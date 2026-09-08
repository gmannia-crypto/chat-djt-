---
name: DC University feature architecture
description: How the DC University lecture/quiz/certificate feature is built and how to extend it to more courses.
---

DC University reuses existing Arena/Interview infrastructure end-to-end rather than creating new personas, voices, or portraits:
- Educators are existing Arena personas (`server/routes.ts` `ARENA_PERSONA_PROMPTS`/`PERSONA_VOICE_IDS`/`ARENA_NAME_MAP`) — course content just wraps `getArenaPersonaPrompt(educatorId)` in a "teaching mode" system prompt via `buildDcLectureSystemPrompt`.
- Lecture content is curated "beats" (topic + fact bullets) in `server/dc-university-curriculum.ts`, not freeform AI generation — the AI is instructed to only teach the provided facts, so accuracy stays anchored to curated content rather than model invention.
- All 9 courses now have full beats/quiz content (History was built and reviewed first, then the other 8 were authored following the same pattern) — no `comingSoon` stubs remain.
- Each course also has a `books: BookReference[]` field (educator's own books + adjacent subject books), built via an `amazonSearch()` helper that mirrors the app-wide Arena affiliate-link convention (`amazon.com/s?k=...&tag=trumpbot-20`, not direct ASIN links). Contested/Afrocentric theses (e.g. Ben-Jochannan, Clarke) are framed as "X argued/wrote Y" rather than asserted as settled fact — same policy comment documents this in the curriculum file.
- Billing: 1 DC token per lecture-minute via `useTokens()`, charged once at `/api/dc-university/lecture/start`; Q&A during the lecture is free.
- Session state (current beat index, transcript) lives in an in-memory `Map` in routes.ts (`dcUniversitySessions`), same throwaway-session pattern as other ephemeral Arena state — not persisted to DB.
- Progress/streak/points/certificates persist in two lazily-created raw-SQL tables (`dc_university_progress`, `dc_university_completions`), following the `arena_user_usage` convention (CREATE TABLE IF NOT EXISTS on each request) rather than Drizzle schema.
- Quiz grading is deterministic (fixed pre-authored answer key per course+length), not AI-graded, so certificates require a real 70% pass threshold.
