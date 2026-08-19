---
name: Debate topic fallback
description: Keep the 1-on-1 debate start flow usable during slow topic generation.
---

Custom AI-generated topics are an enhancement, not a prerequisite for starting a debate. If the topic request exceeds its client wait window or fails to reach the server, activate the curated generic topic set and leave the user a visible retry option.

**Why:** Upstream topic generation can take tens of seconds. Disabling the start action for the entire wait makes a working debate flow appear stuck.

**How to apply:** Preserve the bounded request and stale-request protection when changing topic generation. Do not remove the generic fallback in favor of an unbounded loading state.