import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

async function createRepository(files) {
  const root = await mkdtemp(join(tmpdir(), 'afterlight-repository-security-'));
  execFileSync('git', ['init', '-q'], { cwd: root });

  for (const [file, contents] of Object.entries(files)) {
    const destination = join(root, file);
    await mkdir(join(destination, '..'), { recursive: true });
    await writeFile(destination, contents);
  }

  execFileSync('git', ['add', '.'], { cwd: root });
  return root;
}

function runSecurityScan(root) {
  return spawnSync(process.execPath, [
    'tools/check-repository-security.mjs',
    '--root', root,
  ], {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8',
  });
}

test('accepts clean tracked repository content', async () => {
  const root = await createRepository({
    'src/index.js': 'console.log("signal ready");\n',
    '.env.example': 'PUBLIC_SERVICE_ID=your_service_id_here\n',
  });
  const result = runSecurityScan(root);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /REPOSITORY SECURITY: ALL GREEN/);
});

test('rejects a tracked U+2014 character with its file and line', async () => {
  const forbiddenPunctuation = String.fromCodePoint(0x2014);
  const root = await createRepository({
    'src/index.js': `console.log("before ${forbiddenPunctuation} after");\n`,
  });
  const result = runSecurityScan(root);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /U\+2014: src\/index\.js:1/);
});

test('rejects tracked credential material without printing the secret', async () => {
  const credential = ['ghp', 'A'.repeat(36)].join('_');
  const root = await createRepository({
    'config.txt': `TOKEN=${credential}\n`,
  });
  const result = runSecurityScan(root);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /SECRET: config\.txt:1 GitHub token/);
  assert.doesNotMatch(result.stderr, new RegExp(credential));
});

test('rejects tracked generated build output', async () => {
  const root = await createRepository({
    'src/index.js': 'console.log("source");\n',
    'dist/index.html': '<!doctype html><title>Generated</title>\n',
  });
  const result = runSecurityScan(root);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /GENERATED OUTPUT: dist\/index\.html/);
});

test('ignores tracked files already deleted from the worktree', async () => {
  const root = await createRepository({
    'tmpclaude-deleted-cwd': '/tmp/deleted\n',
    'src/index.js': 'console.log("source");\n',
  });
  await unlink(join(root, 'tmpclaude-deleted-cwd'));
  const result = runSecurityScan(root);

  assert.equal(result.status, 0, result.stderr);
});
