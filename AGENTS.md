# AFTERLIGHT Website Agent Guardrails

This file is the source of truth for any agent working in this website repository.

## Writing Style

- Never use the U+2014 em dash character in source, documentation, tests, comments, commit messages, or replies to Shane.
- Use commas, colons, parentheses, or separate sentences instead.

## Skills First

- Before every task, check the available project and user skills for a matching workflow.
- Use test-driven development for features, fixes, tooling, and behavior changes.
- Use the GitHub Actions security review skill for any workflow change or review.
- Use frontend design guidance when visual work is in scope. Preserve the established design when visual work is not in scope.
- If no skill matches, search for one before improvising and inspect low-adoption skills before use.

## Test-Driven Development

- Write the failing test first and confirm that it fails for the intended reason.
- Implement the smallest change that makes the test pass.
- Preserve RED and GREEN command evidence for reviewed security work.
- Test generated output and executable behavior, not only source text.

## Verification Before Claims

- Never claim success without fresh evidence from the same session.
- Run a clean `npm ci`, the complete `npm test` suite, `npm run build`, `npm run check:site`, `npm run check:security`, and `npm run audit` before completion.
- Run preview and browser checks for routes or interactive behavior affected by the task.
- Report failures verbatim and do not soften partial results.

## Repository Safety

- Never commit secrets, private keys, access tokens, populated environment files, or credentials.
- Never commit generated output such as `dist/`, `.astro/`, `.netlify/`, `node_modules/`, coverage, logs, or temporary agent files.
- Keep changes scoped to the requested task. Do not alter portal behavior, copy, branding, EmailJS behavior, or unrelated content without explicit direction.
- Use Node `22.17.1` consistently across local work, package metadata, CI, and Netlify.

## Review and Delivery

- Do not push, merge, deploy, change DNS, or modify hosting infrastructure before review and explicit approval.
- Never add deployment permissions or secrets to pull request CI.
- End Codex-authored commit messages with `Co-Authored-By: Codex <noreply@openai.com>`.
