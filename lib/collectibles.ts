import AsyncStorage from "@react-native-async-storage/async-storage";

export type Rarity = "Common" | "Rare" | "Epic" | "Legendary";
export type CardCategory = "Sports" | "Finance" | "Debate" | "Fortune" | "Therapy" | "Special";

export interface CollectibleCard {
  id: string;
  name: string;
  description: string;
  rarity: Rarity;
  category: CardCategory;
  icon: string;
  color: string;
  image: any;
}

export interface OwnedCard {
  cardId: string;
  earnedAt: number;
}

export const RARITY_COLORS: Record<Rarity, string> = {
  Common: "#8B8B8B",
  Rare: "#4A90D9",
  Epic: "#9333EA",
  Legendary: "#FFD700",
};

export const RARITY_GRADIENTS: Record<Rarity, string[]> = {
  Common: ["#2a2a2a", "#1a1a1a", "#2a2a2a"],
  Rare: ["#0d1f3b", "#0a1428", "#0d1f3b"],
  Epic: ["#1f0d3b", "#140a28", "#1f0d3b"],
  Legendary: ["#3b2d0d", "#281e0a", "#3b2d0d"],
};

const DROP_RATES: { rarity: Rarity; weight: number }[] = [
  { rarity: "Common", weight: 50 },
  { rarity: "Rare", weight: 30 },
  { rarity: "Epic", weight: 15 },
  { rarity: "Legendary", weight: 5 },
];

export const CARD_CATALOG: CollectibleCard[] = [
  { id: "sports-mvp", name: "MVP Moment", description: "A legendary play that changed the game forever.", rarity: "Common", category: "Sports", icon: "trophy", color: "#4CAF50", image: require("@/assets/cards/sports-mvp.png") },
  { id: "sports-buzzer", name: "Buzzer Beater", description: "The shot heard around the world. Nothing but net.", rarity: "Rare", category: "Sports", icon: "basketball", color: "#FF6B35", image: require("@/assets/cards/sports-buzzer.png") },
  { id: "sports-knockout", name: "The Knockout", description: "One punch. Lights out. Championship secured.", rarity: "Epic", category: "Sports", icon: "boxing-glove", color: "#F44336", image: require("@/assets/cards/sports-knockout.png") },
  { id: "sports-dynasty", name: "Dynasty Builder", description: "Six rings. Seven rings. The debate never ends.", rarity: "Legendary", category: "Sports", icon: "medal", color: "#FFD700", image: require("@/assets/cards/sports-dynasty.png") },

  { id: "finance-bull", name: "Bull Run", description: "Markets soaring. Portfolio up 300%. Pure genius.", rarity: "Common", category: "Finance", icon: "chart-line", color: "#4CAF50", image: require("@/assets/cards/finance-bull.png") },
  { id: "finance-diamond", name: "Diamond Hands", description: "Held through the crash. Came out the other side a legend.", rarity: "Rare", category: "Finance", icon: "diamond-stone", color: "#00BCD4", image: require("@/assets/cards/finance-diamond.png") },
  { id: "finance-whale", name: "The Whale", description: "A single trade that moved the entire market.", rarity: "Epic", category: "Finance", icon: "whale", color: "#2196F3", image: require("@/assets/cards/finance-whale.png") },
  { id: "finance-mogul", name: "Mogul Status", description: "From nothing to billions. The ultimate power move.", rarity: "Legendary", category: "Finance", icon: "cash-multiple", color: "#FFD700", image: require("@/assets/cards/finance-mogul.png") },

  { id: "debate-mic", name: "Mic Drop", description: "That moment when the crowd goes silent. Speechless.", rarity: "Common", category: "Debate", icon: "microphone", color: "#FF9800", image: require("@/assets/cards/debate-mic.png") },
  { id: "debate-knockout", name: "Verbal Knockout", description: "Words sharper than swords. Opponent destroyed.", rarity: "Rare", category: "Debate", icon: "sword-cross", color: "#E91E63", image: require("@/assets/cards/debate-knockout.png") },
  { id: "debate-supreme", name: "Supreme Orator", description: "The greatest speech ever delivered. Standing ovation.", rarity: "Epic", category: "Debate", icon: "podium", color: "#9C27B0", image: require("@/assets/cards/debate-supreme.png") },
  { id: "debate-undefeated", name: "Undefeated", description: "100 debates. 100 wins. Zero losses. Impossible record.", rarity: "Legendary", category: "Debate", icon: "crown", color: "#FFD700", image: require("@/assets/cards/debate-undefeated.png") },

  { id: "fortune-star", name: "Stargazer", description: "The stars aligned. Your future is written in gold.", rarity: "Common", category: "Fortune", icon: "star-four-points", color: "#7C4DFF", image: require("@/assets/cards/fortune-star.png") },
  { id: "fortune-crystal", name: "Crystal Vision", description: "Saw it coming before anyone else. Pure foresight.", rarity: "Rare", category: "Fortune", icon: "crystal-ball", color: "#E040FB", image: require("@/assets/cards/fortune-crystal.png") },
  { id: "fortune-oracle", name: "The Oracle", description: "Every prediction came true. Every. Single. One.", rarity: "Epic", category: "Fortune", icon: "eye", color: "#AA00FF", image: require("@/assets/cards/fortune-oracle.png") },
  { id: "fortune-destiny", name: "Master of Destiny", description: "You don't predict the future. You create it.", rarity: "Legendary", category: "Fortune", icon: "lightning-bolt", color: "#FFD700", image: require("@/assets/cards/fortune-destiny.png") },

  { id: "therapy-breakthrough", name: "Breakthrough", description: "That moment when everything finally clicked.", rarity: "Common", category: "Therapy", icon: "brain", color: "#FF5252", image: require("@/assets/cards/therapy-breakthrough.png") },
  { id: "therapy-healed", name: "Healed Through Winning", description: "Therapy complete. You're now unstoppable.", rarity: "Rare", category: "Therapy", icon: "heart-pulse", color: "#FF1744", image: require("@/assets/cards/therapy-healed.png") },
  { id: "therapy-enlightened", name: "Enlightened", description: "Transcended the ordinary. Reached a higher plane.", rarity: "Epic", category: "Therapy", icon: "meditation", color: "#FF4081", image: require("@/assets/cards/therapy-enlightened.png") },
  { id: "therapy-phoenix", name: "Phoenix Rising", description: "Burned it all down. Rose from the ashes. Reborn.", rarity: "Legendary", category: "Therapy", icon: "fire", color: "#FFD700", image: require("@/assets/cards/therapy-phoenix.png") },

  { id: "special-firstday", name: "Day One", description: "You were here from the beginning. OG status.", rarity: "Common", category: "Special", icon: "flag-checkered", color: "#D4A420", image: require("@/assets/cards/special-firstday.png") },
  { id: "special-collector", name: "The Collector", description: "Some collect art. You collect moments of greatness.", rarity: "Rare", category: "Special", icon: "cards", color: "#D4A420", image: require("@/assets/cards/special-collector.png") },
  { id: "special-vip", name: "VIP Access", description: "Not everyone gets in. You're on the list.", rarity: "Epic", category: "Special", icon: "star-circle", color: "#D4A420", image: require("@/assets/cards/special-vip.png") },
  { id: "special-genesis", name: "Genesis Card", description: "The first of its kind. Priceless. One of one.", rarity: "Legendary", category: "Special", icon: "shield-crown", color: "#FFD700", image: require("@/assets/cards/special-genesis.png") },
];

