---
name: Cross-device account identity
description: How this app identifies a user across devices when building server-authoritative per-user state (e.g. daily rewards, unlocks), and why device_id alone is not tamper-proof.
---

High-value, cross-device entitlements must use a server-verifiable account session. Resettable device identifiers, fingerprints, and network addresses are abuse signals, not proof of identity.

**Why:** Client-controlled identifiers can be replaced or forged, while network correlation can misidentify shared users. Neither can safely authorize persistent rewards.

**How to apply:** Require verified account ownership for valuable claims. Use heuristic signals only as supplementary risk controls, and merge legacy state once under an explicit migration policy.
