<template>
  <div :class="['signal-system', `signal-${signalState}`]">
    <img
      class="relay-background"
      src="/afterlight/signal-reliquary.webp"
      alt=""
      width="1600"
      height="900"
      aria-hidden="true"
    />

    <svg class="signal-trace signal-trace-desktop" viewBox="0 0 1200 1600" preserveAspectRatio="none" aria-hidden="true">
      <path class="trace-shadow" d="M790 360H550V450H520M82 790V835H50V1035H190V1060M190 1035H600V1060M600 1035H1010V1060" />
      <path class="trace-line trace-origin" pathLength="1" d="M790 360H550V450H520" />
      <path class="trace-line trace-trunk" pathLength="1" d="M82 790V835H50V1035H190V1060" />
      <path class="trace-line trace-branch" pathLength="1" d="M190 1035H600V1060" />
      <path class="trace-line trace-branch" pathLength="1" d="M600 1035H1010V1060" />
      <circle cx="790" cy="360" r="7" />
      <circle cx="520" cy="450" r="7" />
      <circle cx="82" cy="790" r="7" />
      <circle cx="190" cy="1060" r="7" />
      <circle cx="600" cy="1060" r="7" />
      <circle cx="1010" cy="1060" r="7" />
    </svg>

    <svg class="signal-trace signal-trace-mobile" viewBox="0 0 400 2500" preserveAspectRatio="none" aria-hidden="true">
      <path class="trace-shadow" d="M200 520V740H30V1060H52V1300H30V1550H52V1800" />
      <path class="trace-line trace-origin" pathLength="1" d="M200 520V740H30V1060H52V1300H30V1550H52V1800" />
      <circle cx="200" cy="520" r="6" />
      <circle cx="30" cy="740" r="6" />
      <circle cx="52" cy="1060" r="6" />
      <circle cx="52" cy="1300" r="6" />
      <circle cx="52" cy="1800" r="6" />
    </svg>

    <section class="portal-hero" aria-labelledby="afterlight-title">
      <div class="hero-grid">
        <header class="hero-copy">
          <p class="signal-label">R&amp;L LABS / PUBLIC RELAY 04</p>
          <h1 id="afterlight-title">AFTERLIGHT</h1>
          <p class="hero-deck">
            A story-driven Minecraft expedition through lost infrastructure, guided automation, and the machine that remembers.
          </p>
          <p class="system-spec">NEOFORGE 1.21.1&nbsp;&nbsp;/&nbsp;&nbsp;JAVA 21&nbsp;&nbsp;/&nbsp;&nbsp;PRIVATE SERVER</p>
        </header>

        <figure class="echo-figure">
          <div class="echo-frame">
            <img
              src="/afterlight/echo-device.png"
              alt="ECHO, a dark stone signal device with a cyan and amber route displayed on its screen"
              width="760"
              height="760"
            />
          </div>
          <figcaption>ECHO / SIGNAL ORIGIN</figcaption>
        </figure>

        <section class="release-console" aria-labelledby="release-state-title">
          <header class="console-heading">
            <div>
              <p class="console-label">RELEASE STATE</p>
              <h2 id="release-state-title">{{ stateTitle }}</h2>
            </div>
            <span class="state-indicator" aria-hidden="true"></span>
          </header>

          <p v-if="notice" class="release-notice" role="status">
            {{ notice }}
          </p>

          <dl class="release-facts" aria-live="polite">
            <div>
              <dt>Version</dt>
              <dd>{{ release.tag_name }}</dd>
            </div>
            <div>
              <dt>Published</dt>
              <dd>{{ publicationDate }}</dd>
            </div>
            <div>
              <dt>Channel</dt>
              <dd>{{ release.prerelease ? 'Prerelease' : 'Stable' }}</dd>
            </div>
          </dl>

          <div class="release-records">
            <a v-if="checksumAsset" :href="checksumAsset.browser_download_url">SHA256SUMS</a>
            <span v-else class="missing-record">SHA256SUMS unavailable</span>
            <a :href="release.html_url" target="_blank" rel="noreferrer noopener">Release notes</a>
          </div>

          <div class="server-node">
            <div>
              <p class="console-label">SERVER ADDRESS</p>
              <code id="server-address">{{ serverAddress }}</code>
            </div>
            <button type="button" aria-describedby="server-copy-status" @click="copyServerAddress">
              {{ copyButtonLabel }}
            </button>
            <p id="server-copy-status" class="copy-status" aria-live="polite">{{ copyStatus }}</p>
          </div>
        </section>
      </div>
    </section>

    <section class="download-deck" aria-labelledby="launcher-bays-title">
      <header class="deck-heading">
        <div>
          <p class="signal-label">VERIFIED OUTPUT / THREE PATHS</p>
          <h2 id="launcher-bays-title">Choose your launcher bay</h2>
        </div>
        <p>Use the archive built for your launcher. Each available button points directly to the selected GitHub release asset.</p>
      </header>

      <div class="launcher-bays">
        <article v-for="bay in launcherBays" :key="bay.id" :class="['launcher-bay', `bay-${bay.id}`]">
          <header>
            <p class="bay-code">{{ bay.code }}</p>
            <h3>{{ bay.name }}</h3>
            <span v-if="bay.recommended" class="recommended-mark">Recommended path</span>
          </header>
          <p>{{ bay.description }}</p>
          <a
            v-if="bay.asset"
            class="download-action"
            :href="bay.asset.browser_download_url"
            :aria-label="`${bay.action} for ${release.tag_name}`"
          >
            {{ bay.action }}
            <span aria-hidden="true">↓</span>
          </a>
          <div v-else class="unavailable-action" role="note">
            Not included in pinned release
          </div>
          <p class="asset-name">{{ bay.assetName }}</p>
        </article>
      </div>
    </section>

    <section class="procedures" aria-label="Installation and server procedures">
      <article>
        <p class="procedure-code">PROCEDURE / UPDATE</p>
        <h2>Stay on the signal</h2>
        <ol>
          <li>Import the Prism archive once as a new instance.</li>
          <li>Launch that instance normally.</li>
          <li>Packwiz checks the stable GitHub Pages channel every launch and applies approved updates before Minecraft starts.</li>
        </ol>
      </article>
      <article>
        <p class="procedure-code">PROCEDURE / SERVER</p>
        <h2>Join the Far Relay</h2>
        <ol>
          <li>Launch the same AFTERLIGHT release used by the server.</li>
          <li>Open Multiplayer, then add a server.</li>
          <li>Use <code>{{ serverAddress }}</code> as the address.</li>
        </ol>
      </article>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { PINNED_FALLBACK, selectAfterlightRelease } from '../lib/afterlight-releases.mjs';

