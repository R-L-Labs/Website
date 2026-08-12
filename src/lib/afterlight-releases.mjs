export const REQUIRED_CLIENT_ASSETS = Object.freeze([
  'AFTERLIGHT-prism-instance.zip',
  'AFTERLIGHT-curseforge.zip',
  'AFTERLIGHT.mrpack',
]);

const RELEASES_PATH = '/Luskish/afterlight-pack/releases';
const TAG_PATTERN = /^[0-9A-Za-z][0-9A-Za-z._-]*$/;
const GITHUB_UTC_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;

export const PINNED_FALLBACK = Object.freeze({
  tag_name: 'v1.0.0-rc.1',
  name: 'AFTERLIGHT 1.0.0-rc.1',
  html_url: 'https://github.com/Luskish/afterlight-pack/releases/tag/v1.0.0-rc.1',
  published_at: '2026-08-12T12:00:00Z',
  draft: false,
  prerelease: true,
  fallback: true,
  assets: Object.freeze([
    Object.freeze({
      name: 'AFTERLIGHT-prism-instance.zip',
      browser_download_url: 'https://github.com/Luskish/afterlight-pack/releases/download/v1.0.0-rc.1/AFTERLIGHT-prism-instance.zip',
    }),
    Object.freeze({
      name: 'AFTERLIGHT-curseforge.zip',
      browser_download_url: 'https://github.com/Luskish/afterlight-pack/releases/download/v1.0.0-rc.1/AFTERLIGHT-curseforge.zip',
    }),
    Object.freeze({
      name: 'AFTERLIGHT.mrpack',
      browser_download_url: 'https://github.com/Luskish/afterlight-pack/releases/download/v1.0.0-rc.1/AFTERLIGHT.mrpack',
    }),
    Object.freeze({
      name: 'SHA256SUMS',
      browser_download_url: 'https://github.com/Luskish/afterlight-pack/releases/download/v1.0.0-rc.1/SHA256SUMS',
    }),
    Object.freeze({
      name: 'release-metadata.json',
      browser_download_url: 'https://github.com/Luskish/afterlight-pack/releases/download/v1.0.0-rc.1/release-metadata.json',
    }),
  ]),
});

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function parseTrustedGithubUrl(value) {
  if (!isNonEmptyString(value)) {
    return null;
  }

  try {
    const url = new URL(value);
    const hasUnexpectedParts = url.protocol !== 'https:'
      || url.hostname !== 'github.com'
      || url.port !== ''
      || url.username !== ''
      || url.password !== ''
      || url.search !== ''
      || url.hash !== '';

    return hasUnexpectedParts ? null : url;
  } catch {
    return null;
  }
}

function isValidTagName(tagName) {
  return isNonEmptyString(tagName) && TAG_PATTERN.test(tagName);
}

function isValidGithubUtcTimestamp(value) {
  if (typeof value !== 'string' || !GITHUB_UTC_TIMESTAMP_PATTERN.test(value)) {
    return false;
  }

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp)
    && new Date(timestamp).toISOString() === `${value.slice(0, -1)}.000Z`;
}

export function isTrustedAfterlightReleasePageUrl(value, tagName) {
  if (!isValidTagName(tagName)) {
    return false;
  }

  const url = parseTrustedGithubUrl(value);
  return url?.pathname === `${RELEASES_PATH}/tag/${encodeURIComponent(tagName)}`;
}

export function isTrustedAfterlightAssetUrl(value, tagName, assetName) {
  if (!isValidTagName(tagName) || !isNonEmptyString(assetName)) {
    return false;
  }

  const url = parseTrustedGithubUrl(value);
  return url?.pathname === `${RELEASES_PATH}/download/${encodeURIComponent(tagName)}/${encodeURIComponent(assetName)}`;
}

function isCompleteRelease(release) {
  if (!isRecord(release)
    || !isValidTagName(release.tag_name)
    || !isNonEmptyString(release.name)
    || typeof release.draft !== 'boolean'
    || typeof release.prerelease !== 'boolean'
    || release.draft
    || !isValidGithubUtcTimestamp(release.published_at)
    || !isTrustedAfterlightReleasePageUrl(release.html_url, release.tag_name)
    || !Array.isArray(release.assets)) {
    return false;
  }

  const assetNames = new Set();
  for (const asset of release.assets) {
    if (!isRecord(asset)
      || !isNonEmptyString(asset.name)
      || assetNames.has(asset.name)
      || !isTrustedAfterlightAssetUrl(asset.browser_download_url, release.tag_name, asset.name)) {
      return false;
    }

    assetNames.add(asset.name);
  }

  return REQUIRED_CLIENT_ASSETS.every((name) => assetNames.has(name));
}

export function selectAfterlightRelease(releases, fallback) {
  if (!Array.isArray(releases)) {
    return fallback;
  }

  return releases
    .filter(isCompleteRelease)
    .sort((left, right) => Date.parse(right.published_at) - Date.parse(left.published_at))[0]
    ?? fallback;
}
