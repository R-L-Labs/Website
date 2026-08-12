import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, symlink, unlink, writeFile } from 'node:fs/promises';
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

test('rejects a tracked generated path after its worktree file is deleted', async () => {
  const root = await createRepository({
    'tmpclaude-deleted-cwd': '/tmp/deleted\n',
    'src/index.js': 'console.log("source");\n',
  });
  await unlink(join(root, 'tmpclaude-deleted-cwd'));
  const result = runSecurityScan(root);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /GENERATED OUTPUT: tmpclaude-deleted-cwd/);
});

test('rejects a tracked secret path before reading a missing worktree file', async () => {
  const root = await createRepository({
    '.env.local': 'PUBLIC_VALUE=fixture\n',
  });
  await unlink(join(root, '.env.local'));
  const result = runSecurityScan(root);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /SECRET FILE: \.env\.local/);
});

test('rejects a tracked symlink even when its target is missing', async () => {
  const root = await createRepository({
    'src/index.js': 'console.log("source");\n',
  });
  await symlink('missing-target', join(root, 'tracked-link'));
  execFileSync('git', ['add', 'tracked-link'], { cwd: root });
  const result = runSecurityScan(root);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /TRACKED SYMLINK: tracked-link/);
});

test('scans the staged blob instead of a modified worktree file', async () => {
  const root = await createRepository({
    'config.txt': 'PUBLIC_VALUE=clean\n',
  });
  const credential = ['ghp', 'B'.repeat(36)].join('_');
  await writeFile(join(root, 'config.txt'), `TOKEN=${credential}\n`);
  const result = runSecurityScan(root);

  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stderr, new RegExp(credential));
});

test('detects a staged credential even when the worktree copy is clean', async () => {
  const credential = ['ghp', 'C'.repeat(36)].join('_');
  const root = await createRepository({
    'config.txt': `TOKEN=${credential}\n`,
  });
  await writeFile(join(root, 'config.txt'), 'PUBLIC_VALUE=clean\n');
  const result = runSecurityScan(root);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /SECRET: config\.txt:1 GitHub token/);
  assert.doesNotMatch(result.stderr, new RegExp(credential));
});

test('detects U+2014 bytes after NUL bytes in a tracked blob', async () => {
  const punctuation = Buffer.from(String.fromCodePoint(0x2014));
  const root = await createRepository({
    'binary.dat': Buffer.concat([Buffer.from([0, 10]), Buffer.from('before '), punctuation, Buffer.from(' after\n')]),
  });
  const result = runSecurityScan(root);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /U\+2014: binary\.dat:2/);
});

test('detects credential bytes after NUL bytes without printing the value', async () => {
  const credential = ['ASIA', 'D'.repeat(16)].join('');
  const root = await createRepository({
    'binary.dat': Buffer.concat([Buffer.from([0, 10]), Buffer.from(`TOKEN=${credential}\n`)]),
  });
  const result = runSecurityScan(root);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /SECRET: binary\.dat:2 AWS access key/);
  assert.doesNotMatch(result.stderr, new RegExp(credential));
});

test('detects high-confidence credential families without leaking values', async () => {
  const credentials = [
    { name: 'AWS access key', value: ['ASIA', 'E'.repeat(16)].join('') },
    { name: 'Google API key', value: ['AI', 'za', 'F'.repeat(35)].join('') },
    { name: 'npm token', value: ['npm', 'G'.repeat(36)].join('_') },
    { name: 'GitLab token', value: ['glpat', 'H'.repeat(20)].join('-') },
    { name: 'SendGrid API key', value: ['SG', 'I'.repeat(22), 'J'.repeat(43)].join('.') },
    { name: 'OpenAI project key', value: ['sk', 'proj', 'K'.repeat(24)].join('-') },
    { name: 'Stripe live restricted key', value: ['rk', 'live', 'L'.repeat(24)].join('_') },
  ];
  const root = await createRepository({
    'credentials.bin': Buffer.concat([
      Buffer.from([0]),
      Buffer.from(credentials.map(({ value }) => `TOKEN=${value}`).join('\n')),
    ]),
  });
  const result = runSecurityScan(root);

  assert.equal(result.status, 1);
  for (const { name, value } of credentials) {
    assert.match(result.stderr, new RegExp(`SECRET: credentials\\.bin:[0-9]+ ${name}`));
    assert.doesNotMatch(result.stderr, new RegExp(value));
  }
});

test('accepts placeholders and near-misses for credential families', async () => {
  const nearMisses = [
    ['ASIA', 'A'.repeat(15)].join(''),
    ['AI', 'za', 'B'.repeat(34)].join(''),
    ['npm', 'C'.repeat(35)].join('_'),
    ['glpat', 'D'.repeat(19)].join('-'),
    ['SG', 'E'.repeat(21), 'F'.repeat(43)].join('.'),
    ['sk', 'proj', 'G'.repeat(19)].join('-'),
    ['rk', 'live', 'H'.repeat(19)].join('_'),
  ];
  const root = await createRepository({
    '.env.example': 'PUBLIC_EMAILJS_PUBLIC_KEY=your_public_key_here\n',
    'docs/examples.txt': `${nearMisses.join('\n')}\n`,
  });
  const result = runSecurityScan(root);

  assert.equal(result.status, 0, result.stderr);
});
