---
name: Character-break spike alerting
description: Design lesson for periodic detection-plus-notification jobs — dedup state must reflect actual delivery, not just detection.
---

Pattern used for the proactive alert on top of the "Character Break Watch" admin panel
(server/analytics.ts getCharacterBreakStats is the pull-based dashboard; a periodic job
compares each persona's today-so-far volume against its trailing baseline and pushes a
notification when it spikes).

Two lessons that generalize beyond this specific feature:

1. **A spike/anomaly detector needs an absolute floor AND a ratio-over-baseline check, not
   just one.** A ratio-only check flags trivial single-digit swings on low-volume subjects as
   "10x spikes"; an absolute-only check misses real spikes on high-baseline subjects. Subjects
   with zero baseline history need their own, higher absolute bar since there's nothing to
   divide by.

2. **Dedup/suppression state must be keyed off confirmed delivery, not off detection.** The
   first version of this alert inserted its "already notified today" row before attempting
   delivery, so a missing notification-channel config or a transient send failure silently
   and permanently suppressed that day's alert — the exact failure mode the feature exists to
   prevent (an admin never finding out). The fix: record delivery status explicitly
   (sent / failed / skipped_no_config) and only a confirmed `sent` blocks a retry; failures
   and missing config get retried on the next scheduled run.

**Why:** any "detect once per day, then notify" job will eventually run before its delivery
channel is configured or during an outage of that channel. If "detected" and "delivered" share
one dedup flag, that class of failure is invisible and unrecoverable until the next calendar
day.

**How to apply:** when building another periodic anomaly-alert job (new metric, new channel),
give the dedup table a status column with at least sent/failed/skipped states, and gate
re-notification on status, not on row existence.
