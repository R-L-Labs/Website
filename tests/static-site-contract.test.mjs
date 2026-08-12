import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, symlink, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parse } from 'parse5';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const fixtureComponentUrl = '/_astro/FixtureIsland.Abc123.js';
const fixtureRendererUrl = '/_astro/client.Def456.js';
const uncontractedComponentUrl = '/_astro/UncontractedIsland.Ghi789.js';
const uncontractedRendererUrl = '/_astro/client.Jkl012.js';

async function createFixture() {
  const root = await mkdtemp(join(tmpdir(), 'afterlight-static-contract-'));
  const output = join(root, 'dist');
  await mkdir(output);
  await mkdir(join(output, '_astro'));
  await writeFile(join(output, fixtureComponentUrl.slice(1)), 'export default {}\n');
  await writeFile(join(output, fixtureRendererUrl.slice(1)), 'export const renderer = {}\n');
  await writeFile(join(output, uncontractedComponentUrl.slice(1)), 'export default {}\n');
  await writeFile(join(output, uncontractedRendererUrl.slice(1)), 'export const renderer = {}\n');
  await writeFile(
    join(output, 'index.html'),
    `<!doctype html><html><head><title>Fixture</title></head><body><h1>Signal ready</h1><astro-island component-url="${fixtureComponentUrl}" component-export="default" renderer-url="${fixtureRendererUrl}" client="load" opts='{"name":"FixtureIsland","value":true}'></astro-island><astro-island component-url="${uncontractedComponentUrl}" component-export="default" renderer-url="${uncontractedRendererUrl}" client="idle" opts='{"name":"UncontractedIsland","value":true}'></astro-island></body></html>`,
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

function runContractPaths(distDirectory, contractPath) {
  return spawnSync(process.execPath, [
    'tools/check-static-site.mjs',
    '--dist', distDirectory,
    '--contract', contractPath,
  ], {
    cwd: projectRoot,
    encoding: 'utf8',
  });
}

function runContract(root) {
  return runContractPaths(join(root, 'dist'), join(root, 'contract.json'));
}

async function replaceIslandAttribute(root, name, currentValue, nextValue) {
  const output = join(root, 'dist', 'index.html');
  const source = await readFile(output, 'utf8');
  const current = `${name}="${currentValue}"`;
  assert.match(source, new RegExp(current.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  await writeFile(output, source.replace(current, `${name}="${nextValue}"`));
}

async function removeIslandAttribute(root, name, value) {
  const output = join(root, 'dist', 'index.html');
  const source = await readFile(output, 'utf8');
  const current = ` ${name}="${value}"`;
  assert.ok(source.includes(current));
  await writeFile(output, source.replace(current, ''));
}

function generatedIslandAttributes(source, componentName) {
  const document = parse(source);
  const pending = [document];

  while (pending.length > 0) {
    const node = pending.pop();
    if (node.tagName === 'astro-island') {
      const actual = Object.fromEntries((node.attrs ?? []).map(({ name, value }) => [name, value]));
      try {
        if (JSON.parse(actual.opts ?? '{}').name === componentName) return actual;
      } catch {
        continue;
      }
    }
    pending.push(...(node.childNodes ?? []));
  }

  return null;
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

test('rejects a missing component module for an uncontracted Astro island', async () => {
  const root = await createFixture();
  await unlink(join(root, 'dist', uncontractedComponentUrl.slice(1)));
  const result = runContract(root);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /UncontractedIsland component-url does not resolve to a regular file/);
});

test('rejects a missing renderer module for an uncontracted Astro island', async () => {
  const root = await createFixture();
  await unlink(join(root, 'dist', uncontractedRendererUrl.slice(1)));
  const result = runContract(root);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /UncontractedIsland renderer-url does not resolve to a regular file/);
});

for (const moduleFixture of [
  { attribute: 'component-url', value: fixtureComponentUrl },
  { attribute: 'renderer-url', value: fixtureRendererUrl },
]) {
  test(`rejects a required Astro island missing its ${moduleFixture.attribute}`, async () => {
    const root = await createFixture();
    await removeIslandAttribute(root, moduleFixture.attribute, moduleFixture.value);
    const result = runContract(root);

    assert.equal(result.status, 1);
    assert.match(result.stderr, new RegExp(`FixtureIsland ${moduleFixture.attribute} is required`));
  });

  test(`rejects a missing required Astro island ${moduleFixture.attribute} file`, async () => {
    const root = await createFixture();
    await unlink(join(root, 'dist', moduleFixture.value.slice(1)));
    const result = runContract(root);

    assert.equal(result.status, 1);
    assert.match(result.stderr, new RegExp(`FixtureIsland ${moduleFixture.attribute} does not resolve to a regular file`));
  });

  test(`rejects a directory used as a required Astro island ${moduleFixture.attribute}`, async () => {
    const root = await createFixture();
    const modulePath = join(root, 'dist', moduleFixture.value.slice(1));
    await unlink(modulePath);
    await mkdir(modulePath);
    const result = runContract(root);

    assert.equal(result.status, 1);
    assert.match(result.stderr, new RegExp(`FixtureIsland ${moduleFixture.attribute} does not resolve to a regular file`));
  });

  test(`rejects malformed URI encoding in a required Astro island ${moduleFixture.attribute}`, async () => {
    const root = await createFixture();
    const malformed = moduleFixture.attribute === 'component-url'
      ? '/_astro/FixtureIsland.%E0%A4%A.js'
      : '/_astro/client.%E0%A4%A.js';
    await replaceIslandAttribute(root, moduleFixture.attribute, moduleFixture.value, malformed);
    const result = runContract(root);

    assert.equal(result.status, 1);
    assert.match(result.stderr, new RegExp(`FixtureIsland ${moduleFixture.attribute} has malformed URI encoding`));
  });

  test(`rejects encoded parent traversal in a required Astro island ${moduleFixture.attribute}`, async () => {
    const root = await createFixture();
    const traversal = moduleFixture.attribute === 'component-url'
      ? '/_astro/FixtureIsland.x%2f..%2f..%2f..%2foutside-component.js'
      : '/_astro/client.x%2f..%2f..%2f..%2foutside-renderer.js';
    const outsideName = moduleFixture.attribute === 'component-url'
      ? 'outside-component.js'
      : 'outside-renderer.js';
    await writeFile(join(root, outsideName), 'export default {}\n');
    await replaceIslandAttribute(root, moduleFixture.attribute, moduleFixture.value, traversal);
    const result = runContract(root);

    assert.equal(result.status, 1);
    assert.match(result.stderr, new RegExp(`FixtureIsland ${moduleFixture.attribute} contains parent traversal`));
  });

  test(`rejects an external required Astro island ${moduleFixture.attribute}`, async () => {
    const root = await createFixture();
    const external = `https://example.com${moduleFixture.value}`;
    await replaceIslandAttribute(root, moduleFixture.attribute, moduleFixture.value, external);
    const result = runContract(root);

    assert.equal(result.status, 1);
    assert.match(result.stderr, new RegExp(`FixtureIsland ${moduleFixture.attribute} must reference an internal generated JavaScript asset`));
  });

  test(`rejects an in-dist symlink used by a required Astro island ${moduleFixture.attribute}`, async () => {
    const root = await createFixture();
    const modulePath = join(root, 'dist', moduleFixture.value.slice(1));
    const targetName = `${moduleFixture.attribute}-target.js`;
    await writeFile(join(root, 'dist', '_astro', targetName), 'export default {}\n');
    await unlink(modulePath);
    await symlink(targetName, modulePath);
    const result = runContract(root);

    assert.equal(result.status, 1);
    assert.match(result.stderr, new RegExp(`FixtureIsland ${moduleFixture.attribute} must not traverse symlinks`));
  });

  test(`rejects a symlink escape used by a required Astro island ${moduleFixture.attribute}`, async () => {
    const root = await createFixture();
    const modulePath = join(root, 'dist', moduleFixture.value.slice(1));
    const outsidePath = join(root, `${moduleFixture.attribute}-outside.js`);
    await writeFile(outsidePath, 'export default {}\n');
    await unlink(modulePath);
    await symlink(outsidePath, modulePath);
    const result = runContract(root);

    assert.equal(result.status, 1);
    assert.match(result.stderr, new RegExp(`FixtureIsland ${moduleFixture.attribute} escapes dist`));
  });
}

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

test('rejects deleted emitted island modules from a real Astro build', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'afterlight-real-build-contract-'));
  const pristineOutput = join(root, 'pristine');
  const build = spawnSync(join(projectRoot, 'node_modules', '.bin', 'astro'), [
    'build',
    '--outDir', pristineOutput,
  ], {
    cwd: projectRoot,
    encoding: 'utf8',
    env: { ...process.env, NO_COLOR: '1' },
  });
  assert.equal(build.status, 0, `${build.stdout}\n${build.stderr}`);

  const afterlightIsland = generatedIslandAttributes(
    await readFile(join(pristineOutput, 'afterlight', 'index.html'), 'utf8'),
    'AfterlightDownloads',
  );
  const contactIsland = generatedIslandAttributes(
    await readFile(join(pristineOutput, 'contact', 'index.html'), 'utf8'),
    'ContactForm',
  );
  const navbarIsland = generatedIslandAttributes(
    await readFile(join(pristineOutput, 'index.html'), 'utf8'),
    'Navbar',
  );
  const footerIsland = generatedIslandAttributes(
    await readFile(join(pristineOutput, 'index.html'), 'utf8'),
    'Footer',
  );
  assert.ok(afterlightIsland);
  assert.ok(contactIsland);
  assert.ok(navbarIsland);
  assert.ok(footerIsland);
  assert.equal(afterlightIsland['renderer-url'], contactIsland['renderer-url']);
  assert.equal(afterlightIsland['renderer-url'], navbarIsland['renderer-url']);
  assert.equal(afterlightIsland['renderer-url'], footerIsland['renderer-url']);

  const mutations = [
    {
      name: 'AfterlightDownloads component module',
      component: 'AfterlightDownloads',
      attribute: 'component-url',
      url: afterlightIsland['component-url'],
    },
    {
      name: 'ContactForm component module',
      component: 'ContactForm',
      attribute: 'component-url',
      url: contactIsland['component-url'],
    },
    {
      name: 'Navbar component module',
      component: 'Navbar',
      attribute: 'component-url',
      url: navbarIsland['component-url'],
    },
    {
      name: 'Footer component module',
      component: 'Footer',
      attribute: 'component-url',
      url: footerIsland['component-url'],
    },
    {
      name: 'shared Vue renderer module',
      component: 'AfterlightDownloads',
      attribute: 'renderer-url',
      url: afterlightIsland['renderer-url'],
    },
  ];

  for (const mutation of mutations) {
    await context.test(`fails after deleting the ${mutation.name}`, async () => {
      assert.match(mutation.url, /^\/_astro\/[^/]+\.js$/);
      const mutatedOutput = join(root, mutation.attribute, mutation.component);
      await cp(pristineOutput, mutatedOutput, { recursive: true });
      await unlink(join(mutatedOutput, mutation.url.slice(1)));

      const result = runContractPaths(
        mutatedOutput,
        join(projectRoot, 'tests', 'fixtures', 'static-site-contract.json'),
      );
      assert.equal(result.status, 1, `${result.stdout}\n${result.stderr}`);
      assert.match(
        result.stderr,
        new RegExp(`${mutation.component} ${mutation.attribute} does not resolve to a regular file`),
      );
    });
  }
});
