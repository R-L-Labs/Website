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

## Fix Round 1

Review base: `7471d6ed6f9b2e632830a35a75e5859847490a2e`

Date: August 11, 2026

This round closes every Important and Minor verification bypass from the Task 4 security review. Production Astro pages, Vue components, styles, copy, branding, portal behavior, and EmailJS behavior are unchanged.

### Static Islands and Behavior

The static output contract now requires exactly one `AfterlightDownloads` island on `/afterlight` and exactly one `ContactForm` island on `/contact`. Each generated island must identify the expected component in Astro island options, emit the matching hashed component module, export `default`, and use `client:load`. Removing `client:load`, changing the component module identity, or omitting the island fails the generated-output gate.

Behavioral regression coverage now mounts the real Vue script setup for:

- AFTERLIGHT live inventory selection with three trusted launcher assets.
- Pinned fallback selection after network failure.
- Clipboard denial with visible field focus, selection, and manual copy guidance.
- Delayed fetch cancellation and terminal-state suppression after unmount.
- Contact rejection when required EmailJS configuration is absent.
- Contact success with exact template parameters, success state, and field reset.

### Workflow Semantics

The parsed workflow checker now permits one file, `website-ci.yml`, with one job, `verify`, and one exact ordered sequence of eight required steps. It strictly allowlists workflow, job, step, and action input keys. It rejects:

- Job or step conditions.
- Job or step `continue-on-error`.
- Job or step timeout overrides.
- Environments, services, extra jobs, and extra workflows.
- Missing, reordered, duplicated, renamed, shadowed, or extra gates.
- Mutable action references, unapproved full SHAs, third-party actions, and unapproved `with` keys.
- Checkout ref or token overrides and persisted credentials.
- Setup Node caches or any input other than `.nvmrc`.

Checkout therefore uses the workflow event commit selected by GitHub, with no `ref` override and `persist-credentials: false`.

### Repository Blob Scanning

Repository security checks now parse `git ls-files --stage -z`, enforce index modes, apply path policy before blob reads, and read raw staged objects with `git cat-file blob`. The scanner no longer follows worktree paths.

Tracked symlinks are rejected even when their target is missing. Tracked generated paths and populated environment paths are rejected even when deleted from the worktree. U+2014 and ASCII credential signatures are scanned in raw bytes, including data after NUL bytes.

High-confidence credential families now include GitHub, AWS `AKIA` and `ASIA`, Google API, npm, GitLab, SendGrid, OpenAI project, Slack, Stripe live secret, Stripe live restricted, and private key signatures. Diagnostics contain only path, line, and family, never the matched value. Near-miss and placeholder fixtures remain accepted.

### Audit Process Contract

The audit gate now runs a real subprocess and requires all of these conditions for success:

- No spawn error.
- No terminating signal.
- Exit status exactly zero.
- Empty stderr.
- Nonempty, valid JSON stdout.
- npm audit report version 2 with valid vulnerability objects and exact nonnegative severity counts.
- Severity total equal to the sum of all severity buckets.
- No audit error object.
- Zero advisory records and zero advisory counts.

Executable fixtures cover spawn, signal, nonzero exit, stderr, malformed JSON, malformed schema, inconsistent totals, audit error, advisory, and clean paths without exposing operational stderr.

### Generated Link Containment

Internal references are decoded with explicit error handling before resolution. Encoded or literal parent segments are rejected before URL normalization can hide them. Every candidate must remain lexically beneath `dist`, and its real path must remain beneath the real `dist` root. A valid target must be a regular file, an extension-resolved HTML file, or an `index.html` file inside the target directory. Encoded traversal, malformed encoding, symlink escape, empty directory, broken link, and valid regular-file fixtures cover the boundary.

### Round 1 TDD Evidence

Observed RED evidence before checker edits:

