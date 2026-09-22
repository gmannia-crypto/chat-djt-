---
name: Lightweight metric piggybacking on feature_events
description: How to add a new internal counter/metric without a new table, and two aggregation pitfalls to avoid.
---

When a new lightweight internal metric is needed (event counters, not user-facing analytics
tied to a specific device), reuse the existing generic `feature_events` table
(`server/analytics.ts`: `device_id`, `feature`, `action`, `metadata jsonb`) instead of adding a
dedicated table. Use a fixed `deviceId` like `"system"` for events not tied to a real
user/device, a stable `feature` name for the metric family, `action` for the event subtype, and
`metadata` for structured detail.

**Why:** the project already has a working, indexed table plus an admin-auth'd query surface;
a bespoke table just for one counter adds migration/index maintenance for no benefit.

**Pitfalls when aggregating:**
1. If one underlying incident can emit more than one `action` row (e.g. a base event plus a
   "this also failed" follow-up event for the same attempt), aggregate queries must count each
   action exclusively (`FILTER (WHERE action = 'x')` per action, never `action = 'x' OR action = 'y'`
   in a single "total" bucket) — otherwise one incident is double-counted as two.
2. For day-grouping in SQL, use `TO_CHAR(created_at, 'YYYY-MM-DD')`, not `DATE(created_at)`
   followed by `String(row.day).slice(0, 10)` in JS — node-pg returns a `DATE` column as a JS
   `Date` object, so `String(date)` calls `Date.prototype.toString()` and the slice yields a
   non-ISO string like `"Tue Sep 22"`, not `"2026-09-22"`.
