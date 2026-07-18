---
name: routes.ts task-agent duplication risk
description: Task agents repeatedly duplicated server/routes.ts content, making it 4-5x its correct size and causing esbuild symbol-redeclaration errors.
---

## Rule
After any batch of task-agent merges, check `wc -l server/routes.ts`. If it exceeds ~12,000 lines the file has been duplicated and needs surgery.

## How to detect
- Backend fails with esbuild `Expected ";" but found "\"express\""` or `symbol already declared` errors.
- `grep -n "^export async function registerRoutes" server/routes.ts` returns more than one hit.

## How to fix
1. Find the line number where the SECOND copy of `registerRoutes` starts.
2. Find the real end of the first copy: `grep -n "^  return httpServer" server/routes.ts` — that line + 1 (the closing `}`) is the cut point.
3. `head -n <cutline> server/routes.ts > /tmp/clean.ts && cp /tmp/clean.ts server/routes.ts`
4. Restart the Start Backend workflow.

**Why:** Task agents read the whole file, make edits, then write the entire file back. If two agents run against the same file concurrently (or one agent's write included already-merged content), the file content gets concatenated rather than replaced. The symptom is `registerRoutes` appearing 2-4 times.

**How to apply:** Run the wc -l check after every batch of task-agent merges to server/routes.ts before restarting the backend.
