# Verification: Auto-name sessions after first prompt with a configurable cheap model

Work item: `261025-1918-auto-name-sessions-after-first-prompt-with-a-configurable-cheap-model`
Date: 2026-10-25

## Environment

- Mode: direct (T01). Assurance: low - personal single-user Pi extension; fully reversible; worst case is a missing or poor session name.
- Starting HEAD: `29d498c0e0c9c8df0c3795da6c17fe2316296244`. All implementation files are new and untracked; nothing staged or committed.
- Node v26.8.2, npm 11.19.1, host Pi `@earendil-works/pi-coding-agent` 1.4.0 (global bun install).
- Dev dependencies (approved D1, exact pins): `typescript` 5.9.3, `tsx` 4.23.15, `@types/node` 22.20.5, `@earendil-works/pi-coding-agent` 1.4.0. Pi is a `peerDependency` only. `node_modules/` is gitignored; `package-lock.json` created.
- Changed paths: `package.json`, `package-lock.json`, `tsconfig.json`, `.gitignore`, `README.md`, `src/index.ts`, `tests/index.test.ts`, and this item's `plan.md` (Decision Log L5, L6; progress).

## Commands and checks

| Check | Result | Evidence |
| --- | --- | --- |
| `npm test` (`node --import tsx --test tests/*.test.ts`) | Pass: 37 tests, 0 failures; stable across 4 runs | `tests/index.test.ts` |
| `npm run typecheck` (`tsc --noEmit`) | Pass: exit 0 | `tsconfig.json` (strict, NodeNext) |
| `manage-spec-item.py validate --item <id>` | Pass: `valid: true` | helper output |
| Manual smoke (tmux, `pi -e ./src/index.ts`, default model, no config file) | Pass | See below |

Manual smoke detail (session `01a17469-40b6-7756-a9f5-899b65ce0c32`):

- After message 1: no name (footer and `/session` show none).
- After message 2: footer and `/session` showed `Name: Python CLI for renaming photos by EXIF date` (auto, default `anthropic/claude-haiku-5-5`).
- `/name Manual placeholder`, then `/ez-name`: notified `Session named: EXIF photo renamer CLI`; manual name replaced.
- Two back-to-back `/ez-name` submissions: second showed `pi-ez-session-name: naming is already running`; exactly one new `session_info` entry appeared in the session file.
- Approximate main-model cost of the smoke: $0.012 plus a few cheap naming calls.

## Requirement coverage

| Requirement | Evidence | Status |
| --- | --- | --- |
| R1 auto trigger at second message only, once, sync `continue` | tests "auto naming trigger (R1)"; smoke | Pass |
| R2 auto context, tool content excluded, 2000-char caps, empty omission | tests "auto context (R2)" | Pass |
| R3 `/ez-name` overwrite, 12k cap keeping first + newest, notify, warn, concurrency | tests "/ez-name (R3)"; smoke | Pass |
| R4 config path, default model, per-attempt read, first-slash split | tests "config (R4)" | Pass |
| R5 single `streamSimple`, data framing, reasoning off, `maxTokens` 2048, normalization | tests "model call (R5)", "normalizeTitle (R5)" | Pass |
| R6 apply guard (manual name, session replacement) | tests "apply guard (R6)" incl. `session_start` and `session_shutdown` | Pass |
| R7 each failure class warns once, no retry, attempt consumed | tests "failures (R7)" (9 classes) | Pass |
| R8 no `ctx.hasUI` gating | source inspection; harness has no `hasUI` | Pass |
| Packaging: `pi.extensions` and Pi peer-only | test "package.json" | Pass |

## Review findings

- Completion review (low assurance, independent read-only reviewer): **PASS**, no blocking findings, 0 retries.
- Non-blocking: plan T01/Progress checkboxes unchecked at review time - resolved by this progress update.
- Reviewer uncertainty: reviewer re-verified checks by static inspection rather than re-execution; implementer re-ran `npm test` and `npm run typecheck` after the review (pass).

## Failures and skipped checks

- Initial test run: 3 timing failures in the test harness (assertions before the async config read completed); fixed by waiting for background work in tests. No source change was needed.
- Initial typecheck: test import used a `.ts` extension; changed to `.js` (sibling convention).

## Unverified areas

- Behavior with providers other than Anthropic was not exercised live (covered by fakes only).
- Implementation details L5 (generation bump on `session_shutdown`, stale-context errors swallowed) and L6 (background `/ez-name`) are recorded in the plan Decision Log; session replacement during an in-flight request was tested with fakes only.