- Island contract: `node --test tests/static-site-contract.test.mjs` reported 4 pass and 2 fail because missing hydration and changed component identity returned status 0.
- Generated links: the expanded static contract run reported 5 pass and 6 fail, including encoded traversal, symlink escape, and bare-directory false accepts.
- Workflow semantics: `node --test tests/workflow-security.test.mjs` reported 13 pass and 21 fail. Conditions, failure suppression, timeout overrides, services, and checkout overrides were accepted by the old checker.
- Repository scanning: `node --test tests/repository-security.test.mjs` reported 5 pass and 8 fail for missing index, symlink, NUL-byte, and temporary AWS key enforcement.
- Audit process: `node --test tests/audit-gate.test.mjs` reported 1 pass and 9 fail because the old gate ignored fixture process outcomes.

Focused GREEN evidence after minimal implementations:

- Static contract: 11 pass.
- Workflow security: 36 pass, including parsed semantic bypass fixtures.
- Repository security: 13 pass.
- Audit gate: 10 pass.
- Real portal and contact component regressions: 6 pass.
- Complete Node suite: 97 pass, 0 fail.

### Round 1 Browser Evidence

Production `astro preview` served `dist` on `127.0.0.1:4321`.

Desktop at 1440 by 1000:

- `/`, `/projects`, `/afterlight`, `/contact`, `/climb/privacy`, and `/hedgelock/confirm-email` rendered expected titles and primary markers without horizontal overflow.
- The live fixture produced `Live release verified`, three launcher downloads, and a hydrated `AfterlightDownloads` island with `client:load`.
- Contact exposed four required fields and a hydrated `ContactForm` island with `client:load`.
- Empty contact submission remained invalid with all four required controls reported invalid.
- Valid fields reached the existing handler and produced `EmailJS is not configured. Please set variables.` with the existing error class.
- Browser page-error collection was empty.

Mobile on emulated iPhone 12 at 390 by 844:

- All six routes rendered expected titles and markers without horizontal overflow.
- Forced release-service failure produced `Pinned release active`, one Prism download, two unavailable launcher bays, and the exact network fallback notice.
- The mobile trace displayed while the desktop trace was hidden.
- Reduced motion matched, trace animation was `none`, and transition duration was `0s`.
- Clipboard denial changed the control to `Address selected`, focused `server-address`, selected characters 0 through 14, and announced manual copy guidance.
- Contact retained four required fields and exact `ContactForm` hydration.
- Browser page-error collection was empty.

The delayed-fetch fixture recorded `started: true`, `islandRemoved: true`, `aborted: true`, and `reason: cancelled` after the real Astro unmount lifecycle event.

All browser sessions were closed. Astro reported no preview server, and port 4321 was not listening after cleanup.

### Round 1 GitHub Actions Review

Exploit-focused outcome: no exploitable vulnerabilities identified. The only workflow remains a `pull_request` and `push` to `main` verification job with `contents: read`. It has no `pull_request_target`, issue or comment trigger, secrets, OIDC, write permission, deployment environment, service container, self-hosted runner, cache, artifact transfer, expression interpolation in `run`, or persisted checkout credential. Both official actions use their exact approved 40-character commits.

An external fork contributor can execute repository code in an ephemeral GitHub-hosted runner, but receives no secret and no credential with write or deploy authority. No complete path exists from attacker-controlled pull request content to repository modification, secret theft, deployment, or persistent runner access.

### Round 1 Dependency and Output Result

Direct versions remain exactly:

- `astro@7.2.1`
- `@astrojs/vue@7.0.2`
- `vue@3.5.41`
- `sass@1.102.0`
- `@emailjs/browser@4.4.1`
- `parse5@8.0.1`
- `smol-toml@1.8.0`
- `yaml@2.9.0`

The production build remains fully static with six routes and 58 generated references. npm audit remains 0 total, 0 low, 0 moderate, 0 high, and 0 critical. The Netlify adapter remains absent, and the previously removed temporary Claude artifacts remain absent.

Remaining concerns are unchanged: the future complete AFTERLIGHT public release does not yet exist, and GitHub-hosted CI has not run because this task forbids pushing. No push, merge, deployment, DNS change, or VPS action occurred.

## Fix Round 2

Review base: `3c4cceaca2db45cd42dbf7d30a590d7d7762c59a`

Date: August 11, 2026

This round closes the single Important finding in `task-4-security-rereview-1.md`. Production pages, Vue components, styles, copy, portal behavior, launcher behavior, branding, dependencies, and EmailJS behavior are unchanged.

