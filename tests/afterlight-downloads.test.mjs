import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, unlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { compileScript, parse } from '@vue/compiler-sfc';
import { createRenderer, nextTick } from 'vue';

import { RELEASE_FAILURE } from '../src/lib/afterlight-portal.mjs';

const componentUrl = new URL('../src/components/AfterlightDownloads.vue', import.meta.url);
const componentPath = fileURLToPath(componentUrl);

async function loadComponentSetup() {
  const source = await readFile(componentUrl, 'utf8');
  const { descriptor, errors } = parse(source, { filename: componentPath });
  assert.deepEqual(errors, []);

  const compiled = compileScript(descriptor, { id: 'afterlight-downloads-test' });
  const generatedPath = join(dirname(componentPath), `.afterlight-downloads-test-${process.pid}.mjs`);

  try {
    await writeFile(generatedPath, compiled.content, 'utf8');
    const component = (await import(`${pathToFileURL(generatedPath).href}?test=${Date.now()}`)).default;
    component.render = () => null;
    return component;
  } finally {
    await unlink(generatedPath).catch(() => {});
  }
}

function createTestRenderer() {
  return createRenderer({
    patchProp() {},
    insert() {},
    remove() {},
    createElement: (type) => ({ type }),
    createText: (text) => ({ text }),
    createComment: (text) => ({ text }),
    setText() {},
    setElementText() {},
    parentNode: () => null,
    nextSibling: () => null,
    querySelector: () => null,
    setScopeId() {},
    insertStaticContent: () => [{}, {}],
  });
}

test('unmount aborts inventory work and blocks terminal component state', async () => {
  const component = await loadComponentSetup();
  const renderer = createTestRenderer();
  const originalWindow = globalThis.window;
  const originalFetch = globalThis.fetch;
  let resolveFetch;
  let requestSignal;
  let app;

  globalThis.window = { setTimeout, clearTimeout };
  globalThis.fetch = async (_url, { signal }) => {
    requestSignal = signal;
    return new Promise((resolve) => { resolveFetch = resolve; });
  };

  try {
    app = renderer.createApp(component);
    app.mount({});
    await nextTick();

    const state = app._instance.setupState;
    assert.equal(state.signalState, 'acquiring');
    assert.equal(state.notice, '');

    app.unmount();
    assert.equal(requestSignal.aborted, true);
    assert.equal(requestSignal.reason, RELEASE_FAILURE.CANCELLED);

    resolveFetch({ ok: true, status: 200, json: async () => [] });
    await new Promise((resolve) => setImmediate(resolve));
    await nextTick();

    assert.equal(state.signalState, 'acquiring');
    assert.equal(state.notice, '');
  } finally {
    app?.unmount();
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
    if (originalFetch === undefined) delete globalThis.fetch;
    else globalThis.fetch = originalFetch;
  }
});
