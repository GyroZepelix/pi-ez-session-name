---
schema_version: 1
episode_id: "2026-10-26-1459-gamemaster-checkpoint-261026-1435-improve-session-naming-prompt-auto-context-and"
timestamp: "2026-10-26T14:59:38+01:00"
summary: "Reworked pi-ez-session-name auto-naming (labeled payload, skill-block collapse, per-part caps, 140-char cap, generic goal-focused prompt) and tuned the prompt with a real-model eval script; archived completed."
kind: "gamemaster-checkpoint"
status: "shipped"
work_item: "261026-1435-improve-session-naming-prompt-auto-context-and-title-length"
current: "direct"
topics: ["pi-extension","session-naming","prompt-eval"]
---

# Gamemaster checkpoint: 261026-1435-improve-session-naming-prompt-auto-context-and-title-length/direct

Date: 2026-10-26
Work item: 261026-1435-improve-session-naming-prompt-auto-context-and-title-length
Status: shipped
In one line: Reworked pi-ez-session-name auto-naming (labeled payload, skill-block collapse, per-part caps, 140-char cap, generic goal-focused prompt) and tuned the prompt with a real-model eval script; archived completed.

## Goal

Make auto-generated session names describe the user's actual goal and its distinctive subject instead of incidental how-to details or skill boilerplate, with the reference session landing near the user-chosen target title.

## How we approached it

- T01/T02: in `src/index.ts`, replaced the flat `{conversation}` auto payload with labeled `initial_request` / `assistant_progress` / `follow_up` parts, collapsed expanded `<skill ...>` blocks to `[skill: X]` before per-part caps (4000/1000/1500), raised `TITLE_CAP` to 140, and rewrote `SYSTEM_PROMPT` to describe both payload shapes. `/ez-name` keeps `{conversation}`. Tests grew from 37 to 40.
- T03: added `scripts/eval-naming.ts`, which replays the second-user-message point of saved sessions through headless `pi -p` with all discovery off. The isolation check uses a read-only probe extension because session files do not store the system prompt.
- T04: six eval rounds (initial prompt plus five revisions, 5 runs x 4 sessions each). Revisions moved from salience rules, to "verb of the end result", to an unrelated-domain example, to a ban on leading analysis verbs.
- T05: updated `README.md` and the module wiki page.
- Completion review PASS, then outcome written and the item archived with the helper.

## Key decisions

- **Accept T04 on the literal criteria** - after the five-revision cap, the final round met every acceptance threshold, and the orchestrator accepted it rather than allowing further tuning. Recorded caveat: 4/5 reference-session titles still lead with "Analyse".
- **Isolation via probe extension** - chose `-e` probe plus `--session-dir` because saved session files do not record the rendered prompt; rejected trusting source reading alone.
- **Type-check the eval script** - added `scripts/**/*.ts` to `tsconfig.json` include; the script stays out of the published `files`.

## What did not work

- **First isolation run hung until timeout** - `pi -p` spawned via `execFile` waits on the open stdin pipe; the script now ends stdin.
- **Rule-only prompt revisions for analyse-to-improve requests** - each added rule moved some titles but the model kept copying the user's leading verb. See the observation trail.

## Current state and where we left off

- Shipped/verified: item archived `completed` under `spec/archive/261026-1435-improve-session-naming-prompt-auto-context-and-title-length/`; tests 40/40, typecheck, diff check, isolation, and completion review pass.
- Pending: nothing staged or committed; Git checkpoint is user-controlled.

## Source of truth

- `spec/archive/261026-1435-improve-session-naming-prompt-auto-context-and-title-length/verification.md`: all eval titles verbatim, isolation record, acceptance table, review verdict.
- `spec/archive/261026-1435-improve-session-naming-prompt-auto-context-and-title-length/outcome.md`: delivered scope, deviations, residual risks.
- `src/index.ts`, `tests/index.test.ts`, `scripts/eval-naming.ts`: implementation.

## Verification

- Done: `npm test` 40/40, `npm run typecheck`, `git diff --check`, isolation check before and after tuning, six eval rounds, independent completion review PASS with 0 retries, archive preflight and archive.
- Not verified yet: `/ez-name` payload against the real model; manual interactive smoke.

## Open questions, blockers, next safe action

- Open/blocked: none blocking. Optional follow-up on outcome-first phrasing if real names still read as analyses.
- Next safe action: user reviews the working tree and creates a Git checkpoint.

## Dynamic knowledge trail

- `wiki/observations.md`: Observation (naming prompt tuning plateau).
