---
name: Referral conversion notification pattern
description: How the sharer learns their referral link converted (Mystery Box "invite worked" moment) without duplicating referral-claim logic
---

Referral credit is granted atomically inside `makeReferralClaimHandler` (server/referral-handler.ts) the moment a friend claims a code. To let the *sharer* know their invite converted without re-deriving that logic elsewhere, add a boolean flag column on the grant row (`acknowledged_by_referrer`) rather than a separate notifications table.

**Why:** the referral_grants table is already the source of truth for "who invited whom and when"; a per-row seen/unseen flag lets a stateless GET compute "any unseen grants for this device" without joining anything else, and POST-to-ack is a single UPDATE.

**How to apply:** expose `GET /api/referral/notifications` (unacknowledged count + token total for `x-device-id`) and `POST /api/referral/notifications/ack` (marks all unacknowledged grants for that device seen). Client checks once per app open (guard with a ref so it doesn't refire on every re-render), shows a dismissible banner/pip, and dismiss calls ack. Don't reuse `/api/referral/stats` for this — it's a lifetime aggregate with no unseen/seen distinction.
