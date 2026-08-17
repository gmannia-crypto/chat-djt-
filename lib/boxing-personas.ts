/**
 * Persona IDs that are exclusive to boxing mode (debate-stage.tsx).
 * These personas should be filtered out of any non-boxing entry point
 * (Arena roundtable, Debate of the Day deep links, etc.).
 *
 * Single source of truth — imported by both debate-stage.tsx and arena.tsx.
 */
export const BOXING_EXCLUSIVE_IDS = [
  "muhammadali", "floydmayweather", "georgeforeman",
  "howardcosell", "jimlampley", "maxkellerman",
];