const STORAGE_KEY = "djt_collectibles";

export async function getCollection(): Promise<OwnedCard[]> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export async function addCard(cardId: string): Promise<OwnedCard | null> {
  try {
    const collection = await getCollection();
    if (collection.some((c) => c.cardId === cardId)) return null;
    const owned: OwnedCard = { cardId, earnedAt: Date.now() };
    collection.push(owned);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(collection));
    return owned;
  } catch {
    return null;
  }
}

export function hasCardSync(cardId: string, collection: OwnedCard[]): boolean {
  return collection.some((c) => c.cardId === cardId);
}

export function getCardById(id: string): CollectibleCard | undefined {
  return CARD_CATALOG.find((c) => c.id === id);
}

export function getRandomCard(): CollectibleCard {
  const total = DROP_RATES.reduce((sum, d) => sum + d.weight, 0);
  let roll = Math.random() * total;
  let selectedRarity: Rarity = "Common";
  for (const dr of DROP_RATES) {
    roll -= dr.weight;
    if (roll <= 0) {
      selectedRarity = dr.rarity;
      break;
    }
  }
  const pool = CARD_CATALOG.filter((c) => c.rarity === selectedRarity);
  return pool[Math.floor(Math.random() * pool.length)];
}

export function getCollectionStats(collection: OwnedCard[]) {
  const total = CARD_CATALOG.length;
  const owned = collection.length;
  const byRarity: Record<Rarity, { owned: number; total: number }> = {
    Common: { owned: 0, total: 0 },
    Rare: { owned: 0, total: 0 },
    Epic: { owned: 0, total: 0 },
    Legendary: { owned: 0, total: 0 },
  };
  for (const card of CARD_CATALOG) {
    byRarity[card.rarity].total++;
    if (collection.some((c) => c.cardId === card.id)) {
      byRarity[card.rarity].owned++;
    }
  }
  return { total, owned, byRarity };
}
