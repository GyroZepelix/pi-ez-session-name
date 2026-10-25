# Outcome: Auto-name sessions after first prompt with a configurable cheap model

Work item: `261025-1918-auto-name-sessions-after-first-prompt-with-a-configurable-cheap-model`
Disposition: completed
Date: 2026-10-25

## Delivered scope

- `pi-ez-session-name` Pi extension (`src/index.ts`): auto-names an unnamed session at the second user message from the first prompt, assistant reply text, and second prompt using the configured cheap model (default `anthropic/claude-haiku-5-5`, config at `<agentDir>/extensions/pi-ez-session-name/config.json`), and adds `/ez-name` to regenerate the name from the whole conversation.
- Tests (`tests/index.test.ts`), `package.json` (Pi as peer dependency only, exact-pinned devDependencies), `package-lock.json`, `tsconfig.json`, `.gitignore`, `README.md`.

## Deviations from plan

- None to requirements. Decision Log records implementation details L5 (generation also increments on `session_shutdown`; stale-context errors are swallowed because Pi disposes runtimes on session replacement) and L6 (`/ez-name` runs in the background so the in-flight guard is reachable). Both preserve R3 and R6.

## Verification summary

- `npm test`: 37/37 pass. `npm run typecheck`: exit 0. Spec validate: valid.
- Manual tmux smoke on Pi 1.4.0: auto-name after message 2, `/ez-name` overwrote a manual name, concurrent `/ez-name` reported "already running".
- Completion review: PASS, no blockers, 0 retries. Details in [verification.md](./verification.md).

## Retained, reverted, or transferred work

- All implementation retained as untracked files; no Git checkpoint created yet.

## Residual risks

- Providers other than Anthropic were tested with fakes only.
- Session replacement during an in-flight naming call was tested with fakes only.

## Follow-up work items

- Add a wiki module page for the extension (plan's proposed durable knowledge update) via the wiki/Dream workflow.
- User-controlled Git checkpoint (nothing staged or committed).

## Source references

- [plan.md](./plan.md), [discovery.md](./discovery.md), [verification.md](./verification.md).

## Wiki updates

- None in this run.
