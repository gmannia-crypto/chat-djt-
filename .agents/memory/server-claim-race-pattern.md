---
name: Server-authoritative claim race pattern
description: How to make a "claim once per period" endpoint (daily rewards, one-time bonuses) safe under concurrent requests without turning a race into a 500.
---

Create the unique claim-state row idempotently before taking a row lock; locking a row that does not exist provides no serialization.

**Why:** Concurrent first claims can both observe absence and race into a uniqueness failure rather than a clean duplicate response.

**How to apply:** Ensure the row exists, then lock it and perform eligibility checking plus mutation in one transaction.
