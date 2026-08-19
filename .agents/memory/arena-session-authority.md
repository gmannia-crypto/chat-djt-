---
name: Arena session authority
description: Rules for keeping debate client timing aligned with server access authorization.
---

Treat a 403 from a debate question or answer endpoint as an expired or unavailable Arena authorization, not as a recoverable model failure. Stop the active loop, halt audio, and present the renewal path rather than retrying with moderator fallback prompts.

**Why:** Retrying a 403 produces a convincing-looking moderator loop with no debater responses. It also masks the actual reason a session can no longer proceed.

**How to apply:** At session start, ensure the server's remaining authorization can cover the selected client duration. During a live session, distinguish server access denial from temporary AI/network failures; only the latter should use recovery/retry behavior.