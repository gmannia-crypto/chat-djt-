---
name: Dev proxy depends on frontend
description: Diagnosing apparently broken dev APIs when the frontend workflow has been killed.
---

The Replit development domain may return 502 for API calls even while the backend is healthy when the frontend/Metro workflow has been killed. This has occurred under memory pressure after TypeScript checks. The API began returning its expected response again once the frontend workflow was running.

**Why:** a proxied 502 was initially indistinguishable from a backend regression until workflow state showed the frontend had been killed; the backend had started cleanly and logged no request.

**How to apply:** when an API probe through the dev domain returns 502, check both backend and frontend workflow status and their logs before changing endpoint logic. Do not interpret this particular proxy response as a backend test failure without an incoming backend request.