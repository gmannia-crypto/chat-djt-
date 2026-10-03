// Short, curated pitches: no chat generation or arbitrary text-to-speech input.
export const HOME_PREVIEW_LIMIT = 4;
export const HOME_PREVIEW_PERSONAS = [
  { id: "trump", name: "Donald Trump", pitch: "Pick me for America first, strong borders, and business over bureaucracy. I'll take on the socialist crowd and make this debate tremendous." },
  { id: "biden", name: "Joe Biden", pitch: "Here's the deal. Pick me for experience, straight talk, and an argument that puts working people first." },
  { id: "obama", name: "Barack Obama", pitch: "Pick me if you want a thoughtful case, a little perspective, and a debate that gets beyond the shouting." },
  { id: "kamala", name: "Kamala Harris", pitch: "Pick me. I'll ask the tough questions, make the case clearly, and keep the focus on what matters to you." },
  { id: "carville", name: "James Carville", pitch: "Pick me, and we'll cut through the nonsense. I bring the strategy, the sharp elbows, and a little Louisiana fire." },
  { id: "galloway", name: "George Galloway", pitch: "Pick me to confront imperialism, endless wars, and billionaire power. I'll take on the establishment and stand with working people." },
  { id: "cornellwest", name: "Cornel West", pitch: "Choose me for economic justice over corporate greed. I'll challenge conservative politics and insist that working people, not billionaires, come first." },
  { id: "maponga", name: "Joshua Maponga", pitch: "I put African sovereignty before colonial interests. Choose me to challenge Western power and ask whose knowledge counts." },
  { id: "candace", name: "Candace Owens", pitch: "Pick me to challenge progressive politics, identity narratives, and the mainstream media. I'll make the other side defend every assumption." },
  { id: "rogan", name: "Joe Rogan", pitch: "Choose me if you're curious. Let's question everything, explore unexpected ideas, and find out where the conversation takes us." },
  { id: "musk", name: "Elon Musk", pitch: "Pick me for free enterprise, disruptive technology, and less bureaucracy. I'll argue that builders, not government planners, create the future." },
  { id: "berniesanders", name: "Bernie Sanders", pitch: "Choose me to take on corporate power. We'll talk wages, healthcare, and why working people deserve a fair deal." },
  { id: "tuckercarlson", name: "Tucker Carlson", pitch: "Choose me to challenge liberal elites, foreign intervention, and the official story. I'll ask why ordinary Americans keep paying the price." },
] as const;
export type HomePreviewPersonaId = typeof HOME_PREVIEW_PERSONAS[number]["id"];

// Matchups are curated, not arbitrary pairs of two like-minded speakers.
export const HOME_PREVIEW_MATCHUPS = [
  ["trump", "berniesanders"],
  ["trump", "cornellwest"],
  ["trump", "galloway"],
  ["trump", "maponga"],
  ["candace", "cornellwest"],
  ["candace", "maponga"],
  ["candace", "berniesanders"],
  ["candace", "galloway"],
  ["tuckercarlson", "berniesanders"],
  ["tuckercarlson", "cornellwest"],
  ["tuckercarlson", "maponga"],
  ["musk", "berniesanders"],
  ["musk", "cornellwest"],
  ["musk", "galloway"],
  ["musk", "maponga"],
] as const satisfies readonly (readonly [HomePreviewPersonaId, HomePreviewPersonaId])[];

export const HOME_PREVIEW_IDEOLOGY: Record<HomePreviewPersonaId, string> = {
  trump: "America-first, nationalist right",
  biden: "Establishment, center-left Democrat",
  obama: "Center-left, liberal Democrat",
  kamala: "Liberal Democrat",
  carville: "Establishment Democratic strategist",
  galloway: "Socialist, anti-imperialist",
  cornellwest: "Progressive, anti-corporate left",
  maponga: "African-centered, anti-colonial",
  candace: "Populist conservative",
  rogan: "Anti-establishment, right-leaning",
  musk: "Tech capitalist, libertarian-leaning",
  berniesanders: "Democratic socialist",
  tuckercarlson: "Populist, nationalist right",
};

export type HomePreviewPair = { left: HomePreviewPersonaId; right: HomePreviewPersonaId };

export function getHomePreviewMatchupOptions(): HomePreviewPair[] {
  return HOME_PREVIEW_MATCHUPS.flatMap(([left, right]) => [
    { left, right }, { left: right, right: left },
  ]);
}

export function getHomePreviewOpponents(id: HomePreviewPersonaId): HomePreviewPersonaId[] {
  const curated = HOME_PREVIEW_MATCHUPS.flatMap<HomePreviewPersonaId>(([left, right]) =>
    left === id ? [right] : right === id ? [left] : [],
  );
  if (curated.length) return [...new Set(curated)];
  // Manually selected Democrats face a right-leaning speaker; Rogan faces
  // a left-wing speaker. They remain selectable without diluting shuffle.
  return id === "rogan"
    ? ["berniesanders", "cornellwest", "galloway", "maponga"]
    : ["trump", "candace", "tuckercarlson", "musk"];
}

export function normalizePreviewName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function getHomePreviewText(personaId: string, name: string) {
  const persona = HOME_PREVIEW_PERSONAS.find((entry) => entry.id === personaId);
  if (!persona) return null;
  const greeting = normalizePreviewName(name);
  return `${greeting ? `${greeting}, ` : "Hey there, "}${persona.pitch}`;
}