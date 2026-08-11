#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';

function option(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

const root = resolve(option('--root') ?? '.');
const tracked = spawnSync('git', ['ls-files', '-z'], {
  cwd: root,
  encoding: 'utf8',
});

if (tracked.status !== 0) {
  console.error(tracked.stderr || 'REPOSITORY SECURITY: unable to read tracked files');
  process.exit(2);
}

const trackedFiles = tracked.stdout.split('\0').filter(Boolean);
const failures = [];
let punctuationCount = 0;
let secretCount = 0;
let generatedCount = 0;

const generatedPatterns = [
  /(^|\/)(?:dist|node_modules|\.astro|\.netlify|coverage)(?:\/|$)/,
  /(^|\/)tmp(?:claude|codex)-[^/]+-(?:cwd|tmp)$/,
  /(^|\/)\.DS_Store$/,
  /\.log$/,
];

const secretPatterns = [
  { name: 'private key', pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/ },
  { name: 'GitHub token', pattern: /\bgh[pousr]_[A-Za-z0-9]{36,255}\b/ },
  { name: 'GitHub fine-grained token', pattern: /\bgithub_pat_[A-Za-z0-9_]{50,255}\b/ },
  { name: 'AWS access key', pattern: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'Slack token', pattern: /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/ },
  { name: 'Stripe live secret', pattern: /\bsk_live_[A-Za-z0-9]{20,}\b/ },
];

for (const file of trackedFiles) {
  let contents;
  try {
    contents = await readFile(resolve(root, file));
  } catch (error) {
    if (error?.code === 'ENOENT') continue;
    throw error;
  }

  if (generatedPatterns.some((pattern) => pattern.test(file))) {
    generatedCount += 1;
    failures.push(`GENERATED OUTPUT: ${file}`);
  }

  if (/(^|\/)\.env(?:$|\.)/.test(file) && !file.endsWith('.example')) {
    secretCount += 1;
    failures.push(`SECRET FILE: ${file}`);
  }

  if (contents.includes(0)) continue;

  const lines = contents.toString('utf8').split(/\r?\n/);
  for (const [index, line] of lines.entries()) {
    if (line.includes(String.fromCodePoint(0x2014))) {
      punctuationCount += 1;
      failures.push(`U+2014: ${file}:${index + 1}`);
    }

    for (const { name, pattern } of secretPatterns) {
      if (pattern.test(line)) {
        secretCount += 1;
        failures.push(`SECRET: ${file}:${index + 1} ${name}`);
      }
    }
  }
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
