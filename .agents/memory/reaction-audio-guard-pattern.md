---
name: Reaction/overlap audio ducking guard pattern
description: How to safely implement a "live reaction plays over the main line" audio feature without ducking or restoring the wrong speaker.
---

Any live-reaction/audio-ducking feature (a short reaction clip that overlaps
a longer statement) needs all three of:

1. **Pre-fire identity check** — capture the exact sound *instance* (not just
   speaker ID) that's playing when the reaction is scheduled, not just the
   speaker's persona ID. The same persona can speak/interrupt twice in a row
   (e.g. two interruptions back to back); a speaker-ID-only check passes
   incorrectly in that case and the reaction ducks/steps on the wrong clip.
2. **Post-await re-validation** — after any `await` (TTS synthesis, network
   fetch), re-check that the captured sound instance is *still* the active
   one before ducking/playing. The queue can advance while synthesis is in
   flight.
3. **Correct restore target** — restore the ducked sound's volume via that
   specific instance and the *original speaker's own configured volume*
   (`getPersonaVoiceVolume(id)`), never a hardcoded `1.0` and never
   "whatever is current" at cleanup time.

**Why:** This exact bug pattern (missing 1, missing 2, or hardcoded 1.0 in 3)
recurred identically across three separate implementations in this project
(interview.tsx, debate-stage.tsx, arena.tsx) and took multiple code-review
rejection rounds each time to fully close, including a subtle case where a
track has its OWN separate sound ref (e.g. an interrupter's clip plays on a
track distinct from the main queue) — cleanup on that separate track must
also gate on sound-instance identity, not persona ID, or an older clip's
cleanup can wipe out a newer same-persona clip's ownership markers.

**How to apply:** When adding any "X plays over/interrupts Y" audio feature,
thread the captured sound instance itself (not just a speaker id string)
through the scheduling delay and into the ducking function's guards, on both
the check-before-duck and the check-after-await paths, and gate any
ref-clearing cleanup on `soundRef.current === thisInstance`.
