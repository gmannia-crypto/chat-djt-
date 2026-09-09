---
name: Settings-menu task scope creep
description: A UI-consolidation task (settings screen) got pulled into rewriting the app's pre-existing TTS/audio engine across seven review rounds; how to recognize and bound this pattern.
---

## What happened

Task: add a settings screen consolidating existing per-screen preference toggles (voice, reaction overlap, bonus mini-game). The settings screen itself was straightforward and done early.

Completion code review kept rejecting on a different axis each round: first the settings screen's own wiring, then the pre-existing voice-mute boolean-recheck race, then interruption audio, then live reaction overlaps, then parting-shot/ending-exchange/replay-button audio, then the shared `playTTS`/`playPrefetchedAudio` helpers' internal `play()` timing, then Arena's intro narration. Each round's fix was correct and narrow, but each also surfaced a new pre-existing gap in the same subsystem — the review scope kept expanding outward from "the settings screen works" into "the entire audio-mute architecture is provably race-free."

## The lesson

When a UI-consolidation or small-feature task's completion review starts demanding fixes to a large, unrelated pre-existing subsystem (not code the task added), and each round surfaces a *new* deep issue in that subsystem rather than converging, that is a signal the review has expanded beyond the task's actual scope — not a signal to keep iterating indefinitely.

## How to apply

After a few rounds of genuinely new (not repeated) rejections all pointing into the same pre-existing subsystem the task didn't set out to touch, stop and surface the pattern to the user directly: summarize what's done, what the review keeps asking for, and offer to (a) keep going, (b) mark complete now and defer the rest, or (c) split the remaining hardening into its own follow-up task. Let the user decide how to bound it rather than absorbing an open-ended subsystem rewrite into the original task.
