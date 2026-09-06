---
name: Adding a moderator/interviewer-only persona
description: Which registries actually need edits when a new persona is added ONLY as a debate moderator + interview host, not as a playable arena combatant.
---

When a new persona should only serve as a **moderator** and/or **interviewer** (not a
selectable combatant in the multi-persona arena free-for-all), you do NOT need to touch
the client combatant roster or write relationship data. Full combatant registration
(arena.tsx `PERSONA_IDS` + a persona object with `relationships` to dozens of other
personas) is a much bigger job — only do it if the persona must actually fight in the
arena.

For moderator/interviewer-only personas, the minimum registry set is:

- `server/routes.ts`:
  - `ARENA_PERSONA_PROMPTS` — one full entry with personality + an `AS MODERATOR:` section
    and an `AS INTERVIEWER:` section in the SAME prompt block (see e.g. `neiltyson`,
    `stephena` for the pattern — these are not separate registries).
  - `PERSONA_NO_AI_DEFLECTIONS` — required, or `scripts/check-no-ai-deflections.js` fails
    (it checks every non-trump `ARENA_PERSONA_PROMPTS` key has a tailored entry).
  - `PERSONA_VOICE_IDS` — appears in the file TWICE (once near the top of routes.ts, once
    again in a `PERSONA_VOICE_IDS_LOCAL` block further down for a separate TTS endpoint).
    Both need the new voice ID or the second endpoint falls back to no voice.
  - `ARENA_NAME_MAP` — first-name display mapping.
  - `INTERVIEWER_IDS` array — add here for interview-mode eligibility. Do NOT add to
    `INTERVIEWEE_IDS` unless the persona should also be interviewable as a guest.
- `lib/debate-moderator.ts`:
  - `ModeratorStyle` union type, `MODERATORS` registry entry (`name`/`personaId`/`bias`),
    and a `MODERATOR_LEANINGS` entry (favor/target persona-id lists, or `{favor:[],target:[]}`
    if intentionally neutral).
  - The moderator picker UI (`app/debate-stage.tsx`) reads `Object.keys(MODERATORS)`
    directly — no separate UI list to update.
- Portrait maps: `app/interview.tsx` and `app/debate-stage.tsx` each have their own
  `PERSONA_PORTRAITS` map (`require("@/assets/images/persona-<id>.png")`) — both need the
  new id. `app/interview.tsx`'s interviewer dropdown is server-driven (fetches
  `/api/arena/interviewers`, built from `INTERVIEWER_IDS` filtered by having an
  `ARENA_PERSONA_PROMPTS` entry) — no separate client list to edit there either.

After registry edits: run `node scripts/check-persona-images.js --update` (new avatar
files show as "not yet in manifest" until you do), `node scripts/check-no-ai-deflections.js`,
and `npx tsc --noEmit` (compare the error count against the pre-existing baseline — this
codebase has a few long-standing duplicate-object-key errors in routes.ts that are not
regressions).
