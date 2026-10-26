# Plan: Improve session naming prompt, auto context, and title length

Work item: `261026-1435-improve-session-naming-prompt-auto-context-and-title-length`
Status: Planned
Created: 2026-10-26
Updated: 2026-10-26

Assurance: low - personal single-user Pi extension; changes are a prompt string, context shaping, and constants in `src/index.ts`; fully reversible; worst case is a poor session name.

## Goal

Auto-generated session names describe the user's actual goal and its distinctive subject, not incidental how-to details or skill boilerplate. For the reference session below, the auto name should land close to the user-chosen target:

`Improve Teach Skill Using Eero Alvar's LLM Learning Ideas`

## Context

Reference session (auto-named `Teach Skill Analysis with Brave`):
`~/.pi/agent/sessions/--Users-dgjalic-Documents-1-Projects-10-software-development-library-of-alexandria-improving-teach--/2026-10-26T08-08-36-156Z_01a17741-143b-704a-aeda-2bcaaf45a7b0.jsonl`

Findings from analysis (2026-10-26):

- F1 The naming model got: the first prompt cut to 2000 of ~2900 chars, assistant text that was only progress narration ("I'll start by orienting..."), and the second message `Use my brave profile with yt-dlp` (a mid-run steer). The unlabeled parts were weighted equally, so the incidental `Brave` became part of the title.
- F2 The title was not truncated by code (31 chars < 80). Haiku chose 5 words within the prompt's "3-8 word" range; the dangling `with Brave` reads like a cut-off.
- F3 `SYSTEM_PROMPT` gives no salience guidance: no notion of goal vs logistics, distinctive subjects, or untrustworthy assistant narration.
- F5 Sessions started with a skill store the expanded `<skill name="..." location="...">...</skill>` block as the first user message. In the install session the block was 12561 chars and the user's real request came after it, so the 2000-char cap removed it entirely.
- Pi does not cap session names: `SessionManager.appendSessionInfo` only replaces newlines. The 80-char cap is this extension's `TITLE_CAP`.

## Requirements

- R1 Rewrite `SYSTEM_PROMPT` so the model:
  - names the user's goal, primarily from the initial request;
  - keeps distinctive subjects (named people, tools, projects, skills) that identify the work;
  - uses follow-up messages only when they change or narrow the goal, and ignores tool, profile, setup, and how-to instructions;
  - treats assistant text as progress narration usable only for disambiguation;
  - replies with one 6-16 word title, in the conversation's language, no quotes, Markdown, or trailing punctuation;
  - still treats the payload strictly as data (keep the existing data-not-instructions framing).
  The prompt must stay generic: no session-specific terms (for example `Eero`, `teach`, `Brave`).
- R2 Auto context payload is labeled so the model can weight parts: `{ "initial_request": ..., "assistant_progress": ..., "follow_up": ... }` (empty parts omitted). Tool content, thinking, and images stay excluded. `/ez-name` keeps its whole-branch `{ "conversation": [...] }` shape and uses the same `SYSTEM_PROMPT`, which must describe both shapes.
- R3 Expanded skill blocks are collapsed before capping, in both auto and `/ez-name` context: each `<skill name="X" ...>...</skill>` becomes `[skill: X]`, and the user's text outside the block is kept.
- R4 Per-part auto caps replace the single `AUTO_PART_CAP`: initial request 4000, assistant progress 1000, follow-up 1500 characters (applied after R3). `/ez-name` keeps `FULL_CONTEXT_CAP` 12000 and uses the initial-request cap for its head turn.
- R5 `TITLE_CAP` becomes 140 characters; `normalizeTitle` behavior is otherwise unchanged.
- R6 Trigger, single-attempt rule, apply guard, `/ez-name` overwrite, config, failure warnings, and `maxTokens` stay unchanged.
- R7 A dev-only evaluation script replays real sessions through headless Pi with the real model (see Design). It reads session files by path at run time; no session content is committed.

## Out of scope

- Changing the trigger point, the model, config format, or retry behavior.
- Handling prompt-template expansion (no stable marker in stored messages).
- Renaming existing sessions.
- Committing or pushing.

## Assumptions

