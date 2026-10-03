---
name: Arena audible turn pacing
description: Ordinary conversation should advance with spoken playback, while intentional interruptions remain separate.
---

Keep ordinary Arena turns aligned with audible dialogue rather than letting completed model requests determine the conversation's pace. Intentional firebacks and overlapping reactions are exceptions, not permission for the main conversation to run ahead.

**Why:** Fast text generation alongside slower voice playback makes replies refer to arguments the listener has not heard yet, and undermines the back-and-forth experience. Waiting for speech must not trigger a fetch watchdog that invalidates legitimate reactive replies.

**How to apply:** Preserve playback-aware pacing when optimizing Arena latency. Prepare one upcoming reply as soon as the current full text is known, including while its voice is still being synthesized; publishing its transcript or playing its voice must wait for the current turn to finish. Cancel that prepared reply if an intervening speaker or a stopped session makes it stale. Muted mode must still advance text normally.

Network generation and voice synthesis must not both start only after the preceding speech ends. A request timeout must remain active while its caller awaits the request, rather than depending on that same blocked scheduler to run.

**Why:** The user reported that Arena's conversational flow was gone, specifically confirming long pauses or conversations stopping. Fully sequential speech → response generation → voice synthesis creates avoidable silence, and a blocked scheduler cannot recover its own hung request.

**How to apply:** Keep lookahead bounded to one ordinary reply; do not remove the audible handoff or turn-cancellation checks to gain speed.

Voice-provider latency must be part of pacing verification, not just model latency. Arena may progressively prepare/play web MP3 audio, but must release the ordinary floor on actual completion, never the stream's estimated duration. Other screens keep their established audio behavior; native URL playback should not acquire a new full-download prerequisite.

**Why:** The user repeated that there was still too much dead air after a controlled test passed. That test hid the substantially slower real voice synthesis. Waiting for confirmed playback before preparation, and waiting for a full audio download before playback, both lost useful time. Previous web streaming had also caused premature cutoffs because consumers trusted incomplete duration estimates.

**How to apply:** Include slowly arriving streamed audio and real-provider playback checks. Check consecutive handoffs, not just one successful clip. Keep the ordinary reply, rapid exchange, and interruption preparation paths from blocking one another's voice requests.

## Browser playback verification

Observe media completion in capture phase before Expo's playback callbacks reset or unload the element. Keep references to the actual media objects; Expo's audio elements can be detached from the document.

**Why:** A browser timing check falsely reported missing completion because Expo reset the media during its time-update handler before the normal ending observer could record it. Querying document audio elements also failed to pause the detached sound used by the real queue.

**How to apply:** Verify actual playback progress/completion before cleanup, and simulate stalls on the tracked sound rather than assuming all media lives in the DOM.