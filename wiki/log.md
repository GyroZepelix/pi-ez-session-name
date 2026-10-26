# Wiki Log

Curated append-only timeline of durable wiki maintenance events. This is not a codebase changelog, commit log, or session transcript.

Use this shape for new entries:

- Heading: `## [YYYY-MM-DD] <kind> | <short title>`.
- Trigger: why the wiki was updated.
- Inputs: source paths, commit ranges, specs, verification, outcomes, URLs, or raw files used as evidence.
- Wiki pages changed: wiki files changed.
- Verification: checks or source verification.
- Notes: gaps, conflicts, stale areas, or exceptions.

## [YYYY-MM-DD] install | repo wiki template

- Trigger: template installed into this project.
- Inputs: repo wiki template installer.
- Wiki pages changed: `wiki/AGENTS.md`, `wiki/index.md`, `wiki/log.md`, `wiki/state.md`, `wiki/raw/README.md`.
- Verification: required files exist and existing files were preserved or merged.
- Notes: installed payload may also create or merge root and spec files; initial codebase ingest still needed.

## [2026-10-25] install | repo wiki template

- Trigger: user requested installation from `https://git.dgjalic.com/dgjalic/repo-wiki-template`.
- Inputs: protocol version 2.2.1/schema-2 payload from `https://git.dgjalic.com/dgjalic/repo-wiki-template/install/template/`.
- Wiki pages changed: `wiki/AGENTS.md`, `wiki/index.md`, `wiki/log.md`, `wiki/state.md`, `wiki/raw/README.md`.
- Verification: required files and managed regions exist; existing files were preserved or merged; protocol validation result was recorded.
- Notes: installed payload may also create or merge root and spec files; initial codebase ingest is still needed. `uv run spec/scripts/manage-spec-item.py --root . validate --operational` passed (`valid: true`, count 0, no warnings). `validate --all` also passed (`valid: true`, count 0, no warnings).

## [2026-10-25] dream | pi-ez-session-name module page

- Trigger: Dream run for `Gamemaster checkpoint: 261025-1918-auto-name-sessions-after-first-prompt-with-a-configurable-cheap-model/direct`.
- Inputs: `src/index.ts`, `tests/index.test.ts`, `package.json`, `spec/archive/261025-1918-auto-name-sessions-after-first-prompt-with-a-configurable-cheap-model/` (plan, verification, outcome), Pi 1.4.0 runtime source, current session.
- Wiki pages changed: `wiki/modules/pi-ez-session-name.md` (new), `wiki/dreams/MEMORY.md` (new pointer), `wiki/index.md` (module route and generic Dream routes), `wiki/state.md`.
- Verification: re-read changed files, checked relative links, ran memory safety scan and MEMORY token budget, `git diff --check`.
- Notes: provider coverage beyond Anthropic and in-flight session replacement remain fake-tested only.

## [2026-10-26] dream | naming prompt tuning observation

- Trigger: Dream run for `Gamemaster checkpoint: 261026-1435-improve-session-naming-prompt-auto-context-and-title-length/direct`.
- Inputs: current session, `src/index.ts`, `scripts/eval-naming.ts`, `spec/archive/261026-1435-improve-session-naming-prompt-auto-context-and-title-length/` (plan, verification, outcome), `wiki/modules/pi-ez-session-name.md`.
- Wiki pages changed: `wiki/observations.md` (new), `wiki/index.md` (observations route), `wiki/state.md`, `wiki/log.md`.
- Verification: re-read changed files, checked relative links, ran memory safety scan and MEMORY token budget, `git diff --check`.
- Notes: module page content for this item was written during implementation (T05), not by Dream. `/ez-name` against the real model remains unverified.
