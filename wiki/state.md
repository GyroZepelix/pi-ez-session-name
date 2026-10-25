# Wiki State

Last full ingest commit: none
Last incremental ingest commit: none
Last lint date: none

## Processed inputs

| Input | Type | Source | Processed date | Output pages | Notes |
| --- | --- | --- | --- | --- | --- |
| `https://git.dgjalic.com/dgjalic/repo-wiki-template` | Protocol 2.2.1/schema-2 template installer | Forgejo repository | 2026-10-25 | `AGENTS.md`, `spec/`, `wiki/` | Installed lean repo wiki template. |
| `spec/archive/261025-1918-auto-name-sessions-after-first-prompt-with-a-configurable-cheap-model/` | Archived spec (plan, verification, outcome) and `src/index.ts` | Repository | 2026-10-25 | `modules/pi-ez-session-name.md` | Initial module page from Dream checkpoint; source not yet committed. |

## Maintenance policy

This file is compact processing state for resume, dedupe, lint, and ingest checkpoints. It is not append-only history.

Update this file when:

- Full or incremental ingest checkpoints change.
- Lint date or lint checkpoint state changes.
- Raw files, source batches, URL batches, specs, verification, outcomes, or commit ranges are processed into durable wiki knowledge and need dedupe/resume tracking.

Do not add rows for every session, chat turn, verification command, routine implementation plan, routine wiki edit, log-only event, or codebase change that does not affect durable wiki knowledge.

For wiki maintenance rows, `Output pages` should name wiki pages. Install/bootstrap rows may summarize the broader installed payload.

- Update checkpoints only after affected wiki pages are processed.
- Keep raw sources separate from trusted wiki synthesis.
- Mark uncertain or unverified pages as stale in `wiki/index.md`.
