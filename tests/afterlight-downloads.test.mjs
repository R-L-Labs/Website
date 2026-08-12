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

function liveRelease() {
  const tagName = 'v1.0.0';
  const assets = [
    'AFTERLIGHT-prism-instance.zip',
    'AFTERLIGHT-curseforge.zip',
    'AFTERLIGHT.mrpack',
    'SHA256SUMS',
  ];

  return {
    tag_name: tagName,
    name: 'AFTERLIGHT v1.0.0',
    html_url: `https://github.com/Luskish/afterlight-pack/releases/tag/${tagName}`,
    published_at: '2026-08-11T12:00:00Z',
    draft: false,
    prerelease: false,
    assets: assets.map((name) => ({
      name,
      browser_download_url: `https://github.com/Luskish/afterlight-pack/releases/download/${tagName}/${name}`,
    })),
  };
}

async function settleMountedWork() {
  await new Promise((resolve) => setImmediate(resolve));
  await nextTick();
}

test('renders a complete trusted inventory as the live portal state', async () => {
  const component = await loadComponentSetup();
  const renderer = createTestRenderer();
  const originalWindow = globalThis.window;
  const originalFetch = globalThis.fetch;
  let app;

  globalThis.window = { setTimeout, clearTimeout };
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => [liveRelease()],
  });

  try {
    app = renderer.createApp(component);
    app.mount({});
    await settleMountedWork();

    const state = app._instance.setupState;
    assert.equal(state.signalState, 'live');
    assert.equal(state.stateTitle, 'Live release verified');
    assert.equal(state.release.tag_name, 'v1.0.0');
    assert.equal(state.notice, '');
    assert.equal(state.liveAnnouncement, 'Live release v1.0.0 verified.');
    assert.equal(state.launcherBays.filter((bay) => bay.asset).length, 3);
  } finally {
    app?.unmount();
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
    if (originalFetch === undefined) delete globalThis.fetch;
    else globalThis.fetch = originalFetch;
  }
});

test('renders the pinned portal state when live inventory fails', async () => {
  const component = await loadComponentSetup();
  const renderer = createTestRenderer();
  const originalWindow = globalThis.window;
  const originalFetch = globalThis.fetch;
  let app;

  globalThis.window = { setTimeout, clearTimeout };
  globalThis.fetch = async () => { throw new Error('network unavailable'); };

  try {
    app = renderer.createApp(component);
    app.mount({});
    await settleMountedWork();

    const state = app._instance.setupState;
    assert.equal(state.signalState, 'fallback');
    assert.equal(state.stateTitle, 'Pinned release active');
    assert.equal(state.release.tag_name, 'v0.9.0-rc.2');
    assert.match(state.notice, /could not be reached/i);
    assert.equal(state.launcherBays.filter((bay) => bay.asset).length, 1);
  } finally {
    app?.unmount();
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
    if (originalFetch === undefined) delete globalThis.fetch;
    else globalThis.fetch = originalFetch;
  }
});

test('keeps manual copy guidance when clipboard access is denied', async () => {
  const component = await loadComponentSetup();
  const renderer = createTestRenderer();
  const originalWindow = globalThis.window;
  const originalFetch = globalThis.fetch;
  const navigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const originalDocument = globalThis.document;
  const temporaryNodes = new Set();
  const field = {
    focused: false,
    selected: false,
    focus() { this.focused = true; },
    select() { this.selected = true; },
  };
  let app;

  globalThis.window = { setTimeout, clearTimeout };
  globalThis.fetch = async () => { throw new Error('network unavailable'); };
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { clipboard: { writeText: async () => { throw new Error('clipboard denied'); } } },
  });
  globalThis.document = {
    body: { appendChild(node) { temporaryNodes.add(node); } },
    createElement() {
      return {
        style: {},
        select() {},
        remove() { temporaryNodes.delete(this); },
      };
    },
    execCommand() { throw new Error('legacy copy denied'); },
  };

  try {
    app = renderer.createApp(component);
    app.mount({});
    await settleMountedWork();

    const state = app._instance.setupState;
    state.serverAddressField = field;
    await state.copyServerAddress();

    assert.equal(state.copyButtonLabel, 'Address selected');
    assert.equal(state.copyStatus, 'Clipboard access is unavailable. The server address is selected; copy it manually.');
    assert.equal(field.focused, true);
    assert.equal(field.selected, true);
    assert.equal(temporaryNodes.size, 0);
  } finally {
    app?.unmount();
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
    if (originalFetch === undefined) delete globalThis.fetch;
    else globalThis.fetch = originalFetch;
    if (navigatorDescriptor) Object.defineProperty(globalThis, 'navigator', navigatorDescriptor);
    else delete globalThis.navigator;
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
  }
});

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
