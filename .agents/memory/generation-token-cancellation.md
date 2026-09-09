---
name: Generation token vs boolean for async cancellation
description: Why a boolean recheck after an await is insufficient to cancel stale async work, and the generation/version-token pattern that fixes it.
---

## The problem

A common pattern for cancelling stale async work is:

```js
if (!enabledRef.current) return;
const result = await someAsyncCall();
if (!enabledRef.current) { /* cleanup */ return; }
```

This looks safe but has a hole: if the flag goes `false` and then back to `true` again while the await is in flight, the post-await check reads `true` and lets the stale result proceed — even though it started under conditions that no longer apply by the time it resolves. A boolean can't tell "unchanged" from "changed twice."

## The fix

Use a monotonically increasing counter (a "generation" or "version") that is bumped on every state transition (not just transitions to the disabled state). Capture it before starting the async work, and compare — not just read the current boolean — after every await:

```js
const myGeneration = generationRef.current;
const result = await someAsyncCall();
if (myGeneration !== generationRef.current || !enabledRef.current) { /* stale, discard */ return; }
```

Any mismatch means "something changed since I started," regardless of what the current state happens to read now.

## Where this applies

Any async operation gated by a toggle that can flip and flip back before the operation resolves — most concretely, audio/TTS playback gated by a mute preference, but the pattern generalizes to any cancellable async flow (search-as-you-type, optimistic UI, etc.).