const releasesApi = 'https://api.github.com/repos/Luskish/afterlight-pack/releases?per_page=20';
const serverAddress = '104.128.55.166';
const release = ref(PINNED_FALLBACK);
const signalState = ref('acquiring');
const notice = ref('');
const copyStatus = ref('');
const copyButtonLabel = ref('Copy address');

const stateTitle = computed(() => {
  if (signalState.value === 'live') return 'Live release verified';
  if (signalState.value === 'fault') return 'Release record fault';
  if (signalState.value === 'fallback') return 'Pinned release active';
  return 'Acquiring release inventory';
});

const publicationDate = computed(() => {
  const published = new Date(release.value.published_at);
  return Number.isNaN(published.getTime())
    ? 'Unknown'
    : new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(published);
});

const checksumAsset = computed(() => release.value.assets.find((asset) => asset.name === 'SHA256SUMS'));

const launcherBays = computed(() => [
  {
    id: 'prism',
    code: 'BAY 01 / MANAGED',
    name: 'Prism Launcher',
    recommended: true,
    assetName: 'AFTERLIGHT-prism-instance.zip',
    asset: release.value.assets.find((asset) => asset.name === 'AFTERLIGHT-prism-instance.zip'),
    action: 'Download Prism ZIP',
    description: 'Import once. Packwiz checks the stable GitHub Pages channel every launch, keeping the instance aligned with approved updates.',
  },
  {
    id: 'curseforge',
    code: 'BAY 02 / PROFILE',
    name: 'CurseForge',
    recommended: false,
    assetName: 'AFTERLIGHT-curseforge.zip',
    asset: release.value.assets.find((asset) => asset.name === 'AFTERLIGHT-curseforge.zip'),
    action: 'Download CurseForge ZIP',
    description: 'For each update, import the newest ZIP as a separate profile. Existing CurseForge profiles do not update in place.',
  },
  {
    id: 'mrpack',
    code: 'BAY 03 / MANUAL',
    name: 'Compatible launchers',
    recommended: false,
    assetName: 'AFTERLIGHT.mrpack',
    asset: release.value.assets.find((asset) => asset.name === 'AFTERLIGHT.mrpack'),
    action: 'Download mrpack',
    description: 'Use the mrpack as the manual fallback for launchers that support the Modrinth pack format.',
  },
]);

async function loadReleaseInventory() {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 6000);

  try {
    const response = await fetch(releasesApi, {
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`GitHub releases returned ${response.status}`);
    }

    const releases = await response.json();
    if (!Array.isArray(releases)) {
      throw new TypeError('GitHub releases response was not an array');
    }

    const selected = selectAfterlightRelease(releases, PINNED_FALLBACK);
    release.value = selected;

    if (selected === PINNED_FALLBACK) {
      signalState.value = 'fallback';
      notice.value = `The live inventory does not contain all three launcher archives. Serving pinned known-good ${PINNED_FALLBACK.tag_name}.`;
      return;
    }

    if (!selected.assets.some((asset) => asset.name === 'SHA256SUMS')) {
      signalState.value = 'fault';
      notice.value = 'The release archives are complete, but the checksum record is unavailable. Verify the release page before installing.';
      return;
    }

    signalState.value = 'live';
  } catch {
    release.value = PINNED_FALLBACK;
    signalState.value = 'fallback';
    notice.value = `The live release service did not answer. Serving pinned known-good ${PINNED_FALLBACK.tag_name}.`;
  } finally {
    window.clearTimeout(timeout);
  }
}

async function copyServerAddress() {
  try {
    await navigator.clipboard.writeText(serverAddress);
    copyButtonLabel.value = 'Copied';
    copyStatus.value = `${serverAddress} copied to clipboard.`;
  } catch {
    const textArea = document.createElement('textarea');
    textArea.value = serverAddress;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.select();
    const copied = document.execCommand('copy');
    textArea.remove();

    copyButtonLabel.value = copied ? 'Copied' : 'Select address';
    copyStatus.value = copied
      ? `${serverAddress} copied to clipboard.`
      : 'Copy is unavailable. Select the server address and copy it manually.';
  }
}

onMounted(loadReleaseInventory);
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');

.signal-system {
  --vault: #070a0b;
  --basalt: #151a1c;
  --smoked: #16262a;
  --cyan: #53e4de;
  --amber: #e4a84b;
  --fault: #d85a52;
  --bone: #d9d0be;
  --muted: #938f84;
  --signal: var(--cyan);
  position: relative;
  isolation: isolate;
  overflow: hidden;
  color: var(--bone);
  background: var(--vault);
  font-family: 'Inter', sans-serif;
}

.signal-system.signal-fallback {
  --signal: var(--amber);
}

.signal-system.signal-fault {
  --signal: var(--fault);
}

.signal-system section {
  padding: 0;
}

.relay-background {
  position: absolute;
  z-index: -2;
  inset: 0 0 auto;
  width: 100%;
  height: 820px;
  object-fit: cover;
  object-position: center top;
  opacity: 0.32;
  filter: saturate(0.72) contrast(1.08);
}

