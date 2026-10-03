---
name: Arena audible turn pacing
description: Ordinary conversation should advance with spoken playback, while intentional interruptions remain separate.
---

Keep ordinary Arena turns aligned with audible dialogue rather than letting completed model requests determine the conversation's pace. Intentional firebacks and overlapping reactions are exceptions, not permission for the main conversation to run ahead.

**Why:** Fast text generation alongside slower voice playback makes replies refer to arguments the listener has not heard yet, and undermines the back-and-forth experience. Waiting for speech must not trigger a fetch watchdog that invalidates legitimate reactive replies.

**How to apply:** Preserve playback-aware pacing when optimizing Arena latency. Verify alternating audible speakers, not just successful response requests. Muted mode must still advance text normally.