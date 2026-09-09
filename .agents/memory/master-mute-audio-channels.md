---
name: Master mute toggle scope in this app
description: A voice/audio mute feature must enumerate every independently-tracked audio channel, not just the main playback queue.
---

## The pattern

In this app's live-session screens (arena.tsx, interview.tsx, debate-stage.tsx, game.tsx), audio playback is not a single queue. A "mute everything" toggle has to cover each of these independently:

- The main TTS queue (sequential persona lines).
- Interruption/fireback audio, played outside the normal queue when a persona interrupts.
- Live reaction-overlap audio, which plays ducked *on top of* the main line via a prefetched-audio promise.
- One-off direct calls that bypass the queue entirely: parting shots, ending-exchange lines (`playAndAwait`-style helpers), and user-triggered "Replay"/"Listen" buttons on transcript cards.

## Why this matters

Fixing only the main queue's mute handling leaves the other channels able to start or continue playing audibly after mute — a real, user-visible bug, and exactly the kind of gap an audio-mute code review will keep finding round after round if channels are fixed one at a time reactively instead of enumerated up front.

## How to apply

When asked to make a mute/voice-toggle "fully authoritative," first grep the file(s) for every `playTTS`/`playPrefetchedAudio`/`Audio.Sound.createAsync`/`new window.Audio(...)` call site, not just the ones already routed through the main queue's stop-on-mute logic. Each one needs its own tracked-sound reference (so a mute effect can stop it) and its own recheck against a generation token (see `generation-token-cancellation.md`) after every await in its call path.
