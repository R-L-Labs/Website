#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

function option(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

const root = resolve(option('--root') ?? '.');
const tracked = spawnSync('git', ['ls-files', '--stage', '-z'], {
  cwd: root,
  encoding: 'utf8',
  maxBuffer: 16 * 1024 * 1024,
});

if (tracked.error || tracked.signal || tracked.status !== 0) {
  console.error('REPOSITORY SECURITY: unable to read the Git index');
  process.exit(2);
}

const trackedEntries = [];
for (const record of tracked.stdout.split('\0').filter(Boolean)) {
  const match = /^(\d{6}) ([0-9a-f]{40,64}) (\d+)\t([\s\S]+)$/.exec(record);
  if (!match) {
    console.error('REPOSITORY SECURITY: malformed Git index record');
    process.exit(2);
  }
  trackedEntries.push({
    mode: match[1],
    object: match[2],
    stage: Number(match[3]),
    file: match[4],
  });
}

const failures = [];
let punctuationCount = 0;
let secretCount = 0;
let generatedCount = 0;
let symlinkCount = 0;

const generatedPatterns = [
  /(^|\/)(?:dist|node_modules|\.astro|\.netlify|coverage)(?:\/|$)/,
  /(^|\/)tmp(?:claude|codex)-[^/]+-(?:cwd|tmp)$/,
  /(^|\/)\.DS_Store$/,
  /\.log$/,
];

const secretPatterns = [
  { name: 'private key', pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/g },
  { name: 'GitHub token', pattern: /\bgh[pousr]_[A-Za-z0-9]{36,255}\b/g },
  { name: 'GitHub fine-grained token', pattern: /\bgithub_pat_[A-Za-z0-9_]{50,255}\b/g },
  { name: 'AWS access key', pattern: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g },
  { name: 'Google API key', pattern: /\bAIza[0-9A-Za-z_-]{35}\b/g },
  { name: 'npm token', pattern: /\bnpm_[A-Za-z0-9]{36}\b/g },
  { name: 'GitLab token', pattern: /\bglpat-[A-Za-z0-9_-]{20}\b/g },
  { name: 'SendGrid API key', pattern: /\bSG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}\b/g },
  { name: 'OpenAI project key', pattern: /\bsk-proj-[A-Za-z0-9_-]{20,}\b/g },
  { name: 'Slack token', pattern: /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/g },
  { name: 'Stripe live secret', pattern: /\bsk_live_[A-Za-z0-9]{20,}\b/g },
  { name: 'Stripe live restricted key', pattern: /\brk_live_[A-Za-z0-9]{20,}\b/g },
];

function lineNumber(bytes, offset) {
  let line = 1;
  for (let index = 0; index < offset; index += 1) {
    if (bytes[index] === 0x0a) line += 1;
  }
  return line;
}

function readBlob(object) {
  const blob = spawnSync('git', ['cat-file', 'blob', object], {
    cwd: root,
    encoding: null,
    maxBuffer: 128 * 1024 * 1024,
  });

  if (blob.error || blob.signal || blob.status !== 0 || !Buffer.isBuffer(blob.stdout)) {
    console.error('REPOSITORY SECURITY: unable to read a tracked Git blob');
    process.exit(2);
  }

  return blob.stdout;
}

function scanPunctuation(file, contents) {
  const forbidden = Buffer.from([0xe2, 0x80, 0x94]);
  let offset = contents.indexOf(forbidden);

  while (offset !== -1) {
    punctuationCount += 1;
    failures.push(`U+2014: ${file}:${lineNumber(contents, offset)}`);
    offset = contents.indexOf(forbidden, offset + forbidden.length);
  }
}

function scanSecrets(file, contents) {
  const text = contents.toString('latin1');

  for (const { name, pattern } of secretPatterns) {
    pattern.lastIndex = 0;
    let match = pattern.exec(text);
    while (match) {
      secretCount += 1;
      failures.push(`SECRET: ${file}:${lineNumber(contents, match.index)} ${name}`);
      if (match[0].length === 0) pattern.lastIndex += 1;
      match = pattern.exec(text);
    }
  }
}

for (const { mode, object, stage, file } of trackedEntries) {
  if (stage !== 0) {
    failures.push(`UNMERGED INDEX ENTRY: ${file}`);
    continue;
  }

  let pathRejected = false;
  if (generatedPatterns.some((pattern) => pattern.test(file))) {
    generatedCount += 1;
    failures.push(`GENERATED OUTPUT: ${file}`);
    pathRejected = true;
  }
  if (/(^|\/)\.env(?:$|\.)/.test(file) && !file.endsWith('.example')) {
    secretCount += 1;
    failures.push(`SECRET FILE: ${file}`);
    pathRejected = true;
  }
  if (pathRejected) continue;

  if (mode === '120000') {
    symlinkCount += 1;
    failures.push(`TRACKED SYMLINK: ${file}`);
    continue;
  }
  if (mode !== '100644' && mode !== '100755') {
    failures.push(`UNAPPROVED INDEX MODE ${mode}: ${file}`);
    continue;
  }

  const contents = readBlob(object);
  scanPunctuation(file, contents);
  scanSecrets(file, contents);
}

if (failures.length > 0) {
  for (const failure of failures) console.error(failure);
  process.exitCode = 1;
} else {
  console.log('REPOSITORY SECURITY: ALL GREEN');
}

console.log(`U+2014 SCAN: ${punctuationCount} tracked occurrences`);
console.log(`SECRET SCAN: ${secretCount} tracked secrets`);
console.log(`GENERATED OUTPUT SCAN: ${generatedCount} tracked artifacts`);
console.log(`SYMLINK SCAN: ${symlinkCount} tracked symlinks`);
