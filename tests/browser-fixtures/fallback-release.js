const originalFetch = globalThis.fetch.bind(globalThis);
const releasesApi = 'https://api.github.com/repos/Luskish/afterlight-pack/releases?per_page=20';

globalThis.fetch = (input, init) => {
  const url = typeof input === 'string' ? input : input.url;
  if (url === releasesApi) {
    return Promise.reject(new TypeError('Fixture network unavailable'));
  }
  return originalFetch(input, init);
};