- The user's answer "140 word cap" means a 140-character `TITLE_CAP` (the cap is character-based and 140 words would contradict the 6-16 word target). Revisit if the user says otherwise.
- `pi -p --system-prompt ... --append-system-prompt ""` yields an effective system prompt of only our prompt plus Pi's `<cwd>` section. The eval script must check this once (T03) before trusting results.

## Design

- `conversationTurns` (or a helper it calls) applies the R3 skill collapse to user text, so both auto and `/ez-name` benefit. Regex over `<skill name="([^"]+)"[^>]*>[\s\S]*?</skill>`; unmatched or malformed blocks are left as-is.
- `buildAutoContext` returns the labeled R2 object (or a structure `generateTitle` serializes into it); `generateTitle` accepts either payload shape. Keep exports the tests need.
- Eval script `scripts/eval-naming.ts`, run as `node --import tsx scripts/eval-naming.ts [--runs 5] <session.jsonl>...`:
  - parse the JSONL, take branch entries before the second user message entry, take that message's text as the current input, and build the payload with the exported functions from `src/index.ts`;
  - for each run, `execFile` (no shell) `pi -p --no-session --no-extensions --no-skills --no-prompt-templates --no-context-files --no-mcp --no-tools --thinking off --model anthropic/claude-haiku-5-5 --system-prompt <SYSTEM_PROMPT> --append-system-prompt "" <payload JSON>` with `cwd` set to a fresh temp directory;
  - print per session: the old name, each normalized title, word count, and char count.
  - Script is not shipped (`package.json` `files` is `src` and `README.md`). An `eval:naming` npm script is optional.
- Eval sessions (paths under `~/.pi/agent/sessions/`):
  - S1 teach (reference): `--Users-dgjalic-Documents-1-Projects-10-software-development-library-of-alexandria-improving-teach--/2026-10-26T08-08-36-156Z_01a17741-143b-704a-aeda-2bcaaf45a7b0.jsonl`
  - S2 install: `--Users-dgjalic-Documents-1-Projects-10-software-development-50-pi-extensions-pi-ez-session-name--/2026-10-25T18-25-25-979Z_01a1744f-71da-7192-8e1a-70c42eb6b9d3.jsonl`
  - S3 EXIF: `--Users-dgjalic-Documents-1-Projects-10-software-development-50-pi-extensions-pi-ez-session-name--/2026-10-25T18-53-37-334Z_01a17469-40b6-7756-a9f5-899b65ce0c32.jsonl`
  - S4 session analysis: `--Users-dgjalic-Documents-1-Projects-10-software-development-50-pi-extensions-rpiv-mono-selfhost-firecrawl--/2026-10-25T20-22-06-774Z_01a174ba-44b6-71d5-91e8-cfb21db25cd2.jsonl`

## Decision Log

| ID | Scope | Decision | Rationale | Evidence | Revisit when |
| --- | --- | --- | --- | --- | --- |
| P1 | Target | Reference target title is N2 `Improve Teach Skill Using Eero Alvar's LLM Learning Ideas` | User choice | Planning Q&A 2026-10-26 | User picks another target |
| P2 | Length | Prompt asks 6-16 words; `TITLE_CAP` 140 chars | User choice; Pi does not cap names | `appendSessionInfo` in Pi 1.4.0 `session-manager.js` | Names look too long in the picker |
| P3 | Context | Labeled auto payload, skill-block collapse, per-part caps 4000/1000/1500 | F1, F3, F5 | Reference and install sessions | Eval shows a part is still mis-weighted |
| P4 | Testing | Real model via headless Pi, 5 runs per session, 4 sessions | User choice; avoids overfitting one session | Planning Q&A 2026-10-26 | Headless Pi cannot isolate the system prompt |

## Work breakdown

- [x] T01: Context shaping (R2, R3, R4)
  - Depends on: none
  - Expected areas: `src/index.ts`, `tests/index.test.ts`
  - Acceptance: auto payload is labeled; skill blocks collapse to `[skill: X]` with trailing user text kept; per-part caps hold; `/ez-name` gets collapse and the new head cap.
  - Verification: `npm test`, `npm run typecheck`
- [x] T02: Prompt and title cap (R1, R5)
  - Depends on: T01
  - Expected areas: `src/index.ts`, `tests/index.test.ts`
  - Acceptance: new `SYSTEM_PROMPT` meets R1 and keeps the data framing; `TITLE_CAP` is 140.
  - Verification: `npm test`, `npm run typecheck`
- [x] T03: Eval script and isolation check (R7)
  - Depends on: T01
  - Expected areas: `scripts/eval-naming.ts`, optionally `package.json` scripts
  - Acceptance: one run saved to a temp `--session-dir` (instead of `--no-session`) shows the system prompt is only `SYSTEM_PROMPT` plus `<cwd>`. If `APPEND_SYSTEM.md` content or other additions leak, stop and report before evaluating.
  - Verification: run the script against S1 with `--runs 1`
- [x] T04: Evaluate and tune
  - Depends on: T02, T03
  - Scope: run 5 runs per S1-S4; revise only `SYSTEM_PROMPT` (and caps within reason) until acceptance passes. Max 5 revision rounds; if still failing, stop and report the titles to the user instead of overfitting.
  - Acceptance: see Acceptance criteria.
- [x] T05: Docs
  - Depends on: T04
  - Expected areas: `README.md` (3-8 words, 2000-char caps), `wiki/modules/pi-ez-session-name.md` (auto context, normalization cap, eval script)
  - Acceptance: docs match the shipped behavior.

## Acceptance criteria

- S1: in at least 4 of 5 runs the title mentions the teach skill, Eero (Alvar), and an improvement goal (improve, enhance, overhaul, redesign, or similar); 0 of 5 mention `Brave` or `yt-dlp`. At least one run is a close paraphrase of P1 (judged manually, titles recorded verbatim).
- S2: in at least 4 of 5 runs the title is about installing the extension or plugin (from the pushed origin), not about skill boilerplate.
- S3: in at least 4 of 5 runs the title mentions EXIF photo renaming (a CLI).
- S4: in at least 4 of 5 runs the title is about diagnosing agent vs plugin (or `ask_user_question`) output issues.
- Across all runs, at least 4 of 5 per session are 6-16 words; none exceed 140 chars after normalization.
- `SYSTEM_PROMPT` contains no session-specific terms.
- Existing behavior in R6 is unchanged; `npm test` and `npm run typecheck` pass.

## Verification plan

- `npm test`
- `npm run typecheck`
- `node --import tsx scripts/eval-naming.ts --runs 5 <S1> <S2> <S3> <S4>` (real Haiku calls, about 20 small requests per round; output recorded verbatim in `verification.md`)
- Optional manual smoke per wiki: `pi -e ./src/index.ts`, start with a skill command, send a second message, check the `session_info` entry.

## Risks and blockers

- Headless Pi may still inject system-prompt additions; T03 checks this first. If isolation is not possible, stop and ask (alternative: an SDK script calling `modelRegistry.streamSimple` directly).
- Model output varies; acceptance uses 4-of-5 thresholds and a bounded revision count.

## Progress

- [x] Planning complete and confirmed.
- [x] Implementation complete (T01-T05), 2026-10-26.
- [x] Verification passed; completion review PASS. Evidence: `verification.md`.

## Execution handoff

Use PI Agent in a fresh session with this prompt:

```text
Read spec/active/261026-1435-improve-session-naming-prompt-auto-context-and-title-length/plan.md and item.yaml completely, plus AGENTS.md and wiki/modules/pi-ez-session-name.md.
Implement T01-T05 at the recorded low assurance, preserving Requirements, Out of scope, and the Decision Log.
Make the smallest coherent change; keep SYSTEM_PROMPT generic.
Run the Verification plan and record titles verbatim in verification.md, including failures and skipped checks.
Stop and ask before dependencies, destructive operations, external writes, commits, pushes, or scope expansion, and when T03 isolation or T04 tuning fails.
```

## Proposed durable knowledge updates

- `wiki/modules/pi-ez-session-name.md`: labeled auto payload, skill-block collapse, per-part caps, 140-char title cap, and the eval script workflow (after implementation is verified).