### Emitted Island Module Contract

Every contracted `AfterlightDownloads` and `ContactForm` Astro island now validates both `component-url` and `renderer-url` against generated output. Each attribute must:

- Be present and identify a root-relative JavaScript asset below `/_astro/`.
- Decode as a valid URI without a literal or encoded parent segment.
- Resolve lexically beneath `dist`.
- Resolve by real path beneath the real `dist` root.
- Avoid every symlinked path component, including symlinks that remain inside `dist`.
- Resolve to a regular file rather than a missing path, directory, or other file type.

The static fixture now writes real component and renderer modules. Adversarial fixtures independently cover missing attributes, missing files, directories, malformed URI encoding, encoded traversal to existing outside files, external URLs, in-tree symlinks, and symlink escapes for both island attributes.

### Real Build Mutations

The static contract test performs one pristine real Astro production build, parses generated island attributes, proves that AFTERLIGHT and contact share the Vue renderer, and copies the output before each isolated mutation. It then deletes these emitted modules one at a time:

- The `AfterlightDownloads` component module.
- The `ContactForm` component module.
- The shared Vue renderer module.

Each deletion now exits 1 with a component-specific regular-file diagnostic. No mutation reuses output from another mutation.

### Round 2 TDD Evidence

RED, before the checker implementation:

```text
node --test tests/static-site-contract.test.mjs
# tests 31
# pass 11
# fail 20
ROUND2_RED_EXIT=1
```

All three real-build deletion subtests showed the old false accept: `STATIC CONTRACT: 6 routes verified`, `STATIC LINKS: 58 generated references verified`, and subprocess status 0 after the required component or renderer file had been removed.

Focused GREEN after the minimal checker change:

```text
node --test tests/static-site-contract.test.mjs
# tests 31
# pass 31
# fail 0
```

The complete regression run reported 117 pass and 0 fail. The production build remained static at six pages, `check:site` verified all six routes and 58 generated references, and npm audit remained zero at every severity.

### Round 2 Browser Evidence

Production `astro preview` served the final build on `127.0.0.1:4321`.

Desktop at 1440 by 1000:

- `/`, `/projects`, `/afterlight`, `/contact`, `/climb/privacy`, and `/hedgelock/confirm-email` rendered their expected titles and primary headings.
- The live fixture produced `Live release verified`, release `v1.0.0`, and three launcher downloads.
- Clipboard denial changed the control to `Address selected`, selected the complete visible server address, and announced the existing manual-copy guidance.
- Reduced motion matched, trace animation was `none`, and download transition duration was `0s`.
- Empty contact submission remained invalid, focused `name`, and retained four required controls.
- A filled contact submission reached the unchanged handler, returned the existing missing-EmailJS-configuration error, preserved field values, and re-enabled submit.

Mobile iPhone 12 emulation at 390 by 844:

- Forced release-service failure produced `Pinned release active`, pinned release `v0.9.0-rc.2`, one launcher download, and two unavailable launcher bays.
- The exact existing fallback notice remained visible and the page had no horizontal overflow.

The delayed-fetch fixture recorded `started: true`, `islandRemoved: true`, `aborted: true`, `reason: cancelled`, no remaining AFTERLIGHT island, and no terminal portal state. Browser page-error collection was empty for all sessions. Every browser session closed, Astro reported no preview server, and port 4321 stopped listening.

### Preserved Security Posture

Exact direct versions remain `astro@7.2.1`, `@astrojs/vue@7.0.2`, `vue@3.5.41`, `sass@1.102.0`, `@emailjs/browser@4.4.1`, `parse5@8.0.1`, `smol-toml@1.8.0`, and `yaml@2.9.0`. Audit remains 0 total, 0 low, 0 moderate, 0 high, and 0 critical.

No workflow file changed. The previously accepted least-privilege GitHub Actions exploit review remains valid, subject to the final parsed workflow gate. No push, merge, deployment, DNS change, or VPS action occurred.

Remaining concerns are unchanged: the complete future public release does not yet exist, and GitHub-hosted CI has not run because pushing is forbidden.
