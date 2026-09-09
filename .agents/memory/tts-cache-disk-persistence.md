---
name: TTS cache persistence
description: Why server/persona-tts.ts's cache warming uses a shared DB, not local disk
---

The in-memory TTS cache survives restarts/redeploys by mirroring itself to a
shared Postgres store and reloading from it at boot, rather than to a local
disk file.

**Why:** this project's deployment target is `autoscale`, where a redeploy or
scale-to-zero cold start hands the process a brand-new, empty filesystem — a
same-instance disk file would never be visible to the replacement instance.
A shared DB store is visible to every instance and survives redeploys, which
a same-container-only mechanism cannot.

**How to apply:** if this project's deployment target or storage story
changes, revisit whether the shared-store approach is still
necessary/sufficient. Any similar "warm cache across restarts" need in this
project should default to shared storage, not local disk, for the same reason.
