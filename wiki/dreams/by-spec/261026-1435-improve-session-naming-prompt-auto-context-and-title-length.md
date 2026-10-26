# Dream learnings: 261026-1435-improve-session-naming-prompt-auto-context-and-title-length

Work item: `261026-1435-improve-session-naming-prompt-auto-context-and-title-length`

> Historical snapshot: this ledger records what Dream retained at each Gamemaster checkpoint. Current source, plans, verification, outcomes, and current dynamic destinations remain authoritative.

<!-- dream-checkpoints:start -->

## Gamemaster checkpoint: 261026-1435-improve-session-naming-prompt-auto-context-and-title-length/direct

Date: 2026-10-26
Dream log: [2026-10-26-1459-gamemaster-checkpoint-261026-1435-improve-session-naming-prompt-auto-context-and.md](../2026-10-26-1459-gamemaster-checkpoint-261026-1435-improve-session-naming-prompt-auto-context-and.md)
Outcome: retained learning

### Observation: naming prompt tuning plateau

- **Exact written text:**
  > ## Naming prompt tuning
  >
  > - **More prompt rules did not stop the naming model from echoing the user's leading verb** - May matter when tuning `SYSTEM_PROMPT` for requests that analyse something in order to improve it, because five rule and example revisions still left 4/5 reference-session titles starting with "Analyse"; try a different lever and compare all eval sessions before stacking more rules. Provenance: [Dream log](./dreams/2026-10-26-1459-gamemaster-checkpoint-261026-1435-improve-session-naming-prompt-auto-context-and.md), `spec/archive/261026-1435-improve-session-naming-prompt-auto-context-and-title-length/verification.md`.
- **Destination and classification:** `wiki/observations.md` - `Observation`
- **Session evidence or selection reason:** Six eval rounds (initial prompt plus five revisions) with the real model; the reference session's titles kept leading with the user's own verb "Analyse" (4/5 in the final round) despite explicit rules and an example. Titles are recorded verbatim in the archived verification.
- **Expected future benefit:** A future tuning pass on `SYSTEM_PROMPT` starts from a different lever instead of spending another round of model calls on more rules.
- **Why this tier:** Supported for one session and one model only; whether the effect recurs, or which lever works, is unproven, so it is not stable module guidance. It is more than episodic because the outcome lists this as optional follow-up work.
