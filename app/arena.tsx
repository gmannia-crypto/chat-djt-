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
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown, FadeInUp, FadeIn } from "react-native-reanimated";
import { getApiUrl } from "@/lib/query-client";

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

const TOPIC_BUTTONS = [
  { id: "israel", label: "Israel", icon: "earth" as const, color: "#0038b8" },
  { id: "economy", label: "Economy", icon: "cash" as const, color: "#4ADE80" },
  { id: "biden", label: "Biden", icon: "person" as const, color: "#60A5FA" },
  { id: "media", label: "Media", icon: "tv" as const, color: "#FBBF24" },
  { id: "immigration", label: "Immigration", icon: "airplane" as const, color: "#F87171" },
  { id: "military", label: "Military", icon: "shield-checkmark" as const, color: "#A78BFA" },
];

const FACTION_COLORS = {
  self: "#FFD700",
  supporter: "#22c55e",
  opponent: "#3b82f6",
};

function getInitials(name: string) {
  return name.split(" ").map(w => w[0]).join("").substring(0, 2);
}

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

  const flatListRef = useRef<FlatList>(null);
  const isRunningRef = useRef(true);
  const messagesRef = useRef<ConversationMessage[]>([]);
  const currentSpeakerRef = useRef<string | null>(null);
  const currentTopicRef = useRef<string | null>(null);
  const emotionalStatesRef = useRef(emotionalStates);
  const conversationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  useEffect(() => {
    currentSpeakerRef.current = currentSpeaker;
  }, [currentSpeaker]);
  useEffect(() => {
    currentTopicRef.current = currentTopic;
  }, [currentTopic]);
  useEffect(() => {
    emotionalStatesRef.current = emotionalStates;
  }, [emotionalStates]);
  useEffect(() => {
    isRunningRef.current = isRunning;
  }, [isRunning]);

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

        PERSONA_IDS.forEach((id) => {
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

        const res = await fetch(new URL("/api/arena/respond", getApiUrl()).toString(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            responderId,
            toSpeakerId,
            conversationHistory: history,
            topic: currentTopicRef.current,
          }),
        });

        if (!res.ok || !mountedRef.current) return;
        const data = await res.json();
        const persona = ARENA_PERSONAS[responderId];

        addMessage({
          id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
          speakerId: responderId,
          speakerName: persona.name,
          text: data.response,
          timestamp: Date.now(),
        });

        updateEmotions(responderId, toSpeakerId);
      } catch (err) {
        console.error("Arena AI error:", err);
      } finally {
        if (mountedRef.current) {
          setCurrentSpeaker(null);
          currentSpeakerRef.current = null;
        }
      }
    },
    [addMessage, updateEmotions]
  );

  const decideNextSpeaker = useCallback(async () => {
    if (!isRunningRef.current || currentSpeakerRef.current) return;
    const msgs = messagesRef.current.filter((m) => !m.isSystem);
    if (msgs.length === 0) return;

    const lastMsg = msgs[msgs.length - 1];
    const candidates: { id: string; prob: number }[] = [];

    PERSONA_IDS.forEach((pid) => {
      if (pid === lastMsg.speakerId) return;
      const prob = calculateResponseProbability(pid, lastMsg.speakerId, lastMsg.text);
      if (Math.random() * 100 < prob) {
        candidates.push({ id: pid, prob });
      }
    });

    if (candidates.length === 0) {
      const randomId = PERSONA_IDS.filter((p) => p !== lastMsg.speakerId)[
        Math.floor(Math.random() * (PERSONA_IDS.length - 1))
      ];
      candidates.push({ id: randomId, prob: 50 });
    }

    candidates.sort((a, b) => {
      const eA = emotionalStatesRef.current[a.id]?.engagement || 0;
      const eB = emotionalStatesRef.current[b.id]?.engagement || 0;
      return eB - eA;
    });

    const chosen = candidates[0];
    if (chosen && mountedRef.current) {
      await generateAIResponse(chosen.id, lastMsg.speakerId);
    }
  }, [generateAIResponse]);

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
      await generateAIResponse("trump", "galloway");
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

      if (!currentSpeakerRef.current && mountedRef.current) {
        const starter = PERSONA_IDS[Math.floor(Math.random() * PERSONA_IDS.length)];
        const target = PERSONA_IDS.filter((p) => p !== starter)[
          Math.floor(Math.random() * (PERSONA_IDS.length - 1))
        ];
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
            <Text style={s.msgTime}>
              {new Date(item.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </Text>
          </View>
          <Text style={s.msgText}>{item.text}</Text>
        </View>
      );
    },
    []
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
        <Pressable onPress={toggleRunning} style={s.pauseBtn}>
          <Ionicons name={isRunning ? "pause" : "play"} size={20} color="#fff" />
        </Pressable>
      </View>

      <Animated.View entering={FadeInDown.delay(200).duration(400)} style={s.personaRow}>
        {PERSONA_IDS.map((pid) => {
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
                : "Real-time AI conversation"}
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

      <Animated.View entering={FadeInUp.delay(400).duration(400)} style={[s.topicRow, { paddingBottom: insets.bottom + webBottomInset + 8 }]}>
        <FlatList
          data={TOPIC_BUTTONS}
          horizontal
          keyExtractor={(item) => item.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.topicList}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => handleTopicPress(item.id)}
              style={[
                s.topicBtn,
                { borderColor: item.color + "60" },
                currentTopic === item.id && { backgroundColor: item.color + "25", borderColor: item.color },
              ]}
            >
              <Ionicons name={item.icon as any} size={14} color={currentTopic === item.id ? item.color : "#888"} />
              <Text style={[s.topicBtnText, currentTopic === item.id && { color: item.color }]}>
                {item.label}
              </Text>
            </Pressable>
          )}
        />
      </Animated.View>
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
    gap: 12,
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
  pauseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  personaRow: {
    flexDirection: "row",
    justifyContent: "center",
    paddingHorizontal: 8,
    gap: 6,
    marginBottom: 8,
  },
  personaCircle: {
    alignItems: "center",
    width: 64,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1.5,
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  personaImg: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  personaImgFallback: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  personaInitials: {
    fontSize: 13,
    fontWeight: "800" as const,
    color: "#fff",
  },
  speakingIndicator: {
    position: "absolute",
    top: 2,
    right: 6,
    backgroundColor: "rgba(255,215,0,0.3)",
    borderRadius: 8,
    padding: 2,
  },
  personaLabel: {
    fontSize: 8,
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
  focusStatIcon: {
    width: 18,
    alignItems: "center",
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
  msgTime: {
    fontSize: 9,
    color: "rgba(255,255,255,0.25)",
    marginLeft: "auto",
  },
  msgText: {
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
    lineHeight: 19,
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
  },
});
