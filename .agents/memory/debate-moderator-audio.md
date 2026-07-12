---
name: Debate moderator audio pattern
description: How to make the moderator speak without being cut off by persona queue audio
---

## Rule
For all moderator question/transition speech in `debate-stage.tsx`, use:
```ts
await waitForQueueDrain().then(() => speakModeratorNow(text, id, { wait: true }))
```
NOT `enqueueTTSAndWait(text, id, msgId)`.

**Why:** `enqueueTTSAndWait` adds moderator audio to the TTS queue *behind* any in-progress persona audio. If the previous persona's audio is long, the moderator queues up but the `Promise.all` wrapper still lets `fetchAnswerFrom` resolve early. In edge cases the persona answer can be pushed to the queue before `onComplete` fires, causing the persona to start mid-moderator. The direct path (`speakModeratorNow`) completely bypasses the queue.

**How to apply:**
1. Call `waitForQueueDrain()` first — polls `ttsRunningRef.current === false && ttsQueueRef.current.length === 0` every 100ms (25s safety cap).
2. Set `activeSpeaker(mod.personaId)` and `activeSpeakerRef.current = mod.personaId` so the glow indicator works.
3. Call `speakModeratorNow(text, mod.personaId, { wait: true })` — resolves on `didJustFinish`.
4. Reset `activeSpeaker(null)` and `activeSpeakerRef.current = null` after.
5. Only then call `enrichAndAddMessage(personaAnswer)` to start persona audio.

`enqueueTTSAndWait` is still correct for regular persona turns.

## Affected locations (debate-stage.tsx)
- `runModeratorOpening` — opening question
- `runLoop` topic transition block — transition question
