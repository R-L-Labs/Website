import test from 'node:test';
import assert from 'node:assert/strict';

import {
  isTrustedAfterlightAssetUrl,
  isTrustedAfterlightReleasePageUrl,
} from '../src/lib/afterlight-releases.mjs';

test('accepts only the matching HTTPS GitHub release page', () => {
  const tagName = 'v1.0.0';

  assert.equal(
    isTrustedAfterlightReleasePageUrl(
      `https://github.com/Luskish/afterlight-pack/releases/tag/${tagName}`,
      tagName,
    ),
    true,
  );

  for (const url of [
    `http://github.com/Luskish/afterlight-pack/releases/tag/${tagName}`,
    `https://github.com/Luskish/other-pack/releases/tag/${tagName}`,
    `https://example.com/Luskish/afterlight-pack/releases/tag/${tagName}`,
    'javascript:alert(1)',
    'not-a-url',
  ]) {
    assert.equal(isTrustedAfterlightReleasePageUrl(url, tagName), false);
  }
});

test('accepts only matching HTTPS GitHub asset download paths', () => {
  const tagName = 'v1.0.0';
  const assetName = 'AFTERLIGHT.mrpack';

  assert.equal(
    isTrustedAfterlightAssetUrl(
      `https://github.com/Luskish/afterlight-pack/releases/download/${tagName}/${assetName}`,
      tagName,
      assetName,
    ),
    true,
  );

  for (const url of [
    `http://github.com/Luskish/afterlight-pack/releases/download/${tagName}/${assetName}`,
    `https://github.com/Luskish/afterlight-pack/releases/download/other/${assetName}`,
    `https://github.com/Luskish/afterlight-pack/releases/download/${tagName}/other.zip`,
    `https://github.com/Other/afterlight-pack/releases/download/${tagName}/${assetName}`,
    'not-a-url',
  ]) {
    assert.equal(isTrustedAfterlightAssetUrl(url, tagName, assetName), false);
  }
});
