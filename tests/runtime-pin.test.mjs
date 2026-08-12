import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

test('pins Node 22.17.1 consistently for contributors and Netlify', () => {
  const result = spawnSync(process.execPath, [
    'tools/check-runtime-pin.mjs',
    '--root', '.',
  ], {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /RUNTIME PIN: Node 22\.17\.1 verified/);
});
