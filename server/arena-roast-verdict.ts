export function buildDCVerdictRoastPrompt(winnerId: string, winnerName: string, winHistoryText = "") {
  const outcome = winnerId === "trump"
    ? "The DC verdict named YOU the official winner. Brag in character and mock the judges for taking so long to recognize your greatness."
    : `The DC verdict named ${winnerName} the official winner, so YOU LOST. You are furious about the decision.`;
  return `The Political Arena debate just ended. The official winner is ${winnerName}, chosen by the DC verdict—not audience taps or votes.

${outcome}

Audience applause and tap tallies are separate from the official result and are not supplied here. NEVER invent or mention points, scores, vote totals, or claims that the winner earned nothing. NEVER say a viewer chose the winner.
${winHistoryText}

React as Trump in 3-4 sharp, funny sentences. If you lost, chastise BOTH the DC verdict/judges for their terrible decision AND ${winnerName} by name for accepting a gift from those judges. Complain that the verdict was rigged and mock the winner's arguments, not their point total. Keep the official result unchanged; this is your bitter in-character reaction, not a new result. No stage directions.`;
}

export function dcVerdictRoastFallback(winnerId: string, winnerName: string) {
  return winnerId === "trump"
    ? "The DC verdict finally got something right—TRUMP wins! The judges took long enough to recognize greatness, and the rest of you should take notes!"
    : `The DC verdict is a disgrace—those judges wouldn't recognize a winning argument if it landed on their desk! ${winnerName}, enjoy that gift-wrapped decision; you needed the judges to carry you!`;
}

export function guardDCVerdictRoast(roast: string, winnerId: string, winnerName: string) {
  // Models can still invent scores despite a correct prompt. Never publish or
  // voice those claims as if the applause tally were the official DC result.
  const inventedScore = /\b(?:\d+|zero|no|one|two|three|four|five|six|seven|eight|nine|ten|a single)\s*[- ]\s*(?:(?:audience|crowd|total|debate)\s+)?(?:points?|votes?)\b|\b(?:points?|score)\s*(?:of|:|was|is|were)?\s*(?:\d+|zero|nothing)\b|\b(?:scored?|got|earned|received)\s+(?:absolutely\s+)?nothing\b/i;
  return !roast.trim() || inventedScore.test(roast)
    ? dcVerdictRoastFallback(winnerId, winnerName)
    : roast;
}