import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  Platform,
  ActivityIndicator,
  Image,
  Modal,
  Share,
  Linking,
  ScrollView,
  TextInput,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown, FadeInUp, FadeIn } from "react-native-reanimated";
import { getApiUrl } from "@/lib/query-client";
import { playTTS } from "@/lib/audio-helper";
import { useTokens } from "@/lib/token-context";

const Colors = {
  background: "#0a0a0a",
  gold: "#D4A420",
  whiteDim: "rgba(255,255,255,0.6)",
};

interface ArenaPersona {
  id: string;
  name: string;
  shortName: string;
  color: string;
  faction: "self" | "supporter" | "opponent";
  image: any;
  personality: {
    energy: number;
    aggression: number;
    humor: number;
    catchphrases: string[];
  };
  relationships: Record<string, { sentiment: number }>;
  triggerWords: { positive: string[]; negative: string[] };
}

interface EmotionalState {
  anger: number;
  happiness: number;
  engagement: number;
  lastSpoke: number | null;
}

interface ConversationMessage {
  id: string;
  speakerId: string;
  speakerName: string;
  text: string;
  timestamp: number;
  isSystem?: boolean;
}

const ARENA_PERSONAS: Record<string, ArenaPersona> = {
  trump: {
    id: "trump",
    name: "Donald Trump",
    shortName: "Trump",
    color: "#ff4d4d",
    faction: "self",
    image: require("@/assets/images/persona-trump.png"),
    personality: {
      energy: 95,
      aggression: 85,
      humor: 70,
      catchphrases: ["Believe me", "Tremendous", "Sad!", "The best", "Loser"],
    },
    relationships: {
      netanyahu: { sentiment: 95 },
      galloway: { sentiment: 20 },
      mcconnell: { sentiment: 40 },
      ruckus: { sentiment: 90 },
      carville: { sentiment: 10 },
      maddow: { sentiment: 5 },
      omar: { sentiment: 5 },
      biden: { sentiment: 10 },
      rosie: { sentiment: 5 },
      berniemc: { sentiment: 20 },
    },
    triggerWords: {
      positive: ["great", "win", "success", "money", "deal", "beautiful", "trump"],
      negative: ["fail", "lose", "weak", "stupid", "disaster", "fake"],
    },
  },
  netanyahu: {
    id: "netanyahu",
    name: "Benjamin Netanyahu",
    shortName: "Bibi",
    color: "#0038b8",
    faction: "supporter",
    image: null,
    personality: {
      energy: 75,
      aggression: 60,
      humor: 30,
      catchphrases: ["My friend", "Israel knows", "Peace through strength", "Never again"],
    },
    relationships: {
      trump: { sentiment: 95 },
      galloway: { sentiment: 30 },
      mcconnell: { sentiment: 50 },
      ruckus: { sentiment: 70 },
      carville: { sentiment: 30 },
      maddow: { sentiment: 25 },
      omar: { sentiment: 5 },
      biden: { sentiment: 55 },
      rosie: { sentiment: 25 },
      berniemc: { sentiment: 35 },
    },
    triggerWords: {
      positive: ["israel", "jerusalem", "security", "alliance", "strength", "peace"],
      negative: ["palestine", "iran", "nuclear", "condemn", "apartheid", "occupation"],
    },
  },
  ruckus: {
    id: "ruckus",
    name: "Uncle Ruckus",
    shortName: "Ruckus",
    color: "#8b0000",
    faction: "supporter",
    image: require("@/assets/images/persona-ruckus.png"),
    personality: {
      energy: 100,
      aggression: 80,
      humor: 90,
      catchphrases: ["THAT'S RIGHT!", "MAGA!", "Praise White Jesus!", "I ain't Black, I'm Uncle Ruckus — no relation!"],
    },
    relationships: {
      trump: { sentiment: 100 },
      netanyahu: { sentiment: 80 },
      galloway: { sentiment: 30 },
      mcconnell: { sentiment: 50 },
      carville: { sentiment: 10 },
      maddow: { sentiment: 5 },
      omar: { sentiment: 5 },
      biden: { sentiment: 10 },
      rosie: { sentiment: 10 },
      berniemc: { sentiment: 5 },
    },
    triggerWords: {
      positive: ["trump", "maga", "america", "winning", "great", "white", "reagan"],
      negative: ["democrat", "liberal", "fake news", "biden", "obama", "sambo", "bernie mac"],
    },
  },
  galloway: {
    id: "galloway",
    name: "George Galloway",
    shortName: "Galloway",
    color: "#c41e3a",
    faction: "opponent",
    image: null,
    personality: {
      energy: 85,
      aggression: 75,
      humor: 60,
      catchphrases: ["Rubbish!", "Absolute nonsense", "I told you so", "Propaganda"],
    },
    relationships: {
      trump: { sentiment: 25 },
      netanyahu: { sentiment: 40 },
      mcconnell: { sentiment: 30 },
      ruckus: { sentiment: 20 },
      carville: { sentiment: 50 },
      maddow: { sentiment: 60 },
      omar: { sentiment: 80 },
      biden: { sentiment: 40 },
      rosie: { sentiment: 50 },
      berniemc: { sentiment: 55 },
    },
    triggerWords: {
      positive: ["britain", "labour", "palestine", "iraq", "socialism", "workers"],
      negative: ["imperialism", "zionism", "neocon", "establishment", "propaganda", "war"],
    },
  },
  mcconnell: {
    id: "mcconnell",
    name: "Mitch McConnell",
    shortName: "Mitch",
    color: "#708090",
    faction: "opponent",
    image: null,
    personality: {
      energy: 20,
      aggression: 40,
      humor: 5,
      catchphrases: ["...", "The Senate will...", "In due time", "*blinks slowly*"],
    },
    relationships: {
      trump: { sentiment: 35 },
      netanyahu: { sentiment: 50 },
      galloway: { sentiment: 20 },
      ruckus: { sentiment: 25 },
      carville: { sentiment: 15 },
      maddow: { sentiment: 10 },
      omar: { sentiment: 10 },
      biden: { sentiment: 30 },
      rosie: { sentiment: 15 },
      berniemc: { sentiment: 20 },
    },
    triggerWords: {
      positive: ["senate", "republican", "conservative", "judiciary", "majority"],
      negative: ["obstruction", "turtle", "slow", "block", "delay", "inaction"],
    },
  },
  carville: {
    id: "carville",
    name: "James Carville",
    shortName: "Carville",
    color: "#e63946",
    faction: "opponent",
    image: null,
    personality: {
      energy: 90,
      aggression: 80,
      humor: 75,
      catchphrases: ["What the hell?!", "Son of a bitch!", "It's the economy, stupid!", "Ragin' Cajun"],
    },
    relationships: {
      trump: { sentiment: 15 },
      ruckus: { sentiment: 10 },
      netanyahu: { sentiment: 30 },
      maddow: { sentiment: 90 },
      biden: { sentiment: 80 },
      galloway: { sentiment: 50 },
      omar: { sentiment: 70 },
      rosie: { sentiment: 75 },
      berniemc: { sentiment: 80 },
      mcconnell: { sentiment: 20 },
    },
    triggerWords: {
      positive: ["democrat", "strategy", "cajun", "clinton", "campaign", "winning"],
      negative: ["trump", "maga", "republican", "stupid", "nonsense", "lies"],
    },
  },
  maddow: {
    id: "maddow",
    name: "Rachel Maddow",
    shortName: "Maddow",
    color: "#7c3aed",
    faction: "opponent",
    image: null,
    personality: {
      energy: 65,
      aggression: 55,
      humor: 45,
      catchphrases: ["Here's what we know", "Let me walk you through this", "The facts show", "This is remarkable"],
    },
    relationships: {
      trump: { sentiment: 10 },
      ruckus: { sentiment: 5 },
      netanyahu: { sentiment: 25 },
      carville: { sentiment: 90 },
      biden: { sentiment: 75 },
      omar: { sentiment: 85 },
      galloway: { sentiment: 60 },
      rosie: { sentiment: 80 },
      berniemc: { sentiment: 70 },
      mcconnell: { sentiment: 15 },
    },
    triggerWords: {
      positive: ["facts", "evidence", "democracy", "constitution", "progressive", "rights"],
      negative: ["trump", "corruption", "authoritarian", "lies", "obstruction", "cover-up"],
    },
  },
  omar: {
    id: "omar",
    name: "Ilhan Omar",
    shortName: "Omar",
    color: "#06b6d4",
    faction: "opponent",
    image: null,
    personality: {
      energy: 80,
      aggression: 70,
      humor: 30,
      catchphrases: ["The people deserve", "As a refugee myself", "Justice demands", "We will not be silenced"],
    },
    relationships: {
      trump: { sentiment: 5 },
      ruckus: { sentiment: 5 },
      netanyahu: { sentiment: 10 },
      carville: { sentiment: 70 },
      maddow: { sentiment: 85 },
      biden: { sentiment: 60 },
      galloway: { sentiment: 80 },
      rosie: { sentiment: 75 },
      berniemc: { sentiment: 65 },
      mcconnell: { sentiment: 10 },
    },
    triggerWords: {
      positive: ["justice", "refugee", "rights", "palestine", "progressive", "squad"],
      negative: ["trump", "ban", "islamophobia", "racist", "hate", "occupation"],
    },
  },
  biden: {
    id: "biden",
    name: "Joe Biden",
    shortName: "Biden",
    color: "#3b82f6",
    faction: "opponent",
    image: null,
    personality: {
      energy: 25,
      aggression: 30,
      humor: 40,
      catchphrases: ["Look, here's the deal", "Come on, man!", "Not a joke!", "...anyway...", "My dad used to say..."],
    },
    relationships: {
      trump: { sentiment: 15 },
      ruckus: { sentiment: 20 },
      netanyahu: { sentiment: 55 },
      carville: { sentiment: 80 },
      maddow: { sentiment: 75 },
      omar: { sentiment: 60 },
      galloway: { sentiment: 40 },
      rosie: { sentiment: 65 },
      berniemc: { sentiment: 60 },
      mcconnell: { sentiment: 35 },
    },
    triggerWords: {
      positive: ["unity", "soul", "america", "barack", "bipartisan", "scranton"],
      negative: ["trump", "maga", "insurrection", "division", "extremism"],
    },
  },
  rosie: {
    id: "rosie",
    name: "Rosie O'Donnell",
    shortName: "Rosie",
    color: "#ec4899",
    faction: "opponent",
    image: null,
    personality: {
      energy: 95,
      aggression: 85,
      humor: 60,
      catchphrases: ["YOU KNOW WHAT?!", "Let me TELL you!", "That's GARBAGE!", "I'm NOT done!"],
    },
    relationships: {
      trump: { sentiment: 5 },
      ruckus: { sentiment: 10 },
      netanyahu: { sentiment: 25 },
      carville: { sentiment: 75 },
      maddow: { sentiment: 80 },
      omar: { sentiment: 75 },
      biden: { sentiment: 65 },
      galloway: { sentiment: 50 },
      berniemc: { sentiment: 80 },
      mcconnell: { sentiment: 15 },
    },
    triggerWords: {
      positive: ["lgbtq", "rights", "justice", "rosie", "equality", "truth"],
      negative: ["trump", "maga", "bully", "liar", "fascist", "hate"],
    },
  },
  berniemc: {
    id: "berniemc",
    name: "Bernie Mac",
    shortName: "Bernie",
    color: "#f59e0b",
    faction: "opponent",
    image: require("@/assets/images/persona-bernie.png"),
    personality: {
      energy: 95,
      aggression: 85,
      humor: 100,
      catchphrases: ["I ain't scared of you, muthuhfuckah!", "Got-DAMN!", "DAMN right!", "sheeeeit"],
    },
    relationships: {
      trump: { sentiment: 15 },
      ruckus: { sentiment: 5 },
      netanyahu: { sentiment: 30 },
      carville: { sentiment: 80 },
      maddow: { sentiment: 70 },
      omar: { sentiment: 65 },
      biden: { sentiment: 60 },
      galloway: { sentiment: 50 },
      rosie: { sentiment: 80 },
      mcconnell: { sentiment: 25 },
    },
    triggerWords: {
      positive: ["comedy", "chicago", "funny", "bernie", "real", "truth"],
      negative: ["trump", "maga", "ruckus", "sambo", "fool", "lies"],
    },
  },
};

const PERSONA_IDS = ["trump", "netanyahu", "ruckus", "galloway", "mcconnell", "carville", "maddow", "omar", "biden", "rosie", "berniemc"];

const TOPIC_ICON_MAP: Record<string, string> = {
  economy: "cash", immigration: "airplane", foreign_policy: "earth", media: "tv",
  middle_east: "earth", tech: "hardware-chip", defense: "shield-checkmark",
  health: "medkit", education: "school", climate: "leaf", trade: "swap-horizontal",
  israel: "earth", biden: "person", military: "shield-checkmark",
};
const TOPIC_COLOR_MAP: Record<string, string> = {
  economy: "#4ADE80", immigration: "#F87171", foreign_policy: "#60A5FA", media: "#FBBF24",
  middle_east: "#0038b8", tech: "#A78BFA", defense: "#708090", health: "#ec4899",
  education: "#06b6d4", climate: "#22c55e", trade: "#f59e0b", israel: "#0038b8",
  biden: "#60A5FA", military: "#708090",
};

interface DynamicTopic {
  id: string;
  title: string;
  description: string;
  headlines?: string[];
}

const FALLBACK_TOPICS: DynamicTopic[] = [
  { id: "economy", title: "Economy", description: "Trade wars, tariffs, and the state of the economy" },
  { id: "immigration", title: "Immigration", description: "Border security, deportations, and refugee policy" },
  { id: "foreign_policy", title: "Foreign Policy", description: "Global alliances, NATO, and military intervention" },
  { id: "media", title: "Media", description: "Fake news, social media censorship, and press freedom" },
  { id: "middle_east", title: "Middle East", description: "Israel-Palestine, Iran tensions, and regional conflicts" },
  { id: "tech", title: "Big Tech", description: "AI regulation, social media, and tech monopolies" },
];

const AFFILIATE_LINKS = [
  { title: "Trump 2024 Hat", url: "https://www.amazon.com/s?k=trump+2024+hat&tag=trumpbot-20", icon: "hat" },
  { title: "MAGA Merch", url: "https://www.amazon.com/s?k=maga+merchandise&tag=trumpbot-20", icon: "shirt" },
  { title: "Political Books", url: "https://www.amazon.com/s?k=political+books+bestseller&tag=trumpbot-20", icon: "book" },
  { title: "Trump Bobblehead", url: "https://www.amazon.com/s?k=trump+bobblehead&tag=trumpbot-20", icon: "gift" },
];

const FACTION_COLORS = {
  self: "#FFD700",
  supporter: "#22c55e",
  opponent: "#3b82f6",
};

function getInitials(name: string) {
  return name.split(" ").map(w => w[0]).join("").substring(0, 2);
}

const INTERRUPTERS = ["biden", "rosie", "galloway", "berniemc", "omar"];

function calculateResponseProbability(
  listenerId: string,
  speakerId: string,
  text: string
): number {
  const listener = ARENA_PERSONAS[listenerId];
  const relationship = listener.relationships[speakerId] || { sentiment: 50 };

  let probability = 35;
  probability += (relationship.sentiment - 50) * 0.3;

  const words = text.toLowerCase().split(/\s+/);
  words.forEach((word) => {
    if (listener.triggerWords.positive.some((tw) => word.includes(tw))) probability += 12;
    if (listener.triggerWords.negative.some((tw) => word.includes(tw))) probability += 18;
  });

  return Math.min(85, Math.max(10, probability));
}

export default function ArenaScreen() {
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const webBottomInset = Platform.OS === "web" ? 34 : 0;
  const { deviceId, balance, refreshBalance } = useTokens();

  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [emotionalStates, setEmotionalStates] = useState<Record<string, EmotionalState>>(() => {
    const s: Record<string, EmotionalState> = {};
    PERSONA_IDS.forEach((id) => {
      s[id] = { anger: 20, happiness: 50, engagement: 50, lastSpoke: null };
    });
    return s;
  });
  const [currentSpeaker, setCurrentSpeaker] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(true);
  const [currentTopic, setCurrentTopic] = useState<string | null>(null);
  const [focusedPersona, setFocusedPersona] = useState<string | null>(null);

  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const ttsQueueRef = useRef<{ text: string; personaId: string }[]>([]);
  const isProcessingTTSRef = useRef(false);

  const [selectedPersonas, setSelectedPersonas] = useState<string[]>(PERSONA_IDS);
  const [showPersonaSelector, setShowPersonaSelector] = useState(false);
  const selectedPersonasRef = useRef<string[]>(PERSONA_IDS);
  useEffect(() => { selectedPersonasRef.current = selectedPersonas; }, [selectedPersonas]);

  const [pollVotes, setPollVotes] = useState<Record<string, number>>({});
  const [userVoted, setUserVoted] = useState(false);
  const [showPollResults, setShowPollResults] = useState(false);
  const [pollWinner, setPollWinner] = useState<string | null>(null);
  const [fanName, setFanName] = useState("");
  const [showNameInput, setShowNameInput] = useState(false);
  const [thankYouPlayed, setThankYouPlayed] = useState(false);

  const [dynamicTopics, setDynamicTopics] = useState<DynamicTopic[]>(FALLBACK_TOPICS);
  const [topicTimer, setTopicTimer] = useState<number>(0);
  const topicTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const TOPIC_DURATION = 5 * 60;

  const [freeRemaining, setFreeRemaining] = useState(30);
  const [hasSession, setHasSession] = useState(false);
  const [sessionExpiresAt, setSessionExpiresAt] = useState<number | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);
  const [sessionTimer, setSessionTimer] = useState<number>(0);
  const [isUnlocking, setIsUnlocking] = useState(false);

  const flatListRef = useRef<FlatList>(null);
  const isRunningRef = useRef(true);
  const messagesRef = useRef<ConversationMessage[]>([]);
  const currentSpeakerRef = useRef<string | null>(null);
  const currentTopicRef = useRef<string | null>(null);
  const emotionalStatesRef = useRef(emotionalStates);
  const conversationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const voiceEnabledRef = useRef(true);
  const recentSpeakersRef = useRef<string[]>([]);

  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { currentSpeakerRef.current = currentSpeaker; }, [currentSpeaker]);
  useEffect(() => { currentTopicRef.current = currentTopic; }, [currentTopic]);
  useEffect(() => { emotionalStatesRef.current = emotionalStates; }, [emotionalStates]);
  useEffect(() => { isRunningRef.current = isRunning; }, [isRunning]);
  useEffect(() => { voiceEnabledRef.current = voiceEnabled; }, [voiceEnabled]);

  const currentSoundRef = useRef<any>(null);
  const forcePlayRef = useRef(false);

  const stopAllTTS = useCallback(() => {
    ttsQueueRef.current = [];
    isProcessingTTSRef.current = false;
    forcePlayRef.current = false;
    if (currentSoundRef.current) {
      try { currentSoundRef.current.stopAsync(); currentSoundRef.current.unloadAsync(); } catch {}
      currentSoundRef.current = null;
    }
    setIsPlayingAudio(false);
  }, []);

  const processTTSQueue = useCallback(async () => {
    if (isProcessingTTSRef.current || ttsQueueRef.current.length === 0) return;
    isProcessingTTSRef.current = true;
    if (mountedRef.current) setIsPlayingAudio(true);
    while (ttsQueueRef.current.length > 0) {
      if (!forcePlayRef.current && !voiceEnabledRef.current) break;
      const item = ttsQueueRef.current.shift();
      if (!item || !mountedRef.current) break;
      try {
        const sound = await playTTS("/api/persona-speak", { text: item.text, personaId: item.personaId }, { volume: 1.0 });
        currentSoundRef.current = sound;
        await new Promise<void>((resolve) => {
          let resolved = false;
          const cleanup = () => { if (resolved) return; resolved = true; try { sound.setOnPlaybackStatusUpdate(null); sound.unloadAsync(); } catch {} currentSoundRef.current = null; resolve(); };
          sound.setOnPlaybackStatusUpdate((status: any) => {
            if (status.didJustFinish || status.error) cleanup();
          });
          setTimeout(cleanup, 60000);
        });
      } catch (e) {
        console.warn("Arena TTS playback error for", item.personaId, ":", e);
      }
    }
    isProcessingTTSRef.current = false;
    forcePlayRef.current = false;
    currentSoundRef.current = null;
    if (mountedRef.current) setIsPlayingAudio(false);
  }, []);

  const queueTTS = useCallback((text: string, personaId: string, force?: boolean) => {
    if (!force && !voiceEnabledRef.current) return;
    if (force) forcePlayRef.current = true;
    ttsQueueRef.current.push({ text, personaId });
    processTTSQueue();
  }, [processTTSQueue]);

  const fetchTopics = useCallback(async () => {
    try {
      const res = await fetch(new URL("/api/arena/topics", getApiUrl()).toString());
      if (res.ok) {
        const data = await res.json();
        if (data.topics?.length > 0) {
          setDynamicTopics(data.topics);
          if (!currentTopicRef.current && data.topics[0]) {
            const firstTopic = data.topics[0].title;
            setCurrentTopic(firstTopic);
            currentTopicRef.current = firstTopic;
          }
        }
      }
    } catch {}
  }, []);

  const checkArenaStatus = useCallback(async () => {
    if (!deviceId) return;
    try {
      const res = await fetch(new URL("/api/arena/status", getApiUrl()).toString(), {
        headers: { "x-device-id": deviceId },
      });
      if (res.ok) {
        const data = await res.json();
        setFreeRemaining(data.freeRemaining ?? 30);
        setHasSession(data.hasSession ?? false);
        if (data.sessionExpiresAt) setSessionExpiresAt(data.sessionExpiresAt);
      }
    } catch {}
  }, [deviceId]);

  const unlockSession = useCallback(async () => {
    if (!deviceId) return;
    setIsUnlocking(true);
    try {
      const res = await fetch(new URL("/api/arena/access", getApiUrl()).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-device-id": deviceId },
      });
      const data = await res.json();
      if (data.granted) {
        setHasSession(true);
        setSessionExpiresAt(data.expiresAt);
        setShowPaywall(false);
        refreshBalance();
        addSystemMessage("Session unlocked! 5 minutes of unlimited access.");
      } else if (data.error === "insufficient_tokens") {
        addSystemMessage("Not enough tokens. Visit the store to get more!");
      }
    } catch {}
    setIsUnlocking(false);
  }, [deviceId, refreshBalance]);

  const addSystemMessage = useCallback((text: string) => {
    const msg: ConversationMessage = {
      id: "sys-" + Date.now() + Math.random().toString(36).substr(2, 5),
      speakerId: "system",
      speakerName: "System",
      text,
      timestamp: Date.now(),
      isSystem: true,
    };
    setMessages((prev) => {
      const next = [...prev, msg].slice(-50);
      messagesRef.current = next;
      return next;
    });
  }, []);

  useEffect(() => {
    fetchTopics().then(() => {
      if (!currentTopicRef.current && FALLBACK_TOPICS.length > 0) {
        const fallbackTitle = FALLBACK_TOPICS[0].title;
        setCurrentTopic(fallbackTitle);
        currentTopicRef.current = fallbackTitle;
      }
    });
    checkArenaStatus();
    const topicRefresh = setInterval(fetchTopics, 3 * 60 * 1000);
    return () => clearInterval(topicRefresh);
  }, [fetchTopics, checkArenaStatus]);

  useEffect(() => {
    if (!hasSession || !sessionExpiresAt) { setSessionTimer(0); return; }
    const tick = setInterval(() => {
      const remaining = Math.max(0, Math.floor((sessionExpiresAt - Date.now()) / 1000));
      setSessionTimer(remaining);
      if (remaining <= 0) {
        setHasSession(false);
        setSessionExpiresAt(null);
        clearInterval(tick);
      }
    }, 1000);
    return () => clearInterval(tick);
  }, [hasSession, sessionExpiresAt]);

  useEffect(() => {
    if (!currentTopic) { setTopicTimer(0); return; }
    setTopicTimer(TOPIC_DURATION);
    if (topicTimerRef.current) clearInterval(topicTimerRef.current);
    topicTimerRef.current = setInterval(() => {
      setTopicTimer((prev) => {
        if (prev <= 1) {
          if (topicTimerRef.current) clearInterval(topicTimerRef.current);
          if (dynamicTopics.length === 0) return 0;
          const currentIdx = dynamicTopics.findIndex((t) => t.id === currentTopicRef.current || t.title === currentTopicRef.current);
          const nextIdx = (currentIdx + 1) % dynamicTopics.length;
          const nextTopic = dynamicTopics[nextIdx];
          if (nextTopic && mountedRef.current) {
            setCurrentTopic(nextTopic.title);
            currentTopicRef.current = nextTopic.title;
            setMessages((p) => [...p, {
              id: "topic-auto-" + Date.now(),
              speakerId: "system", speakerName: "System",
              text: `Topic auto-rotated to: ${nextTopic.title}`,
              timestamp: Date.now(), isSystem: true,
            }].slice(-50));
            setTopicTimer(TOPIC_DURATION);
            setPollVotes({});
            setUserVoted(false);
            setShowPollResults(false);
            setPollWinner(null);
            setShowNameInput(false);
            setThankYouPlayed(false);
            setFanName("");
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (topicTimerRef.current) clearInterval(topicTimerRef.current); };
  }, [currentTopic, dynamicTopics]);

  const addMessage = useCallback((msg: ConversationMessage) => {
    setMessages((prev) => {
      const next = [...prev, msg].slice(-50);
      messagesRef.current = next;
      return next;
    });
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, []);

  const updateEmotions = useCallback(
    (responderId: string, toSpeakerId: string) => {
      setEmotionalStates((prev) => {
        const next = { ...prev };
        const responder = { ...next[responderId] };
        responder.engagement = Math.min(100, responder.engagement + 10);
        responder.lastSpoke = Date.now();

        const relationship = ARENA_PERSONAS[responderId].relationships[toSpeakerId] || { sentiment: 50 };
        if (relationship.sentiment > 70) {
          responder.happiness = Math.min(100, responder.happiness + 5);
          responder.anger = Math.max(0, responder.anger - 3);
        } else if (relationship.sentiment < 30) {
          responder.happiness = Math.max(0, responder.happiness - 3);
          responder.anger = Math.min(100, responder.anger + 8);
        }
        next[responderId] = responder;

        selectedPersonasRef.current.forEach((id) => {
          if (id !== responderId) {
            next[id] = { ...next[id], engagement: Math.min(100, next[id].engagement + 2) };
          }
        });
        emotionalStatesRef.current = next;
        return next;
      });
    },
    []
  );

  const generateAIResponse = useCallback(
    async (responderId: string, toSpeakerId: string) => {
      if (!mountedRef.current) return;
      setCurrentSpeaker(responderId);
      currentSpeakerRef.current = responderId;

      try {
        const history = messagesRef.current
          .filter((m) => !m.isSystem)
          .slice(-6)
          .map((m) => ({ speakerName: m.speakerName, text: m.text }));

        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (deviceId) headers["x-device-id"] = deviceId;

        const res = await fetch(new URL("/api/arena/respond", getApiUrl()).toString(), {
          method: "POST",
          headers,
          body: JSON.stringify({
            responderId,
            toSpeakerId,
            conversationHistory: history,
            topic: currentTopicRef.current,
          }),
        });

        if (res.status === 403) {
          const errData = await res.json();
          if (errData.error === "arena_locked") {
            setFreeRemaining(0);
            setShowPaywall(true);
            setIsRunning(false);
            isRunningRef.current = false;
            if (conversationTimerRef.current) clearTimeout(conversationTimerRef.current);
            return;
          }
        }

        if (!res.ok || !mountedRef.current) return;
        const data = await res.json();
        const persona = ARENA_PERSONAS[responderId];

        if (data.freeRemaining !== undefined) setFreeRemaining(data.freeRemaining);
        if (data.hasSession !== undefined) setHasSession(data.hasSession);
        if (data.sessionExpiresAt) setSessionExpiresAt(data.sessionExpiresAt);

        addMessage({
          id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
          speakerId: responderId,
          speakerName: persona.name,
          text: data.response,
          timestamp: Date.now(),
        });

        updateEmotions(responderId, toSpeakerId);
        queueTTS(data.response, responderId);
      } catch (err) {
        console.error("Arena AI error:", err);
      } finally {
        if (mountedRef.current) {
          setCurrentSpeaker(null);
          currentSpeakerRef.current = null;
        }
      }
    },
    [addMessage, updateEmotions, deviceId, queueTTS]
  );

  const triggerInterruption = useCallback(async (trumpMessageText: string) => {
    if (!mountedRef.current) return;
    const active = selectedPersonasRef.current;
    const availableInterrupters = INTERRUPTERS.filter((id) => active.includes(id));
    if (availableInterrupters.length === 0) return;

    const interrupter = availableInterrupters[Math.floor(Math.random() * availableInterrupters.length)];

    await new Promise((r) => setTimeout(r, 800 + Math.random() * 1200));
    if (!mountedRef.current || !isRunningRef.current) return;

    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (deviceId) headers["x-device-id"] = deviceId;

      const res = await fetch(new URL("/api/arena/respond", getApiUrl()).toString(), {
        method: "POST",
        headers,
        body: JSON.stringify({
          responderId: interrupter,
          toSpeakerId: "trump",
          conversationHistory: [{ speakerName: "Donald Trump", text: trumpMessageText }],
          topic: currentTopicRef.current || "debate",
          isInterruption: true,
        }),
      });

      if (res.ok && mountedRef.current) {
        const data = await res.json();
        const persona = ARENA_PERSONAS[interrupter];
        const interruptMsg: ConversationMessage = {
          id: "interrupt-" + Date.now() + Math.random().toString(36).substr(2, 5),
          speakerId: interrupter,
          speakerName: `⚡ ${persona.name}`,
          text: data.response,
          timestamp: Date.now(),
        };
        addMessage(interruptMsg);
        queueTTS(data.response, interrupter);

        await new Promise((r) => setTimeout(r, 1500 + Math.random() * 1000));
        if (!mountedRef.current || !isRunningRef.current) return;

        const clap = await fetch(new URL("/api/arena/respond", getApiUrl()).toString(), {
          method: "POST",
          headers,
          body: JSON.stringify({
            responderId: "trump",
            toSpeakerId: interrupter,
            conversationHistory: [
              { speakerName: "Donald Trump", text: trumpMessageText },
              { speakerName: persona.name, text: data.response },
            ],
            topic: currentTopicRef.current || "debate",
            isInterruption: true,
          }),
        });

        if (clap.ok && mountedRef.current) {
          const clapData = await clap.json();
          addMessage({
            id: "clapback-" + Date.now() + Math.random().toString(36).substr(2, 5),
            speakerId: "trump",
            speakerName: "Donald Trump",
            text: clapData.response,
            timestamp: Date.now(),
          });
          queueTTS(clapData.response, "trump");
        }
      }
    } catch {}
  }, [deviceId, addMessage, queueTTS]);

  const triggerTrumpInterruption = useCallback(async (opponentText: string, opponentId: string) => {
    if (!mountedRef.current) return;
    const active = selectedPersonasRef.current;
    if (!active.includes("trump")) return;

    await new Promise((r) => setTimeout(r, 600 + Math.random() * 800));
    if (!mountedRef.current || !isRunningRef.current) return;

    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (deviceId) headers["x-device-id"] = deviceId;
      const opponentName = ARENA_PERSONAS[opponentId]?.name || "someone";

      const res = await fetch(new URL("/api/arena/respond", getApiUrl()).toString(), {
        method: "POST",
        headers,
        body: JSON.stringify({
          responderId: "trump",
          toSpeakerId: opponentId,
          conversationHistory: [{ speakerName: opponentName, text: opponentText }],
          topic: currentTopicRef.current || "debate",
          isInterruption: true,
          isTrumpInitiated: true,
        }),
      });

      if (res.ok && mountedRef.current) {
        const data = await res.json();
        addMessage({
          id: "trump-interrupt-" + Date.now() + Math.random().toString(36).substr(2, 5),
          speakerId: "trump",
          speakerName: "\u26A1 Donald Trump",
          text: data.response,
          timestamp: Date.now(),
        });
        queueTTS(data.response, "trump");
      }
    } catch {}
  }, [deviceId, addMessage, queueTTS]);

  const decideNextSpeaker = useCallback(async () => {
    if (!isRunningRef.current || currentSpeakerRef.current) return;
    const msgs = messagesRef.current.filter((m) => !m.isSystem);
    if (msgs.length === 0) return;
    const active = selectedPersonasRef.current;
    if (active.length < 2) return;

    const lastMsg = msgs[msgs.length - 1];
    const recent = recentSpeakersRef.current;

    const pool = active.filter((pid) => pid !== lastMsg.speakerId);
    if (pool.length === 0) return;

    const weights: { id: string; weight: number }[] = pool.map((pid) => {
      let weight = 50;
      const prob = calculateResponseProbability(pid, lastMsg.speakerId, lastMsg.text);
      weight += (prob - 50) * 0.4;

      if (pid === "trump") weight += 25;

      const recentIdx = recent.indexOf(pid);
      if (recentIdx === recent.length - 1) weight -= (pid === "trump" ? 15 : 30);
      else if (recentIdx === recent.length - 2) weight -= (pid === "trump" ? 5 : 15);
      else if (recentIdx === -1) weight += 20;

      const emo = emotionalStatesRef.current[pid];
      if (emo) {
        if (emo.anger > 60) weight += 10;
        if (!emo.lastSpoke || Date.now() - emo.lastSpoke > 20000) weight += 15;
      }

      return { id: pid, weight: Math.max(5, weight) };
    });

    const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0);
    let rand = Math.random() * totalWeight;
    let chosen = weights[0];
    for (const w of weights) {
      rand -= w.weight;
      if (rand <= 0) { chosen = w; break; }
    }

    if (chosen && mountedRef.current) {
      await generateAIResponse(chosen.id, lastMsg.speakerId);

      recentSpeakersRef.current = [...recentSpeakersRef.current, chosen.id].slice(-4);

      if (chosen.id === "trump" && Math.random() < 0.35) {
        const trumpMsg = messagesRef.current.filter((m) => !m.isSystem).slice(-1)[0];
        if (trumpMsg && trumpMsg.speakerId === "trump") {
          triggerInterruption(trumpMsg.text);
        }
      }

      if (chosen.id !== "trump" && Math.random() < 0.3) {
        const latestMsg = messagesRef.current.filter((m) => !m.isSystem).slice(-1)[0];
        if (latestMsg && latestMsg.speakerId !== "trump") {
          triggerTrumpInterruption(latestMsg.text, latestMsg.speakerId);
        }
      }
    }
  }, [generateAIResponse, triggerInterruption, triggerTrumpInterruption]);

  const scheduleNext = useCallback(() => {
    if (conversationTimerRef.current) clearTimeout(conversationTimerRef.current);
    const delay = 3000 + Math.random() * 3000;
    conversationTimerRef.current = setTimeout(async () => {
      if (!mountedRef.current) return;
      await decideNextSpeaker();
      if (mountedRef.current && isRunningRef.current) {
        scheduleNext();
      }
    }, delay);
  }, [decideNextSpeaker]);

  useEffect(() => {
    mountedRef.current = true;

    addMessage({
      id: "system-start",
      speakerId: "system",
      speakerName: "System",
      text: "The Political Arena is live. Personas are entering...",
      timestamp: Date.now(),
      isSystem: true,
    });

    const startTimer = setTimeout(async () => {
      if (!mountedRef.current) return;
      const active = selectedPersonasRef.current;
      const starter = active.includes("trump") ? "trump" : active[0];
      const pool = active.filter((p) => p !== starter);
      const target = pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : starter;
      await generateAIResponse(starter, target);
      if (mountedRef.current) scheduleNext();
    }, 1500);

    return () => {
      mountedRef.current = false;
      clearTimeout(startTimer);
      if (conversationTimerRef.current) clearTimeout(conversationTimerRef.current);
    };
  }, []);

  const handleTopicPress = useCallback(
    async (topicId: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setCurrentTopic(topicId);
      currentTopicRef.current = topicId;

      addMessage({
        id: "topic-" + Date.now(),
        speakerId: "system",
        speakerName: "System",
        text: `Topic changed to: ${topicId.toUpperCase()}`,
        timestamp: Date.now(),
        isSystem: true,
      });

      setPollVotes({});
      setUserVoted(false);
      setShowPollResults(false);
      setPollWinner(null);
      setShowNameInput(false);
      setThankYouPlayed(false);
      setFanName("");

      if (!currentSpeakerRef.current && mountedRef.current) {
        const active = selectedPersonasRef.current;
        const starter = active[Math.floor(Math.random() * active.length)];
        const pool = active.filter((p) => p !== starter);
        const target = pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : starter;
        await generateAIResponse(starter, target);
        if (mountedRef.current) scheduleNext();
      }
    },
    [addMessage, generateAIResponse, scheduleNext]
  );

  const toggleRunning = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsRunning((prev) => {
      const next = !prev;
      isRunningRef.current = next;
      if (next) scheduleNext();
      else if (conversationTimerRef.current) clearTimeout(conversationTimerRef.current);
      return next;
    });
  }, [scheduleNext]);

  const togglePersona = useCallback((pid: string) => {
    setSelectedPersonas((prev) => {
      if (prev.includes(pid)) {
        if (prev.length <= 2) return prev;
        return prev.filter((p) => p !== pid);
      }
      return [...prev, pid];
    });
  }, []);

  const castVote = useCallback((personaId: string) => {
    if (userVoted) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPollVotes((prev) => ({ ...prev, [personaId]: (prev[personaId] || 0) + 1 }));
    setUserVoted(true);
    setShowPollResults(true);
    setPollWinner(personaId);
    setShowNameInput(true);
    setThankYouPlayed(false);
    setFanName("");
  }, [userVoted]);

  const playThankYou = useCallback(async (name: string, personaId: string) => {
    if (!name.trim() || !personaId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setThankYouPlayed(true);
    const persona = ARENA_PERSONAS[personaId];
    if (!persona) return;

    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (deviceId) headers["x-device-id"] = deviceId;
      const res = await fetch(new URL("/api/arena/respond", getApiUrl()).toString(), {
        method: "POST",
        headers,
        body: JSON.stringify({
          responderId: personaId,
          toSpeakerId: "system",
          conversationHistory: [{ speakerName: "Fan", text: `A fan named ${name.trim()} just voted for you as the winner of this debate! Thank them personally and make it memorable.` }],
          topic: currentTopic || "debate",
          isPollThankYou: true,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        addMessage({
          id: "thankyou-" + Date.now() + Math.random().toString(36).substr(2, 5),
          speakerId: personaId,
          speakerName: persona.name,
          text: data.response,
          timestamp: Date.now(),
        });
        queueTTS(data.response, personaId, true);
      } else {
        console.warn("Thank you TTS failed:", res.status);
      }
    } catch (e) {
      console.warn("Thank you error:", e);
    }
  }, [deviceId, currentTopic, addMessage, queueTTS]);

  const shareDebate = useCallback(async () => {
    const topicName = currentTopic || "Political Arena";
    const recentMessages = messages.filter((m) => !m.isSystem).slice(-5);
    let shareText = `🔥 POLITICAL ARENA: ${topicName}\n\n`;
    recentMessages.forEach((m) => {
      const persona = ARENA_PERSONAS[m.speakerId];
      if (persona) shareText += `${persona.shortName}: "${m.text.substring(0, 80)}..."\n`;
    });
    shareText += `\nWatch the AI debate LIVE on Chat DJT! 🏛️`;

    try {
      if (Platform.OS === "web") {
        if (navigator.share) {
          await navigator.share({ title: `Political Arena: ${topicName}`, text: shareText });
        } else {
          const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`;
          Linking.openURL(twitterUrl);
        }
      } else {
        await Share.share({ message: shareText, title: `Political Arena: ${topicName}` });
      }
    } catch {}
  }, [currentTopic, messages]);

  const replayLastMessage = useCallback(() => {
    const lastNonSystem = [...messages].reverse().find((m) => !m.isSystem);
    if (lastNonSystem) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      queueTTS(lastNonSystem.text, lastNonSystem.speakerId, true);
    }
  }, [messages, queueTTS]);

  const pollCandidates = selectedPersonas.filter((pid) => {
    return messages.some((m) => m.speakerId === pid && !m.isSystem);
  });

  const renderMessage = useCallback(
    ({ item }: { item: ConversationMessage }) => {
      if (item.isSystem) {
        return (
          <View style={s.systemMsg}>
            <Text style={s.systemMsgText}>{item.text}</Text>
          </View>
        );
      }
      const persona = ARENA_PERSONAS[item.speakerId];
      if (!persona) return null;
      return (
        <View style={[s.msgRow, { borderLeftColor: persona.color }]}>
          <View style={s.msgHeader}>
            {persona.image ? (
              <Image source={persona.image} style={s.msgAvatar} />
            ) : (
              <View style={[s.msgAvatarFallback, { backgroundColor: persona.color }]}>
                <Text style={s.msgAvatarText}>{getInitials(persona.name)}</Text>
              </View>
            )}
            <Text style={[s.msgName, { color: persona.color }]}>{persona.shortName}</Text>
            <View style={[s.factionBadge, { backgroundColor: FACTION_COLORS[persona.faction] + "30", borderColor: FACTION_COLORS[persona.faction] + "60" }]}>
              <Text style={[s.factionText, { color: FACTION_COLORS[persona.faction] }]}>{persona.faction}</Text>
            </View>
            <Pressable
              onPress={() => queueTTS(item.text, item.speakerId, true)}
              style={s.msgListenBtn}
              hitSlop={8}
            >
              <Ionicons name="volume-medium" size={14} color="rgba(255,255,255,0.4)" />
            </Pressable>
            <Text style={s.msgTime}>
              {new Date(item.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </Text>
          </View>
          <Text style={s.msgText}>{item.text}</Text>
        </View>
      );
    },
    [queueTTS]
  );

  return (
    <View style={[s.container, { paddingTop: insets.top + webTopInset }]}>
      <LinearGradient
        colors={["rgba(255,77,77,0.08)", "rgba(0,0,0,0)", Colors.background]}
        style={StyleSheet.absoluteFill}
      />

      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </Pressable>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>POLITICAL ARENA</Text>
          <View style={s.liveBadge}>
            <View style={s.liveDot} />
            <Text style={s.liveText}>LIVE</Text>
          </View>
        </View>
        <Pressable onPress={() => setShowPersonaSelector(true)} style={s.headerIconBtn}>
          <Ionicons name="people" size={18} color="#FFD700" />
        </Pressable>
        <Pressable onPress={shareDebate} style={s.headerIconBtn}>
          <Ionicons name="share-social" size={18} color="#fff" />
        </Pressable>
        <Pressable onPress={toggleRunning} style={s.headerIconBtn}>
          <Ionicons name={isRunning ? "pause" : "play"} size={18} color="#fff" />
        </Pressable>
      </View>

      <View style={s.voiceRow}>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setVoiceEnabled((p) => {
              if (p) stopAllTTS();
              return !p;
            });
          }}
          style={[s.voiceToggle, voiceEnabled && s.voiceToggleActive]}
        >
          <Ionicons
            name={voiceEnabled ? (isPlayingAudio ? "volume-high" : "volume-medium") : "volume-mute"}
            size={16}
            color={voiceEnabled ? "#FFD700" : "#aaa"}
          />
          <Text style={[s.voiceToggleText, voiceEnabled && s.voiceToggleTextActive]}>
            {voiceEnabled ? (isPlayingAudio ? "PLAYING" : "VOICE ON") : "VOICE OFF"}
          </Text>
        </Pressable>
        <Pressable onPress={replayLastMessage} style={s.replayBtn}>
          <Ionicons name="play-back" size={14} color="#FFD700" />
          <Text style={s.replayText}>REPLAY</Text>
        </Pressable>
        {currentTopic && topicTimer > 0 && (
          <View style={s.topicTimerPill}>
            <Ionicons name="timer" size={12} color={topicTimer < 60 ? "#F87171" : "#FBBF24"} />
            <Text style={[s.topicTimerPillText, topicTimer < 60 && { color: "#F87171" }]}>
              {Math.floor(topicTimer / 60)}:{(topicTimer % 60).toString().padStart(2, "0")}
            </Text>
          </View>
        )}
        {hasSession && sessionTimer > 0 && (
          <View style={s.sessionPill}>
            <Ionicons name="time" size={12} color="#4ADE80" />
            <Text style={s.sessionPillText}>
              {Math.floor(sessionTimer / 60)}:{(sessionTimer % 60).toString().padStart(2, "0")}
            </Text>
          </View>
        )}
        {!hasSession && freeRemaining > 0 && freeRemaining < 30 && (
          <Text style={s.freeCountLabel}>{freeRemaining} free left</Text>
        )}
      </View>

      <Animated.View entering={FadeInDown.delay(200).duration(400)} style={s.personaRow}>
        {selectedPersonas.map((pid) => {
          const p = ARENA_PERSONAS[pid];
          const emo = emotionalStates[pid];
          const isSpeaking = currentSpeaker === pid;
          const isFocused = focusedPersona === pid;
          return (
            <Pressable
              key={pid}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setFocusedPersona(focusedPersona === pid ? null : pid);
              }}
              style={[
                s.personaCircle,
                { borderColor: p.color },
                isSpeaking && { borderColor: "#FFD700", borderWidth: 3 },
                isFocused && { transform: [{ scale: 1.1 }] },
              ]}
            >
              {p.image ? (
                <Image source={p.image} style={s.personaImg} />
              ) : (
                <View style={[s.personaImgFallback, { backgroundColor: p.color + "40" }]}>
                  <Text style={s.personaInitials}>{getInitials(p.name)}</Text>
                </View>
              )}
              {isSpeaking && (
                <View style={s.speakingIndicator}>
                  <MaterialCommunityIcons name="volume-high" size={10} color="#FFD700" />
                </View>
              )}
              <Text style={[s.personaLabel, { color: p.color }]} numberOfLines={1}>
                {p.shortName}
              </Text>
              <View style={s.emotionBars}>
                <View style={[s.emotionBar, s.angerBar, { width: `${emo.anger}%` }]} />
                <View style={[s.emotionBar, s.happyBar, { width: `${emo.happiness}%` }]} />
              </View>
            </Pressable>
          );
        })}
      </Animated.View>

      {focusedPersona && (
        <Animated.View entering={FadeIn.duration(200)} style={s.focusCard}>
          <View style={s.focusHeader}>
            <Text style={[s.focusName, { color: ARENA_PERSONAS[focusedPersona].color }]}>
              {ARENA_PERSONAS[focusedPersona].name}
            </Text>
            <View style={[s.factionBadge, { backgroundColor: FACTION_COLORS[ARENA_PERSONAS[focusedPersona].faction] + "30", borderColor: FACTION_COLORS[ARENA_PERSONAS[focusedPersona].faction] + "60" }]}>
              <Text style={[s.factionText, { color: FACTION_COLORS[ARENA_PERSONAS[focusedPersona].faction] }]}>
                {ARENA_PERSONAS[focusedPersona].faction}
              </Text>
            </View>
          </View>
          <View style={s.focusStats}>
            <View style={s.focusStat}>
              <Ionicons name="flame" size={12} color="#ff4d4d" />
              <Text style={s.focusStatLabel}>Anger</Text>
              <View style={[s.focusStatBar, s.angerBar, { width: `${emotionalStates[focusedPersona].anger}%` }]} />
              <Text style={s.focusStatVal}>{emotionalStates[focusedPersona].anger}%</Text>
            </View>
            <View style={s.focusStat}>
              <Ionicons name="happy" size={12} color="#4ADE80" />
              <Text style={s.focusStatLabel}>Happy</Text>
              <View style={[s.focusStatBar, s.happyBar, { width: `${emotionalStates[focusedPersona].happiness}%` }]} />
              <Text style={s.focusStatVal}>{emotionalStates[focusedPersona].happiness}%</Text>
            </View>
            <View style={s.focusStat}>
              <Ionicons name="flash" size={12} color="#FBBF24" />
              <Text style={s.focusStatLabel}>Energy</Text>
              <View style={[s.focusStatBar, { backgroundColor: "#FBBF24" }, { width: `${emotionalStates[focusedPersona].engagement}%` }]} />
              <Text style={s.focusStatVal}>{emotionalStates[focusedPersona].engagement}%</Text>
            </View>
          </View>
        </Animated.View>
      )}

      <View style={s.streamContainer}>
        <View style={s.streamHeader}>
          <View style={s.streamLive}>
            <View style={[s.liveDot, { width: 6, height: 6, borderRadius: 3 }]} />
            <Text style={s.streamHeaderText}>
              {currentSpeaker
                ? `${ARENA_PERSONAS[currentSpeaker]?.shortName} is speaking...`
                : currentTopic ? currentTopic : "Real-time AI conversation"}
            </Text>
          </View>
          {currentSpeaker && <ActivityIndicator size="small" color={ARENA_PERSONAS[currentSpeaker]?.color || "#fff"} />}
        </View>
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          style={s.streamList}
          contentContainerStyle={s.streamContent}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />
      </View>

      {currentTopic && pollCandidates.length >= 2 && (
        <View style={s.pollSection}>
          <Text style={s.pollTitle}>
            {userVoted ? "POLL RESULTS" : "WHO'S WINNING THIS DEBATE?"}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.pollOptions}>
            {pollCandidates.map((pid) => {
              const p = ARENA_PERSONAS[pid];
              const votes = pollVotes[pid] || 0;
              const totalVotes = Object.values(pollVotes).reduce((a, b) => a + b, 0);
              const pct = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
              return (
                <Pressable
                  key={pid}
                  onPress={() => castVote(pid)}
                  disabled={userVoted}
                  style={[s.pollOptionBtn, userVoted && pollVotes[pid] && { borderColor: p.color, backgroundColor: p.color + "15" }]}
                >
                  {p.image ? (
                    <Image source={p.image} style={s.pollAvatar} />
                  ) : (
                    <View style={[s.pollAvatarFallback, { backgroundColor: p.color + "40" }]}>
                      <Text style={s.pollAvatarText}>{getInitials(p.name)}</Text>
                    </View>
                  )}
                  <Text style={[s.pollName, { color: p.color }]} numberOfLines={1}>{p.shortName}</Text>
                  {showPollResults && <Text style={s.pollPct}>{pct}%</Text>}
                </Pressable>
              );
            })}
          </ScrollView>
          {userVoted && showNameInput && pollWinner && (
            <View style={s.nameInputSection}>
              <Text style={s.nameInputLabel}>
                Enter your name — {ARENA_PERSONAS[pollWinner]?.shortName} wants to thank you!
              </Text>
              <View style={s.nameInputRow}>
                <TextInput
                  style={s.nameInput}
                  placeholder="Your name..."
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  value={fanName}
                  onChangeText={setFanName}
                  maxLength={30}
                  autoCapitalize="words"
                />
                <Pressable
                  onPress={() => playThankYou(fanName, pollWinner)}
                  disabled={!fanName.trim() || thankYouPlayed}
                  style={[s.thankYouBtn, (!fanName.trim() || thankYouPlayed) && { opacity: 0.4 }]}
                >
                  {thankYouPlayed ? (
                    <Ionicons name="checkmark-circle" size={16} color="#4ADE80" />
                  ) : (
                    <Ionicons name="mic" size={16} color="#000" />
                  )}
                  <Text style={s.thankYouBtnText}>{thankYouPlayed ? "Sent!" : "Hear Thanks"}</Text>
                </Pressable>
              </View>
            </View>
          )}
          {userVoted && (
            <View style={s.pollActionsRow}>
              <Pressable
                onPress={() => { setPollVotes({}); setUserVoted(false); setShowPollResults(false); setPollWinner(null); setShowNameInput(false); setThankYouPlayed(false); setFanName(""); }}
                style={s.pollResetBtn}
              >
                <Text style={s.pollResetText}>Vote Again</Text>
              </Pressable>
              <Pressable onPress={shareDebate} style={s.pollShareBtn}>
                <Ionicons name="share-social" size={12} color="#FFD700" />
                <Text style={s.pollShareText}>Share Results</Text>
              </Pressable>
            </View>
          )}
        </View>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.affiliateRow} contentContainerStyle={s.affiliateContent}>
        {AFFILIATE_LINKS.map((link, i) => (
          <Pressable
            key={i}
            onPress={() => Linking.openURL(link.url)}
            style={s.affiliateBtn}
          >
            <Ionicons
              name={link.icon === "hat" ? "ribbon" : link.icon === "shirt" ? "shirt" : link.icon === "book" ? "book" : "gift"}
              size={12}
              color="#FFD700"
            />
            <Text style={s.affiliateText} numberOfLines={1}>{link.title}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <Animated.View entering={FadeInUp.delay(400).duration(400)} style={[s.topicRow, { paddingBottom: insets.bottom + webBottomInset + 8 }]}>
        <FlatList
          data={dynamicTopics}
          horizontal
          keyExtractor={(item) => item.id || item.title}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.topicList}
          renderItem={({ item }) => {
            const color = TOPIC_COLOR_MAP[item.id] || "#FBBF24";
            const icon = TOPIC_ICON_MAP[item.id] || "chatbubbles";
            const isActive = currentTopic === item.title || currentTopic === item.id;
            return (
              <Pressable
                onPress={() => handleTopicPress(item.title || item.id)}
                style={[
                  s.topicBtn,
                  { borderColor: color + "60" },
                  isActive && { backgroundColor: color + "25", borderColor: color },
                ]}
              >
                <Ionicons name={icon as any} size={14} color={isActive ? color : "#888"} />
                <Text style={[s.topicBtnText, isActive && { color }]} numberOfLines={1}>
                  {item.title}
                </Text>
              </Pressable>
            );
          }}
        />
      </Animated.View>

      <Modal visible={showPersonaSelector} transparent animationType="slide">
        <View style={s.selectorOverlay}>
          <View style={s.selectorCard}>
            <View style={s.selectorHeader}>
              <Text style={s.selectorTitle}>Choose Debaters</Text>
              <Text style={s.selectorSubtitle}>Pick 2 or more personas ({selectedPersonas.length} selected)</Text>
            </View>
            <FlatList
              data={PERSONA_IDS}
              keyExtractor={(id) => id}
              numColumns={2}
              contentContainerStyle={s.selectorGrid}
              renderItem={({ item: pid }) => {
                const p = ARENA_PERSONAS[pid];
                const isSelected = selectedPersonas.includes(pid);
                return (
                  <Pressable
                    onPress={() => togglePersona(pid)}
                    style={[
                      s.selectorItem,
                      { borderColor: isSelected ? p.color : "rgba(255,255,255,0.1)" },
                      isSelected && { backgroundColor: p.color + "15" },
                    ]}
                  >
                    {p.image ? (
                      <Image source={p.image} style={s.selectorAvatar} />
                    ) : (
                      <View style={[s.selectorAvatarFallback, { backgroundColor: p.color + "40" }]}>
                        <Text style={s.selectorAvatarInitials}>{getInitials(p.name)}</Text>
                      </View>
                    )}
                    <View style={s.selectorInfo}>
                      <Text style={[s.selectorName, { color: isSelected ? p.color : "#aaa" }]}>{p.shortName}</Text>
                      <Text style={s.selectorFaction}>{p.faction}</Text>
                    </View>
                    {isSelected && <Ionicons name="checkmark-circle" size={18} color={p.color} />}
                  </Pressable>
                );
              }}
            />
            <View style={s.selectorActions}>
              <Pressable
                onPress={() => setSelectedPersonas(PERSONA_IDS)}
                style={s.selectorSelectAll}
              >
                <Text style={s.selectorSelectAllText}>Select All</Text>
              </Pressable>
              <Pressable
                onPress={() => { if (selectedPersonas.length >= 2) setShowPersonaSelector(false); }}
                style={[s.selectorDoneBtn, selectedPersonas.length < 2 && { opacity: 0.4 }]}
              >
                <Text style={s.selectorDoneText}>Done</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showPaywall} transparent animationType="fade">
        <View style={s.paywallOverlay}>
          <View style={s.paywallCard}>
            <Ionicons name="lock-closed" size={36} color="#FFD700" />
            <Text style={s.paywallTitle}>Arena Access Required</Text>
            <Text style={s.paywallSubtitle}>
              You've used your free trial. Unlock 10 minutes of unlimited access for 3 tokens.
            </Text>
            <View style={s.paywallBalanceRow}>
              <Ionicons name="diamond" size={16} color="#FFD700" />
              <Text style={s.paywallBalance}>{balance?.totalAvailable ?? 0} tokens available</Text>
            </View>
            <Pressable
              onPress={unlockSession}
              disabled={isUnlocking}
              style={[s.paywallBtn, isUnlocking && { opacity: 0.6 }]}
            >
              {isUnlocking ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <Text style={s.paywallBtnText}>Unlock for 5 Tokens</Text>
              )}
            </Pressable>
            <Pressable onPress={() => { setShowPaywall(false); router.push("/subscribe"); }} style={s.paywallSecondaryBtn}>
              <Text style={s.paywallSecondaryText}>Get More Tokens</Text>
            </Pressable>
            <Pressable onPress={() => setShowPaywall(false)} style={s.paywallDismiss}>
              <Text style={s.paywallDismissText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "900" as const,
    color: "#ff4d4d",
    letterSpacing: 1.5,
  },
  headerIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,77,77,0.2)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,77,77,0.4)",
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#ff4d4d",
  },
  liveText: {
    fontSize: 9,
    fontWeight: "800" as const,
    color: "#ff4d4d",
    letterSpacing: 0.5,
  },
  personaRow: {
    flexDirection: "row",
    justifyContent: "center",
    paddingHorizontal: 8,
    gap: 6,
    marginBottom: 8,
    flexWrap: "wrap",
  },
  personaCircle: {
    alignItems: "center",
    width: 58,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1.5,
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  personaImg: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  personaImgFallback: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  personaInitials: {
    fontSize: 12,
    fontWeight: "800" as const,
    color: "#fff",
  },
  speakingIndicator: {
    position: "absolute",
    top: 2,
    right: 4,
    backgroundColor: "rgba(255,215,0,0.3)",
    borderRadius: 8,
    padding: 2,
  },
  personaLabel: {
    fontSize: 7,
    fontWeight: "700" as const,
    marginTop: 3,
    letterSpacing: 0.3,
  },
  emotionBars: {
    flexDirection: "row",
    gap: 2,
    marginTop: 4,
    width: "80%",
    height: 3,
  },
  emotionBar: {
    height: 3,
    borderRadius: 1.5,
  },
  angerBar: {
    backgroundColor: "#ff4d4d",
  },
  happyBar: {
    backgroundColor: "#4ADE80",
  },
  focusCard: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  focusHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  focusName: {
    fontSize: 14,
    fontWeight: "800" as const,
  },
  focusStats: {
    gap: 6,
  },
  focusStat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  focusStatLabel: {
    fontSize: 10,
    color: "rgba(255,255,255,0.4)",
    fontWeight: "600" as const,
    width: 40,
  },
  focusStatBar: {
    height: 6,
    borderRadius: 3,
    maxWidth: "60%",
  },
  focusStatVal: {
    fontSize: 10,
    color: "rgba(255,255,255,0.4)",
    fontWeight: "600" as const,
    width: 30,
  },
  factionBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  factionText: {
    fontSize: 8,
    fontWeight: "700" as const,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  streamContainer: {
    flex: 1,
    marginHorizontal: 12,
    backgroundColor: "rgba(255,255,255,0.02)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    overflow: "hidden",
  },
  streamHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
    backgroundColor: "rgba(255,255,255,0.02)",
  },
  streamLive: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  streamHeaderText: {
    fontSize: 11,
    color: "rgba(255,255,255,0.5)",
    fontWeight: "600" as const,
  },
  streamList: {
    flex: 1,
  },
  streamContent: {
    padding: 10,
    gap: 8,
  },
  systemMsg: {
    alignItems: "center",
    paddingVertical: 6,
  },
  systemMsgText: {
    fontSize: 10,
    color: "rgba(255,255,255,0.3)",
    fontStyle: "italic",
  },
  msgRow: {
    borderLeftWidth: 3,
    paddingLeft: 10,
    paddingVertical: 8,
    paddingRight: 8,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 8,
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
  },
  msgHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  msgAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  msgAvatarFallback: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  msgAvatarText: {
    fontSize: 8,
    fontWeight: "800" as const,
    color: "#fff",
  },
  msgName: {
    fontSize: 12,
    fontWeight: "800" as const,
  },
  msgListenBtn: {
    marginLeft: "auto",
    padding: 2,
  },
  msgTime: {
    fontSize: 9,
    color: "rgba(255,255,255,0.25)",
  },
  msgText: {
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
    lineHeight: 19,
  },
  voiceRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 6,
    gap: 8,
  },
  voiceToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.15)",
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  voiceToggleActive: {
    backgroundColor: "rgba(255,215,0,0.12)",
    borderColor: "rgba(255,215,0,0.4)",
  },
  voiceToggleText: {
    fontSize: 11,
    fontWeight: "800" as const,
    color: "#aaa",
    letterSpacing: 0.5,
  },
  voiceToggleTextActive: {
    color: "#FFD700",
  },
  replayBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "rgba(255,215,0,0.25)",
    backgroundColor: "rgba(255,215,0,0.08)",
  },
  replayText: {
    fontSize: 10,
    fontWeight: "800" as const,
    color: "#FFD700",
    letterSpacing: 0.5,
  },
  topicTimerPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: "rgba(251,191,36,0.1)",
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.2)",
  },
  topicTimerPillText: {
    fontSize: 11,
    fontWeight: "700" as const,
    color: "#FBBF24",
  },
  sessionPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: "rgba(74,222,128,0.1)",
    borderWidth: 1,
    borderColor: "rgba(74,222,128,0.25)",
  },
  sessionPillText: {
    fontSize: 11,
    fontWeight: "700" as const,
    color: "#4ADE80",
  },
  freeCountLabel: {
    fontSize: 10,
    fontWeight: "700" as const,
    color: "rgba(255,255,255,0.4)",
    marginLeft: "auto",
  },
  pollSection: {
    marginHorizontal: 12,
    marginVertical: 6,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(255,215,0,0.15)",
  },
  pollTitle: {
    fontSize: 10,
    fontWeight: "800" as const,
    color: "#FFD700",
    textAlign: "center",
    letterSpacing: 1,
    marginBottom: 8,
  },
  pollOptions: {
    gap: 6,
    paddingHorizontal: 2,
  },
  pollOptionBtn: {
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(255,255,255,0.03)",
    minWidth: 56,
  },
  pollAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  pollAvatarFallback: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  pollAvatarText: {
    fontSize: 8,
    fontWeight: "800" as const,
    color: "#fff",
  },
  pollName: {
    fontSize: 9,
    fontWeight: "700" as const,
    marginTop: 3,
  },
  pollPct: {
    fontSize: 11,
    fontWeight: "900" as const,
    color: "#FFD700",
    marginTop: 2,
  },
  pollActionsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
    marginTop: 8,
  },
  pollResetBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  pollResetText: {
    fontSize: 10,
    fontWeight: "600" as const,
    color: "rgba(255,255,255,0.4)",
  },
  pollShareBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: "rgba(255,215,0,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,215,0,0.3)",
  },
  pollShareText: {
    fontSize: 10,
    fontWeight: "700" as const,
    color: "#FFD700",
  },
  nameInputSection: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,215,0,0.1)",
  },
  nameInputLabel: {
    fontSize: 11,
    fontWeight: "700" as const,
    color: "rgba(255,255,255,0.5)",
    textAlign: "center",
    marginBottom: 8,
  },
  nameInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  nameInput: {
    flex: 1,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,215,0,0.25)",
    backgroundColor: "rgba(255,255,255,0.05)",
    paddingHorizontal: 12,
    fontSize: 14,
    color: "#fff",
    fontWeight: "600" as const,
  },
  thankYouBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: "#FFD700",
  },
  thankYouBtnText: {
    fontSize: 12,
    fontWeight: "800" as const,
    color: "#000",
  },
  affiliateRow: {
    maxHeight: 36,
    marginHorizontal: 12,
  },
  affiliateContent: {
    gap: 8,
    alignItems: "center",
    paddingHorizontal: 2,
  },
  affiliateBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: "rgba(255,215,0,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,215,0,0.15)",
  },
  affiliateText: {
    fontSize: 10,
    fontWeight: "600" as const,
    color: "rgba(255,215,0,0.7)",
    maxWidth: 100,
  },
  topicRow: {
    paddingTop: 8,
    backgroundColor: Colors.background,
  },
  topicList: {
    paddingHorizontal: 12,
    gap: 8,
  },
  topicBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  topicBtnText: {
    fontSize: 12,
    fontWeight: "600" as const,
    color: "#888",
    maxWidth: 120,
  },
  selectorOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "center",
    padding: 20,
  },
  selectorCard: {
    backgroundColor: "#1a1a1a",
    borderRadius: 20,
    maxHeight: "80%",
    borderWidth: 1,
    borderColor: "rgba(255,215,0,0.2)",
    overflow: "hidden",
  },
  selectorHeader: {
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
  },
  selectorTitle: {
    fontSize: 18,
    fontWeight: "900" as const,
    color: "#FFD700",
    letterSpacing: 1,
  },
  selectorSubtitle: {
    fontSize: 12,
    color: "rgba(255,255,255,0.4)",
    marginTop: 4,
  },
  selectorGrid: {
    padding: 10,
    gap: 8,
  },
  selectorItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    backgroundColor: "rgba(255,255,255,0.03)",
    margin: 4,
    minWidth: "40%",
  },
  selectorAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  selectorAvatarFallback: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  selectorAvatarInitials: {
    fontSize: 11,
    fontWeight: "800" as const,
    color: "#fff",
  },
  selectorInfo: {
    flex: 1,
  },
  selectorName: {
    fontSize: 12,
    fontWeight: "800" as const,
  },
  selectorFaction: {
    fontSize: 9,
    color: "rgba(255,255,255,0.3)",
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
  selectorActions: {
    flexDirection: "row",
    padding: 14,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
  },
  selectorSelectAll: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  selectorSelectAllText: {
    fontSize: 13,
    fontWeight: "700" as const,
    color: "rgba(255,255,255,0.5)",
  },
  selectorDoneBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#FFD700",
  },
  selectorDoneText: {
    fontSize: 13,
    fontWeight: "900" as const,
    color: "#000",
  },
  paywallOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.8)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  paywallCard: {
    backgroundColor: "#1a1a1a",
    borderRadius: 20,
    padding: 28,
    alignItems: "center",
    width: "100%",
    maxWidth: 340,
    borderWidth: 1,
    borderColor: "rgba(255,215,0,0.2)",
  },
  paywallTitle: {
    fontSize: 20,
    fontWeight: "900" as const,
    color: "#fff",
    marginTop: 12,
    textAlign: "center",
  },
  paywallSubtitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.6)",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 18,
  },
  paywallBalanceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 16,
    backgroundColor: "rgba(255,215,0,0.1)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  paywallBalance: {
    fontSize: 13,
    fontWeight: "700" as const,
    color: "#FFD700",
  },
  paywallBtn: {
    backgroundColor: "#FFD700",
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 16,
    width: "100%",
    alignItems: "center",
  },
  paywallBtnText: {
    fontSize: 15,
    fontWeight: "900" as const,
    color: "#000",
  },
  paywallSecondaryBtn: {
    marginTop: 10,
    paddingVertical: 10,
  },
  paywallSecondaryText: {
    fontSize: 13,
    fontWeight: "600" as const,
    color: "rgba(255,255,255,0.5)",
  },
  paywallDismiss: {
    marginTop: 4,
    paddingVertical: 8,
  },
  paywallDismissText: {
    fontSize: 12,
    color: "rgba(255,255,255,0.3)",
  },
});
