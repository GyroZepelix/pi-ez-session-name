# Observations

Tentative repository-local findings retained for later comparison. This page is used by Dream and memory maintenance, not normal task context.

## Naming prompt tuning

- **More prompt rules did not stop the naming model from echoing the user's leading verb** - May matter when tuning `SYSTEM_PROMPT` for requests that analyse something in order to improve it, because five rule and example revisions still left 4/5 reference-session titles starting with "Analyse"; try a different lever and compare all eval sessions before stacking more rules. Provenance: [Dream log](./dreams/2026-10-26-1459-gamemaster-checkpoint-261026-1435-improve-session-naming-prompt-auto-context-and.md), `spec/archive/261026-1435-improve-session-naming-prompt-auto-context-and-title-length/verification.md`.
