---
name: Arena stale-response guard pattern
description: How to prevent delayed AI-response fetches from jumbling the arena.tsx debate transcript/audio when they resolve after the conversation has moved on.
---

Any async path in `app/arena.tsx` that fetches an AI response and then inserts it
into the transcript (`addMessage`) or audio queue (`queueTTS`) must re-check
that the conversation hasn't advanced to a new main turn since the fetch
started. Without this, a slow network round-trip (interruption, fireback,
Trump interruption, rapid exchange, etc.) can land its message *after* newer,
unrelated turns have already been spoken — reading as two people arguing about
something several exchanges old, or a persona interrupting a line that already
finished. This was reported by users as "conversation gets jumbled if there's
a delay upon its return."

**Why:** these side-channel paths (fireback, interruption, prefetch, rapid
exchange, Trump interruption) run concurrently with or fire independently of
the main scheduler turn loop, but only checked *pre-fetch* state (cooldowns,
current speaker, mounted) — not state *after* the fetch resolved, when the
insert actually happens.

**How to apply:** at the top of the async function, snapshot
`const myGen = speakTokenRef.current;` (the same counter `generateAIResponse`
increments once per main turn). After the fetch resolves and before calling
`addMessage`/`queueTTS`, check `if (speakTokenRef.current !== myGen) return;`
(or `break` inside a loop, e.g. rapid exchange's per-line loop). This mirrors
the guard `generateAIResponse` and `fireClapback` already had; it was added to
`tryArenaFireback`, `triggerInterruption` (both prefetch and fallback paths),
`triggerTrumpInterruption`, and `triggerRapidExchange`.

This guard applies to every AI-response fetch in arena.tsx that inserts into
the transcript/TTS queue, including single-shot user-triggered flows, not
just the scheduler-driven ones. Place the token comparison immediately after
parsing the response body and immediately before the state/message/TTS side
effects — a check placed only before `await res.json()` is not sufficient,
since the scheduler can advance the turn during body parsing. Apply this
pattern to any new insertion path from the start rather than adding it later.
