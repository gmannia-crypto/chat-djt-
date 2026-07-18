---
name: Premium persona lock/unlock system
description: How carlin, drbenj, pressley are locked and how to unlock them — 3 paths each
---

Three new premium personas with 3 unlock paths each, all managed in `lib/persona-locks.tsx`:

| Persona  | Token price | Time threshold | Arena wins |
|----------|-------------|----------------|------------|
| carlin   | 25 tokens   | 180 min (3h)   | 5 wins     |
| drbenj   | 20 tokens   | 120 min (2h)   | 3 wins     |
| pressley | 15 tokens   | 60 min (1h)    | 1 win      |

- `carlin` and `drbenj` are **hidden** (PREMIUM_PERSONA_CONFIGS[id].hidden === true) — not shown in selectors until unlocked.
- `pressley` is **visible-locked** — shown in guest grid with a padlock badge and token price.
- AsyncStorage keys: `PREMIUM_UNLOCKED_KEY = "premium_personas_unlocked_v2"`, `SESSION_MINUTES_KEY`, `ARENA_WINS_KEY`
- `PersonaLocksProvider` is mounted in `_layout.tsx` between `TokenProvider` and `SoundProvider`.
- Arena session end calls `addArenaWin()` which auto-checks thresholds and announces unlocks via `addSystemMessage`.
- The mystery box personas (8 slots: alexjones/obama/etc.) are separate — handled by `lib/persona-unlocks.tsx`.

**Why:** Hidden personas drive discovery/FOMO. Three unlock paths (spend, time, skill) cover all user types.
