// Short, curated pitches: no chat generation or arbitrary text-to-speech input.
export const HOME_PREVIEW_LIMIT = 4;
export const HOME_PREVIEW_PERSONAS = [
  { id: "trump", name: "Donald Trump", pitch: "Pick me. I bring big energy, bold arguments, and I never back down. Let's make this debate tremendous." },
  { id: "biden", name: "Joe Biden", pitch: "Here's the deal. Pick me for experience, straight talk, and an argument that puts working people first." },
  { id: "obama", name: "Barack Obama", pitch: "Pick me if you want a thoughtful case, a little perspective, and a debate that gets beyond the shouting." },
  { id: "kamala", name: "Kamala Harris", pitch: "Pick me. I'll ask the tough questions, make the case clearly, and keep the focus on what matters to you." },
  { id: "carville", name: "James Carville", pitch: "Pick me, and we'll cut through the nonsense. I bring the strategy, the sharp elbows, and a little Louisiana fire." },
  { id: "galloway", name: "George Galloway", pitch: "Choose me for a fearless argument. I'll challenge the powerful, demand the evidence, and never dodge a difficult question." },
  { id: "malcolmx", name: "Malcolm X", pitch: "Choose me for clarity and conviction. I'll question the assumptions, confront injustice, and insist that we think for ourselves." },
  { id: "cornellwest", name: "Cornel West", pitch: "Pick me for a debate with heart. We'll bring truth, justice, and love for everyday people into the conversation." },
] as const;
export type HomePreviewPersonaId = typeof HOME_PREVIEW_PERSONAS[number]["id"];

export function normalizePreviewName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function getHomePreviewText(personaId: string, name: string) {
  const persona = HOME_PREVIEW_PERSONAS.find((entry) => entry.id === personaId);
  if (!persona) return null;
  const greeting = normalizePreviewName(name);
  return `${greeting ? `${greeting}, ` : "Hey there, "}${persona.pitch}`;
}