# Plan: Auto-name sessions after first prompt with a configurable cheap model

Work item: `261025-1918-auto-name-sessions-after-first-prompt-with-a-configurable-cheap-model`
Status: Planned
Created: 2026-10-25
Updated: 2026-10-25

Assurance: low - personal single-user Pi extension; fully reversible (remove package); worst case is a missing or poor session name, and prompt text only goes to a provider the user already uses.

## Goal

A KISS Pi extension, `pi-ez-session-name`, that automatically names a new session with a configurable cheap model once the user sends their second message, and offers `/ez-name` to regenerate the name from the whole conversation.

## Context

- Host: Pi `@earendil-works/pi-coding-agent` 1.4.0. Repository currently contains only the spec/wiki template.
- `input` fires in `AgentSession.prompt()` before skill/template expansion; extension commands do not fire it. Handler returning `{ action: "continue" }` leaves input untouched.
- APIs used: `pi.on("input" | "session_start")`, `pi.registerCommand`, `pi.getSessionName`, `pi.setSessionName`, `ctx.sessionManager.getBranch()`, `ctx.modelRegistry.find/hasConfiguredAuth/streamSimple`, `ctx.ui.notify`, `getAgentDir()` from `@earendil-works/pi-coding-agent`.
- Conventions from siblings: `pi-aware` config at `<agentDir>/extensions/<name>/config.json`; `pi-typesafe-bash` TypeScript ESM layout and `node --import tsx --test` / `tsc --noEmit`.
- Discovery: [discovery.md](./discovery.md). D6 and D7 there are superseded by L1 and L2 below.

## Requirements

- R1 Auto trigger: on an `input` event whose session branch contains exactly one prior user message entry, `pi.getSessionName()` is empty, and no auto attempt has run in this session, start naming in the background. The handler always returns `{ action: "continue" }` immediately.
- R2 Auto context: the naming request contains, as JSON data, the first user message text, the text of assistant messages after it (no tool calls or tool results), and the current input text; each part trimmed and capped at about 2000 characters. Empty parts are omitted; if all are empty, no attempt is made.
- R3 Command: `/ez-name` (no arguments) regenerates the name from the whole branch conversation: user and assistant text only, capped at about 12000 characters total, keeping the first user message and then the newest messages when truncating. It always replaces the current name, including manual names, notifies the new name on success, and warns on failure. A second `/ez-name` while one is in flight notifies that naming is already running.
- R4 Config: model from `<getAgentDir()>/extensions/pi-ez-session-name/config.json`, shape `{"model":"provider/id"}`, split at the first `/`. Missing file uses default `anthropic/claude-haiku-5-5`. Config is read at each attempt.
- R5 Model call: one `ctx.modelRegistry.streamSimple()` call per attempt with a short system prompt that treats the content as data, reasoning off, `maxTokens` 2048. Output is normalized to the first non-empty line, stripped of surrounding quotes and trailing punctuation, collapsed whitespace, and capped at 80 characters.
- R6 Apply guard: auto naming sets the name only if `getSessionName()` is still empty and the session generation (incremented on every `session_start`) is unchanged. `/ez-name` applies only if the generation is unchanged.
- R7 Failure: invalid config (unparseable JSON, non-string or malformed `model`), model not found, missing auth, provider error or non-`stop` result, or empty normalized title produces one `ctx.ui.notify(<message>, "warning")` for that attempt, with no retry. A failed auto attempt still counts as the single auto attempt.
- R8 Runs regardless of `ctx.hasUI` (A1 dropped); notification is the only UI interaction.

## Out of scope

- Terminal or tmux title changes.
- Periodic re-titling or automatic renaming beyond the single auto attempt.
- Tool-call or tool-result content in naming context.
- Environment-variable or `settings.json` configuration; commands to change config.
- Subagent child sessions (launched with `--no-extensions`).
- Publishing to npm, adding a git remote, or installing into `~/.pi/agent/settings.json`.

## Design

- `src/index.ts` default export registers handlers and the command; small pure helpers are exported for tests: `parseModelRef`, `loadConfig(path)`, `extractText(content)`, `buildAutoContext(branch, inputText)`, `buildFullContext(branch)`, `normalizeTitle(text)`, and `generateTitle(ctx, payload)` returning `{ ok: true, title } | { ok: false, reason }`.
- State per extension runtime: `generation` (incremented on `session_start`), `autoAttempted` (reset on `session_start`), `commandRunning`.
- Prompt framing: system prompt instructs one 3-8 word noun/action title in the conversation's language, no quotes, Markdown, or trailing punctuation; user message is `JSON.stringify({ conversation })`.
- Branch reading: count entries with `type === "message"` and `message.role === "user"`; assistant text comes from `type === "text"` content blocks.

## Decision Log

| ID | Scope | Decision | Rationale | Evidence | Revisit when |
| --- | --- | --- | --- | --- | --- |
| L1 | Trigger | Auto-name at the second user message using first prompt, first assistant reply text, and second prompt (supersedes discovery D6) | User direction at plan review: more information yields better titles | Plan review Q6 | Titles still poor or naming too late |
| L2 | Command | Add `/ez-name` that always overwrites using whole-conversation text capped at about 12k characters (supersedes discovery D7 "no commands") | User direction at plan review | Plan review Q7 | Overwrite of manual names is unwanted |
| L3 | Gating | No `ctx.hasUI` gating | User dropped A1 | Plan review | Non-UI runs incur unwanted cost |
| L4 | Default model | `anthropic/claude-haiku-5-5` | Discovery D3 | discovery.md | Anthropic auth unavailable |
| L5 | Apply guard (implementation detail) | Also increment `generation` on `session_shutdown` and swallow errors from a stale `pi`/`ctx` after the model call | Pi 1.4.0 disposes the old runtime on session replacement and stale `pi`/`ctx` calls throw, so a `session_start`-only counter in the old closure would never change; this strengthens R6 without changing it | `dist/core/agent-session.js` dispose/invalidate; `extensions/loader.js` assertActive | Pi reuses runtimes across sessions |
| L6 | Command (implementation detail) | `/ez-name` handler starts generation in the background and returns immediately | Pi awaits command handlers inside `prompt()`; returning immediately keeps the editor responsive and makes the R3 in-flight guard reachable | `dist/core/agent-session.js` `_tryExecuteExtensionCommand`; manual smoke | Pi changes command execution |

## Work breakdown

- [x] T01: Implement and test the extension
  - Depends on: none
  - Scope: package scaffolding, extension source, tests, README
  - Expected areas: `package.json`, `package-lock.json`, `tsconfig.json`, `.gitignore`, `README.md`, `src/index.ts`, `tests/index.test.ts`
  - Acceptance: all Acceptance criteria below
  - Verification: Verification plan below

## Acceptance criteria

- Auto naming sets a title from the configured model at the second user message and not at the first or third (R1).
- Auto context includes first prompt, assistant reply text, and second prompt; excludes tool content; respects caps (R2).
- Already-named sessions, sessions whose branch has zero or two or more prior user messages at input, and repeated inputs during generation never start another auto attempt (R1).
- A manual `/name` during auto generation is not overwritten; a session replaced during generation is not renamed (R6).
- `/ez-name` overwrites an existing name using capped whole-conversation text, notifies success, warns on failure, and rejects a concurrent run (R3).
- Missing config uses `anthropic/claude-haiku-5-5`; valid config uses its model; invalid config warns (R4, R7).
- Each failure class warns exactly once per attempt with no retry (R7).
- Output normalization handles quotes, multi-line output, trailing punctuation, extra whitespace, and length cap (R5).
- `package.json` declares `pi.extensions: ["./src/index.ts"]` and lists Pi only as a peer dependency.

## Verification plan

- `npm test` (`node --import tsx --test tests/*.test.ts`) with fake `pi`/`ctx` covering every acceptance criterion.
- `npm run typecheck` (`tsc --noEmit`).
- Manual smoke: `pi -e ./src/index.ts`; send two messages; confirm the name via `/session` or `/resume`; run `/ez-name` and confirm the name changes.
- One completion review against requirements, diff, tests, and repository rules.

## Risks and blockers

- Dev dependencies (`typescript`, `tsx`, `@types/node`, `@earendil-works/pi-coding-agent@1.4.0` for types) must be pinned and require user approval before install.
- Default model requires Anthropic auth in the session; otherwise R7 warning applies.

## Progress

- [x] Planning complete and confirmed.
- [x] Implementation complete (T01).
- [x] Verification passed; see [verification.md](./verification.md).

## Execution handoff

Use PI Agent in a fresh session with this prompt:

```text
Read this plan and its item.yaml completely.
Implement the work step by step while preserving Requirements, Out of scope, Decision Log, and Verification plan.
Update Progress and the Decision Log when confirmed implementation discoveries change the approach.
Run the specified verification before reporting completion.
Stop and ask before dependencies, migrations, destructive operations, external writes, commits, pushes, or scope expansion.
```

## Proposed durable knowledge updates

- After implementation, add a wiki module page for the extension (trigger rules, config path, default model, `/ez-name`).
