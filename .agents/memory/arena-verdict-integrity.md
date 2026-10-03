---
name: Arena verdict integrity
description: Rules for keeping Arena winners tied to verified in-session fact checks.
---

Arena’s DC verdict must receive the opaque lie tokens issued by the real-time fact checker, alongside the transcript. If the proposed winner has more confirmed lies than the cleanest eligible opponent, the cleanest opponent takes the result.

**Why:** The model only has reliable fact-check context when it receives those server-issued tokens. A higher threshold can allow a factually worse debater to win, and first-persona fallback creates a selection-order bias.

**How to apply:** Preserve this rule across every way an Arena session can end (automatic timeout, manual end, reaction-triggered verdict, and the verdict modal). When the remote judge is unavailable or returns an invalid participant, determine a local result from the session fact-check record rather than the selected-persona order.

Trump's reaction to another persona winning must chastise both the DC verdict and the winner, not claim the winner got zero points or that the viewer chose them.

**Why:** The user explicitly requested this behavior. Audience tap totals can be zero even for the official DC winner; treating them as the winning score misrepresents the result.

**How to apply:** Keep official verdict outcomes separate from audience tallies in post-debate dialogue. Determine Trump's loss from the official winner's identity, not a comparison of audience points.