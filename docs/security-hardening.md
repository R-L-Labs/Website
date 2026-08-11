# Website Security Hardening

Date: August 11, 2026

Starting commit: `38461be5bc3c4f1728bafe26e7f41bc5d69f662f`

## Scope

This change hardens the static website toolchain, dependency graph, runtime pinning, repository checks, and pull request CI. It does not change AFTERLIGHT portal behavior, copy, branding, EmailJS behavior, artwork, DNS, or deployment infrastructure.

## Official Migration Review

The migration followed these official sources before dependency edits:

- Astro upgrade overview: <https://docs.astro.build/en/upgrade-astro/>
- Astro 5 to 6 guide: <https://docs.astro.build/en/guides/upgrade-to/v6/>
- Astro 6 to 7 guide: <https://docs.astro.build/en/guides/upgrade-to/v7/>
- Astro Netlify integration: <https://docs.astro.build/en/guides/integrations-guide/netlify/>
- Official npm registry metadata: <https://registry.npmjs.org/>

Migration-sensitive findings:

- Astro 6 requires Node 22 and moves to Vite 7.
- Astro 7 moves to Vite 8 and the Rust compiler, which rejects unclosed tags and no longer repairs invalid markup.
- Astro 7 uses JSX-style whitespace compression by default.
- A fully static Netlify site does not require the Netlify adapter unless it uses server-backed Netlify features.

The pre-migration output contract was recorded and passed against the Astro 5 build before any framework or adapter edit. The same contract passes after the Astro 7 migration.

## Dependency Result

Direct production dependencies:

- `astro@7.2.1`
- `@astrojs/vue@7.0.2`
- `vue@3.5.41`
- `sass@1.102.0`
- `@emailjs/browser@4.4.1`

Direct verification dependencies:

- `parse5@8.0.1`
- `smol-toml@1.8.0`
- `yaml@2.9.0`

Security-sensitive transitive resolutions include `vite@8.2.1`, `sharp@0.35.3`, `picomatch@4.0.5`, and legacy-range `picomatch@2.3.2`. The Netlify adapter and its server tooling are absent from the manifest, lockfile, installed graph, and Astro config.

Audit counts:

- Untouched baseline: 45 total, 3 low, 9 moderate, 32 high, 1 critical.
- Initial Astro 7 lock: 4 total, all high. npm traced these to a stale Vite 6 peer selection plus patchable Picomatch, Rollup, and Sharp resolutions.
- Final lock: 0 total, 0 low, 0 moderate, 0 high, 0 critical.

No advisory waiver exists. The audit gate parses `npm audit --json` and rejects any nonzero total.

## Static Output Contract

`tests/fixtures/static-site-contract.json` records all six routes:

- `/`
- `/projects`
- `/afterlight`
- `/contact`
- `/climb/privacy`
- `/hedgelock/confirm-email`

The checker parses built HTML with Parse5. It rejects missing or unexpected routes, title changes, heading outline drift, missing required elements, altered security attributes, changed fallback launcher semantics, and broken generated `href` or `src` references.

The final contract verifies six routes and 58 generated references. AFTERLIGHT markers include the acquiring state, pinned release facts, trusted release and checksum links, readonly server address, copy control, Prism fallback download, two unavailable fallback bays, and installation procedures.

## TDD Evidence

Representative RED evidence was observed before each implementation:

- Static contract: missing `tools/check-static-site.mjs` produced `MODULE_NOT_FOUND`.
- Route inventory: an unexpected generated route returned status 0 before route discovery was implemented.
- Direct links: a missing internal link returned status 0 before output resolution was implemented.
- Repository scan: clean-fixture test failed for the missing scanner, then the real baseline found three tracked `tmpclaude-*-cwd` artifacts.
- Runtime pin: the test failed for the missing checker before Node metadata was added.
- Audit gate: the advisory fixture returned status 0 before nonzero totals were rejected.
- Dependency migration: the real gate reported 4 high advisories before the in-range lock remediation.
- Workflow parser: the secure fixture failed for the missing checker. Exploit fixtures then returned status 0 before each policy branch was implemented.

Focused GREEN evidence:

- Static contract tests: 4 pass.
- Repository security tests: 5 pass.
- Audit gate tests: 2 pass.
- Runtime pin test: 1 pass.
- Workflow security tests: 20 pass, including attack fixtures.
- Complete Node test suite: 53 pass.

## GitHub Actions Security Review

Reviewed file: `.github/workflows/website-ci.yml`

Trigger classification:

- `pull_request`
- `push` restricted to `main`
- No `pull_request_target`, issue, comment, schedule, dispatch, reusable workflow, or deployment trigger.

Exploit-focused outcome: no exploitable vulnerabilities identified. The workflow was reviewed and cleared.

Reviewed attack paths:

- Pwn request: fork code runs only in the `pull_request` context with `contents: read`; no secrets or write permissions exist.
- Expression injection: no workflow expression appears inside a `run` block.
- Credential theft: no secret, OIDC, environment, deploy key, package token, or persisted checkout credential is available.
- Supply chain: only official `actions/checkout` and `actions/setup-node` are used, both pinned to full 40-character SHAs.
- Runner persistence: only `ubuntu-latest` is allowed. Self-hosted runners are rejected.
- Cache and artifact poisoning: no cache, artifact upload, artifact download, or cross-workflow data path exists.
- Deployment abuse: no deployment permission, environment, deploy command, or publication step exists.

The parsed workflow checker also rejects trigger drift, write permissions, job-level permissions, mutable action refs, third-party actions, secret references, caches, missing verification commands, extra commands, self-hosted runners, disabled cancellation, and deployment environments.

Remote GitHub Actions execution was not attempted because this task forbids pushing. The workflow is validated locally from parsed YAML and exploit fixtures.

## Browser Verification

Production `astro preview` served the static `dist` directory on `127.0.0.1:4321`.

Desktop checks at 1440 by 1000:

- All six routes rendered the expected title and primary heading with no horizontal overflow.
- The reviewed live fixture produced `Live release verified`, version `v1.0.0`, and three trusted launcher downloads.
- Contact rendered one form, four fields, and the existing `Send Message` control.
- Browser error collection was empty.

Mobile checks on an emulated iPhone 12 at 390 by 844:

- All six routes rendered the expected title and primary heading with no horizontal overflow.
- The forced network failure produced `Pinned release active` and the truthful network fallback notice.
- The fallback exposed one Prism download and two unavailable launcher bays.
- The mobile trace was visible while the desktop trace was hidden.
- Reduced motion matched and the trace animation name was `none`.
- Clipboard denial changed the control to `Address selected`, focused the visible address input, selected characters 0 through 14, and announced manual copy guidance.
- Browser error collection was empty.

Delayed fetch unmount used the generated Vue renderer's `astro:unmount` lifecycle event. The browser fixture recorded `started: true`, `islandRemoved: true`, `aborted: true`, and abort reason `cancelled`.

All named browser sessions were closed. `astro preview status` reported no running preview server after cleanup.

## Local Commands

Run the full local verification with:

```bash
npm ci
npm run verify
```

Individual gates:

```bash
npm test
npm run build
npm run check:site
npm run check:runtime
npm run check:workflow
npm run check:security
npm run audit
```

## Remaining Concerns

- The complete future public AFTERLIGHT release still does not exist. The portal correctly remains on its pinned known-good fallback until all canonical release assets exist.
- CI has not run on GitHub because no push was permitted. It must pass in GitHub before merge or deployment.
- No push, merge, deployment, DNS change, or VPS action was performed.
