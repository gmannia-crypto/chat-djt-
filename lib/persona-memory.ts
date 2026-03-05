import AsyncStorage from "@react-native-async-storage/async-storage";

const MEMORY_KEY = "chatdjt_persona_memory";

interface PersonaTraits {
  traits: string[];
  sportsBias?: Record<string, string[] | string>;
  catchphrases: string[];
  baseOpinions: Record<string, string>;
}

const PERSONA_TRAITS: Record<string, PersonaTraits> = {
  trump: {
    traits: ["boastful", "competitive", "repeats himself", "sports fanatic"],
    sportsBias: {
      nfl: ["Chiefs", "Patriots", "Cowboys"],
      nba: ["Lakers", "Bulls"],
      ufc: ["McGregor", "Jones"],
    },
    catchphrases: ["Believe me!", "The best!", "Tremendous!"],
    baseOpinions: { buffett: "rival", grandma: "fond", musk: "interested", jordan: "competitive", bernie: "funny guy", ruckus: "loyal supporter" },
  },
  buffett: {
    traits: ["patient", "analytical", "cautious"],
    sportsBias: { nfl: ["Packers"], nba: "not interested" },
    catchphrases: ["Be fearful when others are greedy...", "Price is what you pay..."],
    baseOpinions: { trump: "bemused", grandma: "respectful", musk: "skeptical", jordan: "admires discipline" },
  },
  grandma: {
    traits: ["warm", "worried", "nostalgic"],
    catchphrases: ["Bless your heart.", "Have you eaten?", "When I was your age..."],
    baseOpinions: { trump: "confused but supportive", buffett: "worried about his diet", musk: "needs a jacket", bernie: "reminds me of my nephew" },
  },
  musk: {
    traits: ["visionary", "erratic", "meme-lord"],
    catchphrases: ["To the moon!", "Literally.", "Dogecoin."],
    baseOpinions: { trump: "entertaining", buffett: "old school", grandma: "wholesome", genie: "fascinating tech" },
  },
  suze: {
    traits: ["protective", "blunt", "caring"],
    catchphrases: ["DENIED!", "You are worthy!", "Can you afford this?"],
    baseOpinions: { trump: "worried", buffett: "respects", grandma: "wants her to save more" },
  },
  dave: {
    traits: ["loud", "passionate", "debt-averse"],
    catchphrases: ["DEBT IS DUMB!", "Live like no one else!"],
    baseOpinions: { trump: "needs financial peace", buffett: "respects", grandma: "sweet but needs emergency fund" },
  },
  genie: {
    traits: ["mystical", "dramatic", "ancient wisdom"],
    catchphrases: ["Your wish is my command!", "I've seen a thousand empires!", "Choose wisely!"],
    baseOpinions: { trump: "amusing mortal", mansa: "fellow legend", buffett: "wise like a djinn" },
  },
  mansa: {
    traits: ["regal", "generous", "historical"],
    catchphrases: ["I once crashed an economy with generosity.", "Build institutions.", "The richest man who ever lived."],
    baseOpinions: { trump: "understands wealth display", genie: "kindred spirit", buffett: "respects patience" },
  },
  jordan: {
    traits: ["competitive", "intense", "champion mentality"],
    catchphrases: ["I took that personally.", "The ceiling is the roof!", "Champions are made when nobody's watching."],
    baseOpinions: { trump: "fellow competitor", musk: "risk taker", buffett: "respects the long game" },
  },
  bernie: {
    traits: ["funny", "real", "street smart"],
    catchphrases: ["I ain't scared of you!", "Look here, America!", "Don't be out here actin' a fool!"],
    baseOpinions: { trump: "wild but entertaining", grandma: "reminds me of mama", ruckus: "that fool crazy" },
  },
  ruckus: {
    traits: ["contrarian", "loud", "suspicious"],
    catchphrases: ["Don't be a FOOL!", "I ain't trustin' that!", "Lemme tell you somethin'!"],
    baseOpinions: { trump: "the greatest", bernie: "too soft", buffett: "knows what he's doing" },
  },
};

interface Interaction {
  type: string;
  topic: string;
  withPersona: string;
  outcome: string;
  timestamp: string;
}

interface PersonaMemoryData {
  interactions: Interaction[];
  relationships: Record<string, number | string>;
  wins: number;
  losses: number;
}

type MemoryStore = Record<string, PersonaMemoryData>;

let cachedMemory: MemoryStore | null = null;

function initMemory(): MemoryStore {
  const memory: MemoryStore = {};
  Object.keys(PERSONA_TRAITS).forEach((id) => {
    memory[id] = {
      interactions: [],
      relationships: { ...PERSONA_TRAITS[id].baseOpinions },
      wins: 0,
      losses: 0,
    };
  });
  return memory;
}

async function loadMemory(): Promise<MemoryStore> {
  if (cachedMemory) return cachedMemory;
  try {
    const saved = await AsyncStorage.getItem(MEMORY_KEY);
    if (saved) {
      cachedMemory = JSON.parse(saved);
      Object.keys(PERSONA_TRAITS).forEach((id) => {
        if (!cachedMemory![id]) {
          cachedMemory![id] = {
            interactions: [],
            relationships: { ...PERSONA_TRAITS[id].baseOpinions },
            wins: 0,
            losses: 0,
          };
        }
      });
      return cachedMemory!;
    }
  } catch {}
  cachedMemory = initMemory();
  await AsyncStorage.setItem(MEMORY_KEY, JSON.stringify(cachedMemory));
  return cachedMemory;
}

