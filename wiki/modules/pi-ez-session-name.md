# pi-ez-session-name extension

Load this page when changing or debugging the extension in `src/index.ts`, its tests, or its packaging.

Provenance: `src/index.ts`, `tests/index.test.ts`, `scripts/eval-naming.ts`, archived plan and verification under `spec/archive/261025-1918-auto-name-sessions-after-first-prompt-with-a-configurable-cheap-model/`, and the plan and verification of work item `261026-1435-improve-session-naming-prompt-auto-context-and-title-length`. Source at `HEAD` wins on conflict.

## Behavior contract

- **Auto naming fires at the second user message** - the `input` handler starts one background attempt only when the branch has exactly one prior user message entry, the session is unnamed, and no auto attempt ran since the last `session_start`; it always returns `{ action: "continue" }` synchronously. Changing the trigger changes accepted decision L1 in the plan.
- **Auto context is labeled text only** - the payload is `{ "initial_request", "assistant_progress", "follow_up" }` (first prompt, assistant reply text after it, current input), each trimmed and capped separately at 4000, 1000, and 1500 characters; empty parts are omitted. Tool calls, tool results, thinking, and images are excluded. All parts empty means no attempt and the single attempt is not consumed.
- **Skill blocks are collapsed before capping** - in user text (auto and `/ez-name`), each expanded `<skill name="X" ...>...</skill>` becomes `[skill: X]`; surrounding user text is kept, malformed blocks are left as-is. Without this, a long skill body pushed the user's real request past the cap.
- **`/ez-name` always overwrites** - it rebuilds the name from whole-branch user and assistant text as `{ "conversation": [...] }`, capped at about 12000 characters (first prompt kept, capped at 4000, then newest turns), replaces manual names, notifies success, and warns on failure.
- **One generic `SYSTEM_PROMPT` serves both payload shapes** - it frames the payload as data only, asks for one 6-16 word title naming the user's goal (outcome verb first, not the preceding analysis), keeps distinctive names, uses follow-ups only when they change the goal or the first prompt is only a skill marker, ignores how-to steering, and treats assistant text as progress narration. Keep it free of session-specific terms; tune it with the eval script, not by guessing.
- **One warning per failed attempt, no retry** - invalid config, unknown model, missing auth, provider error or non-`stop` result, thrown error, or empty normalized title produce one `warning` notification; a failed auto attempt still consumes the session's single attempt.
- **Title normalization** - first non-empty line, whitespace collapsed, surrounding quotes and trailing punctuation stripped, capped at 140 characters on a word boundary when practical. Pi itself does not cap session names (`appendSessionInfo` only replaces newlines).

## Configuration

- **Config file** - `<getAgentDir()>/extensions/pi-ez-session-name/config.json` with `{"model":"provider/id"}`, split at the first `/` (so `openrouter/google/x` is provider `openrouter`). The file is read at every attempt. A missing file selects `anthropic/claude-haiku-5-5`; a missing or non-string `model` is an invalid config, not the default.
- **Agent dir override** - `getAgentDir()` honors `PI_CODING_AGENT_DIR`; tests point it at a temp dir instead of touching `~/.pi/agent`.

## Pi host constraints (Pi 1.4.0)

- **Captured `pi`/`ctx` go stale on session replacement** - Pi disposes the old extension runtime on new/resume/fork/reload and stale calls throw, so a `session_start`-only counter in the old closure never changes. The extension therefore bumps its `generation` on both `session_start` and `session_shutdown`, re-checks it before applying a result, and swallows errors from late stale calls. Keep this when touching the apply path. (plan Decision Log L5)
- **Command handlers are awaited inside `prompt()`** - a long `await` in a command blocks the submission; `/ez-name` therefore starts generation in the background and guards concurrency with a `commandRunning` flag. (plan Decision Log L6)
- **Extension commands do not fire `input`** - so `/ez-name`, `/name`, and other extension commands never count as user messages for the auto trigger.

## Development and verification

- **Checks** - `npm test` (`node --import tsx --test tests/*.test.ts`) and `npm run typecheck` (`tsc --noEmit`). Pi is a peer dependency only; dev dependencies are exact-pinned.
- **Tests must wait for background work** - naming reads the config file asynchronously before calling the fake model, so assertions on model calls or names need the time-based `settle()` helper rather than a few `setImmediate` ticks.
- **Naming eval** - `npm run eval:naming -- --runs 5 <session.jsonl>...` replays each session's auto-naming point (branch before the second user message, that message as input) through `pi -p` with all discovery disabled, `--system-prompt SYSTEM_PROMPT --append-system-prompt ""`, `--no-tools`, thinking off, the default model, and a fresh temp cwd; it prints normalized titles with word and character counts. Real model calls; session content stays out of the repo. `--check-isolation <session.jsonl>` uses a read-only probe extension to confirm the rendered system prompt is only `SYSTEM_PROMPT` plus Pi's `<cwd>` section (session files do not store the system prompt). Anthropic OAuth also prepends a Claude Code identity block at the provider level, the same as for the extension's own `streamSimple` call. `pi -p` waits for piped stdin, so the script closes it.
- **Manual smoke** - run `pi -e ./src/index.ts` (for example in a tmux pane), send two messages, check `/session`, then run `/ez-name`. Info notifications replace each other on screen; confirm the final names from the `session_info` entries in the session `.jsonl` file.
