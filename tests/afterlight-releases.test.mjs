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
  htmlUrl = `https://github.com/Luskish/afterlight-pack/releases/tag/${tagName}`,
  name = `AFTERLIGHT ${tagName}`,
}) {
  return {
    tag_name: tagName,
    name,
    html_url: htmlUrl,
    published_at: publishedAt,
    draft,
    prerelease,
    assets: assets.map((asset) => typeof asset === 'string'
      ? {
        name: asset,
        browser_download_url: `https://github.com/Luskish/afterlight-pack/releases/download/${tagName}/${asset}`,
      }
      : asset),
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

test('rejects releases with invalid publication dates before sorting', () => {
  const selected = selectAfterlightRelease([
    release({
      tagName: 'v2.0.0',
      publishedAt: 'not-a-date',
    }),
    release({
      tagName: 'v1.9.0',
      publishedAt: '2026-08-12T12:00:00Z',
    }),
  ], PINNED_FALLBACK);

  assert.equal(selected.tag_name, 'v1.9.0');
});

test('rejects impossible calendar timestamps before sorting valid releases', () => {
  const selected = selectAfterlightRelease([
    release({
      tagName: 'v2.0.0',
      publishedAt: '2027-02-30T12:00:00Z',
    }),
    release({
      tagName: 'v1.9.0',
      publishedAt: '2027-02-28T12:00:00Z',
    }),
  ], PINNED_FALLBACK);

  assert.equal(selected.tag_name, 'v1.9.0');
});

test('rejects noncanonical GitHub timestamp shapes', () => {
  const invalidTimestamps = [
    '2027-03-01T12:00:00.000Z',
    '2027-03-01T12:00:00+00:00',
  ];

  for (const publishedAt of invalidTimestamps) {
    const selected = selectAfterlightRelease([
      release({ tagName: 'v2.0.0', publishedAt }),
      release({
        tagName: 'v1.9.0',
        publishedAt: '2027-02-28T12:00:00Z',
      }),
    ], PINNED_FALLBACK);

    assert.equal(selected.tag_name, 'v1.9.0');
  }
});

test('rejects malformed release record fields', () => {
  const valid = release({
    tagName: 'v2.0.0',
    publishedAt: '2026-08-12T12:00:00Z',
  });
  const malformed = [
    { ...valid, tag_name: '' },
    { ...valid, name: '' },
    { ...valid, html_url: undefined },
    { ...valid, draft: 0 },
    { ...valid, prerelease: 'false' },
    { ...valid, assets: 'not-an-array' },
  ];

  for (const record of malformed) {
    assert.strictEqual(selectAfterlightRelease([record], PINNED_FALLBACK), PINNED_FALLBACK);
  }
});

test('rejects duplicate canonical asset records', () => {
  const selected = selectAfterlightRelease([
    release({
      tagName: 'v2.0.0',
      publishedAt: '2026-08-12T12:00:00Z',
      assets: [...canonicalAssets, 'AFTERLIGHT-prism-instance.zip'],
    }),
  ], PINNED_FALLBACK);

  assert.strictEqual(selected, PINNED_FALLBACK);
});

test('rejects asset records with missing download URLs', () => {
  const selected = selectAfterlightRelease([
    release({
      tagName: 'v2.0.0',
      publishedAt: '2026-08-12T12:00:00Z',
      assets: [
        { name: 'AFTERLIGHT-prism-instance.zip' },
        ...canonicalAssets.slice(1),
      ],
    }),
  ], PINNED_FALLBACK);

  assert.strictEqual(selected, PINNED_FALLBACK);
});

test('rejects off-repository and unsafe release links', () => {
  const tagName = 'v2.0.0';
  const publishedAt = '2026-08-12T12:00:00Z';
  const unsafeRecords = [
    release({
      tagName,
      publishedAt,
      htmlUrl: `http://github.com/Luskish/afterlight-pack/releases/tag/${tagName}`,
    }),
    release({
      tagName,
      publishedAt,
      htmlUrl: `https://github.com/Other/afterlight-pack/releases/tag/${tagName}`,
    }),
    release({
      tagName,
      publishedAt,
      htmlUrl: 'not-a-url',
    }),
    release({
      tagName,
      publishedAt,
      assets: canonicalAssets.map((assetName, index) => ({
        name: assetName,
        browser_download_url: index === 0
          ? `https://example.com/releases/download/${tagName}/${assetName}`
          : `https://github.com/Luskish/afterlight-pack/releases/download/${tagName}/${assetName}`,
      })),
    }),
  ];

  for (const record of unsafeRecords) {
    assert.strictEqual(selectAfterlightRelease([record], PINNED_FALLBACK), PINNED_FALLBACK);
  }
});
