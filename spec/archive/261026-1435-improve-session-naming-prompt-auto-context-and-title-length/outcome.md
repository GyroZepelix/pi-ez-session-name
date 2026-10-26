# Outcome: Improve session naming prompt, auto context, and title length

Work item: `261026-1435-improve-session-naming-prompt-auto-context-and-title-length`
Disposition: completed
Date: 2026-10-26

## Delivered scope

- `src/index.ts`: labeled auto payload `{ initial_request, assistant_progress, follow_up }` (R2); skill-block collapse to `[skill: X]` in auto and `/ez-name` user text (R3); per-part caps 4000/1000/1500 replacing `AUTO_PART_CAP`, `/ez-name` head cap 4000 within `FULL_CONTEXT_CAP` 12000 (R4); `TITLE_CAP` 140 (R5); a new generic `SYSTEM_PROMPT` that describes both payload shapes, keeps the data-only framing, and asks for one 6-16 word goal title (R1). R6 behavior is unchanged.
- `tests/index.test.ts`: tests for the labeled payload, caps, skill collapse, prompt shape and genericity, and the 140-char cap (40 tests).
- `scripts/eval-naming.ts`: dev-only eval through headless `pi -p` with the real model, plus `--check-isolation` (R7). `package.json` adds `eval:naming`; the script is not shipped.
- Docs: `README.md`, `wiki/modules/pi-ez-session-name.md`.

## Deviations from plan

- `tsconfig.json` `include` adds `scripts/**/*.ts` so the typecheck covers the eval script.
- The T03 isolation check uses a temp `--session-dir` plus a read-only probe extension, because Pi 1.4.0 session files do not store the system prompt.
- The eval script closes the child's stdin; otherwise `pi -p` waits for piped stdin.
- No requirement, acceptance criterion, or Decision Log entry changed.

## Verification summary

- `npm test` 40/40 PASS; `npm run typecheck` PASS; `git diff --check` PASS.
- Isolation check PASS before and after tuning: the effective prompt is `SYSTEM_PROMPT` plus Pi's `<cwd>`. Anthropic OAuth adds a provider-level identity block, which also applies to the extension's own call.
- T04: 6 eval rounds (the initial prompt plus 5 revisions; caps not tuned). The final round meets all acceptance criteria on their literal reading: S1 5/5, 0/5 Brave or yt-dlp, run #1 a close paraphrase of P1; S2 4/5; S3 5/5; S4 5/5; all titles 7-12 words and at most 76 chars. The orchestrator accepted it as PASS.
- Completion review: PASS, no blockers, 0 retries.
- Details and all titles verbatim: [verification.md](./verification.md).

## Retained, reverted, or transferred work

- All changes retained in the working tree; nothing staged or committed.

## Residual risks

- In S1, 4/5 final titles still lead with `Analyse`. Only #1 and #3 frame the goal as improving the teach skill itself, and earlier rounds were more variable. Prompt tuning stopped at the 5-revision cap.
- `/ez-name` (`{ conversation }` shape) was not run against the real model; it is covered by unit tests only.
- The optional manual smoke test was not run.
- Title quality is sampled (5 runs x 4 sessions); model output varies.

## Follow-up work items

- Optional: revisit outcome-first phrasing for "analyse in order to improve" requests if names still read as analyses in practice.
- Optional: the eval script's `old name` label uses the first `session_info` entry, not the latest.
- User-controlled Git checkpoint and Dream.

## Source references

- [plan.md](./plan.md), [verification.md](./verification.md).

## Wiki updates

- `wiki/modules/pi-ez-session-name.md`: labeled auto payload, skill-block collapse, per-part caps, generic `SYSTEM_PROMPT`, 140-char cap, naming-eval workflow.
