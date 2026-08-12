#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

function option(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function failOperational(message) {
  console.error(`NPM AUDIT: ${message}`);
  process.exit(2);
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

const executable = option('--audit-executable') ?? 'npm';
const audit = spawnSync(executable, ['audit', '--json'], {
  cwd: resolve(option('--root') ?? '.'),
  encoding: 'utf8',
  maxBuffer: 16 * 1024 * 1024,
});

if (audit.error) {
  failOperational('unable to start npm audit');
}
if (audit.signal) {
  failOperational(`subprocess terminated by ${audit.signal}`);
}
if (audit.status !== 0) {
  failOperational(`subprocess exited with status ${audit.status}`);
}
if (typeof audit.stderr !== 'string' || audit.stderr.trim() !== '') {
  failOperational('subprocess wrote to stderr');
}
if (typeof audit.stdout !== 'string' || audit.stdout.trim() === '') {
  failOperational('npm returned no JSON output');
}

let report;
try {
  report = JSON.parse(audit.stdout);
} catch {
  failOperational('output was not valid JSON');
}

if (!isRecord(report)) {
  failOperational('report schema was malformed');
}
if (Object.hasOwn(report, 'error')) {
  failOperational('report contained an audit error');
}

const counts = report.metadata?.vulnerabilities;
const severities = ['info', 'low', 'moderate', 'high', 'critical', 'total'];
const advisorySeverities = severities.slice(0, -1);
const schemaValid = report.auditReportVersion === 2
  && isRecord(report.vulnerabilities)
  && isRecord(report.metadata)
  && isRecord(counts)
  && severities.every((severity) => Number.isInteger(counts[severity]) && counts[severity] >= 0)
  && counts.total === advisorySeverities.reduce((total, severity) => total + counts[severity], 0);

if (!schemaValid) {
  failOperational('report schema was malformed');
}

console.log(`NPM AUDIT: ${counts.total} total (${counts.low} low, ${counts.moderate} moderate, ${counts.high} high, ${counts.critical} critical)`);

if (counts.total > 0 || Object.keys(report.vulnerabilities).length > 0) {
  console.error('NPM AUDIT: advisories are not allowed');
  process.exit(1);
}
