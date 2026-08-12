export const RELEASE_FAILURE = Object.freeze({
  TIMEOUT: 'timeout',
  HTTP: 'http',
  INVALID_JSON: 'invalid-json',
  MALFORMED_RESPONSE: 'malformed-response',
  NETWORK: 'network',
  CANCELLED: 'cancelled',
  INCOMPLETE: 'incomplete',
});

function abortedReason(signal) {
  return signal?.reason === RELEASE_FAILURE.TIMEOUT
    ? RELEASE_FAILURE.TIMEOUT
    : RELEASE_FAILURE.CANCELLED;
}

export async function fetchReleaseInventory({ fetchImpl, url, signal }) {
  let response;

  try {
    response = await fetchImpl(url, {
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      signal,
    });
  } catch {
    return {
      ok: false,
      reason: signal?.aborted ? abortedReason(signal) : RELEASE_FAILURE.NETWORK,
    };
  }

  if (!response || typeof response.ok !== 'boolean' || typeof response.json !== 'function') {
    return { ok: false, reason: RELEASE_FAILURE.MALFORMED_RESPONSE };
  }

  if (!response.ok) {
    return { ok: false, reason: RELEASE_FAILURE.HTTP };
  }

  let releases;
  try {
    releases = await response.json();
  } catch {
    return {
      ok: false,
      reason: signal?.aborted ? abortedReason(signal) : RELEASE_FAILURE.INVALID_JSON,
    };
  }

  return Array.isArray(releases)
    ? { ok: true, releases }
    : { ok: false, reason: RELEASE_FAILURE.MALFORMED_RESPONSE };
}

export function getReleaseFailureNotice(reason, tagName) {
  const reasonCopy = {
    [RELEASE_FAILURE.TIMEOUT]: 'The live release service timed out.',
    [RELEASE_FAILURE.HTTP]: 'The live release service returned an error.',
    [RELEASE_FAILURE.INVALID_JSON]: 'The live release service returned unreadable data.',
    [RELEASE_FAILURE.MALFORMED_RESPONSE]: 'The live release service returned an invalid inventory.',
    [RELEASE_FAILURE.NETWORK]: 'The live release service could not be reached.',
    [RELEASE_FAILURE.INCOMPLETE]: 'The live inventory does not contain a complete verified release.',
  };

  return `${reasonCopy[reason] ?? reasonCopy[RELEASE_FAILURE.NETWORK]} Serving pinned known-good ${tagName}.`;
}

function copiedOutcome(address) {
  return {
    copied: true,
    buttonLabel: 'Copied',
    status: `${address} copied to clipboard.`,
  };
}

export async function copyAddressWithFallback({ address, clipboard, document, field }) {
  try {
    if (typeof clipboard?.writeText !== 'function') {
      throw new TypeError('Clipboard API unavailable');
    }

    await clipboard.writeText(address);
    return copiedOutcome(address);
  } catch {
    let textArea;

    try {
      textArea = document.createElement('textarea');
      textArea.value = address;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();

      if (document.execCommand('copy')) {
        return copiedOutcome(address);
      }
    } catch {
    } finally {
      textArea?.remove();
    }

    field?.focus();
    field?.select();

    return {
      copied: false,
      buttonLabel: 'Address selected',
      status: 'Clipboard access is unavailable. The server address is selected; copy it manually.',
    };
  }
}
