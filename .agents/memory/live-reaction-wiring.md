---
name: Live overlapping reaction wiring
description: Non-obvious decisions for extending the AI overlapping-reaction mechanic to a new exchange type
---

- **Reactor selection differs by format.** Multi-persona exchanges react via a bystander (a persona other than the two speakers); genuine 1-on-1 formats have no bystander available, so the reaction there comes from the other party in the exchange instead. Pick the gating rule (mode-based vs tone-based) already used by that exchange type's other calls, don't assume one scheme fits every endpoint.
- **A reaction must be scheduled off the actual playback start of the line it's meant to overlap**, not fired as soon as that line is queued — queueing only reserves a slot, it doesn't mean nothing is still playing ahead of it.
- **Screens that look like copies of each other (e.g. multiple call-in UIs hitting the same endpoint) are usually separately implemented, not shared code.** Wiring a new mechanic into one does not wire it into the others — check every caller of the endpoint being changed.
