import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PINNED_FALLBACK,
  selectAfterlightRelease,
} from '../src/lib/afterlight-releases.mjs';

const canonicalAssets = [
  'AFTERLIGHT-prism-instance.zip',
  'AFTERLIGHT-curseforge.zip',
  'AFTERLIGHT.mrpack',
];

function release({
  tagName,
  publishedAt,
  draft = false,
  prerelease = false,
  assets = canonicalAssets,
}) {
  return {
    tag_name: tagName,
    name: `AFTERLIGHT ${tagName}`,
    html_url: `https://github.com/Luskish/afterlight-pack/releases/tag/${tagName}`,
    published_at: publishedAt,
    draft,
    prerelease,
    assets: assets.map((name) => ({
      name,
      browser_download_url: `https://downloads.example/${tagName}/${name}`,
    })),
  };
}

test('selects the newest complete published release and preserves prerelease status', () => {
  const selected = selectAfterlightRelease([
    release({
      tagName: 'v1.2.0-draft',
      publishedAt: '2026-08-12T12:00:00Z',
      draft: true,
    }),
    release({
      tagName: 'v1.1.0',
      publishedAt: '2026-08-10T12:00:00Z',
    }),
    release({
      tagName: 'v1.2.0-rc.1',
      publishedAt: '2026-08-11T12:00:00Z',
      prerelease: true,
    }),
  ], PINNED_FALLBACK);

  assert.equal(selected.tag_name, 'v1.2.0-rc.1');
  assert.equal(selected.prerelease, true);
});

test('skips newer releases missing any canonical client archive', () => {
  const selected = selectAfterlightRelease([
    release({
      tagName: 'v1.3.0',
      publishedAt: '2026-08-12T12:00:00Z',
      assets: canonicalAssets.slice(0, 2),
    }),
    release({
      tagName: 'v1.2.0',
      publishedAt: '2026-08-11T12:00:00Z',
    }),
  ], PINNED_FALLBACK);

  assert.equal(selected.tag_name, 'v1.2.0');
});

test('returns the immutable pinned fallback when inventory fails or is incomplete', () => {
  const incompleteInventory = [release({
    tagName: 'v1.3.0',
    publishedAt: '2026-08-12T12:00:00Z',
    assets: ['AFTERLIGHT-prism-instance.zip'],
  })];

  assert.strictEqual(selectAfterlightRelease(undefined, PINNED_FALLBACK), PINNED_FALLBACK);
  assert.strictEqual(selectAfterlightRelease(incompleteInventory, PINNED_FALLBACK), PINNED_FALLBACK);
  assert.equal(Object.isFrozen(PINNED_FALLBACK), true);
  assert.equal(Object.isFrozen(PINNED_FALLBACK.assets), true);
});
