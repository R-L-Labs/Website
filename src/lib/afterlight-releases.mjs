export const REQUIRED_CLIENT_ASSETS = Object.freeze([
  'AFTERLIGHT-prism-instance.zip',
  'AFTERLIGHT-curseforge.zip',
  'AFTERLIGHT.mrpack',
]);

export const PINNED_FALLBACK = Object.freeze({
  tag_name: 'v0.9.0-rc.2',
  name: 'AFTERLIGHT 0.9.0-rc.2',
  html_url: 'https://github.com/Luskish/afterlight-pack/releases/tag/v0.9.0-rc.2',
  published_at: '2026-08-10T17:53:59Z',
  draft: false,
  prerelease: true,
  fallback: true,
  assets: Object.freeze([
    Object.freeze({
      name: 'AFTERLIGHT-prism-instance.zip',
      browser_download_url: 'https://github.com/Luskish/afterlight-pack/releases/download/v0.9.0-rc.2/AFTERLIGHT-prism-instance.zip',
    }),
    Object.freeze({
      name: 'SHA256SUMS',
      browser_download_url: 'https://github.com/Luskish/afterlight-pack/releases/download/v0.9.0-rc.2/SHA256SUMS',
    }),
    Object.freeze({
      name: 'release-metadata.json',
      browser_download_url: 'https://github.com/Luskish/afterlight-pack/releases/download/v0.9.0-rc.2/release-metadata.json',
    }),
  ]),
});

export function selectAfterlightRelease(releases, fallback) {
  if (!Array.isArray(releases)) {
    return fallback;
  }

  return releases
    .filter((release) => {
      if (release?.draft || !Array.isArray(release?.assets)) {
        return false;
      }

      const assetNames = new Set(release.assets.map((asset) => asset?.name));
      return REQUIRED_CLIENT_ASSETS.every((name) => assetNames.has(name));
    })
    .sort((left, right) => Date.parse(right.published_at) - Date.parse(left.published_at))[0]
    ?? fallback;
}
