const originalFetch = globalThis.fetch.bind(globalThis);
const releasesApi = 'https://api.github.com/repos/Luskish/afterlight-pack/releases?per_page=20';
const release = {
  tag_name: 'v1.0.0',
  name: 'AFTERLIGHT v1.0.0',
  html_url: 'https://github.com/Luskish/afterlight-pack/releases/tag/v1.0.0',
  published_at: '2026-08-11T18:00:00Z',
  draft: false,
  prerelease: false,
  assets: [
    'AFTERLIGHT-prism-instance.zip',
    'AFTERLIGHT-curseforge.zip',
    'AFTERLIGHT.mrpack',
    'SHA256SUMS',
  ].map((name) => ({
    name,
    browser_download_url: `https://github.com/Luskish/afterlight-pack/releases/download/v1.0.0/${name}`,
  })),
};

globalThis.fetch = (input, init) => {
  const url = typeof input === 'string' ? input : input.url;
  if (url === releasesApi) {
    return Promise.resolve(new Response(JSON.stringify([release]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
  }
  return originalFetch(input, init);
};
