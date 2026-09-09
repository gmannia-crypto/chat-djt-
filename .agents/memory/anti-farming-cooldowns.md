---
name: Anti-farming submission cooldowns
description: Design lesson for a per-device/per-IP cooldown gate that stops rapid repeat submissions to a scoring/leaderboard endpoint, especially under an autoscaled deployment.
---

A per-submission sanity validator (rejecting implausible values) does not stop farming by
itself — a script can still fire many back-to-back requests, each individually valid, to fish
for a lucky outcome. A cooldown gate needs these properties to actually hold:

- **The cooldown state must live in shared durable storage (e.g. the database), not process
  memory**, whenever the app can run more than one server instance (autoscale deployments,
  restarts). A process-local Map only guards the instance that holds it — concurrent requests
  routed to a different instance see no cooldown at all.
- **Reservation must be atomic across instances**, not just within one process. An
  `INSERT ... ON CONFLICT (key) DO UPDATE ... WHERE <still expired>` keeps this atomic without
  app-level locking: Postgres holds the row lock across the statement, so concurrent writers to
  the same key are serialized by the database itself, regardless of which instance issued them.
- **The cooldown reservation and the result persistence should share one transaction** rather
  than being reserved-then-written-then-released-on-failure as separate steps. Splitting them
  reopens the same kind of gap it's meant to close: a failure between the two steps can leave
  the reservation and the persisted result disagreeing about what happened. One transaction
  means both land or neither does.
- **A cooldown length derived from client-reported data must be capped server-side**, or one
  submission can lock out everyone sharing that key for an attacker-chosen length of time.
- **A per-IP identity used for anti-abuse must come from a proxy-trust-aware source** (e.g.
  Express's `req.ip` with `trust proxy` set to the app's actual proxy hop count), not a raw
  client-suppliable header — otherwise the IP half of the cooldown is trivially spoofable.

**Why:** each of these was independently caught in review of the same anti-farming cooldown;
none are about bigger limits, they're structural gaps that survive a first, apparently-working,
single-process implementation.
