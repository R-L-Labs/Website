import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

async function createFixture() {
  const root = await mkdtemp(join(tmpdir(), 'afterlight-static-contract-'));
  const output = join(root, 'dist');
  await mkdir(output);
  await writeFile(join(output, 'index.html'), '<!doctype html><html><head><title>Fixture</title></head><body><h1>Signal ready</h1></body></html>');
  await writeFile(join(root, 'contract.json'), JSON.stringify({
    version: 1,
    routes: {
      '/': {
        file: 'index.html',
        title: 'Fixture',
        outline: [{ tag: 'h1', text: 'Signal ready' }],
        requiredElements: [{ tag: 'h1', text: 'Signal ready' }],
      },
    },
  }));
  return root;
}

function runContract(root) {
  return spawnSync(process.execPath, [
    'tools/check-static-site.mjs',
    '--dist', join(root, 'dist'),
    '--contract', join(root, 'contract.json'),
  ], {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8',
  });
}

test('accepts complete generated output matching the static site contract', async () => {
  const root = await createFixture();
  const result = runContract(root);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /STATIC CONTRACT: 1 route verified/);
});

test('rejects generated HTML routes missing from the contract inventory', async () => {
  const root = await createFixture();
  await mkdir(join(root, 'dist', 'unexpected'));
  await writeFile(join(root, 'dist', 'unexpected', 'index.html'), '<!doctype html><title>Unexpected</title>');
  const result = runContract(root);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /unexpected generated route \/unexpected/);
});

test('rejects broken internal links in generated HTML', async () => {
  const root = await createFixture();
  await writeFile(
    join(root, 'dist', 'index.html'),
    '<!doctype html><html><head><title>Fixture</title></head><body><h1>Signal ready</h1><a href="/missing">Missing</a></body></html>',
  );
  const result = runContract(root);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /broken internal link \/missing from \//);
});

test('rejects a contracted route missing from generated output', async () => {
  const root = await createFixture();
  await unlink(join(root, 'dist', 'index.html'));
  const result = runContract(root);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /STATIC CONTRACT: \/: missing index\.html/);
});
