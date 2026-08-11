#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

function option(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

const input = option('--input');
let output;

if (input) {
  output = await readFile(resolve(input), 'utf8');
} else {
  const audit = spawnSync('npm', ['audit', '--json'], {
    cwd: resolve(option('--root') ?? '.'),
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
  output = audit.stdout;

  if (!output) {
    console.error(audit.stderr || 'NPM AUDIT: npm returned no JSON output');
    process.exit(2);
  }
}

let report;
try {
  report = JSON.parse(output);
} catch {
  console.error('NPM AUDIT: output was not valid JSON');
  process.exit(2);
}

const counts = report.metadata?.vulnerabilities;
const severities = ['info', 'low', 'moderate', 'high', 'critical', 'total'];
if (!counts || severities.some((severity) => !Number.isInteger(counts[severity]) || counts[severity] < 0)) {
  console.error('NPM AUDIT: vulnerability metadata was missing or malformed');
  process.exit(2);
}

console.log(`NPM AUDIT: ${counts.total} total (${counts.low} low, ${counts.moderate} moderate, ${counts.high} high, ${counts.critical} critical)`);

if (counts.total > 0) {
  console.error('NPM AUDIT: advisories are not allowed');
  process.exit(1);
}
