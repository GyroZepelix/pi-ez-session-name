# Dream learnings: 261025-1918-auto-name-sessions-after-first-prompt-with-a-configurable-cheap-model

Work item: `261025-1918-auto-name-sessions-after-first-prompt-with-a-configurable-cheap-model`

> Historical snapshot: this ledger records what Dream retained at each Gamemaster checkpoint. Current source, plans, verification, outcomes, and current dynamic destinations remain authoritative.

<!-- dream-checkpoints:start -->

## Gamemaster checkpoint: 261025-1918-auto-name-sessions-after-first-prompt-with-a-configurable-cheap-model/direct

Date: 2026-10-25
Dream log: [2026-10-25-2004-gamemaster-checkpoint-261025-1918-auto-name-sessions-after-first-prompt-with-a-c.md](../2026-10-25-2004-gamemaster-checkpoint-261025-1918-auto-name-sessions-after-first-prompt-with-a-c.md)
Outcome: retained learning

### New module page for the pi-ez-session-name extension

- **Exact written text:**
  > # pi-ez-session-name extension
  >
  > Load this page when changing or debugging the extension in `src/index.ts`, its tests, or its packaging.
  >
  > Provenance: `src/index.ts`, `tests/index.test.ts`, archived plan and verification under `spec/archive/261025-1918-auto-name-sessions-after-first-prompt-with-a-configurable-cheap-model/`. Source at `HEAD` wins on conflict.
  >
  > ## Behavior contract
  >
  > - **Auto naming fires at the second user message** - the `input` handler starts one background attempt only when the branch has exactly one prior user message entry, the session is unnamed, and no auto attempt ran since the last `session_start`; it always returns `{ action: "continue" }` synchronously. Changing the trigger changes accepted decision L1 in the plan.
  > - **Auto context is text only** - first prompt, assistant reply text after it, and the current input, each trimmed and capped at about 2000 characters; tool calls, tool results, thinking, and images are excluded. All parts empty means no attempt and the single attempt is not consumed.
  > - **`/ez-name` always overwrites** - it rebuilds the name from whole-branch user and assistant text capped at about 12000 characters (first prompt kept, then newest turns), replaces manual names, notifies success, and warns on failure.
  > - **One warning per failed attempt, no retry** - invalid config, unknown model, missing auth, provider error or non-`stop` result, thrown error, or empty normalized title produce one `warning` notification; a failed auto attempt still consumes the session's single attempt.
  > - **Title normalization** - first non-empty line, whitespace collapsed, surrounding quotes and trailing punctuation stripped, capped at 80 characters on a word boundary when practical.
  >
  > ## Configuration
  >
  > - **Config file** - `<getAgentDir()>/extensions/pi-ez-session-name/config.json` with `{"model":"provider/id"}`, split at the first `/` (so `openrouter/google/x` is provider `openrouter`). The file is read at every attempt. A missing file selects `anthropic/claude-haiku-5-5`; a missing or non-string `model` is an invalid config, not the default.
  > - **Agent dir override** - `getAgentDir()` honors `PI_CODING_AGENT_DIR`; tests point it at a temp dir instead of touching `~/.pi/agent`.
  >
  > ## Pi host constraints (Pi 1.4.0)
  >
  > - **Captured `pi`/`ctx` go stale on session replacement** - Pi disposes the old extension runtime on new/resume/fork/reload and stale calls throw, so a `session_start`-only counter in the old closure never changes. The extension therefore bumps its `generation` on both `session_start` and `session_shutdown`, re-checks it before applying a result, and swallows errors from late stale calls. Keep this when touching the apply path. (plan Decision Log L5)
  > - **Command handlers are awaited inside `prompt()`** - a long `await` in a command blocks the submission; `/ez-name` therefore starts generation in the background and guards concurrency with a `commandRunning` flag. (plan Decision Log L6)
  > - **Extension commands do not fire `input`** - so `/ez-name`, `/name`, and other extension commands never count as user messages for the auto trigger.
  >
  > ## Development and verification
  >
  > - **Checks** - `npm test` (`node --import tsx --test tests/*.test.ts`) and `npm run typecheck` (`tsc --noEmit`). Pi is a peer dependency only; dev dependencies are exact-pinned.
  > - **Tests must wait for background work** - naming reads the config file asynchronously before calling the fake model, so assertions on model calls or names need the time-based `settle()` helper rather than a few `setImmediate` ticks.
  > - **Manual smoke** - run `pi -e ./src/index.ts` (for example in a tmux pane), send two messages, check `/session`, then run `/ez-name`. Info notifications replace each other on screen; confirm the final names from the `session_info` entries in the session `.jsonl` file.
- **Destination and classification:** `wiki/modules/pi-ez-session-name.md` - `Topic-specific dynamic knowledge`
- **Session evidence or selection reason:** The archived plan proposed this durable update; the behavior contract, config path, and default model are stable repository contracts proven by `src/index.ts`, 37 passing tests, and the live smoke; the Pi host constraints were confirmed from Pi 1.4.0 runtime source and recorded as Decision Log L5/L6; the test-timing and notification lessons came from failures observed in this session.
- **Expected future benefit:** Future changes to the extension keep the trigger, overwrite, and failure semantics, preserve the stale-context and background-command safeguards, and use the right checks and smoke procedure without re-reading Pi internals.
- **Why this tier:** It is a coherent cluster limited to this extension's module rather than a broad convention; it is stable and source-backed, so it does not need to wait in observations; it is reusable guidance, not session narrative.
