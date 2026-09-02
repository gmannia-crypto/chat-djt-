---
name: Arena Team Battle mode (ideology groups)
description: How the 4v4 ideology-group team battle feature is designed in app/arena.tsx and server/routes.ts — read before touching group rosters, team drafting, sentiment, or team win-crediting.
---

## Architecture
- Persona data is **client-only** in `app/arena.tsx` (personality, relationships, trigger words, colors). Voice/prompt/emotion config for the same persona id lives **separately server-side** in `server/routes.ts`. Any new persona needs both sides kept in sync by matching id.
- Ideology groups (`IDEOLOGY_GROUPS`, `PERSONA_GROUPS`) are also client-only, defined in `app/arena.tsx`. **Multi-group membership is allowed** — several personas intentionally sit in 2+ groups (e.g. Scott Jennings in MAGA Populists + Imperialist West).

## Team drafting rule
When drafting a 4v4 matchup between group A and group B, any persona who is a member of **both** groups is excluded from **both** rosters for that specific matchup (`draftIdeologyTeams`). This was an explicit user rule, not incidental — don't "fix" it by picking a side for them.

## Team dynamics
During an active team battle, `ACTIVE_TEAM_ASSIGNMENTS` (a module-level mutable map, not React state) holds personaId → "A"/"B" and is read by `teamAdjustedSentiment()` to floor same-team sentiment (~78) at the two relationship-lookup call sites used for response-probability and emotional-state updates. It's a plain module-level `let` (not a ref/context) because those two functions are outside the component tree. It's cleared (`= null`) on debate stop/exit — a stale value would leak team bonuses into the next, unrelated debate.

## Win crediting (separate systems, cross-linked)
- Individual global wins: `arena_wins` / `arena_wins_global` tables, `/api/arena/record-win`.
- Team/group wins: **separate** `arena_team_wins` / `arena_team_wins_global` tables, `/api/arena/record-team-win`. Winning group = higher sum of `personaPoints` across its 4 members (not the same as the overall top individual scorer, who could be on the losing team).
- **Explicit product rule**: a group win also credits an individual global win to the group's MVP (highest `personaPoints` within the *winning* team only). This crediting happens inside `record-team-win`, not via a second call to `record-win` — calling both would double-credit the MVP when they're also the overall top scorer.

## Known gap
Tournament/bracket format (sequential 1v1 sub-matches with a team-level tally) was requested as an alternative to the team-roundtable format but is **not built** — only the roundtable team-battle format exists as of the last session that touched this.
