import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

async function auditFixture(vulnerabilities) {
  const root = await mkdtemp(join(tmpdir(), 'afterlight-audit-gate-'));
  const file = join(root, 'audit.json');
  await writeFile(file, JSON.stringify({ metadata: { vulnerabilities } }));
  return file;
}

function runAuditGate(file) {
  return spawnSync(process.execPath, [
    'tools/check-audit.mjs',
    '--input', file,
  ], {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8',
  });
}

test('accepts parsed npm audit output with zero advisories', async () => {
  const file = await auditFixture({
    info: 0,
    low: 0,
    moderate: 0,
    high: 0,
    critical: 0,
    total: 0,
  });
  const result = runAuditGate(file);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /NPM AUDIT: 0 total/);
});

test('rejects parsed npm audit output containing any advisory', async () => {
  const file = await auditFixture({
    info: 0,
    low: 1,
    moderate: 0,
    high: 0,
    critical: 0,
    total: 1,
  });
  const result = runAuditGate(file);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /NPM AUDIT: advisories are not allowed/);
});