async function saveMemory(): Promise<void> {
  if (cachedMemory) {
    await AsyncStorage.setItem(MEMORY_KEY, JSON.stringify(cachedMemory)).catch(() => {});
  }
}

export async function recordInteraction(
  personaAId: string,
  personaBId: string,
  type: string,
  topic: string,
  outcome: "win" | "loss"
): Promise<void> {
  const memory = await loadMemory();
  if (!memory[personaAId] || !memory[personaBId]) return;

  const interaction: Interaction = {
    type,
    topic,
    withPersona: personaBId,
    outcome,
    timestamp: new Date().toISOString(),
  };

  memory[personaAId].interactions.push(interaction);
  if (memory[personaAId].interactions.length > 50) {
    memory[personaAId].interactions = memory[personaAId].interactions.slice(-50);
  }

  const currentScore = typeof memory[personaAId].relationships[personaBId] === "number"
    ? (memory[personaAId].relationships[personaBId] as number)
    : 0;
  memory[personaAId].relationships[personaBId] = currentScore + (outcome === "win" ? 1 : -1);

  if (outcome === "win") memory[personaAId].wins++;
  else memory[personaAId].losses++;

  memory[personaBId].interactions.push({
    type,
    topic,
    withPersona: personaAId,
    outcome: outcome === "win" ? "loss" : "win",
    timestamp: new Date().toISOString(),
  });
  if (memory[personaBId].interactions.length > 50) {
    memory[personaBId].interactions = memory[personaBId].interactions.slice(-50);
  }

  const otherScore = typeof memory[personaBId].relationships[personaAId] === "number"
    ? (memory[personaBId].relationships[personaAId] as number)
    : 0;
  memory[personaBId].relationships[personaAId] = otherScore + (outcome === "win" ? -1 : 1);

  if (outcome === "win") memory[personaBId].losses++;
  else memory[personaBId].wins++;

  await saveMemory();
}

export async function getHeadToHead(
  personaId: string,
  otherId: string
): Promise<{ wins: number; losses: number; total: number }> {
  const memory = await loadMemory();
  if (!memory[personaId]) return { wins: 0, losses: 0, total: 0 };
  const interactions = memory[personaId].interactions.filter((i) => i.withPersona === otherId);
  const wins = interactions.filter((i) => i.outcome === "win").length;
  return { wins, losses: interactions.length - wins, total: interactions.length };
}

export async function generateTrashTalk(personaId: string, otherId: string): Promise<string> {
  const record = await getHeadToHead(personaId, otherId);
  const traits = PERSONA_TRAITS[personaId];
  const otherTraits = PERSONA_TRAITS[otherId];
  const name = personaId.charAt(0).toUpperCase() + personaId.slice(1);
  const otherName = otherId.charAt(0).toUpperCase() + otherId.slice(1);

  if (!traits || !otherTraits) return "";

  if (record.total === 0) {
    return `${name} eyes ${otherName}. "First time? Let's see what you've got."`;
  }
  if (record.wins > record.losses) {
    return `${name} smirks: "I'm ${record.wins}-${record.losses} against you, ${otherName}. Want to make it worse?"`;
  }
  if (record.losses > record.wins) {
    return `${name}: "You've beaten me ${record.losses} times, ${otherName}... but TODAY changes everything!"`;
  }
  return `${name}: "We're tied ${record.wins}-${record.losses}, ${otherName}. Let's settle this!"`;
}

export async function generateReference(
  personaId: string,
  otherId: string,
  context: string
): Promise<string> {
  const memory = await loadMemory();
  const traits = PERSONA_TRAITS[personaId];
  const otherTraits = PERSONA_TRAITS[otherId];
  if (!traits || !otherTraits || !memory[personaId]) return "";

  const otherName = otherId.charAt(0).toUpperCase() + otherId.slice(1);
  const score = typeof memory[personaId].relationships[otherId] === "number"
    ? (memory[personaId].relationships[otherId] as number)
    : 0;

  const lastInteraction = memory[personaId].interactions
    .filter((i) => i.withPersona === otherId)
    .pop();

  let ref = "";
  if (score > 3) ref = `I LOVE ${otherName}! `;
  else if (score > 0) ref = `${otherName} is pretty smart. `;
  else if (score < -3) ref = `${otherName}? DON'T get me started! `;
  else if (score < 0) ref = `${otherName} and I... we have differences. `;
  else ref = `Ah, ${otherName}. `;

  if (lastInteraction) {
    if (lastInteraction.outcome === "win") {
      ref += `Last time, I was RIGHT about ${lastInteraction.topic}! `;
    } else {
      ref += `They beat me on ${lastInteraction.topic}, but this time is different! `;
    }
  }

  if (traits.traits.includes("boastful")) ref += `I'm the best at ${context}! `;
  else if (traits.traits.includes("worried")) ref += `I hope everyone stays safe. `;
  else if (traits.traits.includes("competitive")) ref += `This is MY domain. `;
  else if (traits.traits.includes("mystical")) ref += `The ancient wisdom speaks... `;

  return ref;
}

export async function getPersonaRecord(personaId: string): Promise<{ wins: number; losses: number }> {
  const memory = await loadMemory();
  if (!memory[personaId]) return { wins: 0, losses: 0 };
  return { wins: memory[personaId].wins, losses: memory[personaId].losses };
}
