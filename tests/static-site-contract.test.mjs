import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, symlink, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

async function createFixture() {
  const root = await mkdtemp(join(tmpdir(), 'afterlight-static-contract-'));
  const output = join(root, 'dist');
  await mkdir(output);
  await writeFile(
    join(output, 'index.html'),
    '<!doctype html><html><head><title>Fixture</title></head><body><h1>Signal ready</h1><astro-island component-url="/_astro/FixtureIsland.Abc123.js" component-export="default" renderer-url="/_astro/client.Def456.js" client="load" opts=\'{"name":"FixtureIsland","value":true}\'></astro-island></body></html>',
  );
  await writeFile(join(root, 'contract.json'), JSON.stringify({
    version: 1,
    routes: {
      '/': {
        file: 'index.html',
        title: 'Fixture',
        outline: [{ tag: 'h1', text: 'Signal ready' }],
        requiredElements: [{ tag: 'h1', text: 'Signal ready' }],
        requiredIslands: [{ component: 'FixtureIsland', hydration: 'load' }],
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

test('rejects a required Astro island without client load hydration', async () => {
  const root = await createFixture();
  const output = join(root, 'dist', 'index.html');
  const source = await readFile(output, 'utf8');
  await writeFile(output, source.replace(' client="load"', ''));
  const result = runContract(root);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /FixtureIsland.*client:load/);
});

test('rejects an Astro island whose component URL does not match its required identity', async () => {
  const root = await createFixture();
  const output = join(root, 'dist', 'index.html');
  const source = await readFile(output, 'utf8');
  await writeFile(output, source.replace('/_astro/FixtureIsland.Abc123.js', '/_astro/OtherIsland.Abc123.js'));
  const result = runContract(root);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /FixtureIsland.*component identity/);
});

test('rejects encoded parent traversal even when it reaches an existing file', async () => {
  const root = await createFixture();
  const output = join(root, 'dist', 'index.html');
  const source = await readFile(output, 'utf8');
  await writeFile(join(root, 'outside.html'), '<!doctype html><title>Outside</title>');
  await writeFile(output, source.replace('</body>', '<a href="/..%2foutside.html">Outside</a></body>'));
  const result = runContract(root);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /parent traversal.*\/\.\.%2foutside\.html/i);
});

test('rejects malformed internal URL encoding with a specific diagnostic', async () => {
  const root = await createFixture();
  const output = join(root, 'dist', 'index.html');
  const source = await readFile(output, 'utf8');
  await writeFile(output, source.replace('</body>', '<a href="/%E0%A4%A">Malformed</a></body>'));
  const result = runContract(root);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /malformed internal URL encoding/);
});

test('rejects an internal output symlink that escapes dist', async () => {
  const root = await createFixture();
  const output = join(root, 'dist', 'index.html');
  const outside = join(root, 'outside');
  await mkdir(outside);
  await writeFile(join(outside, 'secret.txt'), 'outside dist\n');
  await symlink(outside, join(root, 'dist', 'escape'));
  const source = await readFile(output, 'utf8');
  await writeFile(output, source.replace('</body>', '<a href="/escape/secret.txt">Escape</a></body>'));
  const result = runContract(root);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /output escapes dist.*\/escape\/secret\.txt/);
});

test('rejects a linked directory that does not contain index html', async () => {
  const root = await createFixture();
  const output = join(root, 'dist', 'index.html');
  await mkdir(join(root, 'dist', 'empty'));
  const source = await readFile(output, 'utf8');
  await writeFile(output, source.replace('</body>', '<a href="/empty">Empty</a></body>'));
  const result = runContract(root);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /broken internal link \/empty from \//);
});

test('accepts an internal link to a regular generated file', async () => {
  const root = await createFixture();
  const output = join(root, 'dist', 'index.html');
  await writeFile(join(root, 'dist', 'asset.txt'), 'generated asset\n');
  const source = await readFile(output, 'utf8');
  await writeFile(output, source.replace('</body>', '<a href="/asset.txt">Asset</a></body>'));
  const result = runContract(root);

  assert.equal(result.status, 0, result.stderr);
});
