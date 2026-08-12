import test from 'node:test';
import assert from 'node:assert/strict';
import { chmod, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

function cleanReport() {
  return {
    auditReportVersion: 2,
    vulnerabilities: {},
    metadata: {
      vulnerabilities: {
        info: 0,
        low: 0,
        moderate: 0,
        high: 0,
        critical: 0,
        total: 0,
      },
      dependencies: {
        prod: 5,
        dev: 3,
        optional: 1,
        peer: 0,
        peerOptional: 0,
        total: 9,
      },
    },
  };
}

async function auditProcess({ stdout = '', stderr = '', exitCode = 0, signal } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'afterlight-audit-process-'));
  const executable = join(root, 'fixture-process.mjs');
  const source = [
    '#!/usr/bin/env node',
    `process.stdout.write(Buffer.from(${JSON.stringify(Buffer.from(stdout).toString('base64'))}, 'base64'));`,
    `process.stderr.write(Buffer.from(${JSON.stringify(Buffer.from(stderr).toString('base64'))}, 'base64'));`,
    signal
      ? `process.kill(process.pid, ${JSON.stringify(signal)});`
      : `process.exit(${exitCode});`,
    '',
  ].join('\n');
  await writeFile(executable, source);
  await chmod(executable, 0o755);
  return executable;
}

function runAuditGate(executable) {
  return spawnSync(process.execPath, [
    'tools/check-audit.mjs',
    '--root', '.',
    '--audit-executable', executable,
  ], {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8',
  });
}

test('accepts exact subprocess success with zero advisories', async () => {
  const executable = await auditProcess({ stdout: JSON.stringify(cleanReport()) });
  const result = runAuditGate(executable);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /NPM AUDIT: 0 total/);
});

test('rejects a spawn error', () => {
  const result = runAuditGate('/missing/afterlight-audit-executable');

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /NPM AUDIT: unable to start npm audit/);
});

test('rejects a subprocess terminated by a signal despite clean JSON', async () => {
  const executable = await auditProcess({
    stdout: JSON.stringify(cleanReport()),
    signal: 'SIGTERM',
  });
  const result = runAuditGate(executable);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /NPM AUDIT: subprocess terminated by SIGTERM/);
});

test('rejects a nonzero subprocess exit despite clean JSON', async () => {
  const executable = await auditProcess({
    stdout: JSON.stringify(cleanReport()),
    exitCode: 7,
  });
  const result = runAuditGate(executable);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /NPM AUDIT: subprocess exited with status 7/);
});

test('rejects operational stderr despite clean JSON and exit zero', async () => {
  const operationalError = 'registry authentication failed with hidden details';
  const executable = await auditProcess({
    stdout: JSON.stringify(cleanReport()),
    stderr: operationalError,
  });
  const result = runAuditGate(executable);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /NPM AUDIT: subprocess wrote to stderr/);
  assert.doesNotMatch(result.stderr, new RegExp(operationalError));
});

test('rejects malformed JSON from a successful subprocess', async () => {
  const executable = await auditProcess({ stdout: '{not-json' });
  const result = runAuditGate(executable);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /NPM AUDIT: output was not valid JSON/);
});

test('rejects malformed npm audit schema', async () => {
  const malformed = cleanReport();
  delete malformed.vulnerabilities;
  const executable = await auditProcess({ stdout: JSON.stringify(malformed) });
  const result = runAuditGate(executable);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /NPM AUDIT: report schema was malformed/);
});

test('rejects inconsistent advisory totals', async () => {
  const malformed = cleanReport();
  malformed.metadata.vulnerabilities.total = 1;
  const executable = await auditProcess({ stdout: JSON.stringify(malformed) });
  const result = runAuditGate(executable);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /NPM AUDIT: report schema was malformed/);
});

test('rejects an npm audit error object', async () => {
  const report = cleanReport();
  report.error = {
    code: 'EAUDITERROR',
    summary: 'fixture operational error',
    detail: 'fixture detail',
  };
  const executable = await auditProcess({ stdout: JSON.stringify(report) });
  const result = runAuditGate(executable);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /NPM AUDIT: report contained an audit error/);
  assert.doesNotMatch(result.stderr, /fixture operational error/);
});

test('rejects any advisory from a successful subprocess', async () => {
  const report = cleanReport();
  report.vulnerabilities.fixture = {
    name: 'fixture',
    severity: 'low',
    isDirect: false,
    via: [],
    effects: [],
    range: '*',
    nodes: ['node_modules/fixture'],
    fixAvailable: false,
  };
  report.metadata.vulnerabilities.low = 1;
  report.metadata.vulnerabilities.total = 1;
  const executable = await auditProcess({ stdout: JSON.stringify(report) });
  const result = runAuditGate(executable);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /NPM AUDIT: advisories are not allowed/);
});
