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
 * Builds the invite-success banner's subtitle so the sharer can tell WHICH
 * friend's invite converted (by when it happened), not just an aggregate count.
 * Every pending grant's timestamp is listed — none are dropped or collapsed
 * into a "most recently" summary — so each converted invite stays distinguishable.
 */
export function formatInviteSuccessDetail(inviteSuccess: InviteSuccessInfo): string {
  const times = inviteSuccess.grants.map((g) => formatGrantTime(g.grantedAt)).filter(Boolean);

  if (inviteSuccess.newReferrals === 1) {
    return times[0]
      ? `A friend joined The Arena using your link at ${times[0]}.`
      : "A friend joined The Arena using your link.";
  }

  if (times.length === inviteSuccess.newReferrals && times.length > 0) {
    const joined =
      times.length === 2
        ? `${times[0]} and ${times[1]}`
        : `${times.slice(0, -1).join(", ")}, and ${times[times.length - 1]}`;
    return `${inviteSuccess.newReferrals} friends joined using your link — at ${joined}.`;
  }

  return `${inviteSuccess.newReferrals} friends joined The Arena using your link.`;
}