.signal-system::before {
  content: '';
  position: absolute;
  z-index: -1;
  inset: 0 0 auto;
  height: 860px;
  background: linear-gradient(90deg, rgba(7, 10, 11, 0.94) 0%, rgba(7, 10, 11, 0.76) 44%, rgba(7, 10, 11, 0.22) 75%, rgba(7, 10, 11, 0.82) 100%), linear-gradient(180deg, transparent 48%, var(--vault) 100%);
  pointer-events: none;
}

.signal-trace {
  position: absolute;
  z-index: 1;
  inset: 0;
  width: 100%;
  height: 1600px;
  color: var(--signal);
  pointer-events: none;
}

.signal-trace path,
.signal-trace circle {
  fill: currentColor;
  stroke: currentColor;
  transition: color 280ms ease;
}

.signal-trace .trace-shadow {
  fill: none;
  stroke: currentColor;
  stroke-width: 4;
  stroke-linecap: square;
  stroke-linejoin: miter;
  opacity: 0.32;
}

.signal-trace .trace-line {
  fill: none;
  stroke-width: 2.5;
  stroke-linecap: square;
  stroke-linejoin: miter;
  opacity: 0;
  animation: acquire-signal 650ms cubic-bezier(0.65, 0, 0.35, 1) 180ms forwards;
}

.signal-trace .trace-trunk {
  animation-delay: 700ms;
}

.signal-trace .trace-branch {
  animation-delay: 1120ms;
}

.signal-trace-mobile {
  display: none;
}

.signal-trace-desktop {
  z-index: 4;
  opacity: 0.78;
}

.portal-hero {
  position: relative;
  z-index: 2;
  min-height: 820px;
}

.hero-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.02fr) minmax(360px, 0.98fr);
  grid-template-areas:
    'copy echo'
    'release echo';
  gap: 2rem 4rem;
  max-width: 1280px;
  min-height: 820px;
  margin: 0 auto;
  padding: 5.5rem 2rem 4rem;
}

.hero-copy {
  grid-area: copy;
  align-self: end;
  max-width: 680px;
}

.signal-label,
.console-label,
.bay-code,
.procedure-code,
.system-spec,
.asset-name,
.echo-figure figcaption {
  font-family: 'IBM Plex Mono', 'SFMono-Regular', Consolas, monospace;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.signal-label,
.console-label,
.procedure-code,
.echo-figure figcaption {
  color: var(--signal);
}

.signal-label {
  margin-bottom: 1.25rem;
  font-size: 0.72rem;
  font-weight: 600;
}

.hero-copy h1 {
  margin: 0;
  color: var(--bone);
  font-family: 'Cinzel', Georgia, serif;
  font-size: clamp(3.4rem, 8vw, 7rem);
  font-weight: 600;
  letter-spacing: 0.055em;
  line-height: 0.92;
  text-shadow: 0 2px 0 #000;
}

.hero-deck {
  max-width: 620px;
  margin: 2rem 0 1.5rem;
  color: #eee5d3;
  font-size: clamp(1.05rem, 1.8vw, 1.35rem);
  line-height: 1.65;
}

.system-spec {
  color: var(--muted);
  font-size: 0.69rem;
  line-height: 1.8;
}

.echo-figure {
  grid-area: echo;
  position: relative;
  align-self: center;
  margin: 0;
}

.echo-frame {
  position: relative;
  max-width: 620px;
  margin: 0 auto;
}

.echo-frame::before,
.echo-frame::after {
  content: '';
  position: absolute;
  z-index: 2;
  width: 72px;
  height: 72px;
  border-color: var(--signal);
  border-style: solid;
  pointer-events: none;
}

.echo-frame::before {
  top: 8%;
  right: 7%;
  border-width: 2px 2px 0 0;
}

.echo-frame::after {
  bottom: 7%;
  left: 8%;
  border-width: 0 0 2px 2px;
}

.echo-frame img {
  display: block;
  width: 100%;
  height: auto;
  filter: contrast(1.04) drop-shadow(0 28px 30px rgba(0, 0, 0, 0.54));
}

.echo-figure figcaption {
  position: absolute;
  right: 5%;
  bottom: 3%;
  padding: 0.5rem 0.65rem;
  border: 1px solid color-mix(in srgb, var(--signal) 48%, transparent);
  background: rgba(7, 10, 11, 0.9);
  font-size: 0.62rem;
}

.release-console {
  grid-area: release;
  position: relative;
  z-index: 3;
  align-self: start;
  max-width: 670px;
  padding: 1.5rem;
  border: 1px solid color-mix(in srgb, var(--signal) 52%, #283033);
  background: rgba(21, 26, 28, 0.96);
  box-shadow: 0 18px 45px rgba(0, 0, 0, 0.34);
  clip-path: polygon(0 14px, 14px 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%);
}

.console-heading {
  display: flex;
  gap: 1rem;
  align-items: flex-start;
  justify-content: space-between;
  padding-bottom: 1rem;
  border-bottom: 1px solid #30383b;
}

.console-label {
  margin: 0 0 0.35rem;
  font-size: 0.64rem;
  font-weight: 600;
}

.console-heading h2 {
  margin: 0;
  color: var(--bone);
  font-size: clamp(1.15rem, 2vw, 1.45rem);
  letter-spacing: -0.01em;
}

.state-indicator {
  width: 12px;
  height: 12px;
  margin-top: 0.35rem;
  flex: 0 0 auto;
  border: 2px solid var(--vault);
  outline: 1px solid var(--signal);
  background: var(--signal);
}

.release-notice {
  margin: 1rem 0 0;
  padding: 0.8rem 1rem;
  border-left: 3px solid var(--signal);
  color: #e8dcc5;
  background: color-mix(in srgb, var(--signal) 9%, var(--vault));
  font-size: 0.88rem;
  line-height: 1.55;
}

.release-facts {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0;
  margin: 1.25rem 0 0;
  border: 1px solid #30383b;
  background: var(--smoked);
}

.release-facts div {
  min-width: 0;
  padding: 0.85rem 0.9rem;
  border-right: 1px solid #30383b;
}

.release-facts div:last-child {
  border-right: 0;
}

.release-facts dt,
.release-facts dd {
  font-family: 'IBM Plex Mono', 'SFMono-Regular', Consolas, monospace;
}

.release-facts dt {
  margin-bottom: 0.25rem;
  color: var(--muted);
  font-size: 0.59rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.release-facts dd {
  overflow-wrap: anywhere;
  color: var(--bone);
  font-size: 0.76rem;
}

.release-records {
  display: flex;
  flex-wrap: wrap;
  gap: 0.8rem 1.4rem;
  margin-top: 1rem;
}

.release-records a,
.missing-record {
  color: var(--signal);
  font-family: 'IBM Plex Mono', 'SFMono-Regular', Consolas, monospace;
  font-size: 0.7rem;
  text-underline-offset: 0.24em;
}

.missing-record {
  color: var(--fault);
}

.server-node {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.5rem 1rem;
  align-items: end;
  margin-top: 1.25rem;
  padding-top: 1.15rem;
  border-top: 1px solid #30383b;
}

.server-node code {
  color: var(--bone);
  font-family: 'IBM Plex Mono', 'SFMono-Regular', Consolas, monospace;
  font-size: 1.05rem;
}

.server-node button {
  min-height: 42px;
  padding: 0.65rem 1rem;
  border: 1px solid var(--signal);
  border-radius: 0;
  color: var(--vault);
  background: var(--signal);
  font: 600 0.75rem/1 'IBM Plex Mono', 'SFMono-Regular', Consolas, monospace;
  cursor: pointer;
}

.copy-status {
  grid-column: 1 / -1;
  min-height: 1.2em;
  margin: 0;
  color: var(--muted);
  font-size: 0.75rem;
}

.download-deck {
  position: relative;
  z-index: 2;
  padding: 5rem 2rem 5.5rem !important;
  border-top: 1px solid #2d3537;
  border-bottom: 1px solid #2d3537;
  background: var(--basalt);
}

.deck-heading,
.launcher-bays,
.procedures {
  max-width: 1280px;
  margin-right: auto;
  margin-left: auto;
}

.deck-heading {
  display: grid;
  grid-template-columns: 1fr minmax(280px, 460px);
  gap: 3rem;
  align-items: end;
  margin-bottom: 3rem;
}

.deck-heading h2,
.procedures h2 {
  margin: 0;
  color: var(--bone);
  font-family: 'Cinzel', Georgia, serif;
  font-weight: 600;
}

.deck-heading h2 {
  font-size: clamp(2rem, 4vw, 3.4rem);
}

.deck-heading > p {
  margin: 0;
  color: #bbb4a7;
  line-height: 1.65;
}

.launcher-bays {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.25rem;
}

.launcher-bay {
  --bay-accent: var(--bone);
  position: relative;
  z-index: 3;
  display: flex;
  min-width: 0;
  min-height: 360px;
  padding: 1.6rem;
  flex-direction: column;
  border: 1px solid #3a4244;
  border-top: 3px solid var(--bay-accent);
  background: #0e1213;
  clip-path: polygon(0 12px, 12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%);
}

.launcher-bay::before {
  content: '';
  position: absolute;
  top: 0;
  left: 1.6rem;
  width: 72px;
  height: 3px;
  background: var(--signal);
}

.bay-prism {
  --bay-accent: var(--cyan);
}

.bay-curseforge {
  --bay-accent: var(--amber);
}

.bay-code {
  margin: 0 0 1.25rem;
  color: var(--bay-accent);
  font-size: 0.62rem;
}

.launcher-bay h3 {
  margin: 0;
  color: var(--bone);
  font-size: 1.4rem;
}

.recommended-mark {
  display: block;
  width: fit-content;
  margin-top: 0.7rem;
  padding-left: 0.7rem;
  border-left: 2px solid var(--cyan);
  color: var(--cyan);
  font: 500 0.7rem/1.4 'IBM Plex Mono', 'SFMono-Regular', Consolas, monospace;
  text-transform: uppercase;
}

.launcher-bay > p:not(.asset-name) {
  margin: 1.4rem 0 1.7rem;
  color: #b9b2a5;
  line-height: 1.65;
}

.download-action,
.unavailable-action {
  display: flex;
  width: 100%;
  min-height: 48px;
  margin-top: auto;
  padding: 0.78rem 1rem;
  align-items: center;
  justify-content: space-between;
  border: 1px solid var(--bay-accent);
  border-radius: 0;
  font: 600 0.75rem/1.2 'IBM Plex Mono', 'SFMono-Regular', Consolas, monospace;
}

.download-action {
  color: var(--vault);
  background: var(--bay-accent);
  text-decoration: none;
  transition: color 160ms ease, background 160ms ease;
}

.download-action:hover {
  color: var(--bay-accent);
  background: transparent;
}

.unavailable-action {
  color: #8c877d;
  border-color: #4a4e4e;
  background: #121617;
}

.asset-name {
  margin: 0.75rem 0 0;
  overflow-wrap: anywhere;
  color: #777c7a;
  font-size: 0.58rem;
  line-height: 1.5;
}

.procedures {
  position: relative;
  z-index: 2;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0;
  padding: 5rem 2rem 6rem !important;
}

.procedures article {
  padding: 0 4rem 0 0;
}

.procedures article + article {
  padding: 0 0 0 4rem;
  border-left: 1px solid #343a3c;
}

.procedure-code {
  margin-bottom: 0.8rem;
  font-size: 0.65rem;
}

.procedures h2 {
  font-size: clamp(1.55rem, 3vw, 2.2rem);
}

.procedures ol {
  margin: 1.5rem 0 0;
  padding: 0;
  list-style: none;
  counter-reset: procedure;
}

.procedures li {
  position: relative;
  min-height: 2.2rem;
  margin-bottom: 1rem;
  padding-left: 3rem;
  color: #bdb5a7;
  line-height: 1.6;
  counter-increment: procedure;
}

.procedures li::before {
  content: counter(procedure, decimal-leading-zero);
  position: absolute;
  top: 0.05rem;
  left: 0;
  color: var(--signal);
  font: 500 0.7rem/1.6 'IBM Plex Mono', 'SFMono-Regular', Consolas, monospace;
}

.procedures code {
  color: var(--bone);
  font-family: 'IBM Plex Mono', 'SFMono-Regular', Consolas, monospace;
}

a:focus-visible,
button:focus-visible {
  outline: 3px solid var(--bone);
  outline-offset: 4px;
}

@keyframes acquire-signal {
  to {
    opacity: 1;
  }
}

@media (max-width: 900px) {
  .relay-background {
    height: 690px;
    object-position: 58% top;
    opacity: 0.24;
  }

  .signal-system::before {
    height: 720px;
    background: linear-gradient(180deg, rgba(7, 10, 11, 0.58) 0%, rgba(7, 10, 11, 0.82) 45%, var(--vault) 100%);
  }

  .signal-trace-desktop {
    display: none;
  }

  .signal-trace-mobile {
    display: block;
    z-index: 1;
    height: 2500px;
  }

  .portal-hero,
  .hero-grid {
    min-height: 0;
  }

  .hero-grid {
    grid-template-columns: 1fr;
    grid-template-areas:
      'copy'
      'echo'
      'release';
    gap: 2rem;
    padding-top: 4rem;
  }

  .hero-copy {
    align-self: auto;
  }

  .echo-figure {
    width: min(100%, 560px);
    justify-self: center;
  }

  .release-console {
    width: 100%;
    max-width: none;
    margin-bottom: 3rem;
  }

  .deck-heading {
    grid-template-columns: 1fr;
    gap: 1rem;
  }

  .launcher-bays {
    grid-template-columns: 1fr;
  }

  .launcher-bay {
    min-height: 310px;
  }
}

@media (max-width: 620px) {
  .hero-grid {
    padding: 3rem 1rem 2.5rem;
  }

  .hero-copy h1 {
    font-size: clamp(2.65rem, 15vw, 4.2rem);
    letter-spacing: 0.025em;
  }

  .hero-deck {
    font-size: 1rem;
  }

  .system-spec {
    letter-spacing: 0.08em;
  }

  .release-console {
    padding: 1.15rem;
  }

  .release-facts {
    grid-template-columns: 1fr;
  }

  .release-facts div,
  .release-facts div:last-child {
    border-right: 0;
    border-bottom: 1px solid #30383b;
  }

  .release-facts div:last-child {
    border-bottom: 0;
  }

  .server-node {
    grid-template-columns: 1fr;
    align-items: stretch;
  }

  .server-node button {
    width: 100%;
  }

  .download-deck {
    padding: 3.75rem 1rem 4rem !important;
  }

  .launcher-bay {
    min-height: 0;
    padding: 1.35rem;
  }

  .procedures {
    grid-template-columns: 1fr;
    padding: 4rem 1rem 5rem !important;
  }

  .procedures article,
  .procedures article + article {
    padding: 0;
    border-left: 0;
  }

  .procedures article + article {
    margin-top: 3rem;
    padding-top: 3rem;
    border-top: 1px solid #343a3c;
  }
}

@media (prefers-reduced-motion: reduce) {
  .signal-trace .trace-line {
    stroke-dasharray: none;
    stroke-dashoffset: 0;
    opacity: 1;
    animation: none;
  }

  .signal-trace path,
  .signal-trace circle,
  .download-action {
    transition: none;
  }
}
</style>
