import test from 'node:test';
import assert from 'node:assert/strict';

import {
  RELEASE_FAILURE,
  copyAddressWithFallback,
  fetchReleaseInventory,
  getReleaseFailureNotice,
} from '../src/lib/afterlight-portal.mjs';

const releasesUrl = 'https://api.github.com/repos/Luskish/afterlight-pack/releases?per_page=20';

function abortableFetch(_url, { signal }) {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }

    signal.addEventListener('abort', () => {
      reject(new DOMException('Aborted', 'AbortError'));
    }, { once: true });
  });
}

test('classifies HTTP failures without parsing the response body', async () => {
  const result = await fetchReleaseInventory({
    fetchImpl: async () => ({ ok: false, status: 503, json: async () => [] }),
    url: releasesUrl,
    signal: new AbortController().signal,
  });

  assert.deepEqual(result, { ok: false, reason: RELEASE_FAILURE.HTTP });
});

test('classifies invalid JSON responses', async () => {
  const result = await fetchReleaseInventory({
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      json: async () => { throw new SyntaxError('invalid JSON'); },
    }),
    url: releasesUrl,
    signal: new AbortController().signal,
  });

  assert.deepEqual(result, { ok: false, reason: RELEASE_FAILURE.INVALID_JSON });
});

test('classifies malformed top-level release responses', async () => {
  const result = await fetchReleaseInventory({
    fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ releases: [] }) }),
    url: releasesUrl,
    signal: new AbortController().signal,
  });

  assert.deepEqual(result, { ok: false, reason: RELEASE_FAILURE.MALFORMED_RESPONSE });
});

test('classifies timeout cancellation separately from network failure', async () => {
  const controller = new AbortController();
  const pending = fetchReleaseInventory({
    fetchImpl: abortableFetch,
    url: releasesUrl,
    signal: controller.signal,
  });

  controller.abort(RELEASE_FAILURE.TIMEOUT);

  assert.deepEqual(await pending, { ok: false, reason: RELEASE_FAILURE.TIMEOUT });
});

test('returns cancellation without terminal inventory when unmount aborts', async () => {
  const controller = new AbortController();
  const pending = fetchReleaseInventory({
    fetchImpl: abortableFetch,
    url: releasesUrl,
    signal: controller.signal,
  });

  controller.abort(RELEASE_FAILURE.CANCELLED);

  assert.deepEqual(await pending, { ok: false, reason: RELEASE_FAILURE.CANCELLED });
});

test('provides distinct truthful fallback notices', () => {
  const tagName = 'v0.9.0-rc.2';

  assert.match(getReleaseFailureNotice(RELEASE_FAILURE.TIMEOUT, tagName), /timed out/i);
  assert.match(getReleaseFailureNotice(RELEASE_FAILURE.HTTP, tagName), /returned an error/i);
  assert.match(getReleaseFailureNotice(RELEASE_FAILURE.INVALID_JSON, tagName), /unreadable data/i);
  assert.match(getReleaseFailureNotice(RELEASE_FAILURE.MALFORMED_RESPONSE, tagName), /invalid inventory/i);
  assert.match(getReleaseFailureNotice(RELEASE_FAILURE.NETWORK, tagName), /could not be reached/i);
});

test('selects the visible address when both clipboard methods fail', async () => {
  const field = {
    focused: false,
    selected: false,
    focus() { this.focused = true; },
    select() { this.selected = true; },
  };
  const temporaryNodes = new Set();
  const document = {
    body: {
      appendChild(node) { temporaryNodes.add(node); },
    },
    createElement() {
      return {
        style: {},
        select() {},
        remove() { temporaryNodes.delete(this); },
      };
    },
    execCommand() {
      throw new Error('legacy copy denied');
    },
  };

  const outcome = await copyAddressWithFallback({
    address: '104.128.55.166',
    clipboard: { writeText: async () => { throw new Error('clipboard denied'); } },
    document,
    field,
  });

  assert.deepEqual(outcome, {
    copied: false,
    buttonLabel: 'Address selected',
    status: 'Clipboard access is unavailable. The server address is selected; copy it manually.',
  });
  assert.equal(field.focused, true);
  assert.equal(field.selected, true);
  assert.equal(temporaryNodes.size, 0);
});
