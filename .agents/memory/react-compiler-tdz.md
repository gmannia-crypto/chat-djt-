---
name: React Compiler TDZ rule
description: React Compiler (enabled in this project) strictly enforces temporal dead zone — hooks must come after their referenced variables in the component body.
---

**The rule:** Every `useState`, `useRef`, `useSharedValue` etc. must appear BEFORE any `useEffect`/`useCallback`/`useMemo` that references it in the same component function body.

**Why:** The compiler extracts/reorders hook closures in ways that can evaluate a reference before the `const` binding is initialized, causing `ReferenceError: Cannot access 'X' before initialization`.

**How to apply:** When adding a new `useEffect` that closes over state or refs, place it after all variables it references. The crash surface is always `InterviewScreen` (or similar large component). Fix: move declaration above the hook, or move the hook below the declaration.
