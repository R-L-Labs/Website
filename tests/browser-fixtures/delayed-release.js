const originalFetch = globalThis.fetch.bind(globalThis);
const releasesApi = 'https://api.github.com/repos/Luskish/afterlight-pack/releases?per_page=20';

globalThis.__afterlightDelayedFetch = {
  started: false,
  aborted: false,
  reason: null,
  islandRemoved: false,
};

globalThis.fetch = (input, init) => {
  const url = typeof input === 'string' ? input : input.url;
  if (url !== releasesApi) return originalFetch(input, init);

  globalThis.__afterlightDelayedFetch.started = true;
  return new Promise((_resolve, reject) => {
    init.signal.addEventListener('abort', () => {
      globalThis.__afterlightDelayedFetch.aborted = true;
      globalThis.__afterlightDelayedFetch.reason = init.signal.reason;
      reject(new DOMException('Aborted', 'AbortError'));
    }, { once: true });
  });
};

const unmountTimer = globalThis.setInterval(() => {
  const island = Array.from(document.querySelectorAll('astro-island'))
    .find((candidate) => candidate.getAttribute('component-url')?.includes('AfterlightDownloads'));

  if (globalThis.__afterlightDelayedFetch.started && island) {
    island.dispatchEvent(new Event('astro:unmount'));
    island.remove();
    globalThis.__afterlightDelayedFetch.islandRemoved = true;
    globalThis.clearInterval(unmountTimer);
  }
}, 10);
