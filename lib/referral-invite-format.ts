/**
 * referral-invite-format.ts
 *
 * Formats the "invite worked" success banner text (app/index.tsx) so the
 * sharer can tell WHICH friend's invite converted and when, not just an
 * aggregate count. Pulled out of app/index.tsx so it can be unit tested
 * without pulling in React Native.
 */

export interface ReferralGrant {
  id: string;
  grantedAt: string;
  /** The referred friend's display name, when their linked account has one. */
  friendName?: string | null;
}

export interface InviteSuccessInfo {
  newReferrals: number;
  grants: ReferralGrant[];
}

/** Formats a single grant timestamp as a short, human-readable clock time (e.g. "3:42 PM"). */
export function formatGrantTime(grantedAt: string): string {
  const d = new Date(grantedAt);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/**
 * Formats a single grant timestamp as a short date + time (e.g. "Sep 3, 3:42 PM").
 * Used by the lifetime REFERRAL HISTORY card (app/subscribe.tsx), which — unlike
 * the same-day "invite worked" banner — spans grants from many different days.
 */
export function formatGrantDateTime(grantedAt: string): string {
  const d = new Date(grantedAt);
  if (isNaN(d.getTime())) return "";
  const datePart = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const timePart = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${datePart}, ${timePart}`;
}

/**
 * Labels a single grant for display — the friend's name when their linked
 * account has one, falling back to their join time (or "Friend #N" in list
 * contexts that pass a fallback).
 */
function labelForGrant(grant: ReferralGrant): string | undefined {
  const name = grant.friendName?.trim();
  if (name) return name;
  return formatGrantTime(grant.grantedAt) || undefined;
}

/**
 * Builds the invite-success banner's subtitle so the sharer can tell WHICH
 * friend's invite converted (by name when known, otherwise by when it
 * happened), not just an aggregate count. Every pending grant is listed —
 * none are dropped or collapsed into a "most recently" summary — so each
 * converted invite stays distinguishable.
 */
export function formatInviteSuccessDetail(inviteSuccess: InviteSuccessInfo): string {
  const labels = inviteSuccess.grants.map(labelForGrant).filter((l): l is string => !!l);

  if (inviteSuccess.newReferrals === 1) {
    const grant = inviteSuccess.grants[0];
    if (grant?.friendName?.trim()) {
      return `${grant.friendName.trim()} joined The Arena using your link.`;
    }
    return labels[0]
      ? `A friend joined The Arena using your link at ${labels[0]}.`
      : "A friend joined The Arena using your link.";
  }

  if (labels.length === inviteSuccess.newReferrals && labels.length > 0) {
    const allNamed = inviteSuccess.grants.every((g) => !!g.friendName?.trim());
    const joined =
      labels.length === 2
        ? `${labels[0]} and ${labels[1]}`
        : `${labels.slice(0, -1).join(", ")}, and ${labels[labels.length - 1]}`;
    return allNamed
      ? `${joined} joined The Arena using your link.`
      : `${inviteSuccess.newReferrals} friends joined using your link — at ${joined}.`;
  }

  return `${inviteSuccess.newReferrals} friends joined The Arena using your link.`;
}
