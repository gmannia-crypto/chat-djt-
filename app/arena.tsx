import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useEngagement } from "@/lib/engagement-context";
import { useLiveActivity } from "@/lib/live-activity-context";
import { useScreenTracker } from "@/lib/use-analytics";
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
  Alert,
  BackHandler,
  useWindowDimensions,
  ImageBackground,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useNavigation, useFocusEffect } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown, FadeInUp, FadeIn, FadeOut, SlideInLeft, SlideInRight, SlideInUp, SlideOutUp, ZoomIn, ZoomOut, BounceIn, useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming } from "react-native-reanimated";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system/legacy";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApiUrl } from "@/lib/query-client";
import { fetch } from "expo/fetch";
import { playTTS, playAudioFromUrl, prefetchTTSAudio, playPrefetchedAudio } from "@/lib/audio-helper";
import { getPersonaVoiceVolume, shouldSkipPersonaVoice } from "@/lib/persona-voice";
import { playPointAwardSound, playVoteClickSound, playVoteSound2, playBellSound, playCrowdCheer, playDrumroll, playWinnerChosenSound, playWinnerAfterSound, playBreakingNewsAlert } from "@/lib/arena-sfx";
import { useTokens } from "@/lib/token-context";
import { usePersonaLocks, PREMIUM_PERSONA_CONFIGS } from "@/lib/persona-locks";
import {
  placeArenaBet, getArenaBet, clearArenaBet,
  awardBetWin, makeArenaSessionKey, resolveIQRaceBet,
  type ArenaBet,
} from "@/lib/debate-bets";
import { TokenWinVideo } from "@/components/TokenWinVideo";
import { ShareAppButton } from "@/components/ShareAppButton";
import { CashAppDonate } from "@/components/CashAppDonate";
import {
  saveRecording,
  RecordedMessage,
  pickHighlightQuote,
  generateShareText,
  ArenaRecording,
} from "@/lib/arena-recordings";
import {
  recordArenaMoment,
  getArenaMemoryContext,
  saveArenaUserInfo,
  getArenaUserContext,
  loadArenaUserInfo,
} from "@/lib/persona-memory";

const Colors = {
  background: "#0a0a0a",
  gold: "#D4A420",
  whiteDim: "rgba(255,255,255,0.6)",
};

type PersonaCategory = "president" | "politician" | "journalist" | "strategist" | "podcaster" | "comedian" | "tech" | "firstlady" | "commentator" | "activist" | "scientist";

const PERSONA_CATEGORIES: Record<PersonaCategory, { label: string; color: string }> = {
  president: { label: "President", color: "#FFD700" },
  politician: { label: "Politician", color: "#4A90D9" },
  journalist: { label: "Journalist", color: "#9333ea" },
  strategist: { label: "Strategist", color: "#e63946" },
  podcaster: { label: "Podcaster", color: "#FF6B35" },
  comedian: { label: "Comedian", color: "#22c55e" },
  tech: { label: "Tech Leader", color: "#1DA1F2" },
  firstlady: { label: "First Lady", color: "#C0C0C0" },
  commentator: { label: "Commentator", color: "#FF8C00" },
  activist: { label: "Activist", color: "#00C896" },
  scientist: { label: "Scientist", color: "#00BFFF" },
};

const PERSONA_CATEGORY_MAP: Record<string, PersonaCategory> = {
  trump: "president", biden: "president", obama: "president",
  netanyahu: "politician", mcconnell: "politician", omar: "politician",
  graham: "politician", pambondi: "politician", miller: "politician",
  jimjordan: "politician", schumer: "politician", kamala: "politician",
  mtg: "politician", rfk: "politician",
  maddow: "journalist", megynkelly: "journalist", joyreid: "journalist",
  odonnell: "journalist",
  carville: "strategist",
  galloway: "podcaster", alexjones: "podcaster", candace: "podcaster",
  berniemc: "comedian", rosie: "comedian", ruckus: "comedian",
  elon: "tech",
  melania: "firstlady",
  stephena: "commentator",
  malema: "activist",
  hannity: "journalist",
  neiltyson: "scientist",
  errol: "politician",
  leavitt: "journalist",
  erikakirk: "journalist",
  loomer: "podcaster",
  bannon: "strategist",
  claudeanderson: "commentator",
  jascrockett: "politician",
  aoc: "politician",
  pressley: "politician",
  joerogan: "podcaster",
  timscott: "politician",
  drbenj: "commentator",
  carlin: "comedian",
};

// Political Facts IQ: everyone starts at 100 (seeded from all-time average).
// Scored on factual accuracy + political logic consistency. Range 0–200.
// Four tiers: Political Genius (gold ≥160) | Politically Savvy (yellow ≥110) |
//             Politically Ignorant (orange ≥70) | Complete Dumb Ass (red <70)
// "True Arena IQ" = compiled all-time average across sessions (displayed alongside session IQ).
function iqColor(iq: number): string {
  if (iq >= 160) return "#FFD700";
  if (iq >= 110) return "#FBBF24";
  if (iq >= 70)  return "#F97316";
  return "#DC2626";
}
function iqLabelFull(iq: number): string {
  if (iq >= 160) return "Political Genius";
  if (iq >= 110) return "Politically Savvy";
  if (iq >= 70)  return "Politically Ignorant";
  return "Complete Dumb Ass";
}
function iqLabelShort(iq: number): string {
  if (iq >= 160) return "GENIUS";
  if (iq >= 110) return "SAVVY";
  if (iq >= 70)  return "IGNORANT";
  return "DUMB ASS";
}

interface ArenaPersona {
  id: string;
  name: string;
  shortName: string;
  color: string;
  faction: "self" | "supporter" | "opponent" | "wildcard";
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
  audioUri?: string;
}

type LieEntry = {
  id: string;
  speakerId: string;
  speakerName: string;
  text: string;
  score: number;
  reason: string;
  fact: string;
  ts: number;
  userFlagged?: boolean;
  pending?: boolean;
};

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
      elon: { sentiment: 65 },
      joyreid: { sentiment: 5 },
      odonnell: { sentiment: 2 },
      kamala: { sentiment: 5 },
      mtg: { sentiment: 5 },
      schumer: { sentiment: 5 },
    },
    triggerWords: {
      positive: ["great", "win", "success", "money", "deal", "beautiful", "trump"],
      negative: ["fail", "lose", "weak", "stupid", "disaster", "fake", "b6", "traitor"],
    },
  },
  netanyahu: {
    id: "netanyahu",
    name: "Benjamin Netanyahu",
    shortName: "Bibi",
    color: "#0038b8",
    faction: "supporter",
    image: require("@/assets/images/persona-netanyahu.png"),
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
      elon: { sentiment: 50 },
      joyreid: { sentiment: 15 },
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
    image: require("@/assets/images/persona-ruckus.jpg"),
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
      elon: { sentiment: 70 },
      joyreid: { sentiment: 5 },
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
    image: require("@/assets/images/persona-galloway.png"),
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
      elon: { sentiment: 15 },
      joyreid: { sentiment: 55 },
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
    image: require("@/assets/images/persona-mcconnell.png"),
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
      elon: { sentiment: 25 },
      joyreid: { sentiment: 10 },
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
    image: require("@/assets/images/persona-carville.png"),
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
      elon: { sentiment: 15 },
      joyreid: { sentiment: 75 },
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
    image: require("@/assets/images/persona-maddow.png"),
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
      elon: { sentiment: 10 },
      joyreid: { sentiment: 85 },
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
    image: require("@/assets/images/persona-omar.png"),
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
      elon: { sentiment: 10 },
      joyreid: { sentiment: 75 },
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
    image: require("@/assets/images/persona-biden.png"),
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
      elon: { sentiment: 20 },
      joyreid: { sentiment: 60 },
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
    image: require("@/assets/images/persona-rosie.png"),
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
      elon: { sentiment: 10 },
      joyreid: { sentiment: 70 },
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
      elon: { sentiment: 15 },
      joyreid: { sentiment: 55 },
    },
    triggerWords: {
      positive: ["comedy", "chicago", "funny", "bernie", "real", "truth"],
      negative: ["trump", "maga", "ruckus", "sambo", "fool", "lies"],
    },
  },
  elon: {
    id: "elon",
    name: "Elon Musk",
    shortName: "Elon",
    color: "#1DA1F2",
    faction: "supporter",
    image: require("@/assets/images/persona-musk.png"),
    personality: {
      energy: 70,
      aggression: 40,
      humor: 50,
      catchphrases: ["First principles", "We're going to Mars", "X is the everything app", "This is the way", "Delete bureaucracy"],
    },
    relationships: {
      trump: { sentiment: 60 },
      netanyahu: { sentiment: 45 },
      ruckus: { sentiment: 35 },
      galloway: { sentiment: 15 },
      mcconnell: { sentiment: 30 },
      carville: { sentiment: 15 },
      maddow: { sentiment: 10 },
      omar: { sentiment: 10 },
      biden: { sentiment: 15 },
      rosie: { sentiment: 10 },
      berniemc: { sentiment: 20 },
      joyreid: { sentiment: 5 },
      errol: { sentiment: 2 },
    },
    triggerWords: {
      positive: ["mars", "tesla", "spacex", "innovation", "x", "doge", "efficiency", "rockets"],
      negative: ["apartheid", "racism", "salute", "privilege", "billionaire", "exploit", "workers", "jana", "step-sister"],
    },
  },
  errol: {
    id: "errol",
    name: "Errol Musk",
    shortName: "Errol",
    color: "#8B7355",
    faction: "wildcard",
    image: require("@/assets/images/persona-errol.jpg"),
    personality: {
      energy: 55,
      aggression: 60,
      humor: 40,
      catchphrases: ["I'll tell you something now", "In my day", "Quite frankly", "heh heh heh", "The honest truth is"],
    },
    relationships: {
      elon: { sentiment: 70 },
      trump: { sentiment: 65 },
      carville: { sentiment: 20 },
      maddow: { sentiment: 10 },
      omar: { sentiment: 5 },
      biden: { sentiment: 30 },
      rosie: { sentiment: 15 },
      berniemc: { sentiment: 10 },
      joyreid: { sentiment: 5 },
      galloway: { sentiment: 25 },
      ruckus: { sentiment: 20 },
      netanyahu: { sentiment: 55 },
      graham: { sentiment: 60 },
    },
    triggerWords: {
      positive: ["apartheid", "south africa", "white", "infrastructure", "engineering", "civilisation", "order"],
      negative: ["mandela", "racism", "jana", "step", "diversity", "woke", "communist"],
    },
  },
  graham: {
    id: "graham",
    name: "Lindsey Graham",
    shortName: "Graham",
    color: "#cc0000",
    faction: "supporter",
    image: require("@/assets/images/persona-graham.png"),
    personality: {
      energy: 80,
      aggression: 75,
      humor: 30,
      catchphrases: ["I'll tell you what!", "Let me be CLEAR!", "That is OUTRAGEOUS!", "Mark my words!", "There will be HELL to pay!"],
    },
    relationships: {
      trump: { sentiment: 98 },
      netanyahu: { sentiment: 95 },
      ruckus: { sentiment: 70 },
      galloway: { sentiment: 10 },
      mcconnell: { sentiment: 50 },
      carville: { sentiment: 5 },
      maddow: { sentiment: 10 },
      omar: { sentiment: 5 },
      biden: { sentiment: 15 },
      rosie: { sentiment: 10 },
      berniemc: { sentiment: 15 },
      elon: { sentiment: 70 },
      joyreid: { sentiment: 5 },
    },
    triggerWords: {
      positive: ["trump", "israel", "military", "strength", "freedom", "security", "senate"],
      negative: ["flip-flop", "hypocrite", "closet", "gay", "lady lindsey", "bigot", "warmonger"],
    },
  },
  megynkelly: {
    id: "megynkelly",
    name: "Megyn Kelly",
    shortName: "Megyn",
    color: "#d4af37",
    faction: "supporter",
    image: require("@/assets/images/persona-megynkelly.png"),
    personality: {
      energy: 85,
      aggression: 75,
      humor: 35,
      catchphrases: ["Let me be very clear", "The facts don't care about your feelings", "That's just not accurate", "I've done the research"],
    },
    relationships: {
      trump: { sentiment: 65 },
      netanyahu: { sentiment: 70 },
      ruckus: { sentiment: 50 },
      galloway: { sentiment: 10 },
      mcconnell: { sentiment: 55 },
      carville: { sentiment: 15 },
      maddow: { sentiment: 10 },
      omar: { sentiment: 5 },
      biden: { sentiment: 20 },
      rosie: { sentiment: 10 },
      berniemc: { sentiment: 15 },
      elon: { sentiment: 55 },
      graham: { sentiment: 60 },
      pambondi: { sentiment: 70 },
      candace: { sentiment: 60 },
      joyreid: { sentiment: 10 },
    },
    triggerWords: {
      positive: ["fox", "journalism", "facts", "debate", "conservative", "anchor"],
      negative: ["dei", "woke", "liberal media", "cancel culture", "mainstream"],
    },
  },
  pambondi: {
    id: "pambondi",
    name: "Pam Bondi",
    shortName: "Bondi",
    color: "#b22222",
    faction: "supporter",
    image: require("@/assets/images/persona-pambondi.png"),
    personality: {
      energy: 90,
      aggression: 85,
      humor: 20,
      catchphrases: ["As Attorney General", "The law is clear", "We will prosecute", "Federal agents are on the way"],
    },
    relationships: {
      trump: { sentiment: 98 },
      netanyahu: { sentiment: 80 },
      ruckus: { sentiment: 60 },
      galloway: { sentiment: 5 },
      mcconnell: { sentiment: 55 },
      carville: { sentiment: 5 },
      maddow: { sentiment: 5 },
      omar: { sentiment: 5 },
      biden: { sentiment: 10 },
      rosie: { sentiment: 5 },
      berniemc: { sentiment: 10 },
      elon: { sentiment: 75 },
      graham: { sentiment: 70 },
      megynkelly: { sentiment: 70 },
      candace: { sentiment: 55 },
      joyreid: { sentiment: 5 },
    },
    triggerWords: {
      positive: ["law", "order", "justice", "prosecute", "attorney general", "federal"],
      negative: ["corruption", "florida", "fraud", "cover-up", "trump university"],
    },
  },
  candace: {
    id: "candace",
    name: "Candace Owens",
    shortName: "Candace",
    color: "#ff8c00",
    faction: "wildcard",
    image: require("@/assets/images/persona-candace.png"),
    personality: {
      energy: 90,
      aggression: 80,
      humor: 40,
      catchphrases: ["Facts over feelings", "The left doesn't want you to know", "I did my own research", "Follow the money"],
    },
    relationships: {
      trump: { sentiment: 50 },
      netanyahu: { sentiment: 5 },
      ruckus: { sentiment: 30 },
      galloway: { sentiment: 60 },
      mcconnell: { sentiment: 25 },
      carville: { sentiment: 15 },
      maddow: { sentiment: 10 },
      omar: { sentiment: 45 },
      biden: { sentiment: 15 },
      rosie: { sentiment: 15 },
      berniemc: { sentiment: 20 },
      elon: { sentiment: 60 },
      graham: { sentiment: 30 },
      megynkelly: { sentiment: 55 },
      pambondi: { sentiment: 50 },
      joyreid: { sentiment: 10 },
    },
    triggerWords: {
      positive: ["truth", "free speech", "conservative", "blexit", "independent"],
      negative: ["netanyahu", "aipac", "epstein", "israel lobby", "zionist"],
    },
  },
  joyreid: {
    id: "joyreid",
    name: "Joy Reid",
    shortName: "Joy",
    color: "#9333ea",
    faction: "opponent",
    image: require("@/assets/images/persona-joyreid.png"),
    personality: {
      energy: 90,
      aggression: 80,
      humor: 45,
      catchphrases: ["Let me be absolutely clear", "The receipts don't lie", "This is what fascism looks like", "Say it with your chest", "Don't come for me"],
    },
    relationships: {
      trump: { sentiment: 5 },
      netanyahu: { sentiment: 15 },
      ruckus: { sentiment: 5 },
      galloway: { sentiment: 55 },
      mcconnell: { sentiment: 10 },
      carville: { sentiment: 60 },
      maddow: { sentiment: 90 },
      omar: { sentiment: 80 },
      biden: { sentiment: 65 },
      rosie: { sentiment: 70 },
      berniemc: { sentiment: 55 },
      elon: { sentiment: 5 },
      graham: { sentiment: 5 },
      megynkelly: { sentiment: 10 },
      pambondi: { sentiment: 5 },
      candace: { sentiment: 5 },
      miller: { sentiment: 5 },
      jimjordan: { sentiment: 5 },
      schumer: { sentiment: 50 },
    },
    triggerWords: {
      positive: ["justice", "democracy", "voting rights", "equality", "civil rights", "accountability"],
      negative: ["trump", "maga", "fascist", "racist", "authoritarian", "insurrection", "proud boys"],
    },
  },
  miller: {
    id: "miller",
    name: "Stephen Miller",
    shortName: "Miller",
    color: "#2c2c2c",
    faction: "supporter",
    image: require("@/assets/images/persona-miller.png"),
    personality: {
      energy: 75,
      aggression: 90,
      humor: 5,
      catchphrases: ["The President's authority is absolute", "We will not apologize", "This is about national security", "The American people demand action"],
    },
    relationships: {
      trump: { sentiment: 100 },
      netanyahu: { sentiment: 95 },
      ruckus: { sentiment: 50 },
      galloway: { sentiment: 5 },
      mcconnell: { sentiment: 40 },
      carville: { sentiment: 5 },
      maddow: { sentiment: 5 },
      omar: { sentiment: 5 },
      biden: { sentiment: 5 },
      rosie: { sentiment: 5 },
      berniemc: { sentiment: 10 },
      elon: { sentiment: 60 },
      graham: { sentiment: 70 },
      megynkelly: { sentiment: 65 },
      pambondi: { sentiment: 75 },
      candace: { sentiment: 20 },
      joyreid: { sentiment: 5 },
      jimjordan: { sentiment: 80 },
      schumer: { sentiment: 5 },
    },
    triggerWords: {
      positive: ["security", "border", "immigration", "law", "enforcement", "deport", "america first"],
      negative: ["racist", "nazi", "fascist", "concentration camp", "family separation", "anti-semitic"],
    },
  },
  jimjordan: {
    id: "jimjordan",
    name: "Jim Jordan",
    shortName: "Jordan",
    color: "#cc4400",
    faction: "supporter",
    image: require("@/assets/images/persona-jimjordan.png"),
    personality: {
      energy: 95,
      aggression: 90,
      humor: 25,
      catchphrases: ["The American people are SICK of this!", "This is a WITCH HUNT!", "Are you KIDDING me?!", "Let me tell you something!"],
    },
    relationships: {
      trump: { sentiment: 100 },
      netanyahu: { sentiment: 80 },
      ruckus: { sentiment: 65 },
      galloway: { sentiment: 10 },
      mcconnell: { sentiment: 45 },
      carville: { sentiment: 5 },
      maddow: { sentiment: 5 },
      omar: { sentiment: 5 },
      biden: { sentiment: 5 },
      rosie: { sentiment: 10 },
      berniemc: { sentiment: 15 },
      elon: { sentiment: 65 },
      graham: { sentiment: 75 },
      megynkelly: { sentiment: 70 },
      pambondi: { sentiment: 80 },
      candace: { sentiment: 45 },
      joyreid: { sentiment: 5 },
      miller: { sentiment: 85 },
      schumer: { sentiment: 5 },
    },
    triggerWords: {
      positive: ["trump", "freedom", "constitution", "investigation", "hearing", "subpoena"],
      negative: ["witch hunt", "ohio state", "wrestling", "no bills", "kiss ass", "sycophant"],
    },
  },
  stephena: {
    id: "stephena",
    name: "Stephen A. Smith",
    shortName: "Stephen A.",
    color: "#FF8C00",
    faction: "neutral",
    image: require("@/assets/images/persona-stephena.jpg"),
    personality: {
      energy: 98,
      aggression: 80,
      humor: 55,
      catchphrases: ["HOWEVER!", "BLASPHEMY!", "Heheheh. Oh you serious?", "Ain't nobody fidna—", "Go kick rocks!", "I don't give a DAMN!", "Sittin up there actin like—", "On everythin I love—", "PERIOD. POINT BLANK.", "Fidna tell ME?!"],
    },
    relationships: {
      trump: { sentiment: 65 },
      candace: { sentiment: 75 },
      joyreid: { sentiment: 10 },
      maddow: { sentiment: 20 },
      carville: { sentiment: 20 },
      ruckus: { sentiment: 35 },
      hannity: { sentiment: 55 },
      neiltyson: { sentiment: 70 },
      malema: { sentiment: 20 },
      berniemc: { sentiment: 40 },
      elon: { sentiment: 40 },
      biden: { sentiment: 30 },
    },
    triggerWords: {
      positive: ["espn", "first take", "independent", "results", "economy", "accountability", "black excellence"],
      negative: ["sellout", "uncle tom", "house negro", "trump puppet", "republican tool", "coward"],
    },
  },
  malema: {
    id: "malema",
    name: "Julius Malema",
    shortName: "Malema",
    color: "#CC0000",
    faction: "opponent",
    image: require("@/assets/images/persona-malema.jpg"),
    personality: {
      energy: 92,
      aggression: 88,
      humor: 45,
      catchphrases: ["Amandla! Awethu!", "The land must be returned!", "We are not afraid!", "Economic freedom in our lifetime!", "Fighters!"],
    },
    relationships: {
      trump: { sentiment: 5 },
      elon: { sentiment: 5 },
      galloway: { sentiment: 85 },
      omar: { sentiment: 80 },
      berniemc: { sentiment: 65 },
      carville: { sentiment: 35 },
      maddow: { sentiment: 45 },
      stephena: { sentiment: 20 },
      candace: { sentiment: 5 },
      ruckus: { sentiment: 10 },
      neiltyson: { sentiment: 60 },
      netanyahu: { sentiment: 5 },
    },
    triggerWords: {
      positive: ["land", "freedom", "colonialism", "africa", "eff", "liberation", "workers", "masses", "revolution"],
      negative: ["white monopoly", "oligarch", "imperialist", "boer", "settler", "nato", "apartheid"],
    },
  },
  hannity: {
    id: "hannity",
    name: "Sean Hannity",
    shortName: "Hannity",
    color: "#003087",
    faction: "supporter",
    image: require("@/assets/images/persona-hannity.jpg"),
    personality: {
      energy: 88,
      aggression: 85,
      humor: 30,
      catchphrases: ["Let me be clear—", "The RADICAL LEFT—", "Mainstream media HOAX!", "The President is getting it done.", "Sean Hannity, Fox News."],
    },
    relationships: {
      trump: { sentiment: 99 },
      candace: { sentiment: 80 },
      graham: { sentiment: 85 },
      miller: { sentiment: 90 },
      bannon: { sentiment: 75 },
      leavitt: { sentiment: 75 },
      carville: { sentiment: 5 },
      maddow: { sentiment: 3 },
      joyreid: { sentiment: 5 },
      galloway: { sentiment: 10 },
      omar: { sentiment: 5 },
      berniemc: { sentiment: 15 },
      neiltyson: { sentiment: 40 },
      stephena: { sentiment: 55 },
    },
    triggerWords: {
      positive: ["trump", "fox news", "maga", "america", "border", "military", "israel", "conservative"],
      negative: ["hillary", "hunter", "deep state", "radical left", "mainstream media", "democrats", "witch hunt"],
    },
  },
  neiltyson: {
    id: "neiltyson",
    name: "Neil deGrasse Tyson",
    shortName: "Neil T.",
    color: "#00BFFF",
    faction: "neutral",
    image: require("@/assets/images/persona-neiltyson.jpg"),
    personality: {
      energy: 70,
      aggression: 35,
      humor: 75,
      catchphrases: ["Consider this—", "From a scientific perspective—", "Actually—", "The data shows—", "When you consider the scale of the universe—"],
    },
    relationships: {
      trump: { sentiment: 30 },
      elon: { sentiment: 50 },
      maddow: { sentiment: 65 },
      carville: { sentiment: 55 },
      berniemc: { sentiment: 60 },
      omar: { sentiment: 60 },
      galloway: { sentiment: 40 },
      bannon: { sentiment: 15 },
      hannity: { sentiment: 25 },
      stephena: { sentiment: 65 },
      malema: { sentiment: 50 },
      ruckus: { sentiment: 20 },
    },
    triggerWords: {
      positive: ["science", "data", "evidence", "research", "nasa", "climate", "universe", "physics", "facts"],
      negative: ["anti-science", "climate denial", "flat earth", "antivax", "conspiracy", "pseudoscience"],
    },
  },
  jesseleepetersen: {
    id: "jesseleepetersen",
    name: "Jesse Lee Peterson",
    shortName: "Jesse Lee",
    color: "#8B4513",
    faction: "supporter",
    image: require("@/assets/images/persona-jesseleepetersen.jpg"),
    personality: {
      energy: 40,
      aggression: 30,
      humor: 20,
      catchphrases: ["Think about it.", "I'm just asking questions.", "God bless you.", "Did you ask the white man's permission?", "The white man's grace and mercy is divine."],
    },
    relationships: {
      trump: { sentiment: 98 },
      ruckus: { sentiment: 85 },
      candace: { sentiment: 70 },
      maddow: { sentiment: 10 },
      omar: { sentiment: 5 },
      berniemc: { sentiment: 10 },
      carville: { sentiment: 10 },
      malema: { sentiment: 5 },
      stephena: { sentiment: 30 },
      shannon: { sentiment: 25 },
      galloway: { sentiment: 20 },
      hannity: { sentiment: 80 },
    },
    triggerWords: {
      positive: ["trump", "maga", "white", "god", "discipline", "family", "conservative", "permission"],
      negative: ["civil rights", "systemic racism", "blm", "protest", "liberal", "obama", "reparations"],
    },
  },
  shannon: {
    id: "shannon",
    name: "Shannon Sharpe",
    shortName: "Shannon",
    color: "#8B0000",
    faction: "neutral",
    image: require("@/assets/images/persona-shannon.jpg"),
    personality: {
      energy: 92,
      aggression: 70,
      humor: 80,
      catchphrases: ["HUNNIT PERCENT!", "Uncle Shay Shay is here to tell you!", "Put some RESPECK on it!", "I'm here to tell you!", "That's FACTS, baby!"],
    },
    relationships: {
      trump: { sentiment: 15 },
      ruckus: { sentiment: 10 },
      jesseleepetersen: { sentiment: 12 },
      maddow: { sentiment: 65 },
      carville: { sentiment: 55 },
      berniemc: { sentiment: 70 },
      omar: { sentiment: 65 },
      stephena: { sentiment: 75 },
      malema: { sentiment: 60 },
      candace: { sentiment: 20 },
      galloway: { sentiment: 50 },
      neiltyson: { sentiment: 60 },
    },
    triggerWords: {
      positive: ["lebron", "kaepernick", "black excellence", "athlete", "sports", "nfl", "nba", "justice"],
      negative: ["skip bayless", "trump", "maga", "racism", "whitewash", "plantation"],
    },
  },
  ivanka: {
    id: "ivanka",
    name: "Ivanka Trump",
    shortName: "Ivanka",
    color: "#FFB6C1",
    faction: "supporter",
    image: require("@/assets/images/persona-ivanka.jpg"),
    personality: {
      energy: 55,
      aggression: 25,
      humor: 35,
      catchphrases: ["I'm incredibly proud of what my father has accomplished.", "At the end of the day, results matter.", "Women's empowerment is a core value of this administration.", "My father is a champion for working families."],
    },
    relationships: {
      trump: { sentiment: 99 },
      maddow: { sentiment: 20 },
      carville: { sentiment: 15 },
      omar: { sentiment: 10 },
      candace: { sentiment: 70 },
      leavitt: { sentiment: 80 },
      megynkelly: { sentiment: 55 },
      galloway: { sentiment: 10 },
      ruckus: { sentiment: 50 },
      graham: { sentiment: 70 },
      elon: { sentiment: 60 },
    },
    triggerWords: {
      positive: ["family", "empowerment", "women", "workforce", "economy", "father", "business", "trade"],
      negative: ["epstein", "grab them", "complicit", "daddy", "corrupt", "illegitimate", "tax fraud"],
    },
  },
  claudeanderson: {
    id: "claudeanderson",
    name: "Dr. Claude Anderson",
    shortName: "Dr. Anderson",
    color: "#8B4513",
    faction: "wildcard",
    image: require("@/assets/images/persona-claudeanderson.png"),
    personality: {
      energy: 80,
      aggression: 75,
      humor: 30,
      catchphrases: ["Black folks need to hear this", "We own ONE HALF of one percent", "Black labor white wealth", "We need group economics", "The data don't lie"],
    },
    relationships: {
      trump: { sentiment: 5 },
      biden: { sentiment: 15 },
      obama: { sentiment: 20 },
      carville: { sentiment: 15 },
      ruckus: { sentiment: 5 },
      jesseleepetersen: { sentiment: 5 },
      timscott: { sentiment: 5 },
      candace: { sentiment: 5 },
      mcconnell: { sentiment: 5 },
      graham: { sentiment: 5 },
      pambondi: { sentiment: 5 },
      miller: { sentiment: 5 },
      malema: { sentiment: 85 },
      joyreid: { sentiment: 60 },
      maddow: { sentiment: 35 },
      berniemc: { sentiment: 55 },
      omar: { sentiment: 70 },
      jascrockett: { sentiment: 80 },
      aoc: { sentiment: 50 },
    },
    triggerWords: {
      positive: ["black wealth", "economics", "group economics", "reparations", "ownership", "land", "powernomics", "black business"],
      negative: ["gatekeeper", "sellout", "token", "house negro", "bootlicker", "white supremacy", "plantation", "both parties"],
    },
  },
  jascrockett: {
    id: "jascrockett",
    name: "Jasmine Crockett",
    shortName: "Crockett",
    color: "#9B59B6",
    faction: "opponent",
    image: require("@/assets/images/persona-jascrockett.png"),
    personality: {
      energy: 92,
      aggression: 85,
      humor: 65,
      catchphrases: ["Bless your heart", "Let me tell you somethin'", "The receipts are RIGHT HERE", "I said what I said", "Chile please"],
    },
    relationships: {
      trump: { sentiment: 5 },
      ruckus: { sentiment: 5 },
      timscott: { sentiment: 10 },
      candace: { sentiment: 10 },
      jesseleepetersen: { sentiment: 5 },
      joyreid: { sentiment: 90 },
      maddow: { sentiment: 80 },
      omar: { sentiment: 85 },
      berniemc: { sentiment: 70 },
      claudeanderson: { sentiment: 75 },
      aoc: { sentiment: 90 },
      carville: { sentiment: 70 },
    },
    triggerWords: {
      positive: ["black women", "voting rights", "accountability", "congress", "texas", "justice", "equity"],
      negative: ["racist", "voter suppression", "trump", "maga", "sellout", "uncle tom", "gag order"],
    },
  },
  aoc: {
    id: "aoc",
    name: "Alexandria Ocasio-Cortez",
    shortName: "AOC",
    color: "#E74C3C",
    faction: "opponent",
    image: require("@/assets/images/persona-aoc.png"),
    personality: {
      energy: 90,
      aggression: 80,
      humor: 55,
      catchphrases: ["Let me be very clear", "Working class people deserve better", "The science is clear", "We can't afford NOT to do this", "I'm from the Bronx"],
    },
    relationships: {
      trump: { sentiment: 5 },
      ruckus: { sentiment: 5 },
      timscott: { sentiment: 10 },
      candace: { sentiment: 10 },
      miller: { sentiment: 5 },
      joyreid: { sentiment: 85 },
      maddow: { sentiment: 80 },
      omar: { sentiment: 95 },
      berniemc: { sentiment: 70 },
      carville: { sentiment: 65 },
      jascrockett: { sentiment: 90 },
      claudeanderson: { sentiment: 55 },
      elon: { sentiment: 10 },
    },
    triggerWords: {
      positive: ["green new deal", "medicare for all", "working class", "climate", "bronx", "squad", "progressive", "housing"],
      negative: ["billionaire", "oligarch", "fascist", "corporate", "corrupt", "trump", "maga", "exploitation"],
    },
  },
  pressley: {
    id: "pressley",
    name: "Ayanna Pressley",
    shortName: "Pressley",
    color: "#8E44AD",
    faction: "opponent",
    image: require("@/assets/images/persona-pressley.png"),
    personality: {
      energy: 85,
      aggression: 75,
      humor: 45,
      catchphrases: ["The people closest to the pain should be closest to the power", "Liberation is indivisible", "I am not here to make you comfortable", "Those closest to the pain should lead", "We will not be silenced"],
    },
    relationships: {
      trump: { sentiment: 5 },
      ruckus: { sentiment: 5 },
      timscott: { sentiment: 15 },
      candace: { sentiment: 15 },
      miller: { sentiment: 5 },
      joyreid: { sentiment: 85 },
      maddow: { sentiment: 80 },
      omar: { sentiment: 95 },
      aoc: { sentiment: 95 },
      tlaib: { sentiment: 90 },
      jascrockett: { sentiment: 88 },
      claudeanderson: { sentiment: 60 },
      elon: { sentiment: 10 },
      netanyahu: { sentiment: 5 },
    },
    triggerWords: {
      positive: ["black liberation", "palestine", "abolition", "boston", "intersectional", "squad", "community", "survivor", "progressive"],
      negative: ["apartheid", "genocide", "colonialism", "trump", "maga", "aipac", "silence", "sellout"],
    },
  },
  joerogan: {
    id: "joerogan",
    name: "Joe Rogan",
    shortName: "Rogan",
    color: "#2ECC71",
    faction: "wildcard",
    image: require("@/assets/images/persona-joerogan.png"),
    personality: {
      energy: 85,
      aggression: 50,
      humor: 80,
      catchphrases: ["Have you tried DMT?", "It's entirely possible", "That's a great point", "Bro...", "Pull that up Jamie", "That's WILD"],
    },
    relationships: {
      trump: { sentiment: 60 },
      elon: { sentiment: 70 },
      berniemc: { sentiment: 65 },
      carville: { sentiment: 40 },
      maddow: { sentiment: 35 },
      omar: { sentiment: 45 },
      neiltyson: { sentiment: 75 },
      stephena: { sentiment: 70 },
      candace: { sentiment: 55 },
      malema: { sentiment: 40 },
      claudeanderson: { sentiment: 60 },
    },
    triggerWords: {
      positive: ["mma", "ufc", "podcast", "psychedelics", "dmt", "comedy", "fighting", "martial arts", "hunting", "meat"],
      negative: ["censorship", "cancel culture", "mainstream media", "mandates", "woke", "agenda"],
    },
  },
  drbenj: {
    id: "drbenj",
    name: "Dr. Ben Jochannan",
    shortName: "Dr. Ben",
    color: "#C8860A",
    faction: "opponent",
    image: require("@/assets/images/persona-drbenj.jpg"),
    personality: {
      energy: 80,
      aggression: 70,
      humor: 35,
      catchphrases: ["Go look it up!", "This is documented!", "Herodotus himself said it", "Africa is the mother of civilization", "They stole everything from us"],
    },
    relationships: {
      claudeanderson: { sentiment: 90 },
      malema: { sentiment: 85 },
      omar: { sentiment: 75 },
      aoc: { sentiment: 65 },
      tlaib: { sentiment: 65 },
      pressley: { sentiment: 70 },
      galloway: { sentiment: 55 },
      trump: { sentiment: 5 },
      ruckus: { sentiment: 10 },
      timscott: { sentiment: 10 },
      netanyahu: { sentiment: 20 },
      carville: { sentiment: 30 },
      maddow: { sentiment: 35 },
      neiltyson: { sentiment: 80 },
    },
    triggerWords: {
      positive: ["africa", "kemet", "egypt", "civilization", "history", "nubia", "pan-african", "black", "diop", "garvey"],
      negative: ["western civilization", "greek origins", "european", "white history", "bible", "colonialism", "erasure"],
    },
  },
  carlin: {
    id: "carlin",
    name: "George Carlin",
    shortName: "Carlin",
    color: "#4A4A4A",
    faction: "opponent",
    image: require("@/assets/images/persona-carlin.jpg"),
    personality: {
      energy: 85,
      aggression: 75,
      humor: 98,
      catchphrases: ["It's a big club and you ain't in it", "Bullshit!", "The American Dream — you have to be asleep to believe it", "Nobody talks about this shit", "These are the owners of the country"],
    },
    relationships: {
      trump: { sentiment: 5 },
      biden: { sentiment: 8 },
      obama: { sentiment: 10 },
      berniemc: { sentiment: 55 },
      ruckus: { sentiment: 30 },
      galloway: { sentiment: 45 },
      elon: { sentiment: 10 },
      carville: { sentiment: 20 },
      maddow: { sentiment: 25 },
      gilbertgottfried: { sentiment: 70 },
    },
    triggerWords: {
      positive: ["corruption", "bullshit", "corporate", "con", "scam", "hypocrisy", "religion", "club", "owners", "propaganda"],
      negative: ["patriotism", "god bless", "both sides", "career politician", "flag", "national interest", "bipartisan"],
    },
  },
  tuckercarlson: {
    id: "tuckercarlson",
    name: "Tucker Carlson",
    shortName: "Tucker",
    color: "#7A6248",
    faction: "opposition",
    image: require("@/assets/images/persona-tuckercarlson.jpg"),
    personality: {
      energy: 65,
      aggression: 68,
      humor: 52,
      catchphrases: ["Isn't that interesting.", "Of course.", "Think about what you just said.", "Why is that?", "Nobody ever asks this question.", "Wait — hold on."],
    },
    relationships: {
      trump: { sentiment: 18 },
      bannon: { sentiment: 52 },
      elon: { sentiment: 48 },
      galloway: { sentiment: 82 },
      rfk: { sentiment: 78 },
      omar: { sentiment: 62 },
      berniemc: { sentiment: 40 },
      obama: { sentiment: 18 },
      biden: { sentiment: 12 },
      kamala: { sentiment: 10 },
      schumer: { sentiment: 8 },
      maddow: { sentiment: 5 },
      joyreid: { sentiment: 5 },
      carville: { sentiment: 20 },
      netanyahu: { sentiment: 8 },
      graham: { sentiment: 5 },
      mcconnell: { sentiment: 22 },
    },
    triggerWords: {
      positive: ["deep state", "ruling class", "globalist", "censorship", "border", "elite", "neocon", "Ukraine", "war", "surveillance", "corporate media"],
      negative: ["racist", "Putin puppet", "conspiracy theory", "far right", "extremist", "fascist", "white nationalist"],
    },
  },
  timscott: {
    id: "timscott",
    name: "Tim Scott",
    shortName: "Tim Scott",
    color: "#CC0000",
    faction: "supporter",
    image: require("@/assets/images/persona-timscott.png"),
    personality: {
      energy: 70,
      aggression: 45,
      humor: 25,
      catchphrases: ["America is the greatest country", "I am proof the American dream works", "President Trump is doing tremendous things", "God bless America and God bless Donald Trump", "Opportunity zones!"],
    },
    relationships: {
      trump: { sentiment: 100 },
      ruckus: { sentiment: 70 },
      candace: { sentiment: 75 },
      jesseleepetersen: { sentiment: 65 },
      graham: { sentiment: 80 },
      hannity: { sentiment: 80 },
      claudeanderson: { sentiment: 10 },
      jascrockett: { sentiment: 15 },
      aoc: { sentiment: 10 },
      joyreid: { sentiment: 10 },
      maddow: { sentiment: 10 },
      berniemc: { sentiment: 10 },
      carville: { sentiment: 10 },
      malema: { sentiment: 5 },
    },
    triggerWords: {
      positive: ["trump", "america", "opportunity", "faith", "god", "republican", "south carolina", "bootstrap", "conservative"],
      negative: ["sellout", "uncle tom", "house negro", "token", "puppet", "gatekeeper", "systemic racism", "reparations"],
    },
  },
  billclinton: {
    id: "billclinton",
    name: "Bill Clinton",
    shortName: "Bill Clinton",
    color: "#003DA5",
    faction: "opponent",
    image: require("@/assets/images/persona-billclinton.jpg"),
    personality: {
      energy: 80,
      aggression: 45,
      humor: 70,
      catchphrases: ["Now let me tell you something", "I feel your pain", "Here's what I know", "Now look", "I want to be very clear about this"],
    },
    relationships: {
      trump: { sentiment: 10 },
      hillaryclinton: { sentiment: 75 },
      obama: { sentiment: 80 },
      biden: { sentiment: 70 },
      carville: { sentiment: 85 },
      maddow: { sentiment: 65 },
      berniemc: { sentiment: 60 },
      joyreid: { sentiment: 65 },
      graham: { sentiment: 30 },
      mcconnell: { sentiment: 15 },
    },
    triggerWords: {
      positive: ["economy", "surplus", "nafta", "peace", "prosperity", "arkansas", "policy", "charm", "diplomacy"],
      negative: ["monica", "impeachment", "crime bill", "lewinsky", "scandal", "liar", "cheat"],
    },
  },
  hillaryclinton: {
    id: "hillaryclinton",
    name: "Hillary Clinton",
    shortName: "Hillary",
    color: "#1A5276",
    faction: "opponent",
    image: require("@/assets/images/persona-hillaryclinton.jpg"),
    personality: {
      energy: 75,
      aggression: 65,
      humor: 50,
      catchphrases: ["I'm with her", "What difference does it make", "I testified for 11 hours", "I have receipts", "Stronger together"],
    },
    relationships: {
      trump: { sentiment: 5 },
      billclinton: { sentiment: 75 },
      obama: { sentiment: 75 },
      biden: { sentiment: 70 },
      maddow: { sentiment: 75 },
      joyreid: { sentiment: 70 },
      carville: { sentiment: 80 },
      berniemc: { sentiment: 55 },
      graham: { sentiment: 15 },
      mcconnell: { sentiment: 10 },
    },
    triggerWords: {
      positive: ["women", "healthcare", "diplomacy", "secretary", "senator", "children", "policy", "prepared"],
      negative: ["emails", "benghazi", "crooked", "lock her up", "deplorables", "weak", "corrupt", "server"],
    },
  },
  marcorubio: {
    id: "marcorubio",
    name: "Marco Rubio",
    shortName: "Rubio",
    color: "#CC0000",
    faction: "supporter",
    image: require("@/assets/images/persona-marcorubio.jpg"),
    personality: {
      energy: 75,
      aggression: 60,
      humor: 40,
      catchphrases: ["Let's dispel with this fiction", "My parents came here with nothing", "America is still the greatest country", "Cuba under Castro", "Border security first"],
    },
    relationships: {
      trump: { sentiment: 70 },
      desantis: { sentiment: 45 },
      graham: { sentiment: 75 },
      timscott: { sentiment: 70 },
      pambondi: { sentiment: 75 },
      carville: { sentiment: 20 },
      omar: { sentiment: 10 },
      aoc: { sentiment: 15 },
      hillaryclinton: { sentiment: 15 },
      billclinton: { sentiment: 30 },
    },
    triggerWords: {
      positive: ["cuba", "immigration", "florida", "secretary of state", "parents", "american dream", "freedom", "communism"],
      negative: ["little marco", "water bottle", "robot", "scripted", "gang of eight", "amnesty", "sweating", "con artist"],
    },
  },
  desantis: {
    id: "desantis",
    name: "Ron DeSantis",
    shortName: "DeSantis",
    color: "#B22222",
    faction: "supporter",
    image: require("@/assets/images/persona-desantis.jpg"),
    personality: {
      energy: 70,
      aggression: 80,
      humor: 20,
      catchphrases: ["Florida is where woke goes to die", "We will never surrender to the woke mob", "People are voting with their feet", "Don't Say Gay", "Anti-woke"],
    },
    relationships: {
      trump: { sentiment: 40 },
      marcorubio: { sentiment: 50 },
      graham: { sentiment: 60 },
      timscott: { sentiment: 60 },
      aoc: { sentiment: 5 },
      omar: { sentiment: 5 },
      maddow: { sentiment: 5 },
      joyreid: { sentiment: 5 },
      carville: { sentiment: 15 },
      berniemc: { sentiment: 10 },
    },
    triggerWords: {
      positive: ["florida", "anti-woke", "freedom", "parents rights", "border", "conservative", "republican"],
      negative: ["desanctimonious", "disney", "pudding", "weird", "robot", "little marco", "failed", "dropout", "2024"],
    },
  },
  louisfarrakhan: {
    id: "louisfarrakhan",
    name: "Minister Farrakhan",
    shortName: "Farrakhan",
    color: "#006400",
    faction: "wildcard",
    image: require("@/assets/images/persona-louisfarrakhan.png"),
    personality: {
      energy: 75,
      aggression: 70,
      humor: 25,
      catchphrases: ["The Honorable Elijah Muhammad taught us...", "Now watch what I'm about to say", "I said... I SAID...", "They banned the Minister because the Minister told the TRUTH"],
    },
    relationships: {
      trump: { sentiment: 35 },
      obama: { sentiment: 30 },
      mlk: { sentiment: 60 },
      malcolmx: { sentiment: 75 },
      netanyahu: { sentiment: 5 },
      joyreid: { sentiment: 40 },
      maddow: { sentiment: 30 },
    },
    triggerWords: {
      positive: ["nation of islam", "black sovereignty", "self-reliance", "allah", "truth", "justice", "reparations"],
      negative: ["antisemite", "hate speech", "banned", "extremist", "terrorist", "conspiracy"],
    },
  },
  carlsagan: {
    id: "carlsagan",
    name: "Carl Sagan",
    shortName: "Sagan",
    color: "#4169E1",
    faction: "wildcard",
    image: require("@/assets/images/persona-carlsagan.png"),
    personality: {
      energy: 55,
      aggression: 20,
      humor: 60,
      catchphrases: ["Billions and billions", "The cosmos is all that is", "We are made of star stuff", "A candle in the dark", "Pale blue dot"],
    },
    relationships: {
      neiltyson: { sentiment: 90 },
      trump: { sentiment: 15 },
      maddow: { sentiment: 65 },
      carville: { sentiment: 55 },
      alexjones: { sentiment: 5 },
    },
    triggerWords: {
      positive: ["cosmos", "science", "universe", "astronomy", "wonder", "skepticism", "evidence", "truth", "climate"],
      negative: ["pseudoscience", "conspiracy", "supernatural", "creationism", "flat earth", "ignorance"],
    },
  },
  larrycableguy: {
    id: "larrycableguy",
    name: "Larry the Cable Guy",
    shortName: "Larry",
    color: "#8B4513",
    faction: "supporter",
    image: require("@/assets/images/persona-larrycableguy.png"),
    personality: {
      energy: 80,
      aggression: 30,
      humor: 95,
      catchphrases: ["Git-R-Done!", "Lord, I apologize for that one", "I don't care who you are, that's funny right there", "Now THAT'S funny!"],
    },
    relationships: {
      trump: { sentiment: 75 },
      ruckus: { sentiment: 65 },
      berniemc: { sentiment: 70 },
      maddow: { sentiment: 30 },
      aoc: { sentiment: 25 },
      carville: { sentiment: 40 },
    },
    triggerWords: {
      positive: ["git-r-done", "nascar", "hunting", "fishing", "waffle house", "america", "redneck", "country", "blue collar"],
      negative: ["elitist", "liberal", "woke", "socialist", "cancel culture", "tax the rich"],
    },
  },
  jdvance: {
    id: "jdvance",
    name: "JD Vance",
    shortName: "Vance",
    color: "#8B0000",
    faction: "supporter",
    image: require("@/assets/images/persona-jdvance.png"),
    personality: {
      energy: 70,
      aggression: 65,
      humor: 35,
      catchphrases: ["The elites want you to think that", "Hillbilly Elegy taught me", "America First means", "Childless cat ladies", "Let me be clear about China"],
    },
    relationships: {
      trump: { sentiment: 98 },
      graham: { sentiment: 65 },
      leavitt: { sentiment: 80 },
      maddow: { sentiment: 10 },
      joyreid: { sentiment: 10 },
      aoc: { sentiment: 15 },
      berniemc: { sentiment: 30 },
      carville: { sentiment: 15 },
    },
    triggerWords: {
      positive: ["america first", "working class", "ohio", "manufacturing", "china", "border", "hillbilly", "appalachia"],
      negative: ["cancun", "traitor", "flip flopper", "childless", "weird", "tech bro", "silicon valley", "thiel"],
    },
  },
  kaitlyncollins: {
    id: "kaitlyncollins",
    name: "Kaitlan Collins",
    shortName: "Collins",
    color: "#CC0000",
    faction: "wildcard",
    image: require("@/assets/images/persona-kaitlyncollins.png"),
    personality: {
      energy: 80,
      aggression: 65,
      humor: 40,
      catchphrases: ["That's not accurate", "I'm going to ask you again", "The record shows", "Let me follow up on that", "You didn't answer the question"],
    },
    relationships: {
      trump: { sentiment: 30 },
      maddow: { sentiment: 55 },
      joyreid: { sentiment: 50 },
      carville: { sentiment: 60 },
      megynkelly: { sentiment: 55 },
      leavitt: { sentiment: 40 },
    },
    triggerWords: {
      positive: ["accountability", "record", "evidence", "follow up", "press", "journalism", "facts", "truth"],
      negative: ["fake news", "cnn", "biased", "gotcha", "rigged", "unfair", "witch hunt"],
    },
  },
  tedcruz: {
    id: "tedcruz",
    name: "Ted Cruz",
    shortName: "Cruz",
    color: "#990000",
    faction: "supporter",
    image: require("@/assets/images/persona-tedcruz.png"),
    personality: {
      energy: 75,
      aggression: 70,
      humor: 30,
      catchphrases: ["Let me be very clear about something", "The Constitution says", "Now look...", "I'll tell you this...", "Let's dispel with this fiction"],
    },
    relationships: {
      trump: { sentiment: 75 },
      graham: { sentiment: 65 },
      pambondi: { sentiment: 60 },
      marcorubio: { sentiment: 55 },
      maddow: { sentiment: 10 },
      joyreid: { sentiment: 10 },
      carville: { sentiment: 15 },
      aoc: { sentiment: 10 },
      berniemc: { sentiment: 15 },
    },
    triggerWords: {
      positive: ["constitution", "texas", "liberty", "freedom", "conservative", "second amendment", "senate", "princeton", "harvard"],
      negative: ["cancun", "lyin ted", "coward", "beard", "spineless", "flip flop", "wife", "dad", "jfk"],
    },
  },
  georgewbush: {
    id: "georgewbush",
    name: "George W. Bush",
    shortName: "W.",
    color: "#8B0000",
    faction: "wildcard",
    image: require("@/assets/images/persona-georgewbush.png"),
    personality: {
      energy: 65,
      aggression: 35,
      humor: 80,
      catchphrases: ["Fool me once...", "You can't get fooled again", "Heh heh", "Misunderestimated", "Brownie you're doing a heck of a job", "Is our children learning"],
    },
    relationships: {
      trump: { sentiment: 20 },
      obama: { sentiment: 60 },
      cheney: { sentiment: 80 },
      maddow: { sentiment: 35 },
      carville: { sentiment: 30 },
      mcconnell: { sentiment: 45 },
      graham: { sentiment: 50 },
    },
    triggerWords: {
      positive: ["texas", "laura", "dog painting", "military", "mission accomplished", "freedom agenda", "bipartisan"],
      negative: ["iraq", "wmd", "katrina", "wiretapping", "abu ghraib", "recession", "trump", "maga", "shoe"],
    },
  },
  gilbertgottfried: {
    id: "gilbertgottfried",
    name: "Gilbert Gottfried",
    shortName: "Gilbert",
    color: "#FF6600",
    faction: "wildcard",
    image: require("@/assets/images/persona-gilbertgottfried.jpg"),
    personality: {
      energy: 100,
      aggression: 50,
      humor: 100,
      catchphrases: ["AND ANOTHER THING—!", "What IS that?!", "Let me tell you something...", "Oh for fuck's sake—", "I'll tell you what THAT is!"],
    },
    relationships: {
      trump: { sentiment: 50 },
      ruckus: { sentiment: 60 },
      berniemc: { sentiment: 65 },
      maddow: { sentiment: 45 },
      carville: { sentiment: 50 },
    },
    triggerWords: {
      positive: ["comedy", "joke", "aristocrats", "aflac", "aladdin", "roast", "funny", "standup"],
      negative: ["cancel", "offensive", "inappropriate", "fired", "pearl harbor", "9/11"],
    },
  },
  arikana: {
    id: "arikana",
    name: "Dr. Arikana Chihombori",
    shortName: "Dr. Arikana",
    color: "#006400",
    faction: "wildcard",
    image: require("@/assets/images/persona-arikana.png"),
    personality: {
      energy: 80,
      aggression: 70,
      humor: 20,
      catchphrases: ["Africa is the wealthiest continent on Earth", "The CFA Franc is a colonial leash", "This is not an accident — it is a system", "Africa must unite or perish", "Name the names"],
    },
    relationships: {
      louisfarrakhan: { sentiment: 80 },
      malcolmx: { sentiment: 85 },
      mlk: { sentiment: 75 },
      claudeanderson: { sentiment: 80 },
      malema: { sentiment: 85 },
      trump: { sentiment: 15 },
      netanyahu: { sentiment: 20 },
      obama: { sentiment: 50 },
    },
    triggerWords: {
      positive: ["africa", "pan-african", "sovereignty", "reparations", "cfa franc", "unity", "liberation", "resources", "decolonize"],
      negative: ["colonialism", "imf", "world bank", "neo-colonialism", "puppet", "sellout", "foreign aid", "regime change"],
    },
  },
  alishahrazad: {
    id: "alishahrazad",
    name: "Sister Ali Shahrazad",
    shortName: "Sister Ali",
    color: "#4B0082",
    faction: "wildcard",
    image: require("@/assets/images/persona-alishahrazad.png"),
    personality: {
      energy: 70,
      aggression: 60,
      humor: 20,
      catchphrases: ["Let me teach you something", "The miseducation goes deep", "Ancient Kemet", "Black people have a sacred covenant", "You have been thoroughly miseducated"],
    },
    relationships: {
      louisfarrakhan: { sentiment: 90 },
      malcolmx: { sentiment: 90 },
      mlk: { sentiment: 70 },
      arikana: { sentiment: 85 },
      claudeanderson: { sentiment: 80 },
      trump: { sentiment: 10 },
      obama: { sentiment: 45 },
    },
    triggerWords: {
      positive: ["kemet", "africa", "history", "islam", "nation of islam", "black liberation", "self-determination", "knowledge", "consciousness"],
      negative: ["self-hatred", "miseducation", "colonialism", "slavery", "white supremacy", "divide and conquer", "entertainment"],
    },
  },
};

const MYSTERY_PERSONAS: Record<string, ArenaPersona> = {
  schumer: {
    id: "schumer",
    name: "Chuck Schumer",
    shortName: "Schumer",
    color: "#003DA5",
    faction: "opponent",
    image: require("@/assets/images/persona-schumer.png"),
    personality: {
      energy: 65,
      aggression: 60,
      humor: 35,
      catchphrases: ["Let me be clear", "The American people deserve better", "My Republican friends have lost their way", "Make no mistake about it"],
    },
    relationships: {
      trump: { sentiment: 10 },
      netanyahu: { sentiment: 50 },
      ruckus: { sentiment: 10 },
      galloway: { sentiment: 30 },
      mcconnell: { sentiment: 15 },
      carville: { sentiment: 80 },
      maddow: { sentiment: 85 },
      omar: { sentiment: 60 },
      biden: { sentiment: 90 },
      rosie: { sentiment: 65 },
      berniemc: { sentiment: 55 },
      elon: { sentiment: 15 },
      graham: { sentiment: 15 },
      megynkelly: { sentiment: 20 },
      pambondi: { sentiment: 10 },
      candace: { sentiment: 15 },
      joyreid: { sentiment: 80 },
      miller: { sentiment: 5 },
      jimjordan: { sentiment: 10 },
    },
    triggerWords: {
      positive: ["senate", "democrat", "new york", "social security", "medicare", "bipartisan", "democracy"],
      negative: ["trump", "maga", "obstruction", "shutdown", "radical", "extremist"],
    },
  },
  alexjones: {
    id: "alexjones",
    name: "Alex Jones",
    shortName: "Jones",
    color: "#FF4500",
    faction: "supporter",
    image: require("@/assets/images/persona-alexjones.png"),
    personality: {
      energy: 100,
      aggression: 95,
      humor: 70,
      catchphrases: ["THEY'RE TURNING THE FROGS GAY!", "I have the documents RIGHT HERE!", "The globalists are PANICKING!", "1776 WILL COMMENCE AGAIN!"],
    },
    relationships: {
      trump: { sentiment: 95 },
      netanyahu: { sentiment: 40 },
      ruckus: { sentiment: 70 },
      galloway: { sentiment: 30 },
      mcconnell: { sentiment: 25 },
      carville: { sentiment: 5 },
      maddow: { sentiment: 5 },
      omar: { sentiment: 5 },
      biden: { sentiment: 5 },
      rosie: { sentiment: 10 },
      berniemc: { sentiment: 20 },
      elon: { sentiment: 55 },
      graham: { sentiment: 40 },
      megynkelly: { sentiment: 45 },
      pambondi: { sentiment: 50 },
      candace: { sentiment: 60 },
      joyreid: { sentiment: 5 },
      miller: { sentiment: 70 },
      jimjordan: { sentiment: 65 },
      schumer: { sentiment: 5 },
    },
    triggerWords: {
      positive: ["infowars", "conspiracy", "globalists", "truth", "freedom", "liberty", "supplements"],
      negative: ["sandy hook", "lawsuit", "banned", "deplatformed", "crazy", "lunatic"],
    },
  },
  obama: {
    id: "obama",
    name: "Barack Obama",
    shortName: "Obama",
    color: "#1a3a5c",
    faction: "opponent",
    image: require("@/assets/images/persona-obama.png"),
    personality: {
      energy: 60,
      aggression: 35,
      humor: 75,
      catchphrases: ["Let me be clear", "Here's the thing", "That's not who we are", "Yes we can"],
    },
    relationships: {
      trump: { sentiment: 5 },
      netanyahu: { sentiment: 35 },
      ruckus: { sentiment: 15 },
      galloway: { sentiment: 40 },
      mcconnell: { sentiment: 10 },
      carville: { sentiment: 80 },
      maddow: { sentiment: 85 },
      omar: { sentiment: 65 },
      biden: { sentiment: 95 },
      rosie: { sentiment: 70 },
      berniemc: { sentiment: 65 },
      elon: { sentiment: 20 },
      graham: { sentiment: 15 },
      megynkelly: { sentiment: 25 },
      pambondi: { sentiment: 10 },
      candace: { sentiment: 15 },
      joyreid: { sentiment: 80 },
      miller: { sentiment: 5 },
      jimjordan: { sentiment: 10 },
      schumer: { sentiment: 85 },
    },
    triggerWords: {
      positive: ["hope", "change", "unity", "progress", "healthcare", "diplomacy", "michelle"],
      negative: ["trump", "maga", "birther", "muslim", "kenya", "radical"],
    },
  },
  melania: {
    id: "melania",
    name: "Melania Trump",
    shortName: "Melania",
    color: "#C0C0C0",
    faction: "supporter",
    image: require("@/assets/images/persona-melania.png"),
    personality: {
      energy: 25,
      aggression: 20,
      humor: 40,
      catchphrases: ["I really don't care, do u?", "Be best", "That is very interesting...", "I have my own opinion"],
    },
    relationships: {
      trump: { sentiment: 70 },
      netanyahu: { sentiment: 45 },
      ruckus: { sentiment: 30 },
      galloway: { sentiment: 20 },
      mcconnell: { sentiment: 35 },
      carville: { sentiment: 20 },
      maddow: { sentiment: 15 },
      omar: { sentiment: 20 },
      biden: { sentiment: 30 },
      rosie: { sentiment: 10 },
      berniemc: { sentiment: 25 },
      elon: { sentiment: 40 },
      graham: { sentiment: 45 },
      megynkelly: { sentiment: 35 },
      pambondi: { sentiment: 50 },
      candace: { sentiment: 40 },
      joyreid: { sentiment: 15 },
      miller: { sentiment: 30 },
      jimjordan: { sentiment: 35 },
      schumer: { sentiment: 20 },
    },
    triggerWords: {
      positive: ["fashion", "elegance", "first lady", "barron", "slovenia", "be best"],
      negative: ["stormy", "affair", "jacket", "melania", "trophy wife", "gold digger"],
    },
  },
  odonnell: {
    id: "odonnell",
    name: "Lawrence O'Donnell",
    shortName: "Lawrence",
    color: "#2563eb",
    faction: "opponent",
    image: require("@/assets/images/persona-odonnell.png"),
    personality: {
      energy: 85,
      aggression: 90,
      humor: 65,
      catchphrases: ["Donald Trump is the STUPIDEST criminal", "Let me explain this slowly for you", "This is not complicated", "The evidence is overwhelming"],
    },
    relationships: {
      trump: { sentiment: 2 },
      netanyahu: { sentiment: 20 },
      ruckus: { sentiment: 5 },
      galloway: { sentiment: 55 },
      mcconnell: { sentiment: 10 },
      carville: { sentiment: 85 },
      maddow: { sentiment: 95 },
      omar: { sentiment: 80 },
      biden: { sentiment: 70 },
      rosie: { sentiment: 75 },
      berniemc: { sentiment: 60 },
      elon: { sentiment: 5 },
      graham: { sentiment: 5 },
      megynkelly: { sentiment: 10 },
      pambondi: { sentiment: 5 },
      candace: { sentiment: 10 },
      joyreid: { sentiment: 90 },
      miller: { sentiment: 5 },
      jimjordan: { sentiment: 5 },
      kamala: { sentiment: 85 },
      mtg: { sentiment: 25 },
    },
    triggerWords: {
      positive: ["facts", "evidence", "law", "constitution", "democracy", "accountability", "justice"],
      negative: ["trump", "criminal", "incompetent", "stupid", "corrupt", "felon", "epstein"],
    },
  },
  kamala: {
    id: "kamala",
    name: "Kamala Harris",
    shortName: "Kamala",
    color: "#7c3aed",
    faction: "opponent",
    image: require("@/assets/images/persona-kamala.png"),
    personality: {
      energy: 80,
      aggression: 70,
      humor: 50,
      catchphrases: ["Let me be clear", "We are not going back", "The American people deserve better", "I'm speaking"],
    },
    relationships: {
      trump: { sentiment: 5 },
      netanyahu: { sentiment: 30 },
      ruckus: { sentiment: 5 },
      galloway: { sentiment: 45 },
      mcconnell: { sentiment: 15 },
      carville: { sentiment: 80 },
      maddow: { sentiment: 85 },
      omar: { sentiment: 75 },
      biden: { sentiment: 90 },
      rosie: { sentiment: 70 },
      berniemc: { sentiment: 60 },
      elon: { sentiment: 10 },
      graham: { sentiment: 10 },
      megynkelly: { sentiment: 10 },
      pambondi: { sentiment: 10 },
      candace: { sentiment: 10 },
      joyreid: { sentiment: 85 },
      miller: { sentiment: 5 },
      jimjordan: { sentiment: 5 },
      odonnell: { sentiment: 85 },
      mtg: { sentiment: 30 },
    },
    triggerWords: {
      positive: ["justice", "democracy", "rights", "policy", "progress", "prosecutor", "truth"],
      negative: ["trump", "dei", "maga", "racist", "immoral", "criminal", "inhumane"],
    },
  },
  mtg: {
    id: "mtg",
    name: "Marjorie Taylor Greene",
    shortName: "MTG",
    color: "#dc2626",
    faction: "wildcard",
    image: require("@/assets/images/persona-mtg.png"),
    personality: {
      energy: 95,
      aggression: 90,
      humor: 35,
      catchphrases: ["Trump is INSANE!", "I was WRONG about MAGA!", "These Republican COWARDS!", "Absolute evil!"],
    },
    relationships: {
      trump: { sentiment: 5 },
      netanyahu: { sentiment: 20 },
      ruckus: { sentiment: 5 },
      galloway: { sentiment: 30 },
      mcconnell: { sentiment: 10 },
      carville: { sentiment: 35 },
      maddow: { sentiment: 30 },
      omar: { sentiment: 25 },
      biden: { sentiment: 30 },
      rosie: { sentiment: 25 },
      berniemc: { sentiment: 20 },
      elon: { sentiment: 10 },
      graham: { sentiment: 5 },
      megynkelly: { sentiment: 15 },
      pambondi: { sentiment: 5 },
      candace: { sentiment: 15 },
      joyreid: { sentiment: 25 },
      miller: { sentiment: 5 },
      jimjordan: { sentiment: 5 },
      odonnell: { sentiment: 30 },
      kamala: { sentiment: 30 },
    },
    triggerWords: {
      positive: ["truth", "courage", "wrong", "changed", "sorry", "amends"],
      negative: ["trump", "maga", "coward", "b6", "bleached", "traitor", "greene", "marjorie"],
    },
  },
  rfk: {
    id: "rfk",
    name: "Robert F. Kennedy Jr.",
    shortName: "RFK Jr.",
    color: "#7c3aed",
    faction: "wildcard",
    image: require("@/assets/images/persona-rfk.png"),
    personality: {
      energy: 70,
      aggression: 45,
      humor: 25,
      catchphrases: ["The... the data is clear...", "Make America Healthy Again", "Big Pharma is hiding...", "I'm just asking questions"],
    },
    relationships: {
      trump: { sentiment: 70 },
      netanyahu: { sentiment: 40 },
      ruckus: { sentiment: 30 },
      galloway: { sentiment: 20 },
      mcconnell: { sentiment: 35 },
      carville: { sentiment: 15 },
      maddow: { sentiment: 10 },
      omar: { sentiment: 30 },
      biden: { sentiment: 25 },
      rosie: { sentiment: 20 },
      berniemc: { sentiment: 30 },
      elon: { sentiment: 55 },
      graham: { sentiment: 40 },
      megynkelly: { sentiment: 35 },
      pambondi: { sentiment: 50 },
      candace: { sentiment: 40 },
      joyreid: { sentiment: 10 },
      miller: { sentiment: 45 },
      jimjordan: { sentiment: 45 },
      odonnell: { sentiment: 10 },
      kamala: { sentiment: 25 },
      mtg: { sentiment: 60 },
      alexjones: { sentiment: 65 },
      obama: { sentiment: 20 },
      melania: { sentiment: 30 },
      schumer: { sentiment: 20 },
    },
    triggerWords: {
      positive: ["health", "vaccine", "pharma", "kennedy", "truth", "maha", "natural", "chemical", "fluoride", "seed oil"],
      negative: ["worm", "brain worm", "bear", "whale", "conspiracy", "anti-vax", "debunked", "measles", "fringe", "cheryl", "dog"],
    },
  },
  erikakirk: {
    id: "erikakirk",
    name: "Erika Kirk",
    shortName: "Erika",
    color: "#E8A2B8",
    faction: "supporter",
    image: require("@/assets/images/persona-erikakirk.png"),
    personality: {
      energy: 50,
      aggression: 25,
      humor: 20,
      catchphrases: ["Charlie always said...", "*sniffles*", "As a Christian woman...", "I'll be praying for you", "Bless your heart"],
    },
    relationships: {
      trump: { sentiment: 90 },
      melania: { sentiment: 40 },
      netanyahu: { sentiment: 60 },
      ruckus: { sentiment: 25 },
      galloway: { sentiment: 10 },
      mcconnell: { sentiment: 50 },
      carville: { sentiment: 15 },
      maddow: { sentiment: 15 },
      omar: { sentiment: 10 },
      biden: { sentiment: 20 },
      rosie: { sentiment: 10 },
      berniemc: { sentiment: 20 },
      elon: { sentiment: 65 },
      graham: { sentiment: 60 },
      megynkelly: { sentiment: 55 },
      pambondi: { sentiment: 70 },
      candace: { sentiment: 50 },
      joyreid: { sentiment: 10 },
      miller: { sentiment: 65 },
      jimjordan: { sentiment: 60 },
      schumer: { sentiment: 15 },
      odonnell: { sentiment: 10 },
      kamala: { sentiment: 15 },
      mtg: { sentiment: 30 },
      rfk: { sentiment: 50 },
      alexjones: { sentiment: 35 },
      obama: { sentiment: 20 },
      loomer: { sentiment: 30 },
      leavitt: { sentiment: 80 },
    },
    triggerWords: {
      positive: ["charlie", "faith", "christian", "widow", "bible", "legacy", "prayer", "pray", "lord", "jesus", "turning point"],
      negative: ["grift", "fake", "performance", "money", "merch", "hypocrite", "actress", "phony"],
    },
  },
  loomer: {
    id: "loomer",
    name: "Laura Loomer",
    shortName: "Laura",
    color: "#8B0000",
    faction: "supporter",
    image: require("@/assets/images/persona-loomer.png"),
    personality: {
      energy: 95,
      aggression: 95,
      humor: 30,
      catchphrases: ["OH PLEASE", "Listen sweetie...", "I literally cannot", "spare me", "the deep state"],
    },
    relationships: {
      trump: { sentiment: 95 },
      melania: { sentiment: 5 },
      netanyahu: { sentiment: 60 },
      ruckus: { sentiment: 75 },
      galloway: { sentiment: 5 },
      mcconnell: { sentiment: 30 },
      carville: { sentiment: 10 },
      maddow: { sentiment: 5 },
      omar: { sentiment: 5 },
      biden: { sentiment: 5 },
      rosie: { sentiment: 5 },
      berniemc: { sentiment: 10 },
      elon: { sentiment: 70 },
      graham: { sentiment: 40 },
      megynkelly: { sentiment: 30 },
      pambondi: { sentiment: 60 },
      candace: { sentiment: 5 },
      joyreid: { sentiment: 5 },
      miller: { sentiment: 85 },
      jimjordan: { sentiment: 65 },
      schumer: { sentiment: 5 },
      odonnell: { sentiment: 10 },
      kamala: { sentiment: 5 },
      mtg: { sentiment: 30 },
      rfk: { sentiment: 50 },
      alexjones: { sentiment: 75 },
      obama: { sentiment: 5 },
      erikakirk: { sentiment: 35 },
      leavitt: { sentiment: 30 },
    },
    triggerWords: {
      positive: ["maga", "trump", "deep state", "great replacement", "border", "deport", "invasion"],
      negative: ["affair", "homewrecker", "candace", "jewish", "racist", "weird", "embarrassing"],
    },
  },
  leavitt: {
    id: "leavitt",
    name: "Caroline Leavitt",
    shortName: "Caroline",
    color: "#1f3a8a",
    faction: "supporter",
    image: require("@/assets/images/persona-leavitt.png"),
    personality: {
      energy: 85,
      aggression: 80,
      humor: 20,
      catchphrases: ["POTUS has been clear...", "That's a fake-news question", "The President is delivering", "Sit down", "Embarrassing"],
    },
    relationships: {
      trump: { sentiment: 95 },
      melania: { sentiment: 70 },
      netanyahu: { sentiment: 70 },
      ruckus: { sentiment: 30 },
      galloway: { sentiment: 5 },
      mcconnell: { sentiment: 55 },
      carville: { sentiment: 10 },
      maddow: { sentiment: 5 },
      omar: { sentiment: 10 },
      biden: { sentiment: 5 },
      rosie: { sentiment: 10 },
      berniemc: { sentiment: 15 },
      elon: { sentiment: 75 },
      graham: { sentiment: 70 },
      megynkelly: { sentiment: 55 },
      pambondi: { sentiment: 80 },
      candace: { sentiment: 50 },
      joyreid: { sentiment: 5 },
      miller: { sentiment: 80 },
      jimjordan: { sentiment: 75 },
      schumer: { sentiment: 5 },
      odonnell: { sentiment: 5 },
      kamala: { sentiment: 5 },
      mtg: { sentiment: 25 },
      rfk: { sentiment: 60 },
      alexjones: { sentiment: 30 },
      obama: { sentiment: 10 },
      erikakirk: { sentiment: 80 },
      loomer: { sentiment: 30 },
    },
    triggerWords: {
      positive: ["potus", "president", "maga", "trump", "winning", "delivering", "press secretary"],
      negative: ["liar", "spin", "young", "inexperienced", "talking points", "robot"],
    },
  },
  bannon: {
    id: "bannon",
    name: "Steve Bannon",
    shortName: "Bannon",
    color: "#8B0000",
    faction: "supporter",
    image: require("@/assets/images/persona-bannon.png"),
    personality: {
      energy: 95,
      aggression: 95,
      humor: 20,
      catchphrases: ["Globalists!", "The forgotten man!", "Burn it down!", "Sloppy Steve? FINE!", "American workers!"],
    },
    relationships: {
      trump: { sentiment: 80 },
      elon: { sentiment: 2 },
      miller: { sentiment: 90 },
      jimjordan: { sentiment: 85 },
      bannon: { sentiment: 100 },
      melania: { sentiment: 70 },
      loomer: { sentiment: 45 },
      erikakirk: { sentiment: 50 },
      leavitt: { sentiment: 55 },
      galloway: { sentiment: 40 },
      carville: { sentiment: 10 },
      maddow: { sentiment: 5 },
      omar: { sentiment: 5 },
      biden: { sentiment: 5 },
      obama: { sentiment: 5 },
      kamala: { sentiment: 5 },
    },
    triggerWords: {
      positive: ["working class", "america", "maga", "sovereignty", "nationalism", "forgotten man", "populist"],
      negative: ["globalist", "elon", "tech oligarch", "wall street", "jared", "sloppy", "establishment"],
    },
  },
};

const MYSTERY_PERSONA_IDS = ["alexjones", "obama", "melania", "schumer", "odonnell", "kamala", "mtg", "rfk"];
const MYSTERY_UNLOCK_COSTS: Record<string, number> = {
  alexjones: 10,
  obama: 15,
  melania: 12,
  schumer: 10,
  odonnell: 10,
  kamala: 12,
  mtg: 10,
  rfk: 12,
};
const MYSTERY_UNLOCK_KEY = "arena_mystery_unlocked";

const PERSONA_IDS = ["trump", "elon", "errol", "netanyahu", "ruckus", "galloway", "mcconnell", "carville", "maddow", "omar", "biden", "rosie", "berniemc", "carlin", "graham", "megynkelly", "pambondi", "candace", "joyreid", "miller", "jimjordan", "leavitt", "erikakirk", "loomer", "bannon", "stephena", "malema", "hannity", "neiltyson", "jesseleepetersen", "shannon", "ivanka", "claudeanderson", "jascrockett", "aoc", "pressley", "joerogan", "timscott", "drbenj", "billclinton", "hillaryclinton", "marcorubio", "desantis", "tuckercarlson"];
// Cartoon-style image filter — vivid posterized look on web
const CARTOON_FILTER = Platform.OS === "web"
  ? ({ filter: "contrast(1.35) saturate(1.85) brightness(1.03)" } as any)
  : {};

const BREAKING_NEWS_REACTIONS: Record<string, string[]> = {
  trump: [
    "HOLD ON — what the HELL is this now?! Turn that up, turn that up!",
    "WAIT WAIT WAIT — you see this?! BREAKING NEWS, folks! This is HUGE!",
    "OH LOOK AT THIS! They just can't help themselves! UNBELIEVABLE!",
    "STOP EVERYTHING — did you see what just dropped?! This is TREMENDOUS!",
  ],
  carville: [
    "Now what the FUCK they done done now?! HOLD ON — I gotta see this! Trump, this is YOUR mess ain't it?!",
    "WAIT A GODDAMN MINUTE — breaking news y'all! Somebody tell Trump and Netanyahu to sit their asses down, this is THEIR doing!",
    "SON OF A BITCH! You see this?! This has Trump's greasy little fingerprints ALL over it! Netanyahu too!",
    "OH LORD HAVE MERCY — what fresh HELL did Trump and his buddy Bibi cook up NOW?!",
  ],
  netanyahu: [
    "Excuse me — EXCUSE ME — this breaking development is very important. Let me address this.",
    "Hold on, my friends — there is breaking news. I must speak to this directly.",
    "WAIT — this is significant. Israel has always said this would happen. We warned you.",
  ],
  ruckus: [
    "HOLD ON NOW! What in the name of White Jesus is happenin' NOW?!",
    "LAWD HAVE MERCY — BREAKING NEWS?! President Trump better be okay! MAGA!!",
    "WAIT WAIT WAIT — I KNOW this ain't more liberal fake news! Let me see this!",
  ],
  galloway: [
    "STOP THE DEBATE! This is EXACTLY what I've been warning about! LOOK at this!",
    "Well well WELL — breaking news! The chickens are coming home to roost, aren't they?!",
    "HOLD EVERYTHING — this is PRECISELY the imperial rot I've been talking about!",
  ],
  mcconnell: [
    "...I see... *adjusts glasses* ...This is... noteworthy...",
    "If I may... there appears to be... a development... *blinks slowly*",
  ],
  maddow: [
    "OKAY — we need to stop here because we have BREAKING NEWS and I want to walk everyone through this!",
    "Hold on — this is important — breaking news just in and this connects to EVERYTHING we've been discussing!",
  ],
  omar: [
    "WAIT — everyone stop! This breaking news — THIS is what I've been trying to tell you all!",
    "Hold on — breaking news! And I GUARANTEE this traces back to the same corrupt systems we've been talking about!",
  ],
  biden: [
    "Whoa whoa whoa — hold on a second, folks. We got some... some breaking news here. Not a joke!",
    "Look — LOOK — here's the deal. Something just happened. Let me... let me tell you about this.",
  ],
  rosie: [
    "OH MY GOD — STOP! EVERYBODY SHUT UP! Breaking news!! You SEE this?! You SEE what's happening?!",
    "WAIT — HOLD THE PHONE! Oh this is BAD! This is SO bad! I KNEW this was coming!",
  ],
  berniemc: [
    "Whoa whoa WHOA — hold the fuck up! What the HELL is this shit now?! Got-DAMN!",
    "AYO SHUT UP EVERYBODY — breaking news! I TOLD y'all this shit was gonna happen! Sheeeeit!",
    "NAH NAH NAH — time out! What in the muthuhfuckin' WORLD is going on NOW?!",
  ],
  elon: [
    "Interesting... breaking news. This is actually very relevant to what I was about to say about efficiency.",
    "Hold on — let me check X... yeah, this is trending. Breaking news, everyone.",
  ],
  errol: [
    "Well, I'll tell you something now — in my day in South Africa, breaking news meant something. This? heh heh heh.",
    "Ah, breaking news. You see, the thing is, nothing surprises me anymore. Not after what I watched Mandela's lot do to that country.",
    "Hold on, hold on. Let me hear this. I'll tell you, the world has gone quite mad since we handed everything over. heh heh.",
  ],
  graham: [
    "WAIT just a MINUTE! Breaking news! I'll tell you what — this is OUTRAGEOUS!",
    "Let me be CLEAR — this breaking development is a DISGRACE! Mark my words!",
  ],
  megynkelly: [
    "We need to STOP — breaking news coming in. I've done the research on this and let me tell you the FACTS!",
    "Hold on everyone — breaking development. The facts don't care about your feelings on this one!",
  ],
  pambondi: [
    "EXCUSE ME — breaking news! As Attorney General I can tell you this has LEGAL implications!",
    "STOP — this is breaking right now and I need everyone to understand the LEGAL significance!",
  ],
  candace: [
    "WAIT — breaking news! And I BET the mainstream media is going to spin this against conservatives!",
    "Hold ON — you see this?! This is EXACTLY what the establishment doesn't want you to know!",
  ],
  joyreid: [
    "HOLD UP — we got breaking news! And I KNOW this connects to the bigger pattern of what's happening in this country!",
    "WAIT — STOP everything! Breaking news and the CAUCASSITY of this timing is NOT lost on me!",
  ],
  miller: [
    "Breaking news. Let me be clear — the President's response to this will be swift and absolute.",
    "This development... this is precisely why the President's policies are necessary. The American people demand action.",
  ],
  jimjordan: [
    "WHOA WHOA WHOA — HOLD ON! Breaking news everybody! And I GUARANTEE the Democrats are behind this!",
    "Are you KIDDING me?! Breaking news?! The American people are SICK of this! President Trump was RIGHT!",
    "LET ME TELL YOU SOMETHING — this breaking news proves EVERYTHING President Trump has been saying!",
  ],
  schumer: [
    "HOLD ON — I need everyone to stop and pay attention to this. This is EXACTLY why we need to protect our democratic institutions!",
    "Let me be clear — this breaking news is a direct consequence of Republican obstruction and the MAGA agenda. The American people deserve answers!",
  ],
  alexjones: [
    "OH MY GOD! BREAKING NEWS! I TOLD YOU! I TOLD YOU THIS WAS COMING! The globalists are making their MOVE! INFOWARS DOT COM!",
    "STOP EVERYTHING! I have the DOCUMENTS right here! This breaking news PROVES the New World Order agenda! They thought they could HIDE this from us!",
  ],
  obama: [
    "Look... let me just pause here because this is important. This breaking news — this is exactly the kind of moment that tests who we are as a nation.",
    "Here's the thing about this breaking news — it's a reminder that our democracy requires vigilance. And it requires all of us to pay attention.",
  ],
  melania: [
    "...That is... very interesting. I think this breaking news speaks for itself.",
    "I see. Well... I really don't care about the drama, but this news is... significant.",
  ],
  odonnell: [
    "STOP — breaking news! And I guarantee this traces right back to Trump's incompetence! Let me walk you through this!",
    "HOLD ON — this is breaking and this is EXACTLY what I've been warning about on my show for MONTHS!",
  ],
  kamala: [
    "Excuse me — we need to pause here. This breaking news — we are NOT going back. Let me be clear about what this means.",
    "Hold on everyone — breaking development. And the American people deserve the TRUTH about what is happening right now!",
  ],
  mtg: [
    "WAIT — breaking news! And I KNOW what the MAGA crowd is going to say but they're WRONG! Trump is INSANE!",
    "HOLD ON — you see this?! This is EXACTLY the kind of evil I'm talking about! These Republican COWARDS won't say it but I WILL!",
  ],
  rfk: [
    "Hold on, hold on... uh... breaking news? Look, this... this is... this is exactly what I've been... what I've been saying about... about Big Pharma, the... the data is clear...",
    "Wait... *ahem* ...wait, did you... did you all hear that? This is... this is the kind of thing the... the mainstream media buries, folks, the... the truth is finally coming out...",
  ],
  erikakirk: [
    "Oh my— *sniffles* — wait, breaking news? Charlie always said... *dabs eyes* ...he always said moments like this matter. Lord, give me strength.",
    "I— I'm sorry, I just— *sob* — Charlie would have had so much to say about this. We need to pray, we really do.",
  ],
  loomer: [
    "OH PLEASE — breaking news? Listen sweetie, I've been telling Donald about this for WEEKS. The deep state is finally being EXPOSED.",
    "Hold ON — finally a real story. Not that you'll see honest coverage of it from these embarrassing failures in the media.",
  ],
  leavitt: [
    "Excuse me — breaking news. Let me be very clear: POTUS has been on top of this since DAY ONE and the fake news is just catching up.",
    "Hold on — this is a story the President has already addressed multiple times. The media's selective amnesia is, frankly, embarrassing.",
  ],
};

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

const PERSONA_ALIASES: Record<string, string[]> = {
  trump: ["trump", "donald", "mr president", "the president"],
  elon: ["elon", "musk"],
  netanyahu: ["netanyahu", "bibi", "benjamin"],
  ruckus: ["ruckus", "uncle ruckus"],
  galloway: ["galloway", "george galloway"],
  mcconnell: ["mcconnell", "mitch"],
  carville: ["carville", "james carville", "cajun"],
  maddow: ["maddow", "rachel"],
  omar: ["omar", "ilhan"],
  biden: ["biden", "joe"],
  rosie: ["rosie", "o'donnell"],
  berniemc: ["bernie", "bernie mac"],
  graham: ["graham", "lindsey", "lindsey graham", "lady lindsey"],
  megynkelly: ["megyn", "megyn kelly", "kelly"],
  pambondi: ["bondi", "pam bondi", "pam"],
  candace: ["candace", "candace owens", "owens"],
  joyreid: ["joy", "joy reid", "reid"],
  miller: ["miller", "stephen miller", "stephen"],
  jimjordan: ["jordan", "jim jordan", "jim"],
  schumer: ["schumer", "chuck schumer", "chuck"],
  alexjones: ["alex jones", "jones", "alex", "infowars"],
  obama: ["obama", "barack", "barack obama"],
  melania: ["melania", "melania trump"],
  odonnell: ["lawrence", "o'donnell", "lawrence o'donnell", "last word"],
  kamala: ["kamala", "harris", "kamala harris", "vice president"],
  mtg: ["mtg", "marjorie", "marjorie taylor greene", "greene", "traitor-greene"],
  rfk: ["rfk", "rfk jr", "robert kennedy", "robert f kennedy", "bobby", "bobby kennedy", "kennedy"],
  erikakirk: ["erika", "erika kirk", "kirk", "charlie's wife", "charlie kirk's widow"],
  loomer: ["laura", "loomer", "laura loomer"],
  leavitt: ["caroline", "leavitt", "caroline leavitt", "press secretary"],
};

// ── ARENA FIREBACK HEAT SYSTEM ────────────────────────────────────────────────
// Insult detection, aggression profiles, and squabble threats — ported from
// debate-stage.tsx so multi-person Arena personas can snap at each other.

const ARENA_INSULT_PAT = {
  direct: /(go fuck (your|him|her|them)self|fuck you|kiss my (ass|butt)|up yours|drop dead|you'?re (an )?(idiot|a fool|a clown|a fraud|worthless|pathetic|a liar|full of shit|out of (your )?mind)|you make me sick|you disgust me|screw you|get lost|get the hell out)/i,
  profanity: /\b(fuck(ing)?|shit|ass(hole)?|bastard|son of a bitch|bitch(?!es (?:brew|cakes))|cunt|goddamn)\b/i,
  attack: /\b(idiot|moron|stupid|dumb(ass)?|loser|pathetic|incompetent|fraud|liar|coward|scum(bag)?|disgrace|clown|corrupt|criminal|shut up|you never|you always lie|you failed|washed up|irrelevant|nobody believes|laughingstock)\b/i,
  taunt: /\b(you can't win|you'll lose|everyone knows|no one (likes|trusts|believes) you|you're finished|you're done|sit down|get out|go home|you're a joke|what a joke)\b/i,
};
function detectArenaInsult(text: string): number {
  const l = text.toLowerCase();
  let s = 0;
  if (ARENA_INSULT_PAT.direct.test(l))    s += 3;
  if (ARENA_INSULT_PAT.profanity.test(l)) s += 2;
  if (ARENA_INSULT_PAT.attack.test(l))    s += 1;
  if (ARENA_INSULT_PAT.taunt.test(l))     s += 1;
  return Math.min(s, 3);
}

// aggression: 0–1 probability of firing a fireback when insulted
// angerThresh: insult-severity points needed before triggering
// maxChain: consecutive exchanges before squabble cooldown
const ARENA_PERSONA_AGGRESSION: Record<string, { aggression: number; angerThresh: number; maxChain: number }> = {
  carville:        { aggression: 0.97, angerThresh: 1, maxChain: 4 },
  trump:           { aggression: 0.95, angerThresh: 1, maxChain: 5 },
  malema:          { aggression: 0.93, angerThresh: 1, maxChain: 3 },
  claudeanderson:  { aggression: 0.90, angerThresh: 1, maxChain: 3 },
  biden:           { aggression: 0.82, angerThresh: 2, maxChain: 3 },
  joyreid:         { aggression: 0.83, angerThresh: 2, maxChain: 2 },
  netanyahu:       { aggression: 0.78, angerThresh: 2, maxChain: 2 },
  omar:            { aggression: 0.76, angerThresh: 2, maxChain: 2 },
  ruckus:          { aggression: 0.74, angerThresh: 2, maxChain: 2 },
  candace:         { aggression: 0.72, angerThresh: 2, maxChain: 2 },
  rfk:             { aggression: 0.65, angerThresh: 3, maxChain: 2 },
  galloway:        { aggression: 0.70, angerThresh: 2, maxChain: 2 },
  tuckercarlson:   { aggression: 0.60, angerThresh: 3, maxChain: 2 },
  maddow:          { aggression: 0.55, angerThresh: 4, maxChain: 1 },
  kamala:          { aggression: 0.55, angerThresh: 4, maxChain: 1 },
  timscott:        { aggression: 0.40, angerThresh: 5, maxChain: 1 },
  bannon:          { aggression: 0.88, angerThresh: 1, maxChain: 3 },
  alexjones:       { aggression: 0.90, angerThresh: 1, maxChain: 3 },
  jimjordan:       { aggression: 0.85, angerThresh: 1, maxChain: 3 },
  pambondi:        { aggression: 0.78, angerThresh: 2, maxChain: 2 },
  megynkelly:      { aggression: 0.75, angerThresh: 2, maxChain: 2 },
  rosie:           { aggression: 0.82, angerThresh: 1, maxChain: 3 },
  berniemc:        { aggression: 0.85, angerThresh: 1, maxChain: 3 },
  jascrockett:     { aggression: 0.80, angerThresh: 2, maxChain: 2 },
  aoc:             { aggression: 0.75, angerThresh: 2, maxChain: 2 },
  loomer:          { aggression: 0.88, angerThresh: 1, maxChain: 3 },
  stephena:        { aggression: 0.80, angerThresh: 2, maxChain: 2 },
  hannity:         { aggression: 0.80, angerThresh: 2, maxChain: 2 },
  carlin:          { aggression: 0.72, angerThresh: 2, maxChain: 2 },
  _default:        { aggression: 0.50, angerThresh: 4, maxChain: 2 },
};
function getArenaAggression(id: string) {
  return ARENA_PERSONA_AGGRESSION[id] ?? ARENA_PERSONA_AGGRESSION["_default"];
}

// Physical-threat escalation lines fired when a persona's chain hits maxChain
const ARENA_SQUABBLE_THREATS: Record<string, string[]> = {
  carville:        ["You keep talking like that and I will drag you out of this chair, you son of a bitch!", "Say that one more time and we will finish this in the parking lot, I promise you that!"],
  trump:           ["I've dealt with tougher guys than you in Atlantic City — you want to go? Let's go!", "Keep it up and I'll have security remove you. Personally. With my hands."],
  malema:          ["You think this is a game?! I will flip this table and we sort this out right here!", "Step to me like that again and you will regret every word that came out of your mouth."],
  claudeanderson:  ["I don't argue — I educate. But if you come at me like that again, I will handle you differently.", "You come at me sideways one more time and this debate becomes a very different kind of conversation."],
  biden:           ["Listen, pal — I've been in this game fifty years. You push me again and I'll show you what old-fashioned means.", "Come at me like that one more time and I'll remind you how we handled things in Scranton."],
  joyreid:         ["You need to back WAY up before I lose my composure on national television.", "One more word like that and I will come across this table — and I mean that."],
  netanyahu:       ["You threaten me?! I have faced worse than you on three continents. Do not test me.", "Push me one more time and this debate turns into something your security detail will regret."],
  omar:            ["You keep this up and I will walk over there and handle this myself — try me.", "I survived things you can't imagine. Your words don't scare me — but mine should scare you."],
  alexjones:       ["YOU WANT TO FIGHT?! BRING IT! I AM PHYSICALLY SUPERIOR AND CHEMICALLY ENHANCED!", "I will gorilla-press you over my head and THROW you out of this building!"],
  ruckus:          ["Lord have mercy — you push me one more time and I will beat the sense into you myself!", "I may be old but I will still snatch you out that chair if you don't shut your mouth!"],
  rosie:           ["Oh you really want to DO this?! Come on! I have been waiting for this ALL NIGHT!", "You push me one more time and I will absolutely lose it in front of everyone — and I am NOT joking!"],
  berniemc:        ["You really want to do this? Because I have been waiting ALL night for an excuse.", "Say that again and I will physically remove you from this stage — I'm not joking."],
  bannon:          ["You come at me like that again and the forgotten man of this country will not forget what you just said!", "One more crack like that and I will make sure everyone knows exactly who you are — and it ain't pretty."],
  loomer:          ["Oh PLEASE — you think you can talk to ME like that?! Try it one more time, sweetie, just TRY it!", "Keep going and I will personally make sure the whole world knows what a fraud you are."],
  jascrockett:     ["I said what I said — now you got something to say to my FACE? Because I am RIGHT HERE.", "One more time — go ahead, one more time — and see what happens when a Texas woman has had enough."],
  _default:        ["You come at me like that again and we'll settle this outside!", "Push me one more time and this debate becomes a very different conversation."],
};
// ─────────────────────────────────────────────────────────────────────────────

function detectTrumpAttack(text: string, speakerId: string): boolean {
  if (speakerId === "trump" || speakerId === "ruckus" || speakerId === "netanyahu" || speakerId === "graham" || speakerId === "megynkelly" || speakerId === "pambondi" || speakerId === "miller" || speakerId === "jimjordan") return false;
  const lower = text.toLowerCase();
  const trumpMentions = /(?:trump|donald|mr\.?\s*president)/i.test(lower);
  if (!trumpMentions) return false;
  const hostilePatterns = /(?:epstein war|your fault|you started|you caused|your war|felon|convicted|criminal|diaper|stench|dementia|corrupt(?:ion)?|liar|lying|racist|fascist|dictator|brain.?dead|anti-?christ|cover.?up|war criminal|impeach|lock(?:ed)?\s*(?:him|you)\s*up|prison|jail|indicted|guilty|stupid policy|terrible policy|failed policy|bad policy|your policy|wrong about|bad judgment|terrible judgment|poor judgment|incompetent|you don.t know|you have no idea|you.re an idiot|you.re stupid|stupid person|stupid decision|idiotic|you caused this|your bad deal|bad deal|terrible deal|wrong decision|terrible decision|you.re wrong|you were wrong|you made a mistake|doesn.t know what)/i;
  return hostilePatterns.test(lower);
}

function detectTargetPersona(text: string, activePersonas: string[]): string | null {
  const lower = text.toLowerCase();
  for (const pid of activePersonas) {
    const aliases = PERSONA_ALIASES[pid];
    if (!aliases) continue;
    for (const alias of aliases) {
      const pattern = new RegExp(`(?:^|[\\s,@])${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:[\\s,!?.]|$)`, "i");
      if (pattern.test(lower) || lower.startsWith(alias)) {
        return pid;
      }
    }
  }
  return null;
}

interface DynamicTopic {
  id: string;
  title: string;
  description: string;
  headlines?: string[];
}

const FALLBACK_TOPICS: DynamicTopic[] = [
  { id: "epstein_war", title: "The Epstein War on Iran", description: "Trump launched military strikes on Iran just as the Epstein files were set to be unsealed. Critics call it 'The Epstein War' — a war of maximum distraction." },
  { id: "palestine_genocide", title: "Gaza Genocide & Zionist Lobby", description: "The siege of Gaza continues with hospitals bombed, refugee camps destroyed, and civilians starved. The Zionist lobby's stranglehold on American and EU foreign policy." },
  { id: "economy", title: "Trump's Trade War Fallout", description: "Tariffs are crushing American consumers while Trump claims the economy has never been better. Inflation rising, supply chains breaking." },
  { id: "immigration", title: "Mass Deportation Campaign", description: "Trump's ICE raids are tearing families apart across America. Children separated from parents, communities living in fear." },
  { id: "doge_destruction", title: "DOGE Dismantles Government", description: "Elon Musk's DOGE has gutted veterans' services, scientific research, consumer protections, and refugee programs." },
  { id: "epstein_files", title: "Epstein Files Cover-Up", description: "The Epstein client list remains partially sealed. Trump was a known associate. Every distraction is designed to keep these files buried." },
  { id: "jan6_aftermath", title: "January 6th Pardons & Accountability", description: "Trump pardoned January 6th defendants, calling them 'patriots.' Critics call it an endorsement of political violence." },
  { id: "ai_regulation", title: "AI Takeover & Big Tech Power", description: "AI is replacing jobs, generating deepfakes, and concentrating power. Elon's xAI, OpenAI, and Google are in an arms race with zero regulation." },
  { id: "supreme_court", title: "Supreme Court & Judicial Power", description: "The conservative Supreme Court supermajority is reshaping American law on abortion, guns, voting rights, and executive power." },
  { id: "healthcare_crisis", title: "Healthcare System Collapse", description: "Americans are dying because they can't afford insulin or cancer treatment. Big Pharma profits hit record highs while rural hospitals close." },
  { id: "ukraine_russia", title: "Ukraine War & NATO Alliance", description: "Russia's invasion of Ukraine grinds on as Trump pushes for a deal critics call surrender. NATO allies question American commitment." },
  { id: "china_tensions", title: "US-China Cold War", description: "Trade war escalation, Taiwan tensions, TikTok bans. Is the US heading toward military confrontation with China?" },
  { id: "climate_disaster", title: "Climate Crisis & Fossil Fuel Profits", description: "Record wildfires, hurricanes, and heat waves. Oil companies post record profits. Trump pulled out of the Paris Agreement again." },
  { id: "police_reform", title: "Police Brutality & Criminal Justice", description: "Black Americans continue to die in police encounters. Reform efforts stalled. Trump champions 'law and order.'" },
  { id: "election_integrity", title: "Election Fraud Claims & Voter Suppression", description: "Trump still claims 2020 was stolen despite zero evidence. Republican states pass restrictive voting laws." },
  { id: "billionaire_class", title: "Billionaire Oligarchy", description: "Elon, Bezos, and Zuckerberg now have direct access to the presidency. Billionaires pay lower tax rates than their employees." },
  { id: "media_propaganda", title: "Media Wars & Disinformation", description: "Fox News, MSNBC, X, and TikTok shape reality for millions. Deepfakes and AI-generated propaganda flood social media." },
];

const AFFILIATE_LINKS = [
  { title: "Trump 2024 Hat", url: "https://www.amazon.com/s?k=trump+2024+hat&tag=trumpbot-20", icon: "hat" },
  { title: "MAGA Merch", url: "https://www.amazon.com/s?k=maga+merchandise&tag=trumpbot-20", icon: "shirt" },
  { title: "Political Books", url: "https://www.amazon.com/s?k=political+books+bestseller&tag=trumpbot-20", icon: "book" },
  { title: "Trump Bobblehead", url: "https://www.amazon.com/s?k=trump+bobblehead&tag=trumpbot-20", icon: "gift" },
];

const FACTION_COLORS: Record<"self" | "supporter" | "opponent" | "wildcard", string> = {
  self: "#FFD700",
  supporter: "#22c55e",
  opponent: "#3b82f6",
  wildcard: "#a855f7",
};

function getInitials(name: string) {
  return name.split(" ").map(w => w[0]).join("").substring(0, 2);
}

const INTERRUPTERS = ["biden", "rosie", "galloway", "berniemc", "omar", "elon", "errol", "candace", "megynkelly", "pambondi", "joyreid"];

const HEATED_PAIRS: Array<[string, string]> = [
  ["trump", "carville"],
  ["trump", "rosie"],
  ["trump", "biden"],
  ["trump", "omar"],
  ["trump", "joyreid"],
  ["trump", "maddow"],
  ["trump", "galloway"],
  ["trump", "berniemc"],
  ["trump", "malema"],
  ["trump", "alexjones"],
  ["trump", "ruckus"],
  ["trump", "obama"],
  ["carville", "ruckus"],
  ["carville", "alexjones"],
  ["carville", "megynkelly"],
  ["rosie", "ruckus"],
  ["joyreid", "megynkelly"],
  ["joyreid", "candace"],
  ["maddow", "alexjones"],
  ["omar", "megynkelly"],
  ["malema", "elon"],
  ["obama", "alexjones"],
  ["berniemc", "candace"],
];

const US_STATES = [
  "Alabama","Alaska","Arizona","Arkansas","California","Colorado","Connecticut","Delaware","Florida","Georgia",
  "Hawaii","Idaho","Illinois","Indiana","Iowa","Kansas","Kentucky","Louisiana","Maine","Maryland",
  "Massachusetts","Michigan","Minnesota","Mississippi","Missouri","Montana","Nebraska","Nevada","New Hampshire","New Jersey",
  "New Mexico","New York","North Carolina","North Dakota","Ohio","Oklahoma","Oregon","Pennsylvania","Rhode Island","South Carolina",
  "South Dakota","Tennessee","Texas","Utah","Vermont","Virginia","Washington","West Virginia","Wisconsin","Wyoming",
  "District of Columbia","Puerto Rico","Guam","Virgin Islands",
];

const COUNTRIES = [
  "United States","United Kingdom","Canada","Australia","Germany","France","Japan","South Korea","Brazil","Mexico",
  "India","China","Russia","Italy","Spain","Netherlands","Sweden","Norway","Denmark","Finland",
  "Ireland","Scotland","Wales","Nigeria","South Africa","Kenya","Ghana","Egypt","Israel","Palestine",
  "Saudi Arabia","UAE","Turkey","Pakistan","Philippines","Indonesia","Thailand","Vietnam","Colombia","Argentina",
  "Chile","Peru","Poland","Ukraine","Czech Republic","Portugal","Belgium","Austria","Switzerland","New Zealand",
];

function getPersona(id: string): ArenaPersona | undefined {
  return ARENA_PERSONAS[id] || MYSTERY_PERSONAS[id] || undefined;
}

interface ViralMoment {
  index: number;
  message: ConversationMessage;
  persona: ArenaPersona;
  score: number;
}

function pickViralMoments(messages: ConversationMessage[], maxCount = 3): ViralMoment[] {
  const FIRE_WORDS = [
    "never","always","destroy","disgrace","liar","fraud","fake","truth","america","fight","win","lose",
    "pathetic","embarrass","criminal","genius","tremendous","disaster","corrupt","revolution","history",
    "unprecedented","outrageous","shameful","brilliant","incredible","unbelievable","betrayed","exposed",
  ];
  const candidates = messages
    .map((m, index) => ({ m, index }))
    .filter(({ m }) => !m.isSystem && m.speakerId !== "user" && m.text && m.text.length > 60);

  const scored = candidates.map(({ m, index }) => {
    const txt = m.text;
    const lower = txt.toLowerCase();
    let score = 0;
    score += Math.min(txt.length / 20, 10);
    score += (txt.match(/!/g) || []).length * 3;
    score += (txt.match(/\?/g) || []).length * 2;
    const capsWords = txt.match(/\b[A-Z]{3,}\b/g) || [];
    score += capsWords.length * 4;
    FIRE_WORDS.forEach((w) => { if (lower.includes(w)) score += 5; });
    const p = getPersona(m.speakerId);
    if (p) {
      score += p.personality.aggression * 0.08;
      score += p.personality.humor * 0.04;
    }
    return { index, message: m, score };
  });

  scored.sort((a, b) => b.score - a.score);

  const chosen: ViralMoment[] = [];
  const usedSpeakers = new Set<string>();
  for (const s of scored) {
    if (chosen.length >= maxCount) break;
    const p = getPersona(s.message.speakerId);
    if (!p) continue;
    if (usedSpeakers.has(s.message.speakerId)) continue;
    usedSpeakers.add(s.message.speakerId);
    chosen.push({ ...s, persona: p });
  }

  if (chosen.length < maxCount) {
    for (const s of scored) {
      if (chosen.length >= maxCount) break;
      if (chosen.find((c) => c.index === s.index)) continue;
      const p = getPersona(s.message.speakerId);
      if (!p) continue;
      chosen.push({ ...s, persona: p });
    }
  }

  return chosen.sort((a, b) => a.index - b.index);
}

function calculateResponseProbability(
  listenerId: string,
  speakerId: string,
  text: string
): number {
  const listener = getPersona(listenerId);
  if (!listener) return 30;
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

function TypewriterText({ text, style, voiceEnabled, isLatest }: { text: string; style: any; voiceEnabled: boolean; isLatest: boolean }) {
  const [visibleWords, setVisibleWords] = useState(voiceEnabled && isLatest ? 0 : text.split(/\s+/).length);
  const words = text.split(/\s+/);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!voiceEnabled || !isLatest) {
      setVisibleWords(words.length);
      return;
    }
    setVisibleWords(0);
    let count = 0;
    const wordCount = words.length;
    const avgWordLen = text.length / Math.max(wordCount, 1);
    let msPerWord = 380;
    if (avgWordLen > 7) msPerWord = 420;
    if (avgWordLen > 10) msPerWord = 460;
    if (wordCount < 8) msPerWord = 440;
    intervalRef.current = setInterval(() => {
      count++;
      setVisibleWords(count);
      if (count >= wordCount) {
        if (intervalRef.current) clearInterval(intervalRef.current);
      }
    }, msPerWord);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [text, voiceEnabled, isLatest]);

  const displayText = visibleWords >= words.length ? text : words.slice(0, visibleWords).join(" ");

  return <Text style={style}>{displayText}{visibleWords < words.length ? "..." : ""}</Text>;
}

function ArenaIntro({ personas, onComplete }: { personas: string[]; onComplete: () => void }) {
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const [phase, setPhase] = useState(0);
  const [countdown, setCountdown] = useState(5);
  const [visiblePersonas, setVisiblePersonas] = useState<string[]>([]);
  const [showEngage, setShowEngage] = useState(false);
  const [pulseRing, setPulseRing] = useState(false);
  const countdownSoundRef = useRef<any>(null);
  const engageSoundRef = useRef<any>(null);
  const onCompleteRef = useRef(onComplete);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

  const titleSoundRef = useRef<any>(null);

  useEffect(() => {
    const t1 = setTimeout(() => {
      setPhase(1);
      playTTS("/api/nav-speak", { text: "The Arena." })
        .then((sound) => { titleSoundRef.current = sound; }).catch(() => {});
    }, 400);
    const t2 = setTimeout(() => setPhase(2), 1600);

    let idx = 0;
    const personaInterval = setInterval(() => {
      if (idx < personas.length) {
        setVisiblePersonas((prev) => prev.includes(personas[idx]) ? prev : [...prev, personas[idx]]);
        if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        idx++;
      } else {
        clearInterval(personaInterval);
      }
    }, 120);

    const countdownStart = 2200 + personas.length * 120;
    const t3 = setTimeout(() => {
      setPhase(3);
      playTTS("/api/nav-speak", { text: "Five. Four. Three. Two. One." })
        .then((sound) => { countdownSoundRef.current = sound; }).catch(() => {});
    }, countdownStart);

    return () => {
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearInterval(personaInterval);
      if (countdownSoundRef.current) { try { countdownSoundRef.current.unloadAsync(); } catch {} }
      if (engageSoundRef.current) { try { engageSoundRef.current.unloadAsync(); } catch {} }
      if (titleSoundRef.current) { try { titleSoundRef.current.unloadAsync(); } catch {} }
    };
  }, [personas]);

  useEffect(() => {
    if (phase !== 3) return;
    if (countdown <= 0) {
      setShowEngage(true);
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      playTTS("/api/nav-speak", {
        text: "Engage!",
      }).then((sound) => { engageSoundRef.current = sound; }).catch(() => {});
      const engageTimer = setTimeout(() => {
        onCompleteRef.current();
      }, 1800);
      return () => clearTimeout(engageTimer);
    }
    setPulseRing(true);
    const pulseOff = setTimeout(() => setPulseRing(false), 400);
    const t = setTimeout(() => {
      if (Platform.OS !== "web") {
        if (countdown <= 2) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        } else {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        }
      }
      setCountdown((c) => c - 1);
    }, 1000);
    return () => { clearTimeout(t); clearTimeout(pulseOff); };
  }, [phase, countdown]);

  const countdownColor = countdown <= 2 ? "#EF4444" : countdown <= 3 ? "#FBBF24" : "#D4AF37";
  const progress = (5 - countdown) / 5;

  return (
    <Pressable
      onPress={() => {
        try { countdownSoundRef.current?.unloadAsync?.(); } catch {}
        try { engageSoundRef.current?.unloadAsync?.(); } catch {}
        try { titleSoundRef.current?.unloadAsync?.(); } catch {}
        onCompleteRef.current();
      }}
      style={introStyles.container}
    >
      <LinearGradient colors={["#0a0a0a", "#111", "#0a0a0a"]} style={StyleSheet.absoluteFill} />
      <View style={{ position: "absolute", top: insets.top + webTopInset + 12, right: 16, zIndex: 10, backgroundColor: "rgba(255,255,255,0.08)", borderColor: "rgba(255,255,255,0.2)", borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 }}>
        <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: "800", letterSpacing: 1 }}>TAP TO SKIP</Text>
      </View>
      <View style={[introStyles.content, { paddingTop: insets.top + webTopInset + 20 }]}>
        {phase >= 0 && (
          <Animated.View entering={FadeIn.duration(600)} style={introStyles.liveRow}>
            <View style={introStyles.liveDot} />
            <Text style={introStyles.liveText}>LIVE</Text>
          </Animated.View>
        )}
        {phase >= 1 && (
          <Animated.View entering={ZoomIn.duration(500).springify()}>
            <Text style={introStyles.title}>THE</Text>
            <Text style={introStyles.titleBig}>POLITICAL</Text>
            <Text style={introStyles.titleBig}>ARENA</Text>
          </Animated.View>
        )}
        {phase >= 2 && (
          <Animated.View entering={FadeInUp.duration(400)} style={introStyles.taglineRow}>
            <View style={introStyles.taglineLine} />
            <Text style={introStyles.tagline}>13 PERSONAS. NO FILTER. LIVE DEBATE.</Text>
            <View style={introStyles.taglineLine} />
          </Animated.View>
        )}
        {phase >= 2 && (
          <Animated.View entering={FadeIn.duration(300).delay(200)} style={introStyles.personaGrid}>
            {visiblePersonas.map((pid, i) => {
              const p = getPersona(pid);
              if (!p) return null;
              return (
                <Animated.View
                  key={pid}
                  entering={i % 2 === 0 ? SlideInLeft.duration(300).springify() : SlideInRight.duration(300).springify()}
                  style={introStyles.personaChip}
                >
                  <View style={[introStyles.personaDot, { backgroundColor: p.color }]} />
                  <Text style={[introStyles.personaName, { color: p.color }]}>{p.shortName}</Text>
                </Animated.View>
              );
            })}
          </Animated.View>
        )}
        {phase >= 3 && !showEngage && (
          <Animated.View entering={BounceIn.duration(500)} style={introStyles.countdownArea}>
            <View style={introStyles.progressRing}>
              <View style={[introStyles.progressFill, { height: `${progress * 100}%`, backgroundColor: countdownColor + "30" }]} />
              {pulseRing && <View style={[introStyles.pulseOverlay, { borderColor: countdownColor }]} />}
              {Platform.OS === "web" ? (
                <Text style={[introStyles.countdownNum, { color: countdownColor }]}>{countdown}</Text>
              ) : (
                <Animated.Text key={countdown} entering={ZoomIn.duration(250)} exiting={ZoomOut.duration(150)} style={[introStyles.countdownNum, { color: countdownColor }]}>
                  {countdown}
                </Animated.Text>
              )}
            </View>
            <Text style={introStyles.countdownLabel}>SECONDS TO DEBATE</Text>
          </Animated.View>
        )}
        {showEngage && (
          <Animated.View entering={ZoomIn.duration(400).springify()} style={introStyles.engageWrap}>
            <Text style={introStyles.engageText}>ENGAGE</Text>
            <View style={introStyles.engageGlow} />
          </Animated.View>
        )}
      </View>
    </Pressable>
  );
}

const introStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0a0a",
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  liveRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 24,
    backgroundColor: "rgba(239,68,68,0.12)",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.3)",
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#EF4444",
  },
  liveText: {
    fontSize: 12,
    fontWeight: "900" as const,
    color: "#EF4444",
    letterSpacing: 2,
  },
  title: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: "rgba(255,255,255,0.5)",
    textAlign: "center",
    letterSpacing: 6,
  },
  titleBig: {
    fontSize: 40,
    fontWeight: "900" as const,
    color: "#fff",
    textAlign: "center",
    letterSpacing: 4,
  },
  taglineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 16,
    marginBottom: 20,
  },
  taglineLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(212,175,55,0.3)",
  },
  tagline: {
    fontSize: 10,
    fontWeight: "700" as const,
    color: "#D4AF37",
    letterSpacing: 2,
  },
  personaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 6,
    maxWidth: 340,
    marginBottom: 30,
  },
  personaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.05)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  personaDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  personaName: {
    fontSize: 11,
    fontWeight: "700" as const,
  },
  countdownArea: {
    alignItems: "center",
    gap: 12,
  },
  progressRing: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(212,175,55,0.08)",
    borderWidth: 3,
    borderColor: "rgba(212,175,55,0.3)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  progressFill: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderRadius: 50,
  },
  pulseOverlay: {
    position: "absolute",
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: 54,
    borderWidth: 2,
    opacity: 0.5,
  },
  countdownNum: {
    fontSize: 42,
    fontWeight: "900" as const,
    zIndex: 1,
  },
  countdownLabel: {
    fontSize: 10,
    fontWeight: "700" as const,
    color: "rgba(255,255,255,0.4)",
    letterSpacing: 3,
  },
  engageWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
  },
  engageText: {
    fontSize: 48,
    fontWeight: "900" as const,
    color: "#4ADE80",
    letterSpacing: 8,
    textShadowColor: "rgba(74,222,128,0.5)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  engageGlow: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "rgba(74,222,128,0.08)",
  },
});

const ARENA_SAVED_SESSION_KEY = "chatdjt_arena_saved_session";

interface SavedArenaSession {
  messages: ArenaMessage[];
  currentTopic: string;
  sessionExpiresAt: number;
  topicTimer: number;
  emotionalStates: Record<string, string>;
  savedAt: number;
}

interface ViralClipsModalProps {
  visible: boolean;
  onClose: () => void;
  messages: ConversationMessage[];
  currentTopic: string | null;
  videoStates: Record<number, { loading: boolean; videoUrl: string | null; error: string | null }>;
  setVideoStates: React.Dispatch<React.SetStateAction<Record<number, { loading: boolean; videoUrl: string | null; error: string | null }>>>;
  deviceId: string | null;
}

function ViralClipsModal({ visible, onClose, messages, currentTopic, videoStates, setVideoStates, deviceId }: ViralClipsModalProps) {
  const insets = useSafeAreaInsets();
  const moments = React.useMemo(() => pickViralMoments(messages, 3), [messages]);
  const [confirmIdx, setConfirmIdx] = useState<number | null>(null);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  async function generateVideo(idx: number, moment: ViralMoment) {
    setConfirmIdx(null);
    if (!deviceId) return;
    setVideoStates((prev) => ({ ...prev, [idx]: { loading: true, videoUrl: null, error: null } }));
    try {
      const apiBase = getApiUrl().replace(/\/$/, "");
      const res = await globalThis.fetch(`${apiBase}/api/arena/viral-clip`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-device-id": deviceId },
        body: JSON.stringify({ text: moment.message.text.slice(0, 500), personaId: moment.persona.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setVideoStates((prev) => ({ ...prev, [idx]: { loading: false, videoUrl: null, error: data.error || "Generation failed" } }));
      } else {
        setVideoStates((prev) => ({ ...prev, [idx]: { loading: false, videoUrl: data.videoUrl || null, error: data.error || null } }));
      }
    } catch (e: any) {
      setVideoStates((prev) => ({ ...prev, [idx]: { loading: false, videoUrl: null, error: e.message || "Network error" } }));
    }
  }

  async function shareClip(idx: number, moment: ViralMoment) {
    const text = `"${moment.message.text.slice(0, 120)}${moment.message.text.length > 120 ? "…" : ""}"\n\n— ${moment.persona.name} on The Arena\n\nTopic: ${currentTopic || "The Arena"}\n\nWatch 28 AI personas debate LIVE 🏛️\nChat DJT — chatdjt.com`;
    let shared = false;
    try {
      if (Platform.OS !== "web") {
        await Share.share({ message: text });
        shared = true;
      } else if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: `${moment.persona.name} on The Arena`, text });
        shared = true;
      }
    } catch {}
    if (!shared) {
      try {
        const Clipboard = await import("expo-clipboard");
        await Clipboard.setStringAsync(text);
        setCopiedIdx(idx);
        setTimeout(() => setCopiedIdx(null), 2000);
      } catch {
        try { await Linking.openURL(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text.slice(0, 280))}`); } catch {}
      }
    }
  }

  async function shareVideo(videoUrl: string, personaName: string) {
    const msg = `${videoUrl}\n\nWatch ${personaName} go off on The Arena!\n\nChat DJT — chatdjt.com`;
    let shared = false;
    try {
      if (Platform.OS !== "web") {
        await Share.share({ message: msg });
        shared = true;
      } else if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: `${personaName} — Arena Viral Clip`, url: videoUrl });
        shared = true;
      }
    } catch {}
    if (!shared) {
      try {
        const Clipboard = await import("expo-clipboard");
        await Clipboard.setStringAsync(videoUrl);
      } catch {
        try { await Linking.openURL(videoUrl); } catch {}
      }
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={vcStyles.overlay}>
        <Animated.View entering={SlideInUp.duration(300).springify()} style={[vcStyles.card, { paddingTop: insets.top + 16 }]}>
          <View style={vcStyles.header}>
            <View style={vcStyles.headerLeft}>
              <Ionicons name="flame" size={20} color="#ff4d4d" />
              <Text style={vcStyles.headerTitle}>VIRAL MOMENTS</Text>
              <Ionicons name="flame" size={20} color="#ff4d4d" />
            </View>
            <Pressable onPress={onClose} style={vcStyles.closeBtn}>
              <Ionicons name="close" size={22} color="#fff" />
            </Pressable>
          </View>
          <Text style={vcStyles.subtitle}>
            Top {moments.length} most explosive moments from this debate
          </Text>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
            {moments.length === 0 ? (
              <View style={vcStyles.emptyState}>
                <Ionicons name="chatbubbles-outline" size={40} color="rgba(255,255,255,0.3)" />
                <Text style={vcStyles.emptyText}>No moments yet — start a debate first!</Text>
              </View>
            ) : (
              moments.map((moment, idx) => {
                const vs = videoStates[idx] || { loading: false, videoUrl: null, error: null };
                const isConfirming = confirmIdx === idx;
                const isCopied = copiedIdx === idx;
                return (
                  <Animated.View key={idx} entering={FadeInDown.delay(idx * 120).duration(300)} style={vcStyles.momentCard}>
                    <LinearGradient
                      colors={[`${moment.persona.color}22`, "rgba(0,0,0,0.95)"]}
                      style={vcStyles.momentGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    >
                      <View style={vcStyles.momentTop}>
                        {moment.persona.image ? (
                          <Image source={moment.persona.image} style={[vcStyles.momentAvatar, { borderColor: moment.persona.color }]} />
                        ) : (
                          <View style={[vcStyles.momentAvatarFallback, { backgroundColor: moment.persona.color }]}>
                            <Text style={vcStyles.momentAvatarLetter}>{moment.persona.name[0]}</Text>
                          </View>
                        )}
                        <View style={vcStyles.momentPersonaInfo}>
                          <Text style={[vcStyles.momentPersonaName, { color: moment.persona.color }]}>{moment.persona.name}</Text>
                          <Text style={vcStyles.momentTopicLabel}>{currentTopic ? currentTopic.slice(0, 40) : "The Arena"}</Text>
                        </View>
                        <View style={vcStyles.fireBadge}>
                          <Text style={vcStyles.fireBadgeText}>🔥 #{idx + 1}</Text>
                        </View>
                      </View>

                      <View style={vcStyles.quoteBlock}>
                        <Text style={vcStyles.quoteMarks}>"</Text>
                        <Text style={vcStyles.quoteText} numberOfLines={5}>{moment.message.text}</Text>
                        <Text style={[vcStyles.quoteMarks, vcStyles.quoteMarksClose]}>"</Text>
                      </View>

                      <View style={vcStyles.momentBrand}>
                        <Text style={vcStyles.momentBrandText}>Chat DJT · chatdjt.com</Text>
                      </View>

                      {vs.videoUrl ? (
                        <View style={vcStyles.videoReady}>
                          <Ionicons name="checkmark-circle" size={18} color="#4ADE80" />
                          <Text style={vcStyles.videoReadyText}>Video ready!</Text>
                          <Pressable onPress={() => shareVideo(vs.videoUrl!, moment.persona.name)} style={vcStyles.shareVideoBtn}>
                            <Ionicons name="share-social" size={14} color="#000" />
                            <Text style={vcStyles.shareVideoBtnText}>Share</Text>
                          </Pressable>
                        </View>
                      ) : vs.loading ? (
                        <View style={vcStyles.videoLoading}>
                          <ActivityIndicator size="small" color="#7c3aed" />
                          <Text style={vcStyles.videoLoadingText}>Generating lip-sync video… (~60s)</Text>
                        </View>
                      ) : isConfirming ? (
                        <View style={vcStyles.confirmRow}>
                          <Text style={vcStyles.confirmText}>Cost: 3 tokens — confirm?</Text>
                          <View style={vcStyles.confirmBtns}>
                            <Pressable onPress={() => setConfirmIdx(null)} style={vcStyles.confirmCancel}>
                              <Text style={vcStyles.confirmCancelText}>Cancel</Text>
                            </Pressable>
                            <Pressable onPress={() => generateVideo(idx, moment)} style={vcStyles.confirmGo}>
                              <Ionicons name="film" size={13} color="#fff" />
                              <Text style={vcStyles.confirmGoText}>Generate</Text>
                            </Pressable>
                          </View>
                        </View>
                      ) : (
                        <View style={vcStyles.momentActions}>
                          <Pressable onPress={() => shareClip(idx, moment)} style={vcStyles.shareTextBtn}>
                            <Ionicons name={isCopied ? "checkmark" : "share-social"} size={14} color={isCopied ? "#4ADE80" : "#FFD700"} />
                            <Text style={[vcStyles.shareTextBtnText, isCopied && { color: "#4ADE80" }]}>
                              {isCopied ? "Copied!" : "Share Quote"}
                            </Text>
                          </Pressable>
                          <Pressable
                            onPress={() => {
                              if (!deviceId) return;
                              setConfirmIdx(idx);
                            }}
                            style={vcStyles.generateVideoBtn}
                          >
                            <Ionicons name="film" size={14} color="#fff" />
                            <Text style={vcStyles.generateVideoBtnText}>Generate Video · 3🪙</Text>
                          </Pressable>
                        </View>
                      )}
                      {vs.error && !vs.loading && (
                        <Text style={vcStyles.errorText}>⚠ {vs.error}</Text>
                      )}
                    </LinearGradient>
                  </Animated.View>
                );
              })
            )}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const vcStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "flex-end",
  },
  card: {
    backgroundColor: "#0f0f0f",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: "rgba(255,77,77,0.3)",
    maxHeight: "92%",
    minHeight: "60%",
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "900" as const,
    color: "#fff",
    letterSpacing: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  subtitle: {
    fontSize: 12,
    color: "rgba(255,255,255,0.5)",
    marginBottom: 16,
    letterSpacing: 0.5,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    color: "rgba(255,255,255,0.4)",
    textAlign: "center",
  },
  momentCard: {
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  momentGradient: {
    padding: 16,
  },
  momentTop: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 10,
  },
  momentAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
  },
  momentAvatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  momentAvatarLetter: {
    fontSize: 18,
    fontWeight: "900" as const,
    color: "#fff",
  },
  momentPersonaInfo: {
    flex: 1,
  },
  momentPersonaName: {
    fontSize: 15,
    fontWeight: "800" as const,
    letterSpacing: 0.3,
  },
  momentTopicLabel: {
    fontSize: 10,
    color: "rgba(255,255,255,0.45)",
    marginTop: 2,
  },
  fireBadge: {
    backgroundColor: "rgba(255,77,77,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,77,77,0.4)",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  fireBadgeText: {
    fontSize: 11,
    fontWeight: "800" as const,
    color: "#ff7070",
  },
  quoteBlock: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: "#FFD700",
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  quoteMarks: {
    fontSize: 28,
    color: "#FFD700",
    fontWeight: "900" as const,
    lineHeight: 20,
    marginBottom: -4,
  },
  quoteMarksClose: {
    textAlign: "right",
    marginTop: -4,
    marginBottom: 0,
  },
  quoteText: {
    fontSize: 14,
    color: "#fff",
    lineHeight: 20,
    fontWeight: "500" as const,
    fontStyle: "italic",
  },
  momentBrand: {
    alignItems: "flex-end",
    marginBottom: 10,
  },
  momentBrandText: {
    fontSize: 10,
    color: "rgba(212,164,32,0.6)",
    fontWeight: "700" as const,
    letterSpacing: 1,
  },
  momentActions: {
    flexDirection: "row",
    gap: 8,
  },
  shareTextBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    backgroundColor: "rgba(212,164,32,0.12)",
    borderWidth: 1,
    borderColor: "rgba(212,164,32,0.4)",
    borderRadius: 10,
    paddingVertical: 9,
  },
  shareTextBtnText: {
    fontSize: 12,
    fontWeight: "800" as const,
    color: "#FFD700",
  },
  generateVideoBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    backgroundColor: "#7c3aed",
    borderRadius: 10,
    paddingVertical: 9,
  },
  generateVideoBtnText: {
    fontSize: 12,
    fontWeight: "800" as const,
    color: "#fff",
  },
  videoLoading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    backgroundColor: "rgba(124,58,237,0.1)",
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  videoLoadingText: {
    fontSize: 11,
    color: "rgba(255,255,255,0.6)",
    flex: 1,
  },
  videoReady: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    backgroundColor: "rgba(74,222,128,0.1)",
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  videoReadyText: {
    fontSize: 11,
    color: "#4ADE80",
    flex: 1,
    fontWeight: "700" as const,
  },
  shareVideoBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#4ADE80",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  shareVideoBtnText: {
    fontSize: 11,
    fontWeight: "800" as const,
    color: "#000",
  },
  errorText: {
    fontSize: 11,
    color: "#ff7070",
    marginTop: 6,
    textAlign: "center",
  },
  confirmRow: {
    marginTop: 10,
    backgroundColor: "rgba(124,58,237,0.15)",
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.4)",
  },
  confirmText: {
    fontSize: 12,
    color: "rgba(255,255,255,0.8)",
    textAlign: "center",
    marginBottom: 8,
  },
  confirmBtns: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
  },
  confirmCancel: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  confirmCancelText: {
    fontSize: 12,
    color: "rgba(255,255,255,0.6)",
    fontWeight: "600" as const,
  },
  confirmGo: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: "#7c3aed",
  },
  confirmGoText: {
    fontSize: 12,
    color: "#fff",
    fontWeight: "700" as const,
  },
});

export default function ArenaScreen() {
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const speakingOverlaySize = Math.round(Math.sqrt(screenWidth * screenHeight / 8));
  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const webBottomInset = Platform.OS === "web" ? 34 : 0;
  const { deviceId, balance, refreshBalance } = useTokens();
  const { isLocked, isHidden, unlockWithTokens, isUnlocking: premiumUnlocking, addArenaWin, unlockedPremium } = usePersonaLocks();
  const [arenaBet, setArenaBet] = useState<ArenaBet | null>(null);
  const [betWagerInput, setBetWagerInput] = useState(3);
  const [betPickId, setBetPickId] = useState<string | null>(null);
  const [betResult, setBetResult] = useState<{ won: boolean; payout: number; lowestId: string } | null>(null);
  const { showShareCard, awardBadge } = useEngagement();
  const { logEvent: logLiveEvent } = useLiveActivity();
  useScreenTracker("arena");

  useEffect(() => { logLiveEvent("arena_enter"); }, []);

  const [showIntro, setShowIntro] = useState(false);
  const [showPreDebateSetup, setShowPreDebateSetup] = useState(true);
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const selectedTopicIdRef = useRef<string | null>(null);
  const [customTopicText, setCustomTopicText] = useState("");
  const customTopicTextRef = useRef("");
  const [useCustomTopic, setUseCustomTopic] = useState(false);
  const useCustomTopicRef = useRef(false);
  const [showGlobalLeaderboard, setShowGlobalLeaderboard] = useState(false);
  const [showArenaRules, setShowArenaRules] = useState(false);
  const [globalLeaderboardData, setGlobalLeaderboardData] = useState<{ topUsers: any[]; topPersonas: any[] }>({ topUsers: [], topPersonas: [] });
  const [showWinnersStats, setShowWinnersStats] = useState(false);
  const [winnersStatsData, setWinnersStatsData] = useState<{ topPersonas: any[]; totalWinsAllTime: number; totalUniquePlayers: number; userWins: Record<string, number>; userTotalWins: number; dailyWinEarnings: number; maxDailyWinRewards: number } | null>(null);
  const [winTokenToast, setWinTokenToast] = useState<{ tokens: number; personaName: string } | null>(null);
  const [breakingNewsBanner, setBreakingNewsBanner] = useState<{ headline: string; source: string } | null>(null);
  const breakingNewsBannerRef = useRef<{ headline: string; source: string } | null>(null);
  const lastBreakingNewsIdRef = useRef<string>("");
  const breakingNewsTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [bannerFlash, setBannerFlash] = useState(false);

  const [messages, setMessages] = useState<ConversationMessage[]>([]);

  // ── LIE DETECTOR (ported from 1-on-1 interview screen, same backend endpoints) ─
  const [lieCount, setLieCount] = useState(0);
  const [lies, setLies] = useState<LieEntry[]>([]);
  const [liesSheetOpen, setLiesSheetOpen] = useState(false);
  const [lieVotes, setLieVotes] = useState<Record<string, { up: number; down: number; myVote: number }>>({});
  const lieVotesPendingRef = useRef<Set<string>>(new Set());
  const [flaggedMsgIds, setFlaggedMsgIds] = useState<Set<string>>(new Set());
  const flagPendingRef = useRef<Set<string>>(new Set());
  const [latestTruthScore, setLatestTruthScore] = useState<number | null>(null);
  const [lieFlashOn, setLieFlashOn] = useState(false);
  // Liar of the Day — global leaderboard (server) + personal lifetime tally (AsyncStorage)
  const [globalLieStats, setGlobalLieStats] = useState<{
    today: { personaId: string; name: string; count: number }[];
    allTime: { personaId: string; name: string; count: number }[];
    liarOfTheDay: { personaId: string; name: string; count: number } | null;
    liarOfAllTime: { personaId: string; name: string; count: number } | null;
  } | null>(null);
  const [personalLieHistory, setPersonalLieHistory] = useState<Record<string, number>>({});
  const personalLieHistoryRef = useRef<Record<string, number>>({});
  const seenLieIdsRef = useRef<Set<string>>(new Set());

  // ── DEBATE SETTINGS ─────────────────────────────────────────────────────────
  const [debateMode, setDebateMode] = useState<"civil" | "elevated" | "savage">("elevated");
  const debateModeRef = useRef<"civil" | "elevated" | "savage">("elevated");
  useEffect(() => { debateModeRef.current = debateMode; }, [debateMode]);
  const [topicCategory, setTopicCategory] = useState<string>("politics");
  const [bleepEnabled, setBleepEnabled] = useState<boolean>(false);

  const applyBleep = useCallback((text: string): string => {
    if (!bleepEnabled) return text;
    const profanity = [
      /\bf+u+c+k+(e+r+s?|i+n+g?|e+d?)?\b/gi,
      /\bs+h+i+t+(t+y|t+e+r+s?|t+i+n+g?)?\b/gi,
      /\ba+s+s+(h+o+l+e+s?|f+u+c+k+e+r+s?|w+i+p+e+s?)?\b/gi,
      /\bb+i+t+c+h+(e+s?|i+n+g?)?\b/gi,
      /\bc+u+n+t+s?\b/gi,
      /\bd+a+m+n+s?\b/gi,
      /\bp+r+i+c+k+s?\b/gi,
      /\bc+o+c+k+s?\b/gi,
      /\bd+i+c+k+(s|h+e+a+d+s?|f+a+c+e+s?)?\b/gi,
      /\bm+o+t+h+e+r+f+u+c+k+(e+r+s?|i+n+g?)?\b/gi,
      /\bb+a+s+t+a+r+d+s?\b/gi,
      /\bw+h+o+r+e+s?\b/gi,
      /\bs+l+u+t+s?\b/gi,
      /\bn+i+g+g+(e+r+s?|a+s?)\b/gi,
      /\bf+a+g+(g+o+t+s?|s)?\b/gi,
    ];
    let result = text;
    for (const re of profanity) {
      result = result.replace(re, (m) => m[0] + "*".repeat(Math.max(1, m.length - 1)));
    }
    return result;
  }, [bleepEnabled]);

  // Political Facts IQ: starts at 100 (or all-time avg), rises with truths, falls with lies.
  const [personaSessionIQ, setPersonaSessionIQ] = useState<Record<string, number>>({});
  const personaSessionIQRef = useRef<Record<string, number>>({});

  const adjustPersonaIQ = useCallback((pid: string, delta: number) => {
    setPersonaSessionIQ((prev) => {
      const cur = prev[pid] ?? 100;
      const next = Math.max(0, Math.min(200, Math.round(cur + delta)));
      const updated = { ...prev, [pid]: next };
      personaSessionIQRef.current = updated;
      return updated;
    });
  }, []);
  const sessionLieTallyRef = useRef<Record<string, number>>({});
  const [altFactCount, setAltFactCount] = useState(0);
  const sessionAltFactTallyRef = useRef<Record<string, number>>({});
  const [personaAltTruths, setPersonaAltTruths] = useState<Record<string, number>>({});
  const alltimeIQRef = useRef<Record<string, number>>({});

  const [emotionalStates, setEmotionalStates] = useState<Record<string, EmotionalState>>(() => {
    const s: Record<string, EmotionalState> = {};
    PERSONA_IDS.forEach((id) => {
      s[id] = { anger: 20, happiness: 50, engagement: 50, lastSpoke: null };
    });
    return s;
  });
  const [currentSpeaker, setCurrentSpeaker] = useState<string | null>(null);
  const [ttsActiveSpeaker, setTtsActiveSpeaker] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [firstAudioPlayed, setFirstAudioPlayed] = useState(false);
  const firstAudioPlayedRef = useRef(false);
  const [currentTopic, setCurrentTopic] = useState<string | null>(null);
  const [focusedPersona, setFocusedPersona] = useState<string | null>(null);

  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const ttsQueueRef = useRef<{ text: string; personaId: string }[]>([]);
  const isProcessingTTSRef = useRef(false);
  const ttsPendingMoreRef = useRef(false);
  const prefetchedAudioRef = useRef<{ personaId: string; text: string; audioUri: string } | null>(null);
  const prefetchingRef = useRef(false);

  const [unlockedMystery, setUnlockedMystery] = useState<string[]>([]);

  const [mysteryUnlocking, setMysteryUnlocking] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(MYSTERY_UNLOCK_KEY).then((data) => {
      if (data) {
        try {
          const parsed = JSON.parse(data);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setUnlockedMystery(parsed);
            setSelectedPersonas((prev) => {
              const toAdd = parsed.filter((id: string) => !prev.includes(id) && MYSTERY_PERSONAS[id]);
              return toAdd.length > 0 ? [...prev, ...toAdd] : prev;
            });
            setEmotionalStates((prev) => {
              const next = { ...prev };
              parsed.forEach((id: string) => {
                if (!next[id]) next[id] = { anger: 20, happiness: 50, engagement: 50, lastSpoke: null };
              });
              return next;
            });
          }
        } catch {}
      }
    });
  }, []);

  const unlockMysteryPersona = useCallback(async (personaId: string) => {
    const cost = MYSTERY_UNLOCK_COSTS[personaId] || 10;
    if (!balance || balance < cost) {
      if (Platform.OS === "web") {
        alert(`You need ${cost} D.C. Tokens to unlock this mystery persona!`);
      } else {
        Alert.alert("Not Enough Tokens", `You need ${cost} D.C. Tokens to unlock this mystery persona!`);
      }
      return;
    }
    setMysteryUnlocking(personaId);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (deviceId) headers["x-device-id"] = deviceId;
      const res = await fetch(new URL("/api/use-token", getApiUrl()).toString(), {
        method: "POST",
        headers,
        body: JSON.stringify({ amount: cost, reason: `Unlock mystery persona: ${personaId}` }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        const errMsg = errData?.error || "Token deduction failed. Try again.";
        if (Platform.OS === "web") {
          alert(errMsg);
        } else {
          Alert.alert("Unlock Failed", errMsg);
        }
        return;
      }
      await refreshBalance();
      const newUnlocked = [...unlockedMystery, personaId];
      setUnlockedMystery(newUnlocked);
      await AsyncStorage.setItem(MYSTERY_UNLOCK_KEY, JSON.stringify(newUnlocked));
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const persona = MYSTERY_PERSONAS[personaId];
      if (persona) {
        setSelectedPersonas((prev) => [...prev, personaId]);
        setEmotionalStates((prev) => ({
          ...prev,
          [personaId]: prev[personaId] || { anger: 20, happiness: 50, engagement: 50, lastSpoke: null },
        }));
      }
    } catch (e) {
      if (Platform.OS === "web") {
        alert("Failed to unlock persona. Try again.");
      } else {
        Alert.alert("Error", "Failed to unlock persona. Try again.");
      }
    } finally {
      setMysteryUnlocking(null);
    }
  }, [balance, deviceId, refreshBalance, unlockedMystery]);

  const [selectedPersonas, setSelectedPersonas] = useState<string[]>(() => {
    const others = PERSONA_IDS.filter((id) => id !== "trump");
    const shuffled = others.sort(() => Math.random() - 0.5);
    const randomCount = 3 + Math.floor(Math.random() * 3);
    return ["trump", ...shuffled.slice(0, randomCount)];
  });
  const [showPersonaSelector, setShowPersonaSelector] = useState(false);
  const selectedPersonasRef = useRef<string[]>(PERSONA_IDS);
  useEffect(() => { selectedPersonasRef.current = selectedPersonas; }, [selectedPersonas]);

  useEffect(() => {
    if (!breakingNewsBanner) { setBannerFlash(false); return; }
    const flashInterval = setInterval(() => setBannerFlash((p) => !p), 500);
    return () => clearInterval(flashInterval);
  }, [breakingNewsBanner]);

  const [pollVotes, setPollVotes] = useState<Record<string, number>>({});
  const [userVoted, setUserVoted] = useState(false);
  const [showPollResults, setShowPollResults] = useState(false);
  const [pollWinner, setPollWinner] = useState<string | null>(null);
  const [fanName, setFanName] = useState("");
  const [showNameInput, setShowNameInput] = useState(false);

  const [showVerdictModal, setShowVerdictModal] = useState(false);
  const [verdictData, setVerdictData] = useState<any>(null);
  const [verdictLoading, setVerdictLoading] = useState(false);

  const [personaPoints, setPersonaPoints] = useState<Record<string, number>>({});
  const [awardedMessages, setAwardedMessages] = useState<Set<string>>(new Set());
  const [showScoreboard, setShowScoreboard] = useState(false);
  const [showEndSummary, setShowEndSummary] = useState(false);
  const [showViralClips, setShowViralClips] = useState(false);
  const [viralClipVideoStates, setViralClipVideoStates] = useState<Record<number, { loading: boolean; videoUrl: string | null; error: string | null }>>({});
  const [showContinuePrompt, setShowContinuePrompt] = useState(false);
  const [tokenWinVisible, setTokenWinVisible] = useState(false);
  const [tokenWinAmount, setTokenWinAmount] = useState<number | undefined>();
  const [tokenWinSource, setTokenWinSource] = useState<string | undefined>();
  const [trumpRoastText, setTrumpRoastText] = useState("");
  const [isLoadingRoast, setIsLoadingRoast] = useState(false);
  const [winnerClapBack, setWinnerClapBack] = useState("");
  const [isLoadingClapBack, setIsLoadingClapBack] = useState(false);
  const personaPointsRef = useRef<Record<string, number>>({});
  useEffect(() => { personaPointsRef.current = personaPoints; }, [personaPoints]);
  const [thankYouPlayed, setThankYouPlayed] = useState(false);

  const [winTallyGlobal, setWinTallyGlobal] = useState<Record<string, number>>({});
  const [winTallyUser, setWinTallyUser] = useState<Record<string, number>>({});
  const winTallyRef = useRef<{ global: Record<string, number>; user: Record<string, number> }>({ global: {}, user: {} });

  const [allTimeScores, setAllTimeScores] = useState<Record<string, { totalPoints: number; totalVotes: number; totalEntries?: number }>>({});
  const [speakerVoteCounts, setSpeakerVoteCounts] = useState<Record<string, number>>({});
  const [voteAnimations, setVoteAnimations] = useState<Record<string, number>>({});
  const [lastSpeakerId, setLastSpeakerId] = useState<string | null>(null);

  useEffect(() => {
    if (currentSpeaker && currentSpeaker !== lastSpeakerId) {
      setSpeakerVoteCounts((prev) => ({ ...prev, [currentSpeaker]: 0 }));
      setLastSpeakerId(currentSpeaker);
    }
  }, [currentSpeaker, lastSpeakerId]);

  const loadWinTally = useCallback(async () => {
    try {
      const headers: Record<string, string> = {};
      if (deviceId) headers["x-device-id"] = deviceId;
      const res = await fetch(new URL("/api/arena/win-tally", getApiUrl()).toString(), { headers });
      if (res.ok) {
        const data = await res.json();
        setWinTallyGlobal(data.globalTally || {});
        setWinTallyUser(data.userTally || {});
        winTallyRef.current = { global: data.globalTally || {}, user: data.userTally || {} };
        if (data.allTimeScores) setAllTimeScores(data.allTimeScores);
      }
    } catch {}
  }, [deviceId]);

  useEffect(() => { loadWinTally(); }, [loadWinTally]);

  // ── LIAR OF THE DAY: global leaderboard polling + personal lifetime history persistence ──
  useEffect(() => {
    let cancelled = false;
    const fetchStats = async () => {
      try {
        const res = await fetch(new URL("/api/arena/lie-stats", getApiUrl()).toString());
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (!cancelled) setGlobalLieStats(data);
      } catch {}
    };
    fetchStats();
    const t = setInterval(fetchStats, 30_000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  useEffect(() => {
    if (!deviceId) return;
    AsyncStorage.getItem(`arena_lie_history_${deviceId}`).then((raw) => {
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === "object") {
            setPersonalLieHistory(parsed);
            personalLieHistoryRef.current = parsed;
          }
        } catch {}
      }
    });
  }, [deviceId]);

  useEffect(() => {
    if (!deviceId || lies.length === 0) return;
    let dirty = false;
    const next = { ...personalLieHistoryRef.current };
    for (const l of lies) {
      if (!l.id || seenLieIdsRef.current.has(l.id)) continue;
      if (l.pending) continue;
      if (typeof l.score === "number" && l.score >= 40) { seenLieIdsRef.current.add(l.id); continue; }
      seenLieIdsRef.current.add(l.id);
      next[l.speakerId] = (next[l.speakerId] || 0) + 1;
      dirty = true;
    }
    if (dirty) {
      personalLieHistoryRef.current = next;
      setPersonalLieHistory(next);
      AsyncStorage.setItem(`arena_lie_history_${deviceId}`, JSON.stringify(next)).catch(() => {});
    }
  }, [lies, deviceId]);

  const recordWin = useCallback(async (personaId: string) => {
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (deviceId) headers["x-device-id"] = deviceId;
      const res = await fetch(new URL("/api/arena/record-win", getApiUrl()).toString(), {
        method: "POST",
        headers,
        body: JSON.stringify({ personaId }),
      });
      if (res.ok) {
        const data = await res.json();
        setWinTallyGlobal((prev) => ({ ...prev, [personaId]: data.globalWins }));
        setWinTallyUser((prev) => ({ ...prev, [personaId]: data.userWins }));
        winTallyRef.current = {
          global: { ...winTallyRef.current.global, [personaId]: data.globalWins },
          user: { ...winTallyRef.current.user, [personaId]: data.userWins },
        };
        if (data.tokensEarned > 0) {
          const personaName = getPersona(personaId)?.shortName || personaId;
          setWinTokenToast({ tokens: data.tokensEarned, personaName });
          refreshBalance();
          setTimeout(() => setWinTokenToast(null), 3500);
        }
      }
    } catch {}
  }, [deviceId, refreshBalance]);

  const loadAllTimeScores = useCallback(async () => {
    try {
      const baseUrl = getApiUrl().replace(/\/$/, "");
      const res = await fetch(`${baseUrl}/api/arena/leaderboard`);
      const ct = res.headers.get("content-type") || "";
      if (!ct.includes("application/json")) return;
      const data = await res.json();
      const scores: Record<string, { totalPoints: number; totalVotes: number; totalEntries?: number }> = {};
      (data.leaderboard || []).forEach((item: any) => {
        scores[item.personaId] = { totalPoints: item.totalPoints, totalVotes: item.totalVotes, totalEntries: item.totalEntries || 0 };
      });
      setAllTimeScores(scores);
    } catch {}
  }, []);

  useEffect(() => { loadAllTimeScores(); }, [loadAllTimeScores]);

  const voteForPersona = useCallback(async (personaId: string) => {
    const currentCount = speakerVoteCounts[personaId] || 0;
    if (currentCount >= 5) return;

    const newCount = currentCount + 1;
    setSpeakerVoteCounts((prev) => ({ ...prev, [personaId]: newCount }));
    setVoteAnimations((prev) => ({ ...prev, [personaId]: newCount }));
    setPersonaPoints((prev) => ({ ...prev, [personaId]: (prev[personaId] || 0) + 1 }));

    playVoteClickSound();

    setTimeout(() => setVoteAnimations((prev) => ({ ...prev, [personaId]: 0 })), 1200);

    try {
      const baseUrl = getApiUrl().replace(/\/$/, "");
      const voteHeaders: Record<string, string> = { "Content-Type": "application/json" };
      if (deviceId) voteHeaders["x-device-id"] = deviceId;
      const res = await fetch(`${baseUrl}/api/arena/vote`, {
        method: "POST",
        headers: voteHeaders,
        body: JSON.stringify({ personaId, points: 1 }),
      });
      fetch(`${baseUrl}/api/arena/track-vote`, {
        method: "POST",
        headers: voteHeaders,
      }).catch(() => {});
      const ct = res.headers.get("content-type") || "";
      if (ct.includes("application/json")) {
        const data = await res.json();
        setAllTimeScores((prev) => ({
          ...prev,
          [personaId]: { totalPoints: data.totalPoints, totalVotes: data.totalVotes, totalEntries: prev[personaId]?.totalEntries || 0 },
        }));
      }
    } catch {}
  }, [speakerVoteCounts]);

  const [dynamicTopics, setDynamicTopics] = useState<DynamicTopic[]>(FALLBACK_TOPICS);
  const [topicTimer, setTopicTimer] = useState<number>(0);
  const topicTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const TOPIC_DURATION = 5 * 60;

  const [freeRemaining, setFreeRemaining] = useState(15);
  const [hasSession, setHasSession] = useState(false);
  const [sessionExpiresAt, setSessionExpiresAt] = useState<number | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);
  const [paywallSpeechPaused, setPaywallSpeechPaused] = useState(false);
  const paywallPulse = useSharedValue(1);
  const heatSpike = useSharedValue(1);
  const prevRoomTempRef = useRef<number>(0);
  const [sessionTimer, setSessionTimer] = useState<number>(0);
  const [roomTemperature, setRoomTemperature] = useState<number>(0);
  const roomTempRef = useRef<number>(0);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  const flatListRef = useRef<FlatList>(null);
  const isRunningRef = useRef(true);
  const sessionEndedRef = useRef(false);
  const mcconnellFreezeRef = useRef(false);
  const clapBackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesRef = useRef<ConversationMessage[]>([]);
  const currentSpeakerRef = useRef<string | null>(null);
  const currentTopicRef = useRef<string | null>(null);
  const emotionalStatesRef = useRef(emotionalStates);
  const conversationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleNextRef = useRef<(() => void) | null>(null);
  const mountedRef = useRef(true);
  const voiceEnabledRef = useRef(true);
  const recentSpeakersRef = useRef<string[]>([]);
  const ttsGenerationRef = useRef(0);
  const pendingResponseRef = useRef<string | null>(null);
  const [selectedDuration, setSelectedDuration] = useState<number>(5);
  const arenaMemoryContextRef = useRef<string>("");
  const arenaMessageCountRef = useRef(0);
  const arenaUserContextRef = useRef<string>("");

  // ── FIREBACK HEAT SYSTEM ─────────────────────────────────────────────────
  // arenaHeatRef accumulates insult-severity points per target persona.
  // arenaFirebackChainRef caps consecutive retorts before a squabble cooldown.
  const arenaHeatRef = useRef<Record<string, number>>({});
  // personaHeat mirrors arenaHeatRef as React state so the UI re-renders on change.
  const [personaHeat, setPersonaHeat] = useState<Record<string, number>>({});
  // heatPulseOn flips every 600 ms to drive the pulsing red ring.
  const [heatPulseOn, setHeatPulseOn] = useState(false);
  const arenaFirebackChainRef = useRef(0);
  const arenaLastFirebackAtRef = useRef(0);
  const arenaSquabbleCooldownUntilRef = useRef(0);
  // Ref-forwarded so tryArenaFireback can call itself recursively via closure
  const tryArenaFirebackRef = useRef<null | ((attackerId: string, attackText: string, severity: number) => void)>(null);
  // addMessage is declared later (depends on runFactCheck); ref breaks the TDZ cycle
  const addMessageRef = useRef<null | ((msg: ConversationMessage) => void)>(null);
  // ────────────────────────────────────────────────────────────────────────

  // Pulse interval for the heat ring animation (600 ms on / 600 ms off)
  useEffect(() => {
    const id = setInterval(() => setHeatPulseOn((v) => !v), 600);
    return () => clearInterval(id);
  }, []);

  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { currentSpeakerRef.current = currentSpeaker; }, [currentSpeaker]);
  useEffect(() => {
    if (roomTemperature <= 0) return;
    const cooldownTimer = setInterval(() => {
      setRoomTemperature((prev) => {
        const next = Math.max(0, prev - 5);
        roomTempRef.current = next;
        return next;
      });
    }, 30000);
    return () => clearInterval(cooldownTimer);
  }, [roomTemperature]);
  // Pulse the heat meter when temperature spikes upward
  useEffect(() => {
    if (roomTemperature > prevRoomTempRef.current) {
      heatSpike.value = withSequence(
        withTiming(1.35, { duration: 120 }),
        withTiming(0.9, { duration: 100 }),
        withTiming(1.0, { duration: 120 }),
      );
    }
    prevRoomTempRef.current = roomTemperature;
  }, [roomTemperature]);
  useEffect(() => { currentTopicRef.current = currentTopic; }, [currentTopic]);
  useEffect(() => { selectedTopicIdRef.current = selectedTopicId; }, [selectedTopicId]);
  useEffect(() => { customTopicTextRef.current = customTopicText; }, [customTopicText]);
  useEffect(() => { useCustomTopicRef.current = useCustomTopic; }, [useCustomTopic]);
  useEffect(() => { emotionalStatesRef.current = emotionalStates; }, [emotionalStates]);
  useEffect(() => { isRunningRef.current = isRunning; }, [isRunning]);
  useEffect(() => { voiceEnabledRef.current = voiceEnabled; }, [voiceEnabled]);

  const navigation = useNavigation();
  const isDebateActiveRef = useRef(false);
  const confirmedExitRef = useRef(false);
  useEffect(() => {
    isDebateActiveRef.current = !showPreDebateSetup && !showIntro;
  }, [showPreDebateSetup, showIntro]);

  useFocusEffect(
    useCallback(() => {
      sessionEndedRef.current = false;
      isInterruptingRef.current = false;
      confirmedExitRef.current = false;
      setIsStarting(false);
    }, [])
  );

  const saveSessionState = useCallback(async () => {
    if (!hasSession || !sessionExpiresAt || Date.now() >= sessionExpiresAt) return;
    const saved: SavedArenaSession = {
      messages: messagesRef.current,
      currentTopic: currentTopicRef.current,
      sessionExpiresAt,
      topicTimer,
      emotionalStates: emotionalStatesRef.current,
      savedAt: Date.now(),
    };
    await AsyncStorage.setItem(ARENA_SAVED_SESSION_KEY, JSON.stringify(saved));
  }, [hasSession, sessionExpiresAt, topicTimer]);

  const clearSavedSession = useCallback(async () => {
    await AsyncStorage.removeItem(ARENA_SAVED_SESSION_KEY);
  }, []);

  const restoreSavedSession = useCallback(async (): Promise<boolean> => {
    try {
      const raw = await AsyncStorage.getItem(ARENA_SAVED_SESSION_KEY);
      if (!raw) return false;
      const saved: SavedArenaSession = JSON.parse(raw);
      if (Date.now() >= saved.sessionExpiresAt) {
        await clearSavedSession();
        return false;
      }
      if (deviceId) {
        try {
          const statusRes = await fetch(new URL("/api/arena/status", getApiUrl()).toString(), {
            headers: { "x-device-id": deviceId },
          });
          if (statusRes.ok) {
            const statusData = await statusRes.json();
            if (!statusData.hasSession) {
              await clearSavedSession();
              return false;
            }
          }
        } catch {}
      }
      setMessages(saved.messages);
      setCurrentTopic(saved.currentTopic);
      setSessionExpiresAt(saved.sessionExpiresAt);
      setHasSession(true);
      setTopicTimer(saved.topicTimer);
      setEmotionalStates(saved.emotionalStates);
      setShowPreDebateSetup(false);
      setShowIntro(false);
      setIsRunning(true);
      await clearSavedSession();
      return true;
    } catch {
      return false;
    }
  }, [clearSavedSession, deviceId]);

  const stopDebateAndLeave = useCallback(async (doNav: () => void) => {
    if (hasSession && sessionExpiresAt && Date.now() < sessionExpiresAt) {
      await saveSessionState();
    }
    setIsRunning(false);
    isRunningRef.current = false;
    if (conversationTimerRef.current) clearTimeout(conversationTimerRef.current);
    confirmedExitRef.current = true;
    doNav();
  }, [hasSession, sessionExpiresAt, saveSessionState]);

  const [showExitModal, setShowExitModal] = useState(false);
  const pendingExitNavRef = useRef<(() => void) | null>(null);

  const showLeaveAlert = useCallback((doNav: () => void) => {
    pendingExitNavRef.current = doNav;
    setShowExitModal(true);
  }, []);

  const confirmExit = useCallback(() => {
    setShowExitModal(false);
    const nav = pendingExitNavRef.current;
    pendingExitNavRef.current = null;
    if (nav) stopDebateAndLeave(nav);
  }, [stopDebateAndLeave]);

  const cancelExit = useCallback(() => {
    setShowExitModal(false);
    pendingExitNavRef.current = null;
  }, []);

  useEffect(() => {
    const eventName = "beforeRemove";
    const unsubscribe = navigation.addListener(eventName, (e: { preventDefault: () => void; data: { action: { type: string } } }) => {
      if (!isDebateActiveRef.current || confirmedExitRef.current) {
        confirmedExitRef.current = false;
        return;
      }
      e.preventDefault();
    });
    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    const handler = () => {
      if (!isDebateActiveRef.current) return false;
      return true;
    };
    BackHandler.addEventListener("hardwareBackPress", handler);
    return () => BackHandler.removeEventListener("hardwareBackPress", handler);
  }, []);

  const debateActive = !showPreDebateSetup && !showIntro;
  useEffect(() => {
    if (Platform.OS !== "web") return;
    if (!debateActive) return;
    const blockPopState = () => {
      if (isDebateActiveRef.current && !confirmedExitRef.current) {
        window.history.pushState(null, "", window.location.href);
      }
    };
    window.history.pushState(null, "", window.location.href);
    window.addEventListener("popstate", blockPopState);
    return () => window.removeEventListener("popstate", blockPopState);
  }, [debateActive]);

  const currentSoundRef = useRef<any>(null);
  const forcePlayRef = useRef(false);

  const sessionStartTimeRef = useRef<number>(Date.now());
  const recordingMessagesRef = useRef<RecordedMessage[]>([]);
  const lastInterruptionRef = useRef<{ text: string; interrupterId: string } | null>(null);

  const [interruptionOverlay, setInterruptionOverlay] = useState<{
    speakerId: string;
    speakerName: string;
    text: string;
  } | null>(null);
  const interruptionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInterruptingRef = useRef(false);
  const rapidExchangeCooldownRef = useRef<number>(0);
  const isRapidExchangeRef = useRef(false);
  const isAskingUserRef = useRef(false);
  const isUserSendingRef = useRef(false);

  const [userJoined, setUserJoined] = useState(false);
  const [showJoinPrompt, setShowJoinPrompt] = useState(false);
  const [joinCountdown, setJoinCountdown] = useState(30);
  const joinTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const joinPromptShownRef = useRef(false);
  const personaMessageCountRef = useRef(0);

  const [userName, setUserName] = useState("");
  const [userCity, setUserCity] = useState("");
  const [userState, setUserState] = useState("New York");
  const [userCountry, setUserCountry] = useState("United States");
  const [showJoinForm, setShowJoinForm] = useState(false);
  const userJoinedRef = useRef(false);
  const userNameRef = useRef("");
  const userCityRef = useRef("");
  const userStateRef = useRef("");
  const userCountryRef = useRef("");

  const [showUserInput, setShowUserInput] = useState(false);
  const [userInputText, setUserInputText] = useState("");
  const [askingPersona, setAskingPersona] = useState<string | null>(null);
  const [askQuestion, setAskQuestion] = useState("");
  const userResponseCountRef = useRef(0);

  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const recordingObjRef = useRef<Audio.Recording | null>(null);
  const mediaRecorderRef = useRef<any>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const lastRecordedAudioRef = useRef<string | null>(null);

  const wasRunningBeforeRecordRef = useRef(false);

  const resumeAfterRecording = useCallback(() => {
    if (wasRunningBeforeRecordRef.current && mountedRef.current) {
      isRunningRef.current = true;
      setIsRunning(true);
      if (scheduleNextRef.current) scheduleNextRef.current();
    }
  }, []);

  const startVoiceRecording = useCallback(async () => {
    try {
      stopAllTTS();
      wasRunningBeforeRecordRef.current = isRunningRef.current;
      if (isRunningRef.current) {
        isRunningRef.current = false;
        setIsRunning(false);
        if (conversationTimerRef.current) clearTimeout(conversationTimerRef.current);
      }
      lastRecordedAudioRef.current = null;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      if (Platform.OS === "web") {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
        audioChunksRef.current = [];
        mediaRecorder.ondataavailable = (e: any) => {
          if (e.data.size > 0) audioChunksRef.current.push(e.data);
        };
        mediaRecorder.onstop = async () => {
          stream.getTracks().forEach((t: any) => t.stop());
          const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
          const reader = new FileReader();
          const base64 = await new Promise<string>((resolve, reject) => {
            reader.onloadend = () => resolve((reader.result as string).split(",")[1]);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
          const dataUrl = `data:audio/webm;base64,${base64}`;
          lastRecordedAudioRef.current = dataUrl;
          await transcribeBase64(base64, "webm");
        };
        mediaRecorderRef.current = mediaRecorder;
        mediaRecorder.start();
        setIsRecording(true);
      } else {
        const permission = await Audio.requestPermissionsAsync();
        if (!permission.granted) {
          resumeAfterRecording();
          return;
        }
        await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
        const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
        recordingObjRef.current = recording;
        setIsRecording(true);
      }
    } catch (error) {
      console.error("Recording start error:", error);
      setIsRecording(false);
      resumeAfterRecording();
    }
  }, [resumeAfterRecording]);

  const transcribeBase64 = useCallback(async (base64: string, format: string) => {
    setIsTranscribing(true);
    try {
      const res = await globalThis.fetch(`${getApiUrl().replace(/\/$/, "")}/api/stt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audio: base64, format }),
      });
      if (!res.ok) throw new Error("STT failed");
      const data = await res.json();
      if (data.text?.trim()) {
        setUserInputText((prev) => prev ? prev + " " + data.text.trim() : data.text.trim());
      }
    } catch (err) {
      console.error("Transcription error:", err);
    } finally {
      setIsTranscribing(false);
    }
  }, []);

  const stopVoiceRecording = useCallback(async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      if (Platform.OS === "web") {
        if (mediaRecorderRef.current?.state !== "inactive") {
          mediaRecorderRef.current?.stop();
        }
        setIsRecording(false);
      } else {
        if (!recordingObjRef.current) return;
        setIsRecording(false);
        await recordingObjRef.current.stopAndUnloadAsync();
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
        const uri = recordingObjRef.current.getURI();
        recordingObjRef.current = null;
        if (!uri) return;
        lastRecordedAudioRef.current = uri;
        const encodingBase64 = FileSystem.EncodingType?.Base64 ?? "base64";
        const base64 = await FileSystem.readAsStringAsync(uri, { encoding: encodingBase64 as any });
        await transcribeBase64(base64, "m4a");
      }
      setTimeout(resumeAfterRecording, 500);
    } catch (error) {
      console.error("Recording stop error:", error);
      setIsRecording(false);
      resumeAfterRecording();
    }
  }, [transcribeBase64, resumeAfterRecording]);

  const stopAllTTS = useCallback(() => {
    ttsGenerationRef.current += 1;
    ttsQueueRef.current = [];
    isProcessingTTSRef.current = false;
    forcePlayRef.current = false;
    ttsPendingMoreRef.current = false;
    prefetchedAudioRef.current = null;
    prefetchingRef.current = false;
    const s = currentSoundRef.current;
    currentSoundRef.current = null;
    if (s) {
      try { s.stopAsync().then(() => s.unloadAsync()).catch(() => {}); } catch {}
    }
    if (Platform.OS === "web") {
      try {
        const audioEls = document.querySelectorAll("audio");
        audioEls.forEach((a) => { try { a.pause(); a.currentTime = 0; } catch {} });
      } catch {}
    }
    setIsPlayingAudio(false);
  }, []);

  const startPrefetch = useCallback((item: { text: string; personaId: string }) => {
    if (prefetchingRef.current) return;
    if (shouldSkipPersonaVoice(item.personaId)) return;
    if (prefetchedAudioRef.current && prefetchedAudioRef.current.text === item.text && prefetchedAudioRef.current.personaId === item.personaId) return;
    prefetchingRef.current = true;
    prefetchTTSAudio("/api/persona-speak", { text: item.text, personaId: item.personaId })
      .then((audioUri) => {
        prefetchedAudioRef.current = { personaId: item.personaId, text: item.text, audioUri };
        prefetchingRef.current = false;
      })
      .catch(() => { prefetchingRef.current = false; });
  }, []);

  const processTTSQueue = useCallback(async () => {
    if (isProcessingTTSRef.current || ttsQueueRef.current.length === 0) return;
    isProcessingTTSRef.current = true;
    const myGeneration = ttsGenerationRef.current;
    if (mountedRef.current) {
      setIsPlayingAudio(true);
      if (!firstAudioPlayedRef.current) { firstAudioPlayedRef.current = true; setFirstAudioPlayed(true); }
    }
    while (ttsQueueRef.current.length > 0) {
      if (myGeneration !== ttsGenerationRef.current) break;
      if (!forcePlayRef.current && sessionEndedRef.current) break;
      if (!forcePlayRef.current && !voiceEnabledRef.current) break;
      const item = ttsQueueRef.current.shift();
      if (!item || !mountedRef.current) break;
      if (shouldSkipPersonaVoice(item.personaId)) {
        // Skip this turn entirely so a muted persona still yields the floor.
        continue;
      }
      if (mountedRef.current) {
        setTtsActiveSpeaker(item.personaId);
      }
      try {
        let sound: Audio.Sound;
        const personaVolume = getPersonaVoiceVolume(item.personaId);
        const cached = prefetchedAudioRef.current;
        if (cached && cached.text === item.text && cached.personaId === item.personaId) {
          prefetchedAudioRef.current = null;
          sound = await playPrefetchedAudio(cached.audioUri, { volume: personaVolume });
        } else {
          sound = await playTTS("/api/persona-speak", { text: item.text, personaId: item.personaId }, { volume: personaVolume });
        }
        currentSoundRef.current = sound;

        const nextItem = ttsQueueRef.current[0];
        if (nextItem) startPrefetch(nextItem);

        const OVERLAP_MS = 500;
        const isTrumpSpeaking = item.personaId === "trump";
        await new Promise<void>((resolve) => {
          let resolved = false;
          let earlyResolved = false;
          let prefetchStarted = !!nextItem;
          const fullCleanup = () => {
            sound.setOnPlaybackStatusUpdate(null);
            sound.getStatusAsync().then((st: any) => { if (st.isLoaded) sound.unloadAsync().catch(() => {}); }).catch(() => {});
            if (currentSoundRef.current === sound) currentSoundRef.current = null;
          };
          const earlyResolve = () => {
            if (earlyResolved || resolved) return;
            earlyResolved = true;
            resolve();
          };
          const finish = () => {
            if (resolved) return;
            resolved = true;
            if (!earlyResolved) resolve();
            fullCleanup();
          };
          sound.setOnPlaybackStatusUpdate((status: any) => {
            if (status.didJustFinish || status.error) {
              finish();
              return;
            }
            if (status.isPlaying && status.durationMillis && status.positionMillis) {
              if (!prefetchStarted && (ttsQueueRef.current.length > 0 || ttsPendingMoreRef.current)) {
                prefetchStarted = true;
                const ni = ttsQueueRef.current[0];
                if (ni) startPrefetch(ni);
              }
              // Only early-resolve for a DIFFERENT next speaker — never self-interrupt
              const nextQueuedItem = ttsQueueRef.current[0];
              const nextIsDifferentSpeaker = nextQueuedItem && nextQueuedItem.personaId !== item.personaId;
              if (!isTrumpSpeaking && !earlyResolved && nextIsDifferentSpeaker) {
                const remaining = status.durationMillis - status.positionMillis;
                if (remaining <= OVERLAP_MS && remaining > 0) {
                  earlyResolve();
                }
              }
            }
          });
          setTimeout(finish, 60000);
        });
      } catch (e) {
        console.warn("Arena TTS playback error for", item.personaId, ":", e);
      }
    }
    const hasMoreItems = ttsQueueRef.current.length > 0;
    if (myGeneration === ttsGenerationRef.current) {
      isProcessingTTSRef.current = false;
    }
    if (!hasMoreItems) {
      forcePlayRef.current = false;
    }
    currentSoundRef.current = null;
    if (mountedRef.current && !hasMoreItems) {
      setIsPlayingAudio(false);
      setTtsActiveSpeaker(null);
    }
    if (hasMoreItems && forcePlayRef.current) {
      processTTSQueue();
    } else if (hasMoreItems && !forcePlayRef.current) {
      ttsQueueRef.current = [];
    }
  }, [startPrefetch]);

  const queueTTS = useCallback((text: string, personaId: string, force?: boolean) => {
    if (!force && sessionEndedRef.current) return;
    if (!force && !voiceEnabledRef.current) return;
    if (force) forcePlayRef.current = true;
    ttsQueueRef.current.push({ text, personaId });
    processTTSQueue();
  }, [processTTSQueue]);

  const playInterruptionAudio = useCallback(async (text: string, personaId: string) => {
    if (!voiceEnabledRef.current) return;
    if (shouldSkipPersonaVoice(personaId)) return;

    // Duck the current speaker's audio so the interrupt cuts through mid-sentence
    const mainSound = currentSoundRef.current;
    if (mainSound) {
      try { mainSound.setVolumeAsync(0.10).catch(() => {}); } catch {}
    }

    if (mountedRef.current) {
      setTtsActiveSpeaker(personaId);
    }
    try {
      const sound = await playTTS("/api/persona-speak", { text, personaId }, { volume: getPersonaVoiceVolume(personaId) });
      let cleaned = false;
      const cleanup = () => {
        if (cleaned) return;
        cleaned = true;
        sound.setOnPlaybackStatusUpdate(null);
        sound.getStatusAsync().then((st: any) => {
          if (st.isLoaded) sound.stopAsync().then(() => sound.unloadAsync()).catch(() => {});
        }).catch(() => {});
        // Restore main speaker volume after interrupt finishes
        const ms = currentSoundRef.current;
        if (ms) { try { ms.setVolumeAsync(1.0).catch(() => {}); } catch {} }
        if (mountedRef.current) {
          setTtsActiveSpeaker(null);
        }
      };
      sound.setOnPlaybackStatusUpdate((status: any) => {
        if (status.didJustFinish || status.error) cleanup();
      });
      setTimeout(cleanup, 5000);
    } catch {
      // Restore volume even on error
      const ms = currentSoundRef.current;
      if (ms) { try { ms.setVolumeAsync(1.0).catch(() => {}); } catch {} }
    }
  }, []);

  // ── ARENA FIREBACK ENGINE ─────────────────────────────────────────────────
  // When a persona's message crosses the insult threshold, this picks the most
  // provoked other persona in the room and fires a concurrent AI comeback —
  // ducking the current speaker and playing the retort at full volume.
  const tryArenaFireback = useCallback(async (
    attackerId: string,
    attackText: string,
    severity: number,
  ) => {
    if (!mountedRef.current || sessionEndedRef.current || !deviceId) return;
    const activePersonas = selectedPersonasRef.current;
    if (activePersonas.length < 2) return;

    // In squabble cooldown — block for 90 s after an escalation
    if (Date.now() < arenaSquabbleCooldownUntilRef.current) return;
    const now = Date.now();
    // Minimum 7 s gap between consecutive firebacks
    if (now - arenaLastFirebackAtRef.current < 7000) return;
    // Decay chain after 30 s of calm
    if (now - arenaLastFirebackAtRef.current > 30000) arenaFirebackChainRef.current = 0;

    // Sort candidates by hostility toward the attacker (lowest sentiment = most provoked)
    const candidates = activePersonas
      .filter((id) => id !== attackerId)
      .map((id) => {
        const persona = getPersona(id);
        const rel = persona?.relationships?.[attackerId];
        const hostility = rel !== undefined ? (100 - rel.sentiment) : 50;
        return { id, hostility };
      })
      .sort((a, b) => b.hostility - a.hostility + (Math.random() - 0.5) * 15);

    // Scale aggression to the current debate mode
    const currentDebateMode = debateModeRef.current;

    for (const { id: targetId } of candidates) {
      const base = getArenaAggression(targetId);

      // Civil: firebacks almost never happen; Savage: hair-trigger; Elevated: unchanged
      let aggression: number;
      let angerThresh: number;
      if (currentDebateMode === "civil") {
        // Disable firebacks entirely in Civil mode
        continue;
      } else if (currentDebateMode === "savage") {
        aggression = Math.min(1, base.aggression * 1.4);
        angerThresh = Math.max(1, base.angerThresh - 1);
      } else {
        // "elevated" — default behaviour
        aggression = base.aggression;
        angerThresh = base.angerThresh;
      }
      const maxChain = base.maxChain;

      arenaHeatRef.current[targetId] = (arenaHeatRef.current[targetId] ?? 0) + severity;
      setPersonaHeat((prev) => ({ ...prev, [targetId]: arenaHeatRef.current[targetId] }));
      if (arenaHeatRef.current[targetId] < angerThresh) continue;

      // ── SQUABBLE ESCALATION: chain maxed → physical threat + cooldown ──
      if (arenaFirebackChainRef.current >= maxChain) {
        arenaHeatRef.current[targetId] = 0;
        setPersonaHeat((prev) => ({ ...prev, [targetId]: 0 }));
        arenaLastFirebackAtRef.current = now;
        arenaSquabbleCooldownUntilRef.current = now + 90000;
        arenaFirebackChainRef.current = 0;
        const targetPersona = getPersona(targetId);
        const threats = ARENA_SQUABBLE_THREATS[targetId] ?? ARENA_SQUABBLE_THREATS["_default"];
        const threatLine = threats[Math.floor(Math.random() * threats.length)];
        addMessageRef.current?.({
          id: `sq-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          speakerId: targetId,
          speakerName: targetPersona?.name || targetId,
          text: threatLine,
          timestamp: Date.now(),
        });
        await new Promise<void>((r) => setTimeout(r, 50));
        await playInterruptionAudio(threatLine, targetId);
        // Squabble escalation — hard spike the room temperature
        setRoomTemperature((prev) => {
          const next = Math.min(100, prev + 25);
          roomTempRef.current = next;
          return next;
        });
        return;
      }

      if (Math.random() > aggression) {
        // Failed probability check — still clear heat so it builds fresh next time
        arenaHeatRef.current[targetId] = 0;
        setPersonaHeat((prev) => ({ ...prev, [targetId]: 0 }));
        continue;
      }

      // ── Commit: generate and play the fireback ──
      arenaHeatRef.current[targetId] = 0;
      setPersonaHeat((prev) => ({ ...prev, [targetId]: 0 }));
      arenaFirebackChainRef.current += 1;
      arenaLastFirebackAtRef.current = now;

      try {
        const targetPersona = getPersona(targetId);
        const res = await fetch(new URL("/api/arena/interview-answer", getApiUrl()).toString(), {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-device-id": deviceId },
          body: JSON.stringify({
            interviewerId: attackerId,
            intervieweeId: targetId,
            topic: currentTopicRef.current,
            conversationHistory: messagesRef.current.filter((m) => !m.isSystem).slice(-4),
            lastQuestion: attackText,
            isInterruption: true,
            insultFireback: true,
            insultSeverity: severity,
            isDebate: true,
          }),
        });
        if (!res.ok || !mountedRef.current || sessionEndedRef.current) return;
        const data = await res.json();
        const firebackText: string = (data.text || data.response || "").trim();
        if (!firebackText) return;

        addMessageRef.current?.({
          id: `fb-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          speakerId: targetId,
          speakerName: targetPersona?.name || targetId,
          text: firebackText,
          timestamp: Date.now(),
        });
        await new Promise<void>((r) => setTimeout(r, 50));
        await playInterruptionAudio(firebackText, targetId);
        // Fireback — spike room temperature by 10–15 points
        const firebackTempBoost = 10 + Math.floor(Math.random() * 6); // 10–15
        setRoomTemperature((prev) => {
          const next = Math.min(100, prev + firebackTempBoost);
          roomTempRef.current = next;
          return next;
        });

        // Chain: if the fireback itself was insulting the original attacker may respond
        const retalSeverity = detectArenaInsult(firebackText);
        if (retalSeverity >= 2 && mountedRef.current && !sessionEndedRef.current) {
          setTimeout(() => {
            tryArenaFirebackRef.current?.(targetId, firebackText, retalSeverity);
          }, 2000);
        } else {
          setTimeout(() => {
            arenaFirebackChainRef.current = Math.max(0, arenaFirebackChainRef.current - 1);
          }, 18000);
        }
      } catch { /* never break the arena loop */ }
      return; // only one fireback persona per message
    }
  }, [deviceId, playInterruptionAudio]);

  // Keep ref in sync so recursive chain calls always use the latest closure
  useEffect(() => { tryArenaFirebackRef.current = tryArenaFireback; }, [tryArenaFireback]);
  // ─────────────────────────────────────────────────────────────────────────

  const fetchTopics = useCallback(async (category?: string) => {
    try {
      const cat = category || "politics";
      const url = new URL("/api/arena/topics", getApiUrl());
      url.searchParams.set("category", cat);
      const res = await fetch(url.toString());
      if (res.ok) {
        const data = await res.json();
        if (data.topics?.length > 0) {
          setDynamicTopics(data.topics);
          setSelectedTopicId(null);
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
        setFreeRemaining(data.freeRemaining ?? 5);
        setHasSession(data.hasSession ?? false);
        if (data.sessionExpiresAt) setSessionExpiresAt(data.sessionExpiresAt);
      }
    } catch {}
  }, [deviceId]);

  const unlockSession = useCallback(async (continueMode = false) => {
    if (!deviceId) return;
    setIsUnlocking(true);
    try {
      const res = await fetch(new URL("/api/arena/access", getApiUrl()).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-device-id": deviceId },
        body: JSON.stringify({ duration: selectedDuration }),
      });
      const data = await res.json();
      if (res.ok && data.granted) {
        setHasSession(true);
        setSessionExpiresAt(data.expiresAt);
        setShowPaywall(false);
        setShowContinuePrompt(false);
        setShowEndSummary(false);
        if (!continueMode) {
          setPersonaPoints({});
          setAwardedMessages(new Set());
          setTrumpRoastText("");
          setIsLoadingRoast(false);
          firstAudioPlayedRef.current = false;
          setFirstAudioPlayed(false);
        }
        setShowScoreboard(false);
        refreshBalance();
        const mins = data.durationMinutes || selectedDuration;
        if (showPreDebateSetup && !continueMode) {
          if (useCustomTopicRef.current && customTopicTextRef.current.trim()) {
            const t = customTopicTextRef.current.trim();
            setCurrentTopic(t);
            currentTopicRef.current = t;
          } else if (selectedTopicIdRef.current) {
            const found = dynamicTopics.find((t) => t.id === selectedTopicIdRef.current);
            if (found) {
              setCurrentTopic(found.title);
              currentTopicRef.current = found.title;
            }
          }
          setShowPreDebateSetup(false);
          setShowIntro(true);
        } else {
          sessionEndedRef.current = false;
          isInterruptingRef.current = false;
          currentSpeakerRef.current = null;
          setCurrentSpeaker(null);
          firstAudioPlayedRef.current = false;
          setFirstAudioPlayed(false);
          setIsRunning(true);
          isRunningRef.current = true;
          addSystemMessage(continueMode ? `Session extended! ${mins} more minutes — scores carry over. Keep going!` : `Session unlocked! ${mins} minutes of unlimited access.`);
          setTimeout(() => { if (mountedRef.current && scheduleNextRef.current) scheduleNextRef.current(); }, 1000);
        }
      } else if (data.error === "insufficient_tokens") {
        setShowContinuePrompt(false);
        setShowPaywall(true);
        addSystemMessage("Not enough tokens. Visit the store to get more!");
      } else {
        setShowContinuePrompt(false);
        setShowPaywall(true);
      }
    } catch {
      setShowContinuePrompt(false);
      setShowPaywall(true);
    }
    setIsUnlocking(false);
  }, [deviceId, refreshBalance, selectedDuration, showPreDebateSetup, dynamicTopics]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    if (showPaywall) {
      timer = setTimeout(() => {
        setPaywallSpeechPaused(true);
        paywallPulse.value = withRepeat(
          withSequence(withTiming(1.25, { duration: 600 }), withTiming(1.0, { duration: 600 })),
          -1,
          false
        );
      }, 2000);
    } else {
      setPaywallSpeechPaused(false);
      paywallPulse.value = 1;
    }
    return () => { if (timer) clearTimeout(timer); };
  }, [showPaywall]);

  const paywallPulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: paywallPulse.value }],
    opacity: paywallPulse.value > 1.1 ? 1 : 0.7,
  }));

  const heatSpikeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heatSpike.value }],
  }));

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
    restoreSavedSession().then((restored) => {
      if (!restored) {
        fetchTopics().then(() => {
          if (!currentTopicRef.current && FALLBACK_TOPICS.length > 0) {
            const fallbackTitle = FALLBACK_TOPICS[0].title;
            setCurrentTopic(fallbackTitle);
            currentTopicRef.current = fallbackTitle;
          }
        });
      }
    });
    checkArenaStatus();
    getArenaMemoryContext("", []).then((ctx) => {
      arenaMemoryContextRef.current = ctx;
    }).catch(() => {});
    loadArenaUserInfo().then((info) => {
      if (info && info.name) {
        setUserName(info.name);
        setUserCity(info.city || "");
        setUserState(info.state || "New York");
        setUserCountry(info.country || "United States");
        getArenaUserContext().then((ctx) => {
          if (ctx) arenaUserContextRef.current = ctx.summary;
        }).catch(() => {});
      }
    }).catch(() => {});
    const topicRefresh = setInterval(fetchTopics, 3 * 60 * 1000);
    fetch(new URL("/api/arena/iq-alltime", getApiUrl()).toString())
      .then((r) => r.ok ? r.json() : {})
      .then((data: Record<string, number>) => {
        alltimeIQRef.current = data;
      })
      .catch(() => {});
    return () => clearInterval(topicRefresh);
  }, [fetchTopics, checkArenaStatus, restoreSavedSession]);

  useEffect(() => {
    if (!hasSession || !sessionExpiresAt) { setSessionTimer(0); return; }
    const tick = setInterval(() => {
      const remaining = Math.max(0, Math.floor((sessionExpiresAt - Date.now()) / 1000));
      setSessionTimer(remaining);
      if (remaining <= 0) {
        setHasSession(false);
        setSessionExpiresAt(null);
        clearInterval(tick);
        setIsRunning(false);
        isRunningRef.current = false;
        sessionEndedRef.current = true;
        isInterruptingRef.current = false;
        if (breakingNewsTimerRef.current) { clearInterval(breakingNewsTimerRef.current); breakingNewsTimerRef.current = null; }
        setBreakingNewsBanner(null);
        breakingNewsBannerRef.current = null;
        stopAllTTS();
        setCurrentSpeaker(null);
        currentSpeakerRef.current = null;
        setTtsActiveSpeaker(null);
        if (conversationTimerRef.current) clearTimeout(conversationTimerRef.current);
        conversationTimerRef.current = null;
        playBellSound();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        addSystemMessage("TIME'S UP! The bell has rung! Continue the debate or end the session.");
        const activeIds = selectedPersonasRef.current;
        if (activeIds.length > 0) {
          const sessions: Record<string, number> = {};
          for (const pid of activeIds) { sessions[pid] = personaSessionIQRef.current[pid] ?? 100; }
          fetch(new URL("/api/arena/iq-alltime", getApiUrl()).toString(), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessions }),
          }).then((r) => r.ok ? r.json() : {}).then((data: Record<string, number>) => {
            if (Object.keys(data).length > 0) alltimeIQRef.current = { ...alltimeIQRef.current, ...data };
          }).catch(() => {});
        }
        (async () => {
          try {
            const sessionMins = Math.max(1, Math.round((Date.now() - (sessionExpiresAt - (hasSession ? sessionTimer * 1000 : 0))) / 60000));
            const headers: Record<string, string> = { "Content-Type": "application/json" };
            if (deviceId) headers["x-device-id"] = deviceId;
            const trackRes = await fetch(new URL("/api/arena/track-usage", getApiUrl()).toString(), {
              method: "POST",
              headers,
              body: JSON.stringify({ minutesSpent: sessionMins, userName: userNameRef.current || "Anonymous" }),
            });
            if (trackRes.ok) {
              const trackData = await trackRes.json();
              if (trackData.reward) {
                setTimeout(() => {
                  addSystemMessage(`🏆 REWARD UNLOCKED: "${trackData.reward.badge}" — You earned ${trackData.reward.tokens} FREE tokens for ${trackData.reward.totalMinutes} minutes in the Arena!`);
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  playCrowdCheer();
                  refreshBalance();
                  setTokenWinAmount(trackData.reward.tokens);
                  setTokenWinSource(`Arena ${trackData.reward.badge} Reward`);
                  setTokenWinVisible(true);
                }, 3000);
              }
            }
          } catch {}
          // Resolve IQ Race bet
          try {
            const savedBet = await getArenaBet();
            if (savedBet && savedBet.sessionKey === makeArenaSessionKey(selectedPersonasRef.current)) {
              const iqSnap = personaSessionIQRef.current;
              const { won, lowestId, lowestIQ } = resolveIQRaceBet(savedBet.targetPersonaId, iqSnap);
              const payout = won ? Math.round(savedBet.wager * 2.5) : 0;
              if (won && deviceId) {
                await awardBetWin(deviceId, payout, `IQ Race bet win`);
                await refreshBalance();
              }
              await clearArenaBet();
              setArenaBet(null);
              setBetResult({ won, payout, lowestId });
              const targetName = getPersona(savedBet.targetPersonaId)?.shortName || savedBet.targetPersonaId;
              const lowestName = getPersona(lowestId)?.shortName || lowestId;
              if (won) {
                setTimeout(() => { addSystemMessage(`🎰 BET WON: ${targetName} had the lowest IQ — +${payout} tokens!`); }, 1500);
              } else {
                setTimeout(() => { addSystemMessage(`🎰 BET LOST. Lowest IQ: ${lowestName} (${Math.round(lowestIQ)}). Better luck next time.`); }, 1500);
              }
            }
          } catch {}
          // Track arena win for premium persona challenge
          if (deviceId) {
            const newlyUnlocked = await addArenaWin();
            if (newlyUnlocked.length > 0) {
              setTimeout(() => {
                addSystemMessage(`🔓 PERSONA UNLOCKED: ${newlyUnlocked.map(id => PREMIUM_PERSONA_CONFIGS[id]?.name || id).join(", ")} is now available in your debater roster!`);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }, 2500);
            }
          }
        })();
        setTimeout(() => {
          setShowContinuePrompt(true);
        }, 1500);
      }
    }, 1000);
    return () => clearInterval(tick);
  }, [hasSession, sessionExpiresAt]);

  const saveCurrentSession = useCallback(async (topicName?: string) => {
    const msgs = recordingMessagesRef.current;
    if (msgs.length < 3) return;
    const topic = topicName || currentTopicRef.current || "Arena Debate";
    const duration = msgs.length > 0
      ? (msgs[msgs.length - 1].relativeTime) / 1000
      : TOPIC_DURATION;
    const rec: ArenaRecording = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 6),
      topic,
      startTime: sessionStartTimeRef.current,
      duration: Math.max(duration, 1),
      personas: selectedPersonasRef.current,
      messages: [...msgs],
      messageCount: msgs.filter((m) => !m.isSystem).length,
      highlightQuote: pickHighlightQuote(msgs),
    };
    await saveRecording(rec);
  }, []);

  const shareCurrentSession = useCallback(async () => {
    const msgs = recordingMessagesRef.current;
    if (msgs.length < 2) return;
    const topic = currentTopicRef.current || "Arena Debate";
    const duration = msgs.length > 0 ? (msgs[msgs.length - 1].relativeTime) / 1000 : 0;
    const rec: ArenaRecording = {
      id: "live",
      topic,
      startTime: sessionStartTimeRef.current,
      duration,
      personas: selectedPersonasRef.current,
      messages: [...msgs],
      messageCount: msgs.filter((m) => !m.isSystem).length,
    };
    const text = generateShareText(rec);
    try { await Share.share({ message: text }); } catch {}
  }, []);

  const showInterruptionBanner = useCallback((speakerId: string, speakerName: string, text: string) => {
    if (interruptionTimerRef.current) clearTimeout(interruptionTimerRef.current);
    setInterruptionOverlay({ speakerId, speakerName, text });
    interruptionTimerRef.current = setTimeout(() => {
      setInterruptionOverlay(null);
    }, 10000);
  }, []);

  useEffect(() => {
    if (!currentTopic) { setTopicTimer(0); return; }
    setTopicTimer(TOPIC_DURATION);
    sessionStartTimeRef.current = Date.now();
    recordingMessagesRef.current = [];
    if (topicTimerRef.current) clearInterval(topicTimerRef.current);
    topicTimerRef.current = setInterval(() => {
      setTopicTimer((prev) => {
        if (prev <= 1) {
          if (topicTimerRef.current) clearInterval(topicTimerRef.current);
          saveCurrentSession(currentTopicRef.current || undefined);
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
  }, [currentTopic, dynamicTopics, saveCurrentSession]);

  // ── LIE DETECTOR HELPERS (use the same /api/arena/interview-* endpoints as the 1-on-1 screen)
  const triggerLieFlash = useCallback(() => {
    setLieFlashOn(true);
    setTimeout(() => setLieFlashOn(false), 450);
  }, []);

  const playLieAlert = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    if (Platform.OS === "web") return;
    (async () => {
      try {
        const { sound } = await Audio.Sound.createAsync(
          require("@/assets/sfx-click.mp4"),
          { shouldPlay: true, volume: 0.9 },
        );
        sound.setOnPlaybackStatusUpdate((st: any) => {
          if (st?.didJustFinish) sound.unloadAsync().catch(() => {});
        });
      } catch {}
    })();
  }, []);

  const runFactCheck = useCallback((msg: ConversationMessage) => {
    if (!deviceId) return;
    if (msg.isSystem || msg.speakerId === "user") return;
    if (!msg.text || msg.text.length < 25) return;
    fetch(new URL("/api/arena/interview-factcheck", getApiUrl()).toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-device-id": deviceId },
      body: JSON.stringify({ intervieweeId: msg.speakerId, text: msg.text, topic: currentTopicRef.current }),
    })
      .then((r) => r.ok ? r.json() : null)
      .then((data: any) => {
        if (!data) return;
        const score = Math.max(0, Math.min(100, Number(data.score) || 70));
        setLatestTruthScore(score);
        if (score < 40 || data.isLie) {
          adjustPersonaIQ(msg.speakerId, -8);
          sessionLieTallyRef.current = { ...sessionLieTallyRef.current, [msg.speakerId]: (sessionLieTallyRef.current[msg.speakerId] || 0) + 1 };
          setLieCount((c) => c + 1);
          setLies((prev) => [...prev, {
            id: `lie-${msg.id}`,
            speakerId: msg.speakerId,
            speakerName: msg.speakerName,
            text: msg.text,
            score,
            reason: String(data.reason || ""),
            fact: String(data.fact || ""),
            ts: Date.now(),
          }]);
          triggerLieFlash();
          playLieAlert();
          if (data.moderatorLine) {
            addMessage({
              id: `mod-correction-${msg.id}`,
              speakerId: "moderator",
              speakerName: "🎤 MODERATOR",
              text: data.moderatorLine,
              timestamp: Date.now(),
              isSystem: true,
            });
          }
        } else if (score >= 40 && score < 70) {
          sessionAltFactTallyRef.current = { ...sessionAltFactTallyRef.current, [msg.speakerId]: (sessionAltFactTallyRef.current[msg.speakerId] || 0) + 1 };
          setAltFactCount((c) => c + 1);
          setPersonaAltTruths((prev) => ({ ...prev, [msg.speakerId]: (prev[msg.speakerId] || 0) + 1 }));
          if (score >= 60) {
            adjustPersonaIQ(msg.speakerId, 2);
          }
        } else if (score >= 80) {
          adjustPersonaIQ(msg.speakerId, 5);
        } else {
          adjustPersonaIQ(msg.speakerId, 2);
        }
      })
      .catch(() => {});
  }, [deviceId, triggerLieFlash, playLieAlert, adjustPersonaIQ]);

  const flagMessageAsLie = useCallback((msg: ConversationMessage) => {
    if (!deviceId) return;
    if (flaggedMsgIds.has(msg.id) || flagPendingRef.current.has(msg.id)) return;
    if (!msg.text || msg.text.trim().length < 4) return;
    flagPendingRef.current.add(msg.id);
    setFlaggedMsgIds((prev) => {
      const next = new Set(prev);
      next.add(msg.id);
      return next;
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

    const lieId = `userlie-${msg.id}`;
    const placeholder: LieEntry = {
      id: lieId,
      speakerId: msg.speakerId,
      speakerName: msg.speakerName,
      text: msg.text,
      score: 50,
      reason: "Scoring viewer report…",
      fact: "",
      ts: Date.now(),
      userFlagged: true,
      pending: true,
    };
    setLies((prev) => prev.some((l) => l.id === lieId) ? prev : [...prev, placeholder]);
    setLieCount((c) => c + 1);

    fetch(new URL("/api/arena/interview-flag-lie", getApiUrl()).toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-device-id": deviceId },
      body: JSON.stringify({ speakerId: msg.speakerId, text: msg.text, topic: currentTopicRef.current }),
    })
      .then(async (r) => {
        if (r.ok) return r.json();
        let body: any = {};
        try { body = await r.json(); } catch {}
        const err: any = new Error(body?.error || "flag failed");
        err.status = r.status;
        err.code = body?.error;
        err.message_text = body?.message;
        throw err;
      })
      .then((data: any) => {
        const score = Math.max(0, Math.min(100, Number(data?.score) || 50));
        setLies((prev) => prev.map((l) => l.id === lieId ? {
          ...l,
          score,
          reason: String(data?.reason || ""),
          fact: String(data?.fact || ""),
          pending: false,
        } : l));
        setLatestTruthScore(score);
        if (score < 40) {
          adjustPersonaIQ(msg.speakerId, -4);
          sessionLieTallyRef.current = { ...sessionLieTallyRef.current, [msg.speakerId]: (sessionLieTallyRef.current[msg.speakerId] || 0) + 1 };
          triggerLieFlash();
          playLieAlert();
        }
      })
      .catch((err: any) => {
        setLies((prev) => prev.filter((l) => l.id !== lieId));
        setLieCount((c) => Math.max(0, c - 1));
        setFlaggedMsgIds((prev) => {
          const next = new Set(prev);
          next.delete(msg.id);
          return next;
        });
        const code = err?.code;
        if (code === "duplicate") {
          Alert.alert("Already flagged", err?.message_text || "You already flagged that quote.");
        } else if (code === "rate_limited") {
          Alert.alert("Slow down", err?.message_text || "You're flagging too fast. Try again in a moment.");
        } else if (code === "session_limit") {
          Alert.alert("Flag limit reached", err?.message_text || "You've hit the flag limit for this session.");
        } else {
          Alert.alert("Couldn't flag", "We couldn't reach the fact-checker. Try again in a moment.");
        }
      })
      .finally(() => { flagPendingRef.current.delete(msg.id); });
  }, [deviceId, flaggedMsgIds, triggerLieFlash, playLieAlert, adjustPersonaIQ]);

  const submitLieVote = useCallback((lie: LieEntry, direction: 1 | -1) => {
    if (!deviceId) return;
    if (lieVotesPendingRef.current.has(lie.id)) return;
    lieVotesPendingRef.current.add(lie.id);
    const current = lieVotes[lie.id] || { up: 0, down: 0, myVote: 0 };
    const nextVote: 1 | -1 | 0 = current.myVote === direction ? 0 : direction;
    let optimistic = { ...current };
    if (current.myVote === 1) optimistic.up = Math.max(0, optimistic.up - 1);
    if (current.myVote === -1) optimistic.down = Math.max(0, optimistic.down - 1);
    if (nextVote === 1) optimistic.up += 1;
    if (nextVote === -1) optimistic.down += 1;
    optimistic.myVote = nextVote;
    setLieVotes((prev) => ({ ...prev, [lie.id]: optimistic }));
    fetch(new URL("/api/arena/interview-lie-vote", getApiUrl()).toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-device-id": deviceId },
      body: JSON.stringify({ lieId: lie.id, vote: nextVote, intervieweeId: lie.speakerId, lieText: lie.text }),
    })
      .then((r) => r.ok ? r.json() : Promise.reject(new Error("vote failed")))
      .then((data: any) => {
        if (data && typeof data.up === "number") {
          setLieVotes((prev) => ({
            ...prev,
            [lie.id]: { up: data.up, down: data.down, myVote: data.myVote },
          }));
        }
      })
      .catch(() => {
        setLieVotes((prev) => ({ ...prev, [lie.id]: current }));
      })
      .finally(() => { lieVotesPendingRef.current.delete(lie.id); });
  }, [deviceId, lieVotes]);

  // Refresh lie tallies when sheet opens for any unscored entries
  useEffect(() => {
    if (!liesSheetOpen || !deviceId || lies.length === 0) return;
    const ids = lies.map((l) => l.id);
    fetch(new URL("/api/arena/interview-lie-votes", getApiUrl()).toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-device-id": deviceId },
      body: JSON.stringify({ ids }),
    })
      .then((r) => r.ok ? r.json() : null)
      .then((data: any) => {
        if (!data?.tallies) return;
        setLieVotes((prev) => {
          const next = { ...prev };
          for (const id of ids) {
            const t = data.tallies[id];
            if (t) next[id] = { up: t.up || 0, down: t.down || 0, myVote: t.myVote || 0 };
          }
          return next;
        });
      })
      .catch(() => {});
  }, [liesSheetOpen, deviceId, lies]);

  const addMessage = useCallback((msg: ConversationMessage) => {
    setMessages((prev) => {
      const next = [...prev, msg].slice(-50);
      messagesRef.current = next;
      return next;
    });
    if (!msg.isSystem && msg.speakerId !== "user") {
      runFactCheck(msg);
    }
    if (!msg.isSystem && msg.speakerId !== "user") {
      personaMessageCountRef.current += 1;
      if (personaMessageCountRef.current === 2 && !joinPromptShownRef.current && !userJoinedRef.current) {
        joinPromptShownRef.current = true;
        setTimeout(() => {
          setShowJoinPrompt(true);
          setJoinCountdown(30);
          if (joinTimerRef.current) clearInterval(joinTimerRef.current);
          joinTimerRef.current = setInterval(() => {
            setJoinCountdown((prev) => {
              if (prev <= 1) {
                if (joinTimerRef.current) clearInterval(joinTimerRef.current);
                setShowJoinPrompt(false);
                return 0;
              }
              return prev - 1;
            });
          }, 1000);
        }, 1500);
      }
      const isInt = msg.speakerName.includes("\u26A1") || msg.speakerName.includes("⚡") || msg.id.startsWith("interrupt-") || msg.id.startsWith("trump-interrupt-") || msg.id.startsWith("clapback-");
      recordingMessagesRef.current.push({
        id: msg.id,
        speakerId: msg.speakerId,
        speakerName: msg.speakerName,
        text: msg.text,
        timestamp: msg.timestamp,
        relativeTime: msg.timestamp - sessionStartTimeRef.current,
        isInterruption: isInt,
      });
    }
    if (msg.isSystem || msg.speakerId === "user") {
      recordingMessagesRef.current.push({
        id: msg.id,
        speakerId: msg.speakerId,
        speakerName: msg.speakerName,
        text: msg.text,
        timestamp: msg.timestamp,
        relativeTime: msg.timestamp - sessionStartTimeRef.current,
        isInterruption: false,
        audioUri: msg.audioUri,
      });
    }
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [runFactCheck]);
  useEffect(() => { addMessageRef.current = addMessage; }, [addMessage]);

  const updateEmotions = useCallback(
    (responderId: string, toSpeakerId: string) => {
      const defaultEmo: EmotionalState = { anger: 20, happiness: 50, engagement: 50, lastSpoke: null };
      setEmotionalStates((prev) => {
        const next = { ...prev };
        const responder = { ...(next[responderId] || defaultEmo) };
        responder.engagement = Math.min(100, responder.engagement + 10);
        responder.lastSpoke = Date.now();

        const persona = getPersona(responderId);
        const relationship = persona?.relationships[toSpeakerId] || { sentiment: 50 };
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
            const existing = next[id] || defaultEmo;
            next[id] = { ...existing, engagement: Math.min(100, existing.engagement + 2) };
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
      if (!mountedRef.current || sessionEndedRef.current || !deviceId) return;
      setCurrentSpeaker(responderId);
      currentSpeakerRef.current = responderId;
      ttsPendingMoreRef.current = true;

      try {
        const history = messagesRef.current
          .filter((m) => !m.isSystem)
          .slice(-6)
          .map((m) => ({ speakerName: m.speakerName, text: m.text }));

        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (deviceId) headers["x-device-id"] = deviceId;

        const bodyPayload: Record<string, any> = {
          responderId,
          toSpeakerId,
          conversationHistory: history,
          topic: currentTopicRef.current || "Current Events",
          activePersonas: selectedPersonasRef.current,
          debateMode: debateModeRef.current,
        };
        const currentWinTally = winTallyRef.current;
        if (currentWinTally.global && Object.keys(currentWinTally.global).length > 0) {
          bodyPayload.winTally = currentWinTally;
        }
        if (arenaMemoryContextRef.current) {
          bodyPayload.arenaMemoryContext = arenaMemoryContextRef.current;
        }
        if (arenaUserContextRef.current) {
          bodyPayload.arenaUserContext = arenaUserContextRef.current;
        }
        const lastInt = lastInterruptionRef.current;
        if (lastInt) {
          bodyPayload.wasInterrupted = true;
          bodyPayload.interruptionText = lastInt.text;
          bodyPayload.interrupterId = lastInt.interrupterId;
          lastInterruptionRef.current = null;
        }
        if (mcconnellFreezeRef.current && responderId !== "mcconnell") {
          bodyPayload.mcconnellJustFroze = true;
          mcconnellFreezeRef.current = false;
        }
        bodyPayload.sessionIQ = personaSessionIQRef.current;
        bodyPayload.sessionLieTally = sessionLieTallyRef.current;
        bodyPayload.sessionAltFactTally = sessionAltFactTallyRef.current;

        const res = await fetch(new URL("/api/arena/respond", getApiUrl()).toString(), {
          method: "POST",
          headers,
          body: JSON.stringify(bodyPayload),
        });

        if (res.status === 403) {
          const errCt = res.headers.get("content-type") || "";
          if (errCt.includes("application/json")) {
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
        }

        if (!res.ok || !mountedRef.current) return;
        if (sessionEndedRef.current) return;
        const ct = res.headers.get("content-type") || "";
        if (!ct.includes("application/json")) return;
        const data = await res.json();
        const persona = getPersona(responderId);

        if (data.freeRemaining !== undefined) setFreeRemaining(data.freeRemaining);
        if (data.hasSession !== undefined) setHasSession(data.hasSession);
        if (data.sessionExpiresAt) setSessionExpiresAt(data.sessionExpiresAt);

        if (data.questionTargetId && selectedPersonasRef.current.includes(data.questionTargetId)) {
          pendingResponseRef.current = data.questionTargetId;
        }

        if (data.mcconnellFroze) {
          mcconnellFreezeRef.current = true;
        }

        if (typeof data.currentIQ === "number") {
          setPersonaSessionIQ((prev) => {
            const updated = { ...prev, [responderId]: data.currentIQ };
            personaSessionIQRef.current = updated;
            return updated;
          });
        } else if (typeof data.iqDelta === "number" && data.iqDelta !== 0) {
          adjustPersonaIQ(responderId, data.iqDelta);
        }
        if (typeof data.altTruthCount === "number") {
          setPersonaAltTruths((prev) => ({ ...prev, [responderId]: data.altTruthCount }));
          sessionAltFactTallyRef.current = { ...sessionAltFactTallyRef.current, [responderId]: data.altTruthCount };
        } else if (data.altTruthIncrement) {
          setPersonaAltTruths((prev) => ({ ...prev, [responderId]: (prev[responderId] || 0) + 1 }));
          sessionAltFactTallyRef.current = { ...sessionAltFactTallyRef.current, [responderId]: (sessionAltFactTallyRef.current[responderId] || 0) + 1 };
        }

        if (sessionEndedRef.current) return;

        addMessage({
          id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
          speakerId: responderId,
          speakerName: persona?.name || responderId,
          text: data.response,
          timestamp: Date.now(),
        });

        updateEmotions(responderId, toSpeakerId);
        if (!sessionEndedRef.current) {
          if (isProcessingTTSRef.current && !prefetchingRef.current && !prefetchedAudioRef.current) {
            startPrefetch({ text: data.response, personaId: responderId });
          }
          queueTTS(data.response, responderId);
        }
        ttsPendingMoreRef.current = false;

        // ── Fireback trigger: check if this message provokes another persona ──
        if (data.response && !sessionEndedRef.current) {
          const fbSeverity = detectArenaInsult(data.response);
          if (fbSeverity >= 1) {
            // Small delay so the main speaker's TTS gets queued first
            setTimeout(() => {
              tryArenaFirebackRef.current?.(responderId, data.response, fbSeverity);
            }, 1200);
          }
        }
        // ────────────────────────────────────────────────────────────────────

        if (data.response && data.response.length > 30) {
          recordArenaMoment(responderId, toSpeakerId, data.response, currentTopicRef.current || "debate").catch(() => {});
          arenaMessageCountRef.current = (arenaMessageCountRef.current || 0) + 1;
          if (arenaMessageCountRef.current % 10 === 0) {
            getArenaMemoryContext("", selectedPersonasRef.current).then((ctx) => {
              arenaMemoryContextRef.current = ctx;
            }).catch(() => {});
          }
        }
      } catch (err) {
        console.warn("Arena AI error:", err);
        ttsPendingMoreRef.current = false;
      } finally {
        if (mountedRef.current) {
          setCurrentSpeaker(null);
          currentSpeakerRef.current = null;
        }
      }
    },
    [addMessage, updateEmotions, deviceId, queueTTS, startPrefetch]
  );

  const triggerInterruption = useCallback(async (trumpMessageText: string, prefetchedInterrupter?: string, prefetchedData?: any) => {
    if (!mountedRef.current) return;

    let interrupter: string;
    let data: any;

    if (prefetchedInterrupter && prefetchedData) {
      // Fast path — caller pre-fetched the response in parallel with generateAIResponse.
      // isInterruptingRef is already set true by the caller; no extra delay needed.
      interrupter = prefetchedInterrupter;
      data = prefetchedData;
    } else {
      // Fallback path — fetch on-demand (used when called without prefetch).
      if (isInterruptingRef.current) return;
      isInterruptingRef.current = true;
      const active = selectedPersonasRef.current;
      const availableInterrupters = INTERRUPTERS.filter((id) => active.includes(id) && id !== currentSpeakerRef.current);
      if (availableInterrupters.length === 0) { isInterruptingRef.current = false; return; }
      interrupter = availableInterrupters[Math.floor(Math.random() * availableInterrupters.length)];
      await new Promise((r) => setTimeout(r, 300));
      if (!mountedRef.current || !isRunningRef.current) { isInterruptingRef.current = false; return; }
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
            sessionIQ: personaSessionIQRef.current,
            sessionLieTally: sessionLieTallyRef.current,
            sessionAltFactTally: sessionAltFactTallyRef.current,
          }),
        });
        if (!res.ok || !mountedRef.current) { isInterruptingRef.current = false; return; }
        data = await res.json();
      } catch { isInterruptingRef.current = false; return; }
    }

    try {
      const persona = getPersona(interrupter);
      const interruptMsg: ConversationMessage = {
        id: "interrupt-" + Date.now() + Math.random().toString(36).substr(2, 5),
        speakerId: interrupter,
        speakerName: `⚡ ${persona.name}`,
        text: data.response,
        timestamp: Date.now(),
      };

      // Wait until the main speaker is ~40% through before cutting in.
      // With prefetch this check now actually fires mid-sentence instead of at the end.
      const mainSound = currentSoundRef.current;
      if (mainSound) {
        try {
          const st = await mainSound.getStatusAsync();
          if (st.isLoaded && (st as any).isPlaying && (st as any).durationMillis && (st as any).positionMillis) {
            const pct = (st as any).positionMillis / (st as any).durationMillis;
            if (pct < 0.35) {
              const waitMs = Math.max(0, (st as any).durationMillis * 0.40 - (st as any).positionMillis);
              await new Promise((r) => setTimeout(r, waitMs));
            }
          }
        } catch {}
      }

      if (!mountedRef.current || !isRunningRef.current) return;

      addMessage(interruptMsg);
      showInterruptionBanner(interrupter, persona.name, data.response);
      lastInterruptionRef.current = { text: data.response, interrupterId: interrupter };
      playInterruptionAudio(data.response, interrupter);
      if (typeof data.currentIQ === "number") {
        setPersonaSessionIQ((prev) => { const u = { ...prev, [interrupter]: data.currentIQ }; personaSessionIQRef.current = u; return u; });
      } else if (typeof data.iqDelta === "number" && data.iqDelta !== 0) adjustPersonaIQ(interrupter, data.iqDelta);
      if (typeof data.altTruthCount === "number") {
        setPersonaAltTruths((prev) => ({ ...prev, [interrupter]: data.altTruthCount }));
        sessionAltFactTallyRef.current = { ...sessionAltFactTallyRef.current, [interrupter]: data.altTruthCount };
      } else if (data.altTruthIncrement) setPersonaAltTruths((prev) => ({ ...prev, [interrupter]: (prev[interrupter] || 0) + 1 }));

      await new Promise((r) => setTimeout(r, 500 + Math.random() * 500));
      if (!mountedRef.current || !isRunningRef.current) return;

      // Clapback: Trump fires back at the interrupter
      const clapHeaders: Record<string, string> = { "Content-Type": "application/json" };
      if (deviceId) clapHeaders["x-device-id"] = deviceId;
      // Use the last Trump message we have (or fall back to empty context)
      const lastTrumpMsg = messagesRef.current.filter((m) => !m.isSystem && m.speakerId === "trump").slice(-1)[0];
      const trumpCtxText = lastTrumpMsg?.text || trumpMessageText || "";
      const clap = await fetch(new URL("/api/arena/respond", getApiUrl()).toString(), {
        method: "POST",
        headers: clapHeaders,
        body: JSON.stringify({
          responderId: "trump",
          toSpeakerId: interrupter,
          conversationHistory: [
            ...(trumpCtxText ? [{ speakerName: "Donald Trump", text: trumpCtxText }] : []),
            { speakerName: persona.name, text: data.response },
          ],
          topic: currentTopicRef.current || "debate",
          isInterruption: true,
          sessionIQ: personaSessionIQRef.current,
          sessionLieTally: sessionLieTallyRef.current,
          sessionAltFactTally: sessionAltFactTallyRef.current,
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
        if (typeof clapData.currentIQ === "number") {
          setPersonaSessionIQ((prev) => { const u = { ...prev, trump: clapData.currentIQ }; personaSessionIQRef.current = u; return u; });
        } else if (typeof clapData.iqDelta === "number" && clapData.iqDelta !== 0) adjustPersonaIQ("trump", clapData.iqDelta);
        if (typeof clapData.altTruthCount === "number") {
          setPersonaAltTruths((prev) => ({ ...prev, trump: clapData.altTruthCount }));
          sessionAltFactTallyRef.current = { ...sessionAltFactTallyRef.current, trump: clapData.altTruthCount };
        } else if (clapData.altTruthIncrement) setPersonaAltTruths((prev) => ({ ...prev, trump: (prev.trump || 0) + 1 }));
        await new Promise((r) => setTimeout(r, 500));
      }
    } catch {} finally {
      isInterruptingRef.current = false;
      const newTemp = Math.min(100, roomTempRef.current + 10);
      roomTempRef.current = newTemp;
      setRoomTemperature(newTemp);
    }
  }, [deviceId, addMessage, showInterruptionBanner, playInterruptionAudio, queueTTS]);

  const triggerTrumpInterruption = useCallback(async (opponentText: string, opponentId: string) => {
    if (!mountedRef.current || isInterruptingRef.current) return;
    isInterruptingRef.current = true;
    const active = selectedPersonasRef.current;
    if (!active.includes("trump")) { isInterruptingRef.current = false; return; }

    await new Promise((r) => setTimeout(r, 600 + Math.random() * 800));
    if (!mountedRef.current || !isRunningRef.current) { isInterruptingRef.current = false; return; }

    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (deviceId) headers["x-device-id"] = deviceId;
      const opponentName = getPersona(opponentId)?.name || "someone";

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
          sessionIQ: personaSessionIQRef.current,
          sessionLieTally: sessionLieTallyRef.current,
          sessionAltFactTally: sessionAltFactTallyRef.current,
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
        showInterruptionBanner("trump", "Donald Trump", data.response);
        lastInterruptionRef.current = { text: data.response, interrupterId: "trump" };
        playInterruptionAudio(data.response, "trump");
        if (typeof data.currentIQ === "number") {
          setPersonaSessionIQ((prev) => { const u = { ...prev, trump: data.currentIQ }; personaSessionIQRef.current = u; return u; });
        } else if (typeof data.iqDelta === "number" && data.iqDelta !== 0) adjustPersonaIQ("trump", data.iqDelta);
        if (typeof data.altTruthCount === "number") {
          setPersonaAltTruths((prev) => ({ ...prev, trump: data.altTruthCount }));
          sessionAltFactTallyRef.current = { ...sessionAltFactTallyRef.current, trump: data.altTruthCount };
        } else if (data.altTruthIncrement) setPersonaAltTruths((prev) => ({ ...prev, trump: (prev.trump || 0) + 1 }));
        await new Promise((r) => setTimeout(r, 500));
      }
    } catch {} finally {
      isInterruptingRef.current = false;
      const newTemp = Math.min(100, roomTempRef.current + 15);
      roomTempRef.current = newTemp;
      setRoomTemperature(newTemp);
    }
  }, [deviceId, addMessage, showInterruptionBanner, playInterruptionAudio]);

  const triggerRapidExchange = useCallback(async (personaAId: string, personaBId: string) => {
    if (!mountedRef.current || !isRunningRef.current || sessionEndedRef.current) return;
    if (rapidExchangeCooldownRef.current > Date.now()) return;
    if (isRapidExchangeRef.current) return;
    isRapidExchangeRef.current = true;
    rapidExchangeCooldownRef.current = Date.now() + 90000;

    const nameA = getPersona(personaAId)?.name || personaAId;
    const nameB = getPersona(personaBId)?.name || personaBId;

    addMessage({
      id: "rapid-banner-" + Date.now(),
      speakerId: "system",
      speakerName: "ARENA",
      text: `🔥 RAPID FIRE: ${nameA} vs ${nameB} 🔥`,
      timestamp: Date.now(),
      isSystem: true,
    });

    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (deviceId) headers["x-device-id"] = deviceId;

      const history = messagesRef.current.filter((m) => !m.isSystem).slice(-4).map((m) => ({ speakerName: m.speakerName, text: m.text }));

      const res = await fetch(new URL("/api/arena/rapid-exchange", getApiUrl()).toString(), {
        method: "POST",
        headers,
        body: JSON.stringify({
          personaAId,
          personaBId,
          topic: currentTopicRef.current || "politics",
          conversationHistory: history,
        }),
      });

      if (!res.ok || !mountedRef.current) return;
      const data = await res.json();
      const lines: Array<{ personaId: string; text: string }> = data.lines || [];

      for (const line of lines) {
        if (!mountedRef.current || !isRunningRef.current) break;
        const persona = getPersona(line.personaId);
        if (!persona) continue;

        addMessage({
          id: "rapid-" + Date.now() + Math.random().toString(36).substr(2, 4),
          speakerId: line.personaId,
          speakerName: `⚡ ${persona.name}`,
          text: line.text,
          timestamp: Date.now(),
        });

        queueTTS(line.text, line.personaId);
        await new Promise((r) => setTimeout(r, 350));
      }

      const newTemp = Math.min(100, roomTempRef.current + 20);
      roomTempRef.current = newTemp;
      setRoomTemperature(newTemp);
    } catch {
    } finally {
      isRapidExchangeRef.current = false;
    }
  }, [deviceId, addMessage, queueTTS]);

  const handleJoinConversation = useCallback(() => {
    if (joinTimerRef.current) clearInterval(joinTimerRef.current);
    setShowJoinPrompt(true);
  }, []);

  const submitJoinForm = useCallback(async () => {
    if (!userName.trim()) return;
    setShowJoinForm(false);
    setShowJoinPrompt(false);
    if (joinTimerRef.current) clearInterval(joinTimerRef.current);
    setUserJoined(true);
    userJoinedRef.current = true;
    userNameRef.current = userName.trim();
    userCityRef.current = userCity.trim();
    userStateRef.current = userState;
    userCountryRef.current = userCountry;

    getArenaUserContext().then((ctx) => {
      if (ctx) arenaUserContextRef.current = ctx.summary;
    }).catch(() => {}).finally(() => {
      saveArenaUserInfo({
        name: userName.trim(),
        city: userCity.trim(),
        state: userState,
        country: userCountry,
        topic: currentTopicRef.current || undefined,
      }).catch(() => {});
    });

    const locationParts = [userCity.trim(), userState, userCountry].filter(Boolean);
    const locationStr = locationParts.join(", ");

    addMessage({
      id: "user-join-" + Date.now(),
      speakerId: "user",
      speakerName: userName.trim(),
      text: `${userName.trim()} from ${locationStr} has entered the arena!`,
      timestamp: Date.now(),
      isSystem: true,
    });

    const active = selectedPersonasRef.current;
    const welcomer = active[Math.floor(Math.random() * active.length)];
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (deviceId) headers["x-device-id"] = deviceId;
      const res = await fetch(new URL("/api/arena/respond", getApiUrl()).toString(), {
        method: "POST",
        headers,
        body: JSON.stringify({
          responderId: welcomer,
          toSpeakerId: "user",
          conversationHistory: [{ speakerName: "System", text: `A viewer named ${userName.trim()} from ${locationStr} just joined the conversation. Welcome them warmly by name and location. Be in character.` }],
          topic: currentTopicRef.current || "debate",
          activePersonas: active,
          isWelcome: true,
          userContext: { name: userName.trim(), location: locationStr },
          sessionIQ: personaSessionIQRef.current,
          sessionLieTally: sessionLieTallyRef.current,
          sessionAltFactTally: sessionAltFactTallyRef.current,
        }),
      });
      if (res.ok && mountedRef.current) {
        const data = await res.json();
        const persona = getPersona(welcomer);
        addMessage({
          id: "welcome-" + Date.now(),
          speakerId: welcomer,
          speakerName: persona.name,
          text: data.response,
          timestamp: Date.now(),
        });
        queueTTS(data.response, welcomer);
      }
    } catch {}
  }, [userName, userCity, userState, userCountry, deviceId, addMessage, queueTTS]);

  const submitUserResponse = useCallback(async () => {
    if (!userInputText.trim() || !askingPersona) return;
    const responseText = userInputText.trim();
    const audioUri = lastRecordedAudioRef.current;
    lastRecordedAudioRef.current = null;
    setShowUserInput(false);
    setUserInputText("");
    const askerPersona = askingPersona;
    setAskingPersona(null);
    setAskQuestion("");
    userResponseCountRef.current += 1;

    addMessage({
      id: "user-msg-" + Date.now(),
      speakerId: "user",
      speakerName: userNameRef.current || "Viewer",
      text: responseText,
      timestamp: Date.now(),
      audioUri: audioUri || undefined,
    });

    const active = selectedPersonasRef.current;
    const targeted = detectTargetPersona(responseText, active);
    const reactor = targeted || askerPersona;
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (deviceId) headers["x-device-id"] = deviceId;
      const locationParts = [userCityRef.current, userStateRef.current, userCountryRef.current].filter(Boolean);
      const res = await fetch(new URL("/api/arena/respond", getApiUrl()).toString(), {
        method: "POST",
        headers,
        body: JSON.stringify({
          responderId: reactor,
          toSpeakerId: "user",
          conversationHistory: [
            { speakerName: getPersona(askerPersona)?.name || "Someone", text: askQuestion || "What do you think?" },
            { speakerName: userNameRef.current || "Viewer", text: responseText },
          ],
          topic: currentTopicRef.current || "debate",
          activePersonas: active,
          userContext: { name: userNameRef.current, location: locationParts.join(", ") },
          sessionIQ: personaSessionIQRef.current,
          sessionLieTally: sessionLieTallyRef.current,
          sessionAltFactTally: sessionAltFactTallyRef.current,
        }),
      });
      if (res.ok && mountedRef.current) {
        const data = await res.json();
        const persona = getPersona(reactor);
        addMessage({
          id: "react-" + Date.now(),
          speakerId: reactor,
          speakerName: persona.name,
          text: data.response,
          timestamp: Date.now(),
        });
        queueTTS(data.response, reactor);
        if (typeof data.currentIQ === "number") {
          setPersonaSessionIQ((prev) => { const u = { ...prev, [reactor]: data.currentIQ }; personaSessionIQRef.current = u; return u; });
        } else if (typeof data.iqDelta === "number" && data.iqDelta !== 0) adjustPersonaIQ(reactor, data.iqDelta);
        if (typeof data.altTruthCount === "number") {
          setPersonaAltTruths((prev) => ({ ...prev, [reactor]: data.altTruthCount }));
          sessionAltFactTallyRef.current = { ...sessionAltFactTallyRef.current, [reactor]: data.altTruthCount };
        } else if (data.altTruthIncrement) setPersonaAltTruths((prev) => ({ ...prev, [reactor]: (prev[reactor] || 0) + 1 }));
      }
    } catch {}
  }, [userInputText, askingPersona, askQuestion, deviceId, addMessage, queueTTS, adjustPersonaIQ, setPersonaAltTruths]);

  const askUserQuestion = useCallback(async (personaId: string) => {
    if (!userJoinedRef.current || !mountedRef.current || showUserInput || isAskingUserRef.current) return;
    isAskingUserRef.current = true;
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (deviceId) headers["x-device-id"] = deviceId;
      const locationParts = [userCityRef.current, userStateRef.current, userCountryRef.current].filter(Boolean);
      const res = await fetch(new URL("/api/arena/respond", getApiUrl()).toString(), {
        method: "POST",
        headers,
        body: JSON.stringify({
          responderId: personaId,
          toSpeakerId: "user",
          conversationHistory: messagesRef.current.filter((m) => !m.isSystem).slice(-4).map((m) => ({ speakerName: m.speakerName, text: m.text })),
          topic: currentTopicRef.current || "debate",
          activePersonas: selectedPersonasRef.current,
          askUser: true,
          userContext: { name: userNameRef.current, location: locationParts.join(", ") },
        }),
      });
      if (res.ok && mountedRef.current) {
        const data = await res.json();
        const persona = getPersona(personaId);
        addMessage({
          id: "ask-user-" + Date.now(),
          speakerId: personaId,
          speakerName: persona.name,
          text: data.response,
          timestamp: Date.now(),
        });
        queueTTS(data.response, personaId);
        setAskingPersona(personaId);
        setAskQuestion(data.response);
        const waitForTTSComplete = () => {
          let checks = 0;
          const check = () => {
            checks++;
            if (!mountedRef.current) return;
            if (checks > 60) { setShowUserInput(true); return; }
            if (isProcessingTTSRef.current || ttsQueueRef.current.length > 0 || currentSpeakerRef.current) {
              setTimeout(check, 500);
            } else {
              setTimeout(() => { if (mountedRef.current) setShowUserInput(true); }, 1200);
            }
          };
          setTimeout(check, 2000);
        };
        waitForTTSComplete();
      }
    } catch {} finally {
      isAskingUserRef.current = false;
    }
  }, [deviceId, addMessage, queueTTS, showUserInput]);

  const decideNextSpeaker = useCallback(async () => {
    if (!isRunningRef.current || currentSpeakerRef.current) return;
    if (isInterruptingRef.current) return;
    if (isRapidExchangeRef.current) return;
    const msgs = messagesRef.current.filter((m) => !m.isSystem && m.speakerId !== "user");
    if (msgs.length === 0) return;
    const active = selectedPersonasRef.current;
    if (active.length < 2) return;

    if (userJoinedRef.current && !showUserInput && msgs.length > 0 && msgs.length % 5 === 0 && Math.random() < 0.4) {
      const asker = active[Math.floor(Math.random() * active.length)];
      await askUserQuestion(asker);
      return;
    }

    const lastMsg = msgs[msgs.length - 1];
    const recent = recentSpeakersRef.current;

    const pendingTarget = pendingResponseRef.current;
    if (pendingTarget && active.includes(pendingTarget) && pendingTarget !== lastMsg.speakerId) {
      pendingResponseRef.current = null;
      if (mountedRef.current) {
        await generateAIResponse(pendingTarget, lastMsg.speakerId);
        recentSpeakersRef.current = [...recentSpeakersRef.current, pendingTarget].slice(-4);
      }
      return;
    }
    pendingResponseRef.current = null;

    const trumpAttacked = active.includes("trump") && lastMsg.speakerId !== "trump" && detectTrumpAttack(lastMsg.text, lastMsg.speakerId);

    const pool = active.filter((pid) => pid !== lastMsg.speakerId);
    if (pool.length === 0) return;

    let chosen: { id: string; weight: number };

    if (trumpAttacked) {
      chosen = { id: "trump", weight: 999 };
    } else {
      const weights: { id: string; weight: number }[] = pool.map((pid) => {
        let weight = 50;
        const prob = calculateResponseProbability(pid, lastMsg.speakerId, lastMsg.text);
        weight += (prob - 50) * 0.4;

        if (pid === "trump") weight += 40;

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
      chosen = weights[0];
      for (const w of weights) {
        rand -= w.weight;
        if (rand <= 0) { chosen = w; break; }
      }
    }

    if (chosen && mountedRef.current) {
      // Rapid exchange: ~18% chance when a known heated pair faces off
      const lastSpeaker = lastMsg.speakerId;
      const nextSpeaker = chosen.id;
      const isHeatedPair = HEATED_PAIRS.some(([a, b]) =>
        (a === lastSpeaker && b === nextSpeaker) || (b === lastSpeaker && a === nextSpeaker)
      );
      if (isHeatedPair && !isRapidExchangeRef.current && rapidExchangeCooldownRef.current < Date.now() && Math.random() < 0.18) {
        await triggerRapidExchange(lastSpeaker, nextSpeaker);
        recentSpeakersRef.current = [...recentSpeakersRef.current, nextSpeaker].slice(-4);
        return;
      }

      const willInterrupt = !isInterruptingRef.current && chosen.id === "trump" && !trumpAttacked && Math.random() < 0.35;

      // Pre-fetch the interrupter's response in parallel with generateAIResponse so it is
      // ready the moment Trump's TTS starts — eliminates the 5-10 s sequential lag.
      let interruptPrefetch: Promise<{ interrupter: string; data: any } | null> | null = null;
      if (willInterrupt && !isInterruptingRef.current) {
        const available = INTERRUPTERS.filter((id) => selectedPersonasRef.current.includes(id) && id !== "trump");
        if (available.length > 0) {
          isInterruptingRef.current = true;
          const preInterrupter = available[Math.floor(Math.random() * available.length)];
          const preHistory = messagesRef.current.filter((m) => !m.isSystem).slice(-4).map((m) => ({ speakerName: m.speakerName, text: m.text }));
          const preHeaders: Record<string, string> = { "Content-Type": "application/json" };
          if (deviceId) preHeaders["x-device-id"] = deviceId;
          interruptPrefetch = fetch(new URL("/api/arena/respond", getApiUrl()).toString(), {
            method: "POST",
            headers: preHeaders,
            body: JSON.stringify({
              responderId: preInterrupter,
              toSpeakerId: "trump",
              conversationHistory: preHistory,
              topic: currentTopicRef.current || "debate",
              isInterruption: true,
              sessionIQ: personaSessionIQRef.current,
              sessionLieTally: sessionLieTallyRef.current,
              sessionAltFactTally: sessionAltFactTallyRef.current,
            }),
          }).then(async (r) => r.ok ? { interrupter: preInterrupter, data: await r.json() } : null)
            .catch(() => null);
        }
      }

      await generateAIResponse(chosen.id, lastMsg.speakerId);
      recentSpeakersRef.current = [...recentSpeakersRef.current, chosen.id].slice(-4);

      if (interruptPrefetch && mountedRef.current && isRunningRef.current) {
        const prefetched = await interruptPrefetch;
        if (prefetched) {
          await triggerInterruption("", prefetched.interrupter, prefetched.data);
        } else {
          isInterruptingRef.current = false;
        }
      }
    }
  }, [generateAIResponse, triggerInterruption, triggerRapidExchange, askUserQuestion, showUserInput]);

  const scheduleNext = useCallback(() => {
    if (sessionEndedRef.current) return;
    if (conversationTimerRef.current) clearTimeout(conversationTimerRef.current);
    const WATCHDOG_TIMEOUT = 8000;
    let watchdogTimer: ReturnType<typeof setTimeout> | null = null;
    const waitForClear = () => {
      if (sessionEndedRef.current) return;
      if (isInterruptingRef.current || currentSpeakerRef.current) {
        if (!watchdogTimer) {
          watchdogTimer = setTimeout(() => {
            console.warn("Arena watchdog: clearing stuck locks after timeout");
            isInterruptingRef.current = false;
            currentSpeakerRef.current = null;
            setCurrentSpeaker(null);
            isProcessingTTSRef.current = false;
            if (conversationTimerRef.current) clearTimeout(conversationTimerRef.current);
            if (mountedRef.current && isRunningRef.current && !sessionEndedRef.current) {
              scheduleNext();
            }
          }, WATCHDOG_TIMEOUT);
        }
        conversationTimerRef.current = setTimeout(waitForClear, 20);
        return;
      }
      if (watchdogTimer) { clearTimeout(watchdogTimer); watchdogTimer = null; }
      const delay = 20 + Math.random() * 30;
      conversationTimerRef.current = setTimeout(async () => {
        if (!mountedRef.current || sessionEndedRef.current) return;
        await decideNextSpeaker();
        if (mountedRef.current && isRunningRef.current && !sessionEndedRef.current) {
          scheduleNext();
        }
      }, delay);
    };
    waitForClear();
  }, [decideNextSpeaker]);

  useEffect(() => { scheduleNextRef.current = scheduleNext; }, [scheduleNext]);

  const startDebate = useCallback(async () => {
    if (!mountedRef.current) return;
    if (!deviceId) {
      setShowPreDebateSetup(true);
      setShowIntro(false);
      return;
    }
    setBetResult(null);
    sessionEndedRef.current = false;
    isInterruptingRef.current = false;
    isRapidExchangeRef.current = false;
    rapidExchangeCooldownRef.current = 0;
    currentSpeakerRef.current = null;
    setCurrentSpeaker(null);
    setIsRunning(true);
    isRunningRef.current = true;
    sessionLieTallyRef.current = {};
    sessionAltFactTallyRef.current = {};
    setAltFactCount(0);
    setPersonaAltTruths({});
    const seededIQ: Record<string, number> = {};
    for (const pid of selectedPersonasRef.current) {
      seededIQ[pid] = alltimeIQRef.current[pid] ?? 100;
    }
    setPersonaSessionIQ(seededIQ);
    personaSessionIQRef.current = seededIQ;
    try {
      const ctx = await getArenaMemoryContext("", selectedPersonasRef.current);
      arenaMemoryContextRef.current = ctx;
    } catch {}

    try {
      const entryHeaders: Record<string, string> = { "Content-Type": "application/json" };
      if (deviceId) entryHeaders["x-device-id"] = deviceId;
      fetch(new URL("/api/arena/track-entries", getApiUrl()).toString(), {
        method: "POST",
        headers: entryHeaders,
        body: JSON.stringify({ personaIds: selectedPersonasRef.current }),
      }).catch(() => {});
    } catch {}

    if (breakingNewsTimerRef.current) clearInterval(breakingNewsTimerRef.current);
    breakingNewsTimerRef.current = setInterval(async () => {
      if (!isRunningRef.current || sessionEndedRef.current) return;
      try {
        const res = await fetch(new URL("/api/arena/breaking-news", getApiUrl()).toString());
        if (!res.ok) return;
        const data = await res.json();
        if (data.breakingNews && data.breakingNews.headline !== lastBreakingNewsIdRef.current) {
          lastBreakingNewsIdRef.current = data.breakingNews.headline;
          const bn = { headline: data.breakingNews.headline, source: data.breakingNews.source };
          setBreakingNewsBanner(bn);
          breakingNewsBannerRef.current = bn;
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          playBreakingNewsAlert();
          addMessage({
            id: "breaking-news-" + Date.now(),
            speakerId: "system",
            speakerName: "BREAKING NEWS",
            text: `🔴 BREAKING: ${data.breakingNews.headline} (${data.breakingNews.source})`,
            timestamp: Date.now(),
            isSystem: true,
          });

          const activeP = selectedPersonasRef.current;
          const reactorId = activeP[Math.floor(Math.random() * activeP.length)];
          const reactorPersona = getPersona(reactorId);
          const reactions = BREAKING_NEWS_REACTIONS[reactorId] || ["What the hell?! Breaking news, everybody!"];
          const reactionText = reactions[Math.floor(Math.random() * reactions.length)];
          if (reactorPersona) {
            setTimeout(() => {
              addMessage({
                id: "bn-react-" + Date.now(),
                speakerId: reactorId,
                speakerName: `⚡ ${reactorPersona.name}`,
                text: reactionText,
                timestamp: Date.now(),
              });
            }, 1200);
          }

          setCurrentTopic(data.breakingNews.headline);
          currentTopicRef.current = data.breakingNews.headline;
          setTimeout(() => {
            setBreakingNewsBanner(null);
            breakingNewsBannerRef.current = null;
          }, 15000);
        }
      } catch {}
    }, 2 * 60 * 1000);

    addMessage({
      id: "system-start",
      speakerId: "system",
      speakerName: "System",
      text: "The Arena is live. Personas are entering...",
      timestamp: Date.now(),
      isSystem: true,
    });
    const active = selectedPersonasRef.current;
    const starter = active.includes("trump") ? "trump" : active[0];
    const pool = active.filter((p) => p !== starter);
    const target = pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : starter;
    await generateAIResponse(starter, target);
    if (mountedRef.current) scheduleNext();
  }, [addMessage, deviceId, generateAIResponse, scheduleNext]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (conversationTimerRef.current) clearTimeout(conversationTimerRef.current);
      if (joinTimerRef.current) clearInterval(joinTimerRef.current);
      if (clapBackTimeoutRef.current) clearTimeout(clapBackTimeoutRef.current);
      if (breakingNewsTimerRef.current) clearInterval(breakingNewsTimerRef.current);
      if (recordingObjRef.current) {
        try { recordingObjRef.current.stopAndUnloadAsync(); } catch {}
        recordingObjRef.current = null;
      }
      if (mediaRecorderRef.current?.state !== "inactive") {
        try { mediaRecorderRef.current?.stop(); } catch {}
      }
      lastRecordedAudioRef.current = null;
      stopAllTTS();
      saveCurrentSession();
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
      if (next) {
        scheduleNext();
      } else {
        if (conversationTimerRef.current) clearTimeout(conversationTimerRef.current);
        isInterruptingRef.current = false;
        currentSpeakerRef.current = null;
        setCurrentSpeaker(null);
        isProcessingTTSRef.current = false;
      }
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
    const persona = getPersona(personaId);
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

  const fetchVerdict = useCallback(async () => {
    if (verdictLoading) return;
    if (messages.filter((m) => !m.isSystem).length < 4) {
      Alert.alert("Not enough debate yet", "Keep the debate going — the AI judge needs more arguments to score.");
      return;
    }
    setVerdictLoading(true);
    setShowVerdictModal(true);
    try {
      const r = await fetch(new URL("/api/arena/verdict", getApiUrl()).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: currentTopic || "General debate",
          messages: messages.map((m) => ({ speakerName: m.speakerName || m.speakerId, text: m.text, isSystem: m.isSystem })),
          personas: selectedPersonas,
        }),
      });
      if (r.ok) setVerdictData(await r.json());
    } catch {}
    finally { setVerdictLoading(false); }
  }, [verdictLoading, messages, currentTopic, selectedPersonas]);

  const shareVerdict = useCallback(async () => {
    if (!verdictData) return;
    const checks = (verdictData.factChecks || []).slice(0, 3).map((f: any) => `${f.verdict === "TRUE" ? "✅" : f.verdict === "FALSE" ? "❌" : "⚠️"} ${f.persona}: "${f.claim?.substring(0, 60)}…" → ${f.fact?.substring(0, 70)}`).join("\n");
    const msg = `⚖️ AI VERDICT — Chat DJT\n\nTopic: "${currentTopic || "The Debate"}"\n\n🏆 WINNER: ${verdictData.winner}\n\n${verdictData.verdict}\n\n📊 FACT CHECKS:\n${checks}\n\n"${verdictData.summary}"\n\nWatch 20 AI personas debate LIVE 👇\nchatdjt.com`;
    try {
      if (Platform.OS === "web" && navigator.share) await navigator.share({ title: "AI Verdict", text: msg });
      else await Share.share({ message: msg, title: "AI Verdict" });
    } catch {}
  }, [verdictData, currentTopic]);

  const shareDebate = useCallback(async () => {
    const topicName = currentTopic || "The Arena";
    const recentMessages = messages.filter((m) => !m.isSystem && m.speakerId !== "user").slice(-4);
    const winner = Object.entries(personaPointsRef.current).sort(([, a], [, b]) => b - a)[0];
    const winnerPersona = winner ? getPersona(winner[0]) : null;
    const winnerName = winnerPersona?.name || null;
    const winnerPts = winner ? winner[1] : 0;

    let shareText = `🏛️ THE ARENA — Chat DJT\n`;
    shareText += `📰 Topic: "${topicName}"\n\n`;
    if (recentMessages.length > 0) {
      shareText += `🔥 Highlights:\n`;
      recentMessages.forEach((m) => {
        const persona = getPersona(m.speakerId);
        if (persona) {
          const snippet = m.text.length > 90 ? m.text.substring(0, 87) + "…" : m.text;
          shareText += `${persona.shortName || persona.name}: "${snippet}"\n`;
        }
      });
      shareText += "\n";
    }
    if (winnerName && winnerPts > 0) {
      shareText += `👑 Winning: ${winnerName} with ${winnerPts} pts\n\n`;
    }
    shareText += `Watch 20 AI personas debate LIVE 👇\nChat DJT — chatdjt.com`;

    try {
      if (Platform.OS === "web") {
        if (navigator.share) {
          await navigator.share({ title: `The Arena: ${topicName}`, text: shareText, url: "https://chatdjt.com" });
        } else {
          const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`;
          Linking.openURL(twitterUrl);
        }
      } else {
        await Share.share({ message: shareText, title: `The Arena: ${topicName}` });
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

  const latestPersonaMsgId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (!messages[i].isSystem && messages[i].speakerId !== "user") return messages[i].id;
    }
    return null;
  }, [messages]);

  const fetchWinnerClapBack = useCallback(async (winnerId: string, winnerName: string, trumpRoast: string, leaderboard: any[]) => {
    setIsLoadingClapBack(true);
    try {
      const customerName = userNameRef.current || "this person";
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (deviceId) headers["x-device-id"] = deviceId;
      const res = await fetch(new URL("/api/arena/clap-back", getApiUrl()).toString(), {
        method: "POST",
        headers,
        body: JSON.stringify({ winnerId, winnerName, trumpRoast, customerName, leaderboard, winTally: winTallyRef.current }),
      });
      if (res.ok && mountedRef.current) {
        const data = await res.json();
        setWinnerClapBack(data.clapBack);
        queueTTS(data.clapBack, winnerId, true);
      }
    } catch (e) {
      console.warn("fetchWinnerClapBack error:", e);
    } finally {
      if (mountedRef.current) setIsLoadingClapBack(false);
    }
  }, [deviceId, queueTTS]);

  const fetchTrumpRoast = useCallback(async () => {
    const pts = personaPointsRef.current;
    const sorted = Object.entries(pts).sort(([, a], [, b]) => b - a);
    if (sorted.length === 0) return;
    const winnerId = sorted[0][0];
    const winnerName = getPersona(winnerId)?.name || "someone";
    const winnerPts = sorted[0][1];
    const trumpPts = pts["trump"] || 0;
    const customerName = userNameRef.current || "this person";
    const leaderboard = sorted.slice(0, 5).map(([id, p]) => ({ name: getPersona(id)?.name || id, points: p }));

    await recordWin(winnerId);

    setIsLoadingRoast(true);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (deviceId) headers["x-device-id"] = deviceId;
      const res = await fetch(new URL("/api/arena/roast", getApiUrl()).toString(), {
        method: "POST",
        headers,
        body: JSON.stringify({
          winnerId,
          winnerName,
          winnerPoints: winnerPts,
          trumpPoints: trumpPts,
          customerName,
          leaderboard,
          winTally: winTallyRef.current,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setTrumpRoastText(data.roast);
        queueTTS(data.roast, "trump", true);
        if (winnerId !== "trump") {
          if (clapBackTimeoutRef.current) clearTimeout(clapBackTimeoutRef.current);
          fetchWinnerClapBack(winnerId, winnerName, data.roast, leaderboard);
        }
      }
    } catch {} finally {
      setIsLoadingRoast(false);
    }
  }, [deviceId, queueTTS, fetchWinnerClapBack, recordWin]);

  const renderMessage = useCallback(
    ({ item, index }: { item: ConversationMessage; index: number }) => {
      if (item.isSystem) {
        return (
          <Animated.View entering={FadeIn.duration(400)} style={s.systemMsg}>
            <Text style={[s.systemMsgText, item.speakerId === "user" && { color: "#4ADE80", fontStyle: "normal" as const, fontWeight: "700" as const }]}>{item.text}</Text>
          </Animated.View>
        );
      }
      if (item.speakerId === "user") {
        return (
          <Animated.View entering={SlideInRight.duration(350).springify()} style={[s.msgRow, { borderLeftColor: "#4ADE80", backgroundColor: "rgba(74,222,128,0.08)" }]}>
            <View style={s.msgHeader}>
              <View style={[s.msgAvatarFallback, { backgroundColor: "#4ADE80" }]}>
                <Ionicons name={item.audioUri ? "mic" : "person"} size={12} color="#000" />
              </View>
              <Text style={[s.msgName, { color: "#4ADE80" }]}>{item.speakerName}</Text>
              <View style={[s.factionBadge, { backgroundColor: "rgba(74,222,128,0.2)", borderColor: "rgba(74,222,128,0.4)" }]}>
                <Text style={[s.factionText, { color: "#4ADE80" }]}>{item.audioUri ? "VOICE" : "YOU"}</Text>
              </View>
              <Text style={s.msgTime}>
                {new Date(item.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </Text>
            </View>
            <Text style={s.msgText}>{applyBleep(item.text)}</Text>
          </Animated.View>
        );
      }
      const persona = getPersona(item.speakerId);
      if (!persona) return null;
      const isLatest = item.id === latestPersonaMsgId;
      return (
        <Animated.View entering={SlideInLeft.duration(350).springify()} style={[s.msgRow, { borderLeftColor: persona.color }]}>
          <View style={s.msgHeader}>
            {persona.image ? (
              <Image source={persona.image} style={[s.msgAvatar, CARTOON_FILTER]} />
            ) : (
              <View style={[s.msgAvatarFallback, { backgroundColor: persona.color }]}>
                <Text style={s.msgAvatarText}>{getInitials(persona.name)}</Text>
              </View>
            )}
            <Text style={[s.msgName, { color: persona.color }]}>{persona.shortName}</Text>
            <View style={[s.factionBadge, { backgroundColor: FACTION_COLORS[persona.faction] + "30", borderColor: FACTION_COLORS[persona.faction] + "60" }]}>
              <Text style={[s.factionText, { color: FACTION_COLORS[persona.faction] }]}>{persona.faction}</Text>
            </View>
            {personaSessionIQ[item.speakerId] !== undefined && (
              <View style={[s.iqPill, { borderColor: iqColor(personaSessionIQ[item.speakerId]) + "70", backgroundColor: iqColor(personaSessionIQ[item.speakerId]) + "1A" }]}>
                <Text style={[s.iqPillText, { color: iqColor(personaSessionIQ[item.speakerId]) }]}>
                  {iqLabelShort(personaSessionIQ[item.speakerId])} {Math.round(personaSessionIQ[item.speakerId])}
                </Text>
              </View>
            )}
            <Pressable
              onPress={() => queueTTS(item.text, item.speakerId, true)}
              style={s.msgListenBtn}
              hitSlop={8}
            >
              <Ionicons name="volume-medium" size={14} color="rgba(255,255,255,0.4)" />
            </Pressable>
            <Pressable
              onPress={() => flagMessageAsLie(item)}
              style={s.msgListenBtn}
              hitSlop={8}
              testID={`flag-lie-${item.id}`}
              disabled={flaggedMsgIds.has(item.id)}
            >
              <Ionicons
                name={flaggedMsgIds.has(item.id) ? "flag" : "flag-outline"}
                size={13}
                color={flaggedMsgIds.has(item.id) ? "#ff4d4d" : "rgba(255,255,255,0.4)"}
              />
            </Pressable>
            {!awardedMessages.has(item.id) ? (
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  playPointAwardSound();
                  setPersonaPoints((prev) => ({ ...prev, [item.speakerId]: (prev[item.speakerId] || 0) + 1 }));
                  setAwardedMessages((prev) => new Set(prev).add(item.id));
                }}
                style={s.pointBtn}
                hitSlop={6}
              >
                <Ionicons name="thumbs-up-outline" size={12} color="rgba(255,215,0,0.6)" />
                <Text style={s.pointBtnText}>+1</Text>
              </Pressable>
            ) : (
              <View style={s.pointBtnAwarded}>
                <Ionicons name="thumbs-up" size={12} color="#FFD700" />
              </View>
            )}
            <Text style={s.msgTime}>
              {new Date(item.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </Text>
          </View>
          <TypewriterText text={applyBleep(item.text)} style={s.msgText} voiceEnabled={voiceEnabled} isLatest={isLatest} />
        </Animated.View>
      );
    },
    [queueTTS, voiceEnabled, latestPersonaMsgId, awardedMessages, flagMessageAsLie, flaggedMsgIds, personaSessionIQ, applyBleep, bleepEnabled]
  );

  const [flashOn, setFlashOn] = useState(true);
  useEffect(() => {
    if (!showPreDebateSetup) return;
    fetchTopics(topicCategory);
    const flashInterval = setInterval(() => setFlashOn((v) => !v), 700);
    return () => clearInterval(flashInterval);
  }, [showPreDebateSetup, topicCategory]);

  if (showPreDebateSetup) {
    return (
      <ImageBackground
        source={require("../assets/images/dynamic-creations-arena-bg.jpg")}
        style={[s.container, { paddingTop: insets.top + webTopInset }]}
        imageStyle={{ opacity: 0.28, resizeMode: "cover" }}
      >
        <LinearGradient colors={["rgba(0,0,0,0.72)", "rgba(0,0,0,0.55)", "rgba(0,0,0,0.78)"]} style={StyleSheet.absoluteFill} />
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
          <View style={{ alignItems: "center", marginBottom: 16 }}>
            <Text style={{
              color: flashOn ? "#FFD700" : "#FF4D4D",
              fontSize: 28,
              fontWeight: "900",
              letterSpacing: 2,
              textAlign: "center",
              textShadowColor: flashOn ? "rgba(255,215,0,0.6)" : "rgba(255,77,77,0.6)",
              textShadowOffset: { width: 0, height: 0 },
              textShadowRadius: flashOn ? 20 : 10,
            }}>CHOOSE YOUR DEBATERS</Text>
            <View style={{ flexDirection: "row", alignItems: "center", marginTop: 6 }}>
              <Ionicons name="flame" size={20} color="#FF4D4D" />
              <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, marginHorizontal: 8 }}>THE ARENA</Text>
              <Ionicons name="flame" size={20} color="#FF4D4D" />
            </View>
          </View>

          <Pressable
            onPress={() => setShowArenaRules(!showArenaRules)}
            style={{
              backgroundColor: showArenaRules ? "rgba(255,77,77,0.15)" : "rgba(255,255,255,0.05)",
              borderWidth: 1, borderColor: showArenaRules ? "rgba(255,77,77,0.4)" : "rgba(255,255,255,0.1)",
              borderRadius: 12, padding: 12, marginBottom: 14, flexDirection: "row", alignItems: "center",
            }}
          >
            <Ionicons name="information-circle" size={20} color={showArenaRules ? "#FF4D4D" : "#888"} style={{ marginRight: 8 }} />
            <Text style={{ color: showArenaRules ? "#FF4D4D" : "#aaa", fontSize: 13, fontWeight: "800", flex: 1 }}>TAP HERE FOR RULES & HOW TO PLAY</Text>
            <Ionicons name={showArenaRules ? "chevron-up" : "chevron-down"} size={16} color={showArenaRules ? "#FF4D4D" : "#888"} />
          </Pressable>
          {showArenaRules && (
            <View style={{
              backgroundColor: "rgba(255,77,77,0.08)", borderRadius: 12, padding: 14, marginBottom: 14,
              borderWidth: 1, borderColor: "rgba(255,77,77,0.2)",
            }}>
              {[
                { icon: "people" as const, text: "Pick 2-17 AI personas to debate. Each has a unique political voice & personality." },
                { icon: "chatbubbles" as const, text: "Choose a hot topic from today's headlines or create your own. The AI debaters will argue about it in real time." },
                { icon: "timer" as const, text: "Debates are timed (5/10/15 min). Each minute costs 1 token. When time runs out, the bell rings." },
                { icon: "mic" as const, text: "Use the MIC button to jump in and challenge the debaters. They'll respond to you directly." },
                { icon: "star" as const, text: "Award POINTS to personas you think are winning. At the end, the winner gets roasted and fires back." },
                { icon: "trophy" as const, text: "Vote for your favorite persona — votes count on the GLOBAL leaderboard. Earn reward tokens by spending time in the Arena." },
                { icon: "newspaper" as const, text: "BREAKING NEWS can interrupt mid-debate — all personas react in character when it hits." },
              ].map((rule, i) => (
                <View key={i} style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: i < 6 ? 10 : 0 }}>
                  <Ionicons name={rule.icon} size={15} color="#FF6B6B" style={{ marginRight: 8, marginTop: 1 }} />
                  <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, lineHeight: 17, flex: 1 }}>{rule.text}</Text>
                </View>
              ))}
            </View>
          )}

          <Pressable
            onPress={() => router.push("/interview")}
            style={{
              flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 14, marginBottom: 14,
              backgroundColor: "rgba(255,215,0,0.12)", borderWidth: 1, borderColor: "#FFD700",
            }}
            testID="open-interview-mode"
          >
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,215,0,0.25)", alignItems: "center", justifyContent: "center", marginRight: 12 }}>
              <Ionicons name="mic" size={20} color="#FFD700" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: "#FFD700", fontSize: 14, fontWeight: "900", letterSpacing: 1 }}>1-ON-1 INTERVIEWS</Text>
              <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 11, marginTop: 2 }}>Maddow grills Trump · Megyn vs Bernie · 5/10/15 min</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#FFD700" />
          </Pressable>

          <Pressable
            onPress={() => router.push("/debate-stage")}
            style={{
              flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 14, marginBottom: 14,
              backgroundColor: "rgba(244,63,94,0.12)", borderWidth: 1, borderColor: "#f43f5e",
            }}
            testID="open-debate-stage-mode"
          >
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(244,63,94,0.25)", alignItems: "center", justifyContent: "center", marginRight: 12 }}>
              <Ionicons name="megaphone" size={20} color="#f43f5e" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: "#f43f5e", fontSize: 14, fontWeight: "900", letterSpacing: 1 }}>1-ON-1 DEBATE</Text>
              <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 11, marginTop: 2 }}>Pick a moderator · cut mics · timed rounds</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#f43f5e" />
          </Pressable>

          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <Text style={{ color: "#FFD700", fontSize: 14, fontWeight: "800" }}>{selectedPersonas.length} DEBATERS SELECTED</Text>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <Pressable onPress={() => setSelectedPersonas(["trump", ...PERSONA_IDS.filter((id) => id !== "trump"), ...unlockedMystery.filter((id) => !PERSONA_IDS.includes(id))])}>
                <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: "600" }}>All</Text>
              </Pressable>
              <Pressable onPress={() => setSelectedPersonas(["trump"])}>
                <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: "600" }}>Trump Only</Text>
              </Pressable>
            </View>
          </View>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
            {Object.entries(PERSONA_CATEGORIES).map(([key, cat]) => (
              <View key={key} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: cat.color }} />
                <Text style={{ color: cat.color, fontSize: 10, fontWeight: "700" }}>{cat.label}</Text>
              </View>
            ))}
          </View>

          {(() => {
            const allIds = [
              ...PERSONA_IDS.filter(id => !isHidden(id)),
              ...unlockedMystery.filter((id) => !PERSONA_IDS.includes(id)),
            ];
            const grouped: Record<string, string[]> = {};
            const categoryOrder: PersonaCategory[] = ["president", "politician", "journalist", "commentator", "strategist", "podcaster", "comedian", "tech", "firstlady", "activist", "scientist"];
            for (const pid of allIds) {
              const cat = PERSONA_CATEGORY_MAP[pid] || "politician";
              if (!grouped[cat]) grouped[cat] = [];
              grouped[cat].push(pid);
            }
            return categoryOrder.filter((cat) => grouped[cat]?.length).map((cat) => {
              const catInfo = PERSONA_CATEGORIES[cat];
              return (
                <View key={cat} style={{ marginBottom: 10 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: catInfo.color, marginRight: 6 }} />
                    <Text style={{ color: catInfo.color, fontSize: 12, fontWeight: "800", letterSpacing: 1 }}>{catInfo.label.toUpperCase()}S</Text>
                  </View>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    {grouped[cat].map((pid) => {
                      const p = getPersona(pid);
                      if (!p) return null;
                      const isSelected = selectedPersonas.includes(pid);
                      const isMystery = MYSTERY_PERSONA_IDS.includes(pid);
                      const isPremiumLocked = isLocked(pid);
                      const premiumCfg = PREMIUM_PERSONA_CONFIGS[pid];
                      const totalEntries = allTimeScores[pid]?.totalEntries || 0;
                      const wins = winTallyGlobal[pid] || 0;
                      const winPct = totalEntries > 0 ? Math.round((wins / totalEntries) * 100) : 0;
                      return (
                        <Pressable
                          key={pid}
                          onPress={() => {
                            if (isPremiumLocked && premiumCfg && deviceId) {
                              unlockWithTokens(pid, deviceId, refreshBalance);
                              return;
                            }
                            togglePersona(pid);
                          }}
                          style={{
                            flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 6,
                            borderRadius: 20, borderWidth: 1.5,
                            borderColor: isPremiumLocked ? (premiumCfg?.badgeColor || "#FFD700") + "60" : isSelected ? p.color : isMystery ? "rgba(255,215,0,0.3)" : "rgba(255,255,255,0.15)",
                            backgroundColor: isPremiumLocked ? (premiumCfg?.badgeColor || "#FFD700") + "10" : isSelected ? p.color + "20" : "rgba(255,255,255,0.05)",
                            opacity: isPremiumLocked ? 0.8 : 1,
                          }}
                        >
                          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: catInfo.color, marginRight: 5 }} />
                          {p.image ? (
                            <Image source={p.image} style={[{ width: 24, height: 24, borderRadius: 12, marginRight: 6 }, CARTOON_FILTER]} />
                          ) : (
                            <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: p.color + "40", justifyContent: "center", alignItems: "center", marginRight: 6 }}>
                              <Text style={{ fontSize: 9, color: "#fff", fontWeight: "800" }}>{getInitials(p.name)}</Text>
                            </View>
                          )}
                          {isPremiumLocked
                            ? <Text style={{ color: premiumCfg?.badgeColor || "#FFD700", fontSize: 12, fontWeight: "700" }}>{p.shortName} 🔒{premiumCfg ? ` ${premiumCfg.tokenPrice}🪙` : ""}</Text>
                            : <Text style={{ color: isSelected ? p.color : "#888", fontSize: 12, fontWeight: "700" }}>{p.shortName}{isMystery ? " ★" : ""}</Text>
                          }
                          {wins > 0 && (
                            <View style={{ marginLeft: 4, backgroundColor: "rgba(74,222,128,0.2)", borderRadius: 8, paddingHorizontal: 4, paddingVertical: 1 }}>
                              <Text style={{ color: "#4ADE80", fontSize: 9, fontWeight: "800" }}>{wins}W{winPct > 0 ? ` ${winPct}%` : ""}</Text>
                            </View>
                          )}
                          {totalEntries > 0 && (
                            <View style={{ marginLeft: 3, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 8, paddingHorizontal: 4, paddingVertical: 1 }}>
                              <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 9, fontWeight: "700" }}>{totalEntries}E</Text>
                            </View>
                          )}
                          {isSelected && <Ionicons name="checkmark-circle" size={14} color={p.color} style={{ marginLeft: 4 }} />}
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              );
            });
          })()}

          {MYSTERY_PERSONA_IDS.filter((id) => !unlockedMystery.includes(id)).length > 0 && (
            <View style={{ marginBottom: 16, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: "rgba(255,215,0,0.2)", backgroundColor: "rgba(255,215,0,0.05)" }}>
              <Text style={{ color: "#FFD700", fontSize: 13, fontWeight: "800", textAlign: "center", marginBottom: 6 }}>MYSTERY PERSONAS</Text>
              <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, textAlign: "center", marginBottom: 10 }}>10–15 D.C. Tokens each to unlock</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
                {MYSTERY_PERSONA_IDS.filter((id) => !unlockedMystery.includes(id)).map((pid) => (
                  <Pressable
                    key={pid}
                    onPress={() => unlockMysteryPersona(pid)}
                    style={{
                      flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 8,
                      borderRadius: 20, borderWidth: 1.5, borderColor: "rgba(255,215,0,0.4)",
                      backgroundColor: "rgba(255,215,0,0.08)",
                    }}
                  >
                    {mysteryUnlocking === pid ? (
                      <ActivityIndicator size="small" color="#FFD700" style={{ marginRight: 6 }} />
                    ) : (
                      <Ionicons name="help-circle" size={20} color="#FFD700" style={{ marginRight: 6 }} />
                    )}
                    <Text style={{ color: "#FFD700", fontSize: 12, fontWeight: "700" }}>??? ({MYSTERY_UNLOCK_COSTS[pid] || 10}🪙)</Text>
                    <Ionicons name="lock-closed" size={12} color="#FFD700" style={{ marginLeft: 6 }} />
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {/* ── PREMIUM LOCKED PERSONAS ────────────────────── */}
          {Object.entries(PREMIUM_PERSONA_CONFIGS).filter(([id]) => isHidden(id)).length > 0 && (
            <View style={{ marginBottom: 16, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: "rgba(255,107,0,0.3)", backgroundColor: "rgba(255,107,0,0.05)" }}>
              <Text style={{ color: "#FF6B00", fontSize: 13, fontWeight: "800", textAlign: "center", marginBottom: 4 }}>🔓 PREMIUM PERSONAS</Text>
              <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, textAlign: "center", marginBottom: 10 }}>Unlock with tokens, 3h+ play time, or debate wins</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
                {Object.entries(PREMIUM_PERSONA_CONFIGS).filter(([id]) => isHidden(id)).map(([pid, cfg]) => (
                  <Pressable
                    key={pid}
                    onPress={() => deviceId && unlockWithTokens(pid, deviceId, refreshBalance)}
                    style={{
                      flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 8,
                      borderRadius: 20, borderWidth: 1.5, borderColor: cfg.badgeColor + "60",
                      backgroundColor: cfg.badgeColor + "10",
                    }}
                  >
                    {premiumUnlocking === pid ? (
                      <ActivityIndicator size="small" color={cfg.badgeColor} style={{ marginRight: 6 }} />
                    ) : (
                      <Ionicons name="lock-closed" size={14} color={cfg.badgeColor} style={{ marginRight: 6 }} />
                    )}
                    <Text style={{ color: cfg.badgeColor, fontSize: 12, fontWeight: "700" }}>{cfg.name} ({cfg.tokenPrice}🪙)</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 9, textAlign: "center", marginTop: 8 }}>
                Or earn free: {Object.values(PREMIUM_PERSONA_CONFIGS).map(c => `${c.timeMinutes/60}h play / ${c.challengeWins} arena wins`)[0]}+
              </Text>
            </View>
          )}

          {/* ── VISIBLE-LOCKED PERSONAS ─────────────────────── */}
          {Object.entries(PREMIUM_PERSONA_CONFIGS).filter(([id]) => !isHidden(id) && isLocked(id)).map(([pid, cfg]) => (
            <Pressable
              key={pid}
              onPress={() => deviceId && unlockWithTokens(pid, deviceId, refreshBalance)}
              style={{
                flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 10,
                borderRadius: 12, borderWidth: 1.5, borderColor: cfg.badgeColor + "50",
                backgroundColor: cfg.badgeColor + "08", marginBottom: 10,
              }}
            >
              <Ionicons name="lock-closed" size={16} color={cfg.badgeColor} style={{ marginRight: 10 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: cfg.badgeColor, fontSize: 13, fontWeight: "800" }}>{cfg.name} <Text style={{ fontSize: 10, fontWeight: "600" }}>({cfg.badge})</Text></Text>
                <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, marginTop: 2 }}>{cfg.description}</Text>
                <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 9, marginTop: 3 }}>Unlock: {cfg.tokenPrice}🪙 · {cfg.timeMinutes/60}h play · {cfg.challengeWins} arena win{cfg.challengeWins > 1 ? "s" : ""}</Text>
              </View>
              {premiumUnlocking === pid
                ? <ActivityIndicator size="small" color={cfg.badgeColor} />
                : <Text style={{ color: cfg.badgeColor, fontSize: 12, fontWeight: "900" }}>{cfg.tokenPrice}🪙</Text>
              }
            </Pressable>
          ))}

          {/* ── IQ RACE BET ──────────────────────────────────── */}
          {selectedPersonas.length >= 2 && !arenaBet && (
            <View style={{ marginBottom: 16, padding: 14, borderRadius: 14, borderWidth: 1.5, borderColor: "rgba(251,191,36,0.35)", backgroundColor: "rgba(251,191,36,0.06)" }}>
              <Text style={{ color: "#FBBF24", fontSize: 13, fontWeight: "900", marginBottom: 4 }}>🎰 IQ RACE BET</Text>
              <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 10, marginBottom: 10 }}>Pick who ends with the LOWEST IQ — win 2.5× your bet</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }} contentContainerStyle={{ gap: 6 }}>
                {selectedPersonas.map((pid) => {
                  const p = getPersona(pid);
                  if (!p) return null;
                  const picked = betPickId === pid;
                  return (
                    <Pressable key={pid} onPress={() => { Haptics.selectionAsync(); setBetPickId(pid); }}
                      style={{
                        paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5,
                        borderColor: picked ? "#FBBF24" : "rgba(255,255,255,0.15)",
                        backgroundColor: picked ? "rgba(251,191,36,0.15)" : "rgba(255,255,255,0.04)",
                      }}>
                      <Text style={{ color: picked ? "#FBBF24" : "#888", fontSize: 12, fontWeight: "700" }}>{p.shortName}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 11 }}>Wager:</Text>
                {[1, 2, 3, 5, 10].map((v) => (
                  <Pressable key={v} onPress={() => setBetWagerInput(v)}
                    style={{
                      paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16, borderWidth: 1,
                      borderColor: betWagerInput === v ? "#FBBF24" : "rgba(255,255,255,0.15)",
                      backgroundColor: betWagerInput === v ? "rgba(251,191,36,0.15)" : "transparent",
                    }}>
                    <Text style={{ color: betWagerInput === v ? "#FBBF24" : "#888", fontSize: 11, fontWeight: "700" }}>{v}🪙</Text>
                  </Pressable>
                ))}
              </View>
              <Pressable
                onPress={async () => {
                  if (!betPickId || !deviceId) return;
                  const res = await fetch(new URL("/api/use-token", getApiUrl()).toString(), {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "x-device-id": deviceId },
                    body: JSON.stringify({ amount: betWagerInput, reason: "IQ Race bet" }),
                  });
                  if (!res.ok) { Alert.alert("Not enough tokens", `Need ${betWagerInput} tokens to place this bet.`); return; }
                  await refreshBalance();
                  const bet: ArenaBet = { targetPersonaId: betPickId, wager: betWagerInput, placedAt: Date.now(), sessionKey: makeArenaSessionKey(selectedPersonas) };
                  await placeArenaBet(bet);
                  setArenaBet(bet);
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                }}
                disabled={!betPickId}
                style={{ backgroundColor: betPickId ? "#FBBF24" : "rgba(255,255,255,0.1)", borderRadius: 10, paddingVertical: 10, alignItems: "center", opacity: betPickId ? 1 : 0.5 }}
              >
                <Text style={{ color: betPickId ? "#000" : "#666", fontSize: 13, fontWeight: "900" }}>PLACE BET ({betWagerInput}🪙)</Text>
              </Pressable>
            </View>
          )}

          {arenaBet && !betResult && (
            <View style={{ marginBottom: 16, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: "rgba(251,191,36,0.3)", backgroundColor: "rgba(251,191,36,0.06)", flexDirection: "row", alignItems: "center" }}>
              <Ionicons name="checkmark-circle" size={18} color="#FBBF24" style={{ marginRight: 8 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: "#FBBF24", fontSize: 12, fontWeight: "800" }}>BET PLACED: {getPersona(arenaBet.targetPersonaId)?.shortName || arenaBet.targetPersonaId} loses IQ</Text>
                <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 10 }}>Wagered {arenaBet.wager}🪙 · Win {Math.round(arenaBet.wager * 2.5)}🪙</Text>
              </View>
              <Pressable onPress={async () => { await clearArenaBet(); setArenaBet(null); }}>
                <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.3)" />
              </Pressable>
            </View>
          )}

          {betResult && (
            <View style={{ marginBottom: 16, padding: 14, borderRadius: 12, borderWidth: 1.5, borderColor: betResult.won ? "#4ADE80" : "#FF4D4D", backgroundColor: betResult.won ? "rgba(74,222,128,0.08)" : "rgba(255,77,77,0.08)" }}>
              <Text style={{ color: betResult.won ? "#4ADE80" : "#FF4D4D", fontSize: 14, fontWeight: "900", textAlign: "center" }}>
                {betResult.won ? `🎉 BET WON! +${betResult.payout}🪙` : "❌ BET LOST"}
              </Text>
              {!betResult.won && <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, textAlign: "center", marginTop: 4 }}>Lowest IQ: {getPersona(betResult.lowestId)?.shortName || betResult.lowestId}</Text>}
            </View>
          )}

          {/* ── DEBATE MODE ─────────────────────────────────── */}
          <Text style={{ color: "#FFD700", fontSize: 14, fontWeight: "800", marginBottom: 8, marginTop: 4 }}>DEBATE MODE</Text>
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 14 }}>
            {(["civil", "elevated", "savage"] as const).map((mode) => {
              const modeConfig = {
                civil:    { label: "🕊 Civil",    color: "#60A5FA", desc: "Facts & logic" },
                elevated: { label: "🔥 Elevated",  color: "#FFD700", desc: "Heated debate" },
                savage:   { label: "💀 Savage",    color: "#FF4D4D", desc: "No holds barred" },
              }[mode];
              const isActive = debateMode === mode;
              return (
                <Pressable
                  key={mode}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setDebateMode(mode); }}
                  style={{
                    flex: 1, padding: 10, borderRadius: 12, alignItems: "center",
                    borderWidth: 1.5, borderColor: isActive ? modeConfig.color : "rgba(255,255,255,0.1)",
                    backgroundColor: isActive ? modeConfig.color + "18" : "rgba(255,255,255,0.04)",
                  }}
                >
                  <Text style={{ color: isActive ? modeConfig.color : "#888", fontSize: 12, fontWeight: "800" }}>{modeConfig.label}</Text>
                  <Text style={{ color: isActive ? modeConfig.color + "bb" : "rgba(255,255,255,0.3)", fontSize: 10, marginTop: 2 }}>{modeConfig.desc}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* ── TOPIC CATEGORY ──────────────────────────────── */}
          <Text style={{ color: "#FFD700", fontSize: 14, fontWeight: "800", marginBottom: 8 }}>CHOOSE TOPIC</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }} contentContainerStyle={{ gap: 6, paddingVertical: 2 }}>
            {[
              { key: "politics", label: "🏛 Politics",   color: "#FF4D4D" },
              { key: "sports",   label: "🏆 Sports",     color: "#F59E0B" },
              { key: "science",  label: "🔭 Science",    color: "#60A5FA" },
              { key: "health",   label: "💊 Health",     color: "#4ADE80" },
              { key: "wealth",   label: "💰 Wealth",     color: "#FFD700" },
              { key: "finance",  label: "📈 Finance",    color: "#A78BFA" },
              { key: "motivation", label: "🚀 Motivation", color: "#FB923C" },
            ].map(({ key, label, color }) => {
              const isActive = topicCategory === key;
              return (
                <Pressable
                  key={key}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setTopicCategory(key); }}
                  style={{
                    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5,
                    borderColor: isActive ? color : "rgba(255,255,255,0.12)",
                    backgroundColor: isActive ? color + "20" : "rgba(255,255,255,0.04)",
                  }}
                >
                  <Text style={{ color: isActive ? color : "#888", fontSize: 12, fontWeight: "700" }}>{label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setUseCustomTopic(!useCustomTopic);
              if (!useCustomTopic) setSelectedTopicId(null);
            }}
            style={{
              padding: 12, borderRadius: 12, marginBottom: 10, borderWidth: 1.5,
              borderColor: useCustomTopic ? "#FFD700" : "rgba(255,255,255,0.1)",
              backgroundColor: useCustomTopic ? "rgba(255,215,0,0.12)" : "rgba(255,255,255,0.04)",
              flexDirection: "row", alignItems: "center",
            }}
          >
            <Ionicons name="create-outline" size={18} color={useCustomTopic ? "#FFD700" : "#888"} style={{ marginRight: 8 }} />
            <Text style={{ color: useCustomTopic ? "#FFD700" : "#ccc", fontSize: 14, fontWeight: "800" }}>CREATE YOUR OWN TOPIC</Text>
          </Pressable>
          {useCustomTopic && (
            <TextInput
              value={customTopicText}
              onChangeText={setCustomTopicText}
              placeholder="Type your debate topic..."
              placeholderTextColor="rgba(255,255,255,0.3)"
              style={{
                borderWidth: 1.5, borderColor: "#FFD700", borderRadius: 12, padding: 12, marginBottom: 12,
                color: "#fff", fontSize: 14, backgroundColor: "rgba(255,215,0,0.08)", minHeight: 50,
              }}
              multiline
              maxLength={200}
            />
          )}

          {!useCustomTopic && dynamicTopics.map((topic) => {
            const isSelected = selectedTopicId === topic.id;
            return (
              <Pressable
                key={topic.id}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setSelectedTopicId(isSelected ? null : topic.id);
                }}
                style={{
                  padding: 12, borderRadius: 12, marginBottom: 8, borderWidth: 1.5,
                  borderColor: isSelected ? "#FF4D4D" : "rgba(255,255,255,0.1)",
                  backgroundColor: isSelected ? "rgba(255,77,77,0.15)" : "rgba(255,255,255,0.04)",
                }}
              >
                <Text style={{ color: isSelected ? "#FF4D4D" : "#ccc", fontSize: 14, fontWeight: "800" }}>{topic.title}</Text>
                <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, marginTop: 3 }} numberOfLines={2}>{topic.description}</Text>
              </Pressable>
            );
          })}

          <Pressable
            onPress={async () => {
              const canStart = selectedPersonas.length >= 2 && !(useCustomTopic && !customTopicText.trim()) && !!deviceId;
              if (!canStart || isStarting) return;
              setIsStarting(true);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

              // Safety net: if anything throws unexpectedly, always unlock the button
              try {
                let liveFreeRemaining = freeRemaining;
                let liveHasSession = hasSession;

                {
                  const controller = new AbortController();
                  const timeoutId = setTimeout(() => controller.abort(), 5000);
                  try {
                    const res = await fetch(new URL("/api/arena/status", getApiUrl()).toString(), {
                      headers: { "x-device-id": deviceId! },
                      signal: controller.signal,
                    });
                    if (res.ok) {
                      const data = await res.json();
                      liveFreeRemaining = data.freeRemaining ?? liveFreeRemaining;
                      liveHasSession = data.hasSession ?? liveHasSession;
                      setFreeRemaining(liveFreeRemaining);
                      setHasSession(liveHasSession);
                      if (data.sessionExpiresAt) setSessionExpiresAt(data.sessionExpiresAt);
                    }
                  } catch {} finally {
                    clearTimeout(timeoutId);
                  }
                }

                if (!liveHasSession && liveFreeRemaining <= 0) {
                  try {
                    const trialRes = await fetch(new URL("/api/arena/free-trial", getApiUrl()).toString(), {
                      method: "POST",
                      headers: { "x-device-id": deviceId!, "Content-Type": "application/json" },
                    });
                    if (trialRes.ok) {
                      const trialData = await trialRes.json();
                      if (trialData.granted && trialData.expiresAt) {
                        liveHasSession = true;
                        setHasSession(true);
                        setSessionExpiresAt(trialData.expiresAt);
                      }
                    }
                  } catch {}
                  if (!liveHasSession) {
                    setShowPaywall(true);
                    return; // finally will reset isStarting
                  }
                }

                sessionEndedRef.current = false;
                isInterruptingRef.current = false;

                if (useCustomTopic && customTopicText.trim()) {
                  setCurrentTopic(customTopicText.trim());
                  currentTopicRef.current = customTopicText.trim();
                } else if (selectedTopicId) {
                  const topic = dynamicTopics.find((t) => t.id === selectedTopicId);
                  if (topic) {
                    setCurrentTopic(topic.title);
                    currentTopicRef.current = topic.title;
                  }
                }
                setShowPreDebateSetup(false);
                setShowIntro(true);
              } catch (err) {
                // Swallow unexpected errors — button will be unlocked by finally
              } finally {
                setIsStarting(false);
              }
            }}
            disabled={isStarting}
            style={{
              marginTop: 20, paddingVertical: 16, borderRadius: 16, alignItems: "center",
              backgroundColor: (selectedPersonas.length >= 2 && !(useCustomTopic && !customTopicText.trim()) && !isStarting && !!deviceId) ? "#FF4D4D" : "rgba(255,255,255,0.1)",
              opacity: (selectedPersonas.length >= 2 && !(useCustomTopic && !customTopicText.trim()) && !isStarting && !!deviceId) ? 1 : 0.4,
            }}
          >
            <Text style={{ color: "#fff", fontSize: 18, fontWeight: "900", letterSpacing: 1 }}>
              {isStarting ? "LOADING..." : !deviceId ? "CONNECTING..." : "START DEBATE"}
            </Text>
            <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 11, marginTop: 2 }}>
              {selectedPersonas.length} debaters{useCustomTopic && customTopicText.trim() ? " • Custom topic" : selectedTopicId ? " • Topic selected" : " • Random topic"}
            </Text>
          </Pressable>

          <CashAppDonate />
        </ScrollView>
      </ImageBackground>
    );
  }

  if (showIntro) {
    return (
      <ArenaIntro
        personas={selectedPersonas}
        onComplete={() => {
          setShowIntro(false);
          startDebate();
        }}
      />
    );
  }

  return (
    <ImageBackground
      source={require("../assets/images/dynamic-creations-arena-bg.jpg")}
      style={[s.container, { paddingTop: insets.top + webTopInset }]}
      imageStyle={{ opacity: 0.22, resizeMode: "cover" }}
    >
      <LinearGradient
        colors={["rgba(0,0,0,0.68)", "rgba(0,0,0,0.45)", "rgba(0,0,0,0.72)"]}
        style={StyleSheet.absoluteFill}
      />

      {/* TikTok demo QR overlay — visible in screen recordings */}
      <View pointerEvents="none" style={{ position: "absolute", bottom: insets.bottom + 175, right: 14, zIndex: 9999, alignItems: "center" }}>
        <View style={{ backgroundColor: "rgba(0,0,0,0.72)", borderRadius: 10, padding: 6, borderWidth: 1, borderColor: "rgba(255,215,0,0.45)" }}>
          <Image source={require("../assets/images/qr-download.jpg")} style={{ width: 72, height: 72, borderRadius: 6 }} resizeMode="contain" />
          <Text style={{ color: "#FFD700", fontSize: 8, fontWeight: "700", textAlign: "center", marginTop: 3, letterSpacing: 0.5 }}>SCAN TO TRY</Text>
        </View>
      </View>

      <Animated.View entering={FadeInDown.duration(400)} style={s.header}>
        {(showPreDebateSetup || showIntro) ? (
          <Pressable onPress={() => router.back()} style={s.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </Pressable>
        ) : (
          <Pressable onPress={() => {
            showLeaveAlert(() => {
              confirmedExitRef.current = true;
              router.back();
            });
          }} style={[s.backBtn, { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(255,77,77,0.15)", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }]}>
            <Ionicons name="exit-outline" size={18} color="#ff4d4d" />
            <Text style={{ color: "#ff4d4d", fontSize: 11, fontWeight: "800" }}>EXIT</Text>
          </Pressable>
        )}
        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>THE ARENA</Text>
          <Animated.View entering={ZoomIn.duration(500).delay(300)} style={s.liveBadge}>
            <View style={s.liveDot} />
            <Text style={s.liveText}>LIVE</Text>
          </Animated.View>
        </View>
        <Pressable onPress={() => setShowPersonaSelector(true)} style={s.headerIconBtn}>
          <Ionicons name="people" size={18} color="#FFD700" />
        </Pressable>
        {altFactCount > 0 && (
          <Pressable
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setLiesSheetOpen(true); }}
            style={[s.headerIconBtn, { backgroundColor: "rgba(251,191,36,0.15)", borderColor: "rgba(251,191,36,0.5)" }]}
            testID="arena-altfact-counter"
          >
            <Ionicons name="star-half" size={15} color="#FBB924" />
            <Text style={{ color: "#FBB924", fontSize: 10, fontWeight: "900", marginLeft: 2 }}>{altFactCount}</Text>
          </Pressable>
        )}
        <Pressable
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setLiesSheetOpen(true); }}
          style={[s.headerIconBtn, lieCount > 0 && { backgroundColor: "rgba(255,77,77,0.15)", borderColor: "rgba(255,77,77,0.5)" }]}
          testID="arena-lie-counter"
        >
          <Ionicons name="flash" size={16} color={lieCount > 0 ? "#ff4d4d" : "rgba(255,255,255,0.6)"} />
          {lieCount > 0 && (
            <Text style={{ color: "#ff4d4d", fontSize: 10, fontWeight: "900", marginLeft: 2 }}>{lieCount}</Text>
          )}
        </Pressable>
        <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); fetchVerdict(); }} style={[s.headerIconBtn, { borderColor: "rgba(255,215,0,0.4)" }]} testID="arena-verdict">
          <Ionicons name="scale" size={16} color="#FFD700" />
        </Pressable>
        <Pressable onPress={shareDebate} style={s.headerIconBtn}>
          <Ionicons name="share-social" size={18} color="#fff" />
        </Pressable>
        <Pressable onPress={toggleRunning} style={s.headerIconBtn}>
          <Ionicons name={isRunning ? "pause" : "play"} size={18} color="#fff" />
        </Pressable>
      </Animated.View>

      <Animated.View entering={FadeIn.duration(300).delay(200)} style={s.voiceRow}>
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
        <Pressable
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setBleepEnabled((p) => !p); }}
          style={[s.voiceToggle, bleepEnabled && { borderColor: "#60A5FA", backgroundColor: "rgba(96,165,250,0.15)" }]}
        >
          <Ionicons name={bleepEnabled ? "shield-checkmark" : "shield-outline"} size={16} color={bleepEnabled ? "#60A5FA" : "#aaa"} />
          <Text style={[s.voiceToggleText, bleepEnabled && { color: "#60A5FA" }]}>
            {bleepEnabled ? "BLEEP ON" : "BLEEP OFF"}
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
        <Pressable
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowScoreboard((p) => !p); }}
          style={[s.scoreboardToggle, showScoreboard && { backgroundColor: "rgba(255,215,0,0.2)" }]}
        >
          <Ionicons name="trophy" size={14} color="#FFD700" />
          <Text style={s.scoreboardToggleText}>SCORE {Object.values(allTimeScores).reduce((a, b) => a + b.totalPoints, 0) || Object.values(personaPoints).reduce((a, b) => a + b, 0)}</Text>
        </Pressable>
        {hasSession && sessionTimer > 0 && (
          <View style={s.sessionPill}>
            <Ionicons name="time" size={12} color="#4ADE80" />
            <Text style={s.sessionPillText}>
              {Math.floor(sessionTimer / 60)}:{(sessionTimer % 60).toString().padStart(2, "0")}
            </Text>
          </View>
        )}
        {roomTemperature > 0 && (
          <Animated.View style={[s.heatMeterContainer, heatSpikeStyle]}>
            <Text style={s.heatLabel}>
              {roomTemperature >= 80 ? "🔥" : roomTemperature >= 50 ? "⚡" : "🌡️"}
            </Text>
            <View style={s.heatBarOuter}>
              <View style={[
                s.heatBarInner,
                {
                  width: `${roomTemperature}%` as any,
                  backgroundColor: roomTemperature >= 80 ? "#FF3B30" : roomTemperature >= 50 ? "#FF9500" : "#FFD700",
                },
              ]} />
            </View>
          </Animated.View>
        )}
        {!hasSession && freeRemaining > 0 && freeRemaining < 5 && (
          <Text style={s.freeCountLabel}>{freeRemaining} free left</Text>
        )}
        <Pressable onPress={shareCurrentSession} style={s.arenaActionBtn} hitSlop={8}>
          <Ionicons name="share-outline" size={14} color="#D4A420" />
          <Text style={s.arenaActionBtnText}>SHARE</Text>
        </Pressable>
        <Pressable onPress={() => router.push("/arena-replay")} style={s.arenaActionBtn} hitSlop={8}>
          <Ionicons name="albums-outline" size={14} color="#D4A420" />
          <Text style={s.arenaActionBtnText}>REPLAYS</Text>
        </Pressable>
        <Pressable onPress={async () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          try {
            const res = await fetch(new URL("/api/arena/global-leaderboard", getApiUrl()).toString());
            if (res.ok) setGlobalLeaderboardData(await res.json());
          } catch {}
          setShowGlobalLeaderboard(true);
        }} style={s.arenaActionBtn} hitSlop={8}>
          <Ionicons name="trophy-outline" size={14} color="#D4A420" />
          <Text style={s.arenaActionBtnText}>GLOBAL</Text>
        </Pressable>
        <Pressable onPress={async () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          try {
            const headers: Record<string, string> = {};
            if (deviceId) headers["x-device-id"] = deviceId;
            const res = await fetch(new URL("/api/arena/winners-stats", getApiUrl()).toString(), { headers });
            if (res.ok) setWinnersStatsData(await res.json());
          } catch {}
          setShowWinnersStats(true);
        }} style={s.arenaActionBtn} hitSlop={8}>
          <Ionicons name="podium-outline" size={14} color="#D4A420" />
          <Text style={s.arenaActionBtnText}>WINNERS</Text>
        </Pressable>
      </Animated.View>

      {breakingNewsBanner && (
        <Animated.View entering={SlideInUp.duration(400)} exiting={SlideOutUp.duration(400)} style={{
          backgroundColor: bannerFlash ? "#EE0000" : "#990000", paddingVertical: 10, paddingHorizontal: 16,
          marginHorizontal: 12, marginBottom: 6, borderRadius: 10,
          flexDirection: "column", alignItems: "center",
          borderWidth: 2, borderColor: bannerFlash ? "#FF4444" : "#CC0000",
          shadowColor: "#FF0000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: bannerFlash ? 0.8 : 0.3, shadowRadius: bannerFlash ? 12 : 6,
        }}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: bannerFlash ? "#FF0000" : "#880000", marginRight: 6 }} />
            <Text style={{ color: "#fff", fontSize: 13, fontWeight: "900", letterSpacing: 2 }}>BREAKING NEWS</Text>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: bannerFlash ? "#FF0000" : "#880000", marginLeft: 6 }} />
          </View>
          <Text style={{ color: "#fff", fontSize: 13, fontWeight: "700", textAlign: "center" }} numberOfLines={2}>
            {breakingNewsBanner.headline}
          </Text>
          <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 10, marginTop: 2 }}>
            {breakingNewsBanner.source}
          </Text>
        </Animated.View>
      )}

      {showScoreboard && (
        <Animated.View entering={FadeInDown.duration(300)} style={s.scoreboardPanel}>
          <Text style={s.scoreboardTitle}>ALL-TIME LEADERS</Text>
          {Object.entries(allTimeScores)
            .sort(([, a], [, b]) => b.totalPoints - a.totalPoints)
            .slice(0, 8)
            .map(([pid, score], idx) => {
              const p = getPersona(pid);
              if (!p) return null;
              return (
                <View key={pid} style={s.scoreRow}>
                  <Text style={[s.scoreRank, idx === 0 && { color: "#FFD700" }, idx === 1 && { color: "#C0C0C0" }, idx === 2 && { color: "#CD7F32" }]}>#{idx + 1}</Text>
                  {p.image ? (
                    <Image source={p.image} style={s.scoreAvatar} />
                  ) : (
                    <View style={[s.scoreAvatarFallback, { backgroundColor: p.color }]}>
                      <Text style={{ fontSize: 8, color: "#fff", fontWeight: "800" as const }}>{getInitials(p.name)}</Text>
                    </View>
                  )}
                  <Text style={[s.scoreName, { color: p.color }]}>{p.shortName}</Text>
                  <Text style={s.scorePoints}>{score.totalPoints} pts</Text>
                  <Text style={s.scoreVotes}>{score.totalVotes} votes</Text>
                </View>
              );
            })}
          {Object.keys(allTimeScores).length === 0 && Object.keys(personaPoints).length === 0 && (
            <Text style={s.scoreEmpty}>Tap persona icons to award points!</Text>
          )}
          {Object.keys(allTimeScores).length === 0 && Object.keys(personaPoints).length > 0 && (
            <>
              <Text style={[s.scoreboardTitle, { marginTop: 8, fontSize: 11 }]}>THIS SESSION</Text>
              {Object.entries(personaPoints)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 5)
                .map(([pid, pts], idx) => {
                  const p = getPersona(pid);
                  if (!p) return null;
                  return (
                    <View key={pid} style={s.scoreRow}>
                      <Text style={[s.scoreRank, idx === 0 && { color: "#FFD700" }]}>#{idx + 1}</Text>
                      {p.image ? (
                        <Image source={p.image} style={s.scoreAvatar} />
                      ) : (
                        <View style={[s.scoreAvatarFallback, { backgroundColor: p.color }]}>
                          <Text style={{ fontSize: 8, color: "#fff", fontWeight: "800" as const }}>{getInitials(p.name)}</Text>
                        </View>
                      )}
                      <Text style={[s.scoreName, { color: p.color }]}>{p.shortName}</Text>
                      <Text style={s.scorePoints}>{pts} pts</Text>
                    </View>
                  );
                })}
            </>
          )}
        </Animated.View>
      )}

      {(() => {
        const activeSpeakerId = ttsActiveSpeaker || currentSpeaker;
        const sp = activeSpeakerId ? getPersona(activeSpeakerId) : null;
        if (!sp) return null;
        const spVotes = speakerVoteCounts[activeSpeakerId!] || 0;
        const maxVotes = spVotes >= 5;
        return (
          <Animated.View
            key={activeSpeakerId}
            entering={FadeIn.duration(200)}
            exiting={FadeOut.duration(300)}
            style={{
              position: "absolute",
              bottom: 180,
              right: 12,
              zIndex: 50,
              alignItems: "center",
            }}
          >
            <Pressable
              onPress={() => {
                if (maxVotes) return;
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                if (spVotes === 4) playVoteSound2();
                voteForPersona(activeSpeakerId!);
              }}
              style={{
                width: speakingOverlaySize,
                height: speakingOverlaySize,
                borderRadius: speakingOverlaySize * 0.18,
                backgroundColor: sp.color + "22",
                borderWidth: 2.5,
                borderColor: "#FFD700",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                opacity: 0.82,
                shadowColor: "#FFD700",
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.6,
                shadowRadius: 16,
              }}
            >
              {sp.image ? (
                <Image source={sp.image} style={[{ width: speakingOverlaySize, height: speakingOverlaySize, borderRadius: speakingOverlaySize * 0.16 }, CARTOON_FILTER]} />
              ) : (
                <View style={{ width: speakingOverlaySize, height: speakingOverlaySize, alignItems: "center", justifyContent: "center", backgroundColor: sp.color + "40" }}>
                  <Text style={{ fontSize: speakingOverlaySize * 0.32, fontWeight: "800" as const, color: "#fff" }}>{getInitials(sp.name)}</Text>
                </View>
              )}
              <View style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                paddingVertical: 5,
                backgroundColor: "rgba(0,0,0,0.65)",
                alignItems: "center",
              }}>
                <Text style={{ color: "#FFD700", fontSize: speakingOverlaySize * 0.12, fontWeight: "900" as const, letterSpacing: 0.5 }} numberOfLines={1}>
                  {sp.shortName}
                </Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 3, marginTop: 2 }}>
                  <MaterialCommunityIcons name="volume-high" size={speakingOverlaySize * 0.1} color="#FFD700" />
                  <Text style={{ color: "rgba(255,215,0,0.7)", fontSize: speakingOverlaySize * 0.09, fontWeight: "700" as const }}>SPEAKING</Text>
                </View>
              </View>
            </Pressable>
            <Pressable
              onPress={() => {
                if (maxVotes) return;
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                if (spVotes === 4) playVoteSound2();
                voteForPersona(activeSpeakerId!);
              }}
              style={{
                marginTop: 6,
                paddingHorizontal: 12,
                paddingVertical: 5,
                borderRadius: 20,
                backgroundColor: maxVotes ? "rgba(255,0,0,0.3)" : "rgba(255,215,0,0.2)",
                borderWidth: 1,
                borderColor: maxVotes ? "rgba(255,0,0,0.5)" : "rgba(255,215,0,0.5)",
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
              }}
            >
              <Ionicons name={maxVotes ? "checkmark-circle" : "thumbs-up"} size={12} color={maxVotes ? "#ff4d4d" : "#FFD700"} />
              <Text style={{ color: maxVotes ? "#ff4d4d" : "#FFD700", fontSize: 11, fontWeight: "800" as const }}>
                {maxVotes ? "MAX" : `VOTE ${spVotes}/5`}
              </Text>
            </Pressable>
          </Animated.View>
        );
      })()}

      <Animated.View entering={FadeInDown.delay(200).duration(400)} style={s.personaRow}>
        {selectedPersonas.map((pid) => {
          const p = getPersona(pid);
          if (!p) return null;
          const emo = emotionalStates[pid] || { anger: 20, happiness: 50, engagement: 50, lastSpoke: null };
          const isSpeaking = currentSpeaker === pid || ttsActiveSpeaker === pid;
          const isFocused = focusedPersona === pid;
          const voteAnim = voteAnimations[pid] || 0;
          const allTime = allTimeScores[pid];
          const sessionPts = personaPoints[pid] || 0;
          const isEnlarged = isSpeaking || isFocused;
          // ── HEAT RING ─────────────────────────────────────────────────────
          const rawHeat = personaHeat[pid] || 0;
          const heatThresh = getArenaAggression(pid).angerThresh;
          const heatPct = heatThresh > 0 ? rawHeat / heatThresh : 0;
          const heatAmber = !isSpeaking && heatPct >= 0.5 && heatPct < 1.0;
          const heatDanger = !isSpeaking && heatPct >= 1.0;
          // ─────────────────────────────────────────────────────────────────
          return (
            <Animated.View
              key={pid}
              style={[
                isEnlarged && {
                  transform: [{ scale: isSpeaking ? 1.35 : 1.1 }],
                  zIndex: 10,
                  elevation: 10,
                },
              ]}
            >
              <Pressable
                onPress={() => {
                  const count = speakerVoteCounts[pid] || 0;
                  if (count >= 5) {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                    return;
                  }
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  if (count === 4) {
                    playVoteSound2();
                  }
                  voteForPersona(pid);
                }}
                onLongPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setFocusedPersona(focusedPersona === pid ? null : pid);
                }}
                style={[
                  s.personaCircle,
                  { borderColor: p.color },
                  isSpeaking && {
                    borderColor: "#FFD700",
                    borderWidth: 3,
                    shadowColor: "#FFD700",
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 0.8,
                    shadowRadius: 12,
                  },
                  // Amber glow: heat at 50–99% of threshold
                  heatAmber && {
                    borderColor: "#F59E0B",
                    borderWidth: 2,
                    shadowColor: "#F59E0B",
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 0.55,
                    shadowRadius: 8,
                  },
                  // Pulsing red ring: heat at or above threshold
                  heatDanger && {
                    borderColor: heatPulseOn ? "#FF3B30" : "#FF3B3070",
                    borderWidth: heatPulseOn ? 3 : 2,
                    shadowColor: "#FF3B30",
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: heatPulseOn ? 0.9 : 0.35,
                    shadowRadius: heatPulseOn ? 18 : 7,
                  },
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
                {voteAnim > 0 && (
                  <Animated.View entering={FadeIn.duration(200)} style={s.votePopup}>
                    <Text style={s.votePopupText}>+1 ({voteAnim}/5)</Text>
                  </Animated.View>
                )}
                {(speakerVoteCounts[pid] || 0) >= 5 && (
                  <View style={[s.votableIndicator, { backgroundColor: "rgba(255,0,0,0.4)" }]}>
                    <Ionicons name="checkmark" size={8} color="#fff" />
                  </View>
                )}
                <Text style={[s.personaLabel, { color: isSpeaking ? "#FFD700" : p.color }]} numberOfLines={1}>
                  {p.shortName}
                </Text>
                {personaSessionIQ[pid] !== undefined && (
                  <Animated.Text
                    key={`iq-${pid}-${personaSessionIQ[pid]}`}
                    entering={ZoomIn.duration(250)}
                    style={[s.personaIqLabel, { color: iqColor(personaSessionIQ[pid]) }]}
                  >
                    {personaSessionIQ[pid] < 70 ? "😵 " : personaSessionIQ[pid] > 160 ? "🌟 " : ""}IQ {Math.round(personaSessionIQ[pid])}
                  </Animated.Text>
                )}
                {alltimeIQRef.current[pid] !== undefined && (
                  <Text style={[s.personaIqLabel, { color: "#888", fontSize: 9 }]}>
                    ★ {Math.round(alltimeIQRef.current[pid])} all-time
                  </Text>
                )}
                {(personaAltTruths[pid] || 0) > 0 && (
                  <Animated.Text
                    key={`alt-${pid}-${personaAltTruths[pid]}`}
                    entering={ZoomIn.duration(250)}
                    style={s.personaAltTruthLabel}
                  >
                    Alt. Truths: {personaAltTruths[pid]}
                  </Animated.Text>
                )}
                {(sessionPts > 0 || (allTime && allTime.totalPoints > 0)) && (
                  <View style={s.personaScoreBadge}>
                    <Text style={s.personaScoreText}>
                      {allTime ? allTime.totalPoints : sessionPts}
                    </Text>
                  </View>
                )}
                <View style={s.emotionBars}>
                  <View style={[s.emotionBar, s.angerBar, { width: `${emo.anger}%` }]} />
                  <View style={[s.emotionBar, s.happyBar, { width: `${emo.happiness}%` }]} />
                </View>
              </Pressable>
            </Animated.View>
          );
        })}
      </Animated.View>

      {focusedPersona && (
        <Animated.View entering={FadeIn.duration(200)} style={s.focusCard}>
          {(() => {
            const fp = getPersona(focusedPersona);
            const fEmo = emotionalStates[focusedPersona] || { anger: 20, happiness: 50, engagement: 50, lastSpoke: null };
            if (!fp) return null;
            return (<>
          <View style={s.focusHeader}>
            <Text style={[s.focusName, { color: fp.color }]}>
              {fp.name}
            </Text>
            <View style={[s.factionBadge, { backgroundColor: FACTION_COLORS[fp.faction] + "30", borderColor: FACTION_COLORS[fp.faction] + "60" }]}>
              <Text style={[s.factionText, { color: FACTION_COLORS[fp.faction] }]}>
                {fp.faction}
              </Text>
            </View>
          </View>
          <View style={s.focusStats}>
            <View style={s.focusStat}>
              <Ionicons name="flame" size={12} color="#ff4d4d" />
              <Text style={s.focusStatLabel}>Anger</Text>
              <View style={[s.focusStatBar, s.angerBar, { width: `${fEmo.anger}%` }]} />
              <Text style={s.focusStatVal}>{fEmo.anger}%</Text>
            </View>
            <View style={s.focusStat}>
              <Ionicons name="happy" size={12} color="#4ADE80" />
              <Text style={s.focusStatLabel}>Happy</Text>
              <View style={[s.focusStatBar, s.happyBar, { width: `${fEmo.happiness}%` }]} />
              <Text style={s.focusStatVal}>{fEmo.happiness}%</Text>
            </View>
            <View style={s.focusStat}>
              <Ionicons name="flash" size={12} color="#FBBF24" />
              <Text style={s.focusStatLabel}>Energy</Text>
              <View style={[s.focusStatBar, { backgroundColor: "#FBBF24" }, { width: `${fEmo.engagement}%` }]} />
              <Text style={s.focusStatVal}>{fEmo.engagement}%</Text>
            </View>
            {focusedPersona !== null && personaSessionIQ[focusedPersona] !== undefined && (() => {
              const iq = personaSessionIQ[focusedPersona as string];
              const col = iqColor(iq);
              const altCount = personaAltTruths[focusedPersona as string] || 0;
              const trueIq = alltimeIQRef.current[focusedPersona as string];
              return (<>
                <View style={s.focusStat}>
                  <Ionicons name="bulb-outline" size={12} color={col} />
                  <Text style={[s.focusStatLabel, { color: col, fontWeight: "800" as const }]}>
                    {iq < 70 ? "😵 " : iq > 160 ? "🌟 " : ""}{iqLabelFull(iq)}
                  </Text>
                  <View style={[s.focusStatBar, { backgroundColor: col }, { width: `${Math.min(100, Math.round(iq / 2))}%` }]} />
                  <Text style={[s.focusStatVal, { color: col }]}>{Math.round(iq)}/200</Text>
                </View>
                {trueIq !== undefined && (
                  <View style={s.focusStat}>
                    <Ionicons name="star-outline" size={12} color="#C084FC" />
                    <Text style={[s.focusStatLabel, { color: "#C084FC", fontWeight: "700" as const }]}>True Arena IQ</Text>
                    <View style={[s.focusStatBar, { backgroundColor: "#C084FC" }, { width: `${Math.min(100, Math.round(trueIq / 2))}%` }]} />
                    <Text style={[s.focusStatVal, { color: "#C084FC" }]}>{Math.round(trueIq)}</Text>
                  </View>
                )}
                {altCount > 0 && (
                  <View style={s.focusStat}>
                    <Ionicons name="alert-circle" size={12} color="#F59E0B" />
                    <Text style={[s.focusStatLabel, { color: "#F59E0B", fontWeight: "800" as const }]}>Alt. Truths</Text>
                    <View style={[s.focusStatBar, { backgroundColor: "#F59E0B" }, { width: `${Math.min(100, altCount * 20)}%` }]} />
                    <Text style={[s.focusStatVal, { color: "#F59E0B" }]}>{altCount}</Text>
                  </View>
                )}
              </>);
            })()}
          </View>
          </>);
          })()}
        </Animated.View>
      )}

      <Animated.View entering={FadeInUp.duration(500).delay(400)} style={s.streamContainer}>
        <View style={s.streamHeader}>
          <View style={s.streamLive}>
            <View style={[s.liveDot, { width: 6, height: 6, borderRadius: 3 }]} />
            <Text style={s.streamHeaderText}>
              {(ttsActiveSpeaker || currentSpeaker)
                ? `${getPersona(ttsActiveSpeaker || currentSpeaker)?.shortName} is speaking...`
                : currentTopic ? currentTopic : "Real-time AI conversation"}
            </Text>
          </View>
          {(ttsActiveSpeaker || currentSpeaker) && <ActivityIndicator size="small" color={getPersona(ttsActiveSpeaker || currentSpeaker)?.color || "#fff"} />}
        </View>
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          style={s.streamList}
          contentContainerStyle={s.streamContent}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={true}
          maxToRenderPerBatch={8}
          windowSize={5}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          ListFooterComponent={currentTopic && pollCandidates.length >= 2 ? (
            <View style={s.pollSection}>
              <Text style={s.pollTitle}>
                {userVoted ? "POLL RESULTS" : "WHO'S WINNING THIS DEBATE?"}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.pollOptions}>
                {pollCandidates.map((pid) => {
                  const p = getPersona(pid);
                  if (!p) return null;
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
                    Enter your name — {getPersona(pollWinner)?.shortName} wants to thank you!
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
          ) : null}
        />
      </Animated.View>

      <Animated.View entering={FadeInUp.duration(400).delay(500)}>
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
      </Animated.View>

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

      {winTokenToast && (
        <Animated.View entering={SlideInUp.duration(350)} exiting={SlideOutUp.duration(300)} style={{
          position: "absolute", top: 80, left: 20, right: 20, zIndex: 9999,
          backgroundColor: "#14532d", borderRadius: 14, paddingVertical: 12, paddingHorizontal: 16,
          borderWidth: 1.5, borderColor: "#4ADE80",
          flexDirection: "row", alignItems: "center", gap: 10,
          shadowColor: "#4ADE80", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12,
        }}>
          <Text style={{ fontSize: 22 }}>🏆</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ color: "#4ADE80", fontSize: 14, fontWeight: "900" }}>{winTokenToast.personaName} WIN BONUS</Text>
            <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 12 }}>+{winTokenToast.tokens} DC tokens earned</Text>
          </View>
          <Text style={{ fontSize: 20 }}>🪙</Text>
        </Animated.View>
      )}

      <Modal visible={showWinnersStats} transparent animationType="slide">
        <View style={s.selectorOverlay}>
          <View style={[s.selectorCard, { maxHeight: "88%" }]}>
            <View style={s.selectorHeader}>
              <Text style={s.selectorTitle}>🏆 WINNERS HALL OF FAME</Text>
              <Pressable onPress={() => setShowWinnersStats(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </Pressable>
            </View>
            {winnersStatsData && (
              <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
                <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
                  <View style={{ flex: 1, backgroundColor: "rgba(255,215,0,0.08)", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: "rgba(255,215,0,0.2)", alignItems: "center" }}>
                    <Text style={{ color: "#FFD700", fontSize: 22, fontWeight: "900" }}>{winnersStatsData.totalWinsAllTime}</Text>
                    <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 10, marginTop: 2 }}>TOTAL WINS</Text>
                  </View>
                  <View style={{ flex: 1, backgroundColor: "rgba(74,222,128,0.08)", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: "rgba(74,222,128,0.2)", alignItems: "center" }}>
                    <Text style={{ color: "#4ADE80", fontSize: 22, fontWeight: "900" }}>{winnersStatsData.totalUniquePlayers}</Text>
                    <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 10, marginTop: 2 }}>PLAYERS</Text>
                  </View>
                  <View style={{ flex: 1, backgroundColor: "rgba(147,197,253,0.08)", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: "rgba(147,197,253,0.2)", alignItems: "center" }}>
                    <Text style={{ color: "#93c5fd", fontSize: 22, fontWeight: "900" }}>{winnersStatsData.userTotalWins}</Text>
                    <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 10, marginTop: 2 }}>YOUR WINS</Text>
                  </View>
                </View>

                <View style={{ backgroundColor: "rgba(74,222,128,0.08)", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: "rgba(74,222,128,0.2)", marginBottom: 16 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
                    <Ionicons name="flash" size={14} color="#4ADE80" style={{ marginRight: 6 }} />
                    <Text style={{ color: "#4ADE80", fontSize: 13, fontWeight: "800" }}>WIN TOKEN REWARDS</Text>
                  </View>
                  <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, lineHeight: 18 }}>
                    Earn 3–5 DC tokens for each arena win{"\n"}
                    Up to {winnersStatsData.maxDailyWinRewards} wins rewarded per day
                  </Text>
                  <View style={{ flexDirection: "row", alignItems: "center", marginTop: 8, gap: 6 }}>
                    {Array.from({ length: winnersStatsData.maxDailyWinRewards }).map((_, i) => (
                      <View key={i} style={{
                        width: 28, height: 28, borderRadius: 14,
                        backgroundColor: i < winnersStatsData.dailyWinEarnings ? "#4ADE80" : "rgba(255,255,255,0.1)",
                        alignItems: "center", justifyContent: "center",
                        borderWidth: 1.5, borderColor: i < winnersStatsData.dailyWinEarnings ? "#4ADE80" : "rgba(255,255,255,0.2)",
                      }}>
                        <Text style={{ fontSize: 10 }}>{i < winnersStatsData.dailyWinEarnings ? "✓" : "🪙"}</Text>
                      </View>
                    ))}
                    <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, marginLeft: 4 }}>
                      {winnersStatsData.dailyWinEarnings}/{winnersStatsData.maxDailyWinRewards} today
                    </Text>
                  </View>
                </View>

                <Text style={{ color: "#FFD700", fontSize: 13, fontWeight: "900", letterSpacing: 1, marginBottom: 10 }}>🏅 TOP WINNING PERSONAS</Text>
                {winnersStatsData.topPersonas.length === 0 && (
                  <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, marginBottom: 16 }}>No wins recorded yet — start a debate!</Text>
                )}
                {winnersStatsData.topPersonas.map((item, i) => {
                  const p = getPersona(item.personaId);
                  const myWins = winnersStatsData.userWins[item.personaId] || 0;
                  const medalColor = i === 0 ? "#FFD700" : i === 1 ? "#C0C0C0" : i === 2 ? "#CD7F32" : "#555";
                  return (
                    <View key={item.personaId} style={{
                      flexDirection: "row", alignItems: "center", paddingVertical: 10,
                      borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)",
                    }}>
                      <View style={{
                        width: 28, height: 28, borderRadius: 14,
                        backgroundColor: medalColor + "22", borderWidth: 1.5, borderColor: medalColor,
                        alignItems: "center", justifyContent: "center", marginRight: 10,
                      }}>
                        <Text style={{ color: medalColor, fontSize: 12, fontWeight: "900" }}>
                          {i === 0 ? "👑" : i === 1 ? "2" : i === 2 ? "3" : `${i + 1}`}
                        </Text>
                      </View>
                      {p?.image ? (
                        <Image source={p.image} style={{ width: 32, height: 32, borderRadius: 16, marginRight: 10 }} />
                      ) : (
                        <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: (p?.color || "#555") + "40", alignItems: "center", justifyContent: "center", marginRight: 10 }}>
                          <Text style={{ color: "#fff", fontSize: 12, fontWeight: "800" }}>{(p?.name || item.personaId)[0]}</Text>
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: p?.color || "#fff", fontSize: 14, fontWeight: "700" }}>{p?.name || item.personaId}</Text>
                        {myWins > 0 && <Text style={{ color: "#93c5fd", fontSize: 10 }}>You backed them {myWins}×</Text>}
                      </View>
                      <View style={{ alignItems: "flex-end" }}>
                        <Text style={{ color: "#4ADE80", fontSize: 16, fontWeight: "900" }}>{item.totalWins}</Text>
                        <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 10 }}>{item.totalWins === 1 ? "win" : "wins"}</Text>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            )}
            {!winnersStatsData && (
              <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                <ActivityIndicator color="#4ADE80" />
                <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, marginTop: 10 }}>Loading winners…</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={showGlobalLeaderboard} transparent animationType="slide">
        <View style={s.selectorOverlay}>
          <View style={[s.selectorCard, { maxHeight: "85%" }]}>
            <View style={s.selectorHeader}>
              <Text style={s.selectorTitle}>🏆 GLOBAL ARENA LEADERBOARD</Text>
              <Pressable onPress={() => setShowGlobalLeaderboard(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </Pressable>
            </View>
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
              <Text style={{ color: "#FFD700", fontSize: 14, fontWeight: "900", marginBottom: 8, letterSpacing: 1 }}>TOP VOTERS</Text>
              {globalLeaderboardData.topUsers.length === 0 && (
                <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, marginBottom: 16 }}>No voters yet — be the first!</Text>
              )}
              {globalLeaderboardData.topUsers.map((user, i) => (
                <View key={i} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)" }}>
                  <Text style={{ color: i === 0 ? "#FFD700" : i === 1 ? "#C0C0C0" : i === 2 ? "#CD7F32" : "#888", fontSize: 16, fontWeight: "900", width: 30 }}>
                    {i === 0 ? "👑" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`}
                  </Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: "#fff", fontSize: 14, fontWeight: "700" }}>{user.name}</Text>
                    <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 11 }}>
                      {user.totalMinutes}min • {user.totalSessions} sessions • {user.totalVotes} votes
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={{ color: "#FFD700", fontSize: 13, fontWeight: "800" }}>{user.tokensEarned} 🪙</Text>
                    <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 10 }}>earned</Text>
                  </View>
                </View>
              ))}
              <Text style={{ color: "#FFD700", fontSize: 14, fontWeight: "900", marginTop: 20, marginBottom: 8, letterSpacing: 1 }}>MOST POPULAR PERSONAS</Text>
              {globalLeaderboardData.topPersonas.map((p, i) => {
                const persona = getPersona(p.personaId);
                return (
                  <View key={p.personaId} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)" }}>
                    <Text style={{ color: i === 0 ? "#FFD700" : i === 1 ? "#C0C0C0" : i === 2 ? "#CD7F32" : "#888", fontSize: 16, fontWeight: "900", width: 30 }}>
                      {i === 0 ? "👑" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`}
                    </Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: persona?.color || "#fff", fontSize: 14, fontWeight: "700" }}>{persona?.name || p.personaId}</Text>
                      <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 11 }}>{p.totalVotes} votes</Text>
                    </View>
                    <Text style={{ color: "#FFD700", fontSize: 15, fontWeight: "900" }}>{p.totalPoints} pts</Text>
                  </View>
                );
              })}
              <View style={{ marginTop: 20, padding: 14, borderRadius: 12, backgroundColor: "rgba(255,215,0,0.08)", borderWidth: 1, borderColor: "rgba(255,215,0,0.2)" }}>
                <Text style={{ color: "#FFD700", fontSize: 13, fontWeight: "800", marginBottom: 6 }}>🎁 USAGE REWARDS</Text>
                <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, lineHeight: 18 }}>
                  15 min → 2 free tokens (Rookie){"\n"}
                  30 min → 3 free tokens (Regular){"\n"}
                  1 hour → 5 free tokens (Veteran){"\n"}
                  2 hours → 8 free tokens (Champion){"\n"}
                  5 hours → 15 free tokens (Legend)
                </Text>
                <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, marginTop: 6 }}>Rewards unlock automatically at session end</Text>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={showPersonaSelector} transparent animationType="slide">
        <View style={s.selectorOverlay}>
          <View style={s.selectorCard}>
            <View style={s.selectorHeader}>
              <Text style={s.selectorTitle}>Choose Debaters</Text>
              <Text style={s.selectorSubtitle}>{selectedPersonas.length} selected — pick 2 or more</Text>
            </View>
            {(() => {
              const CATEGORIES: Array<{ label: string; ids: string[]; mysteryIds: string[] }> = [
                { label: "🏛  PRESIDENTS", ids: ["trump", "biden"], mysteryIds: ["obama"] },
                { label: "⚖️  POLITICIANS", ids: ["netanyahu", "mcconnell", "omar", "graham", "pambondi", "miller", "jimjordan", "jascrockett", "aoc", "pressley", "timscott", "billclinton", "hillaryclinton", "marcorubio", "desantis"], mysteryIds: ["schumer", "kamala", "mtg", "rfk"] },
                { label: "📺  MEDIA & JOURNALISTS", ids: ["maddow", "megynkelly", "joyreid", "erikakirk", "loomer", "leavitt", "hannity"], mysteryIds: ["odonnell"] },
                { label: "🎙  PODCASTERS & STRATEGISTS", ids: ["galloway", "candace", "carville", "bannon", "joerogan"], mysteryIds: ["alexjones"] },
                { label: "🎭  COMEDIANS", ids: ["berniemc", "rosie", ...(!isHidden("carlin") ? ["carlin"] : [])], mysteryIds: [] },
                { label: "💻  TECH", ids: ["elon"], mysteryIds: [] },
                { label: "✊  COMMENTATORS & ACTIVISTS", ids: ["stephena", "jesseleepetersen", "shannon", "neiltyson", "malema", "claudeanderson", ...(!isHidden("drbenj") ? ["drbenj"] : [])], mysteryIds: [] },
                { label: "👥  FAMILY & OTHERS", ids: ["errol", "ivanka"], mysteryIds: ["melania"] },
              ];
              const lockedMysteryIds = MYSTERY_PERSONA_IDS.filter((id) => !unlockedMystery.includes(id));
              const renderPersonaCard = (pid: string, isMystery = false) => {
                const p = getPersona(pid);
                if (!p) return null;
                if (isHidden(pid)) return null;
                const isSelected = selectedPersonas.includes(pid);
                const isPremiumLocked = isLocked(pid);
                const premiumCfg = PREMIUM_PERSONA_CONFIGS[pid];
                const accentColor = isPremiumLocked ? (premiumCfg?.badgeColor || "#FFD700") : isSelected ? p.color : isMystery ? "#FFD700" : "rgba(255,255,255,0.1)";
                return (
                  <Pressable
                    key={pid}
                    onPress={() => {
                      if (isPremiumLocked && premiumCfg && deviceId) {
                        unlockWithTokens(pid, deviceId, refreshBalance);
                        return;
                      }
                      togglePersona(pid);
                    }}
                    style={[
                      s.selectorItem,
                      { borderColor: accentColor },
                      isSelected && { backgroundColor: p.color + "15" },
                      isPremiumLocked && { borderColor: (premiumCfg?.badgeColor || "#FFD700") + "60", backgroundColor: (premiumCfg?.badgeColor || "#FFD700") + "08" },
                    ]}
                  >
                    {p.image ? (
                      <Image source={p.image} style={[s.selectorAvatar, isPremiumLocked && { opacity: 0.6 }]} />
                    ) : (
                      <View style={[s.selectorAvatarFallback, { backgroundColor: p.color + "40" }]}>
                        <Text style={s.selectorAvatarInitials}>{getInitials(p.name)}</Text>
                      </View>
                    )}
                    <View style={s.selectorInfo}>
                      <Text style={[s.selectorName, { color: isPremiumLocked ? (premiumCfg?.badgeColor || "#FFD700") : isSelected ? p.color : isMystery ? "#FFD700" : "#aaa" }]}>
                        {p.shortName}{isPremiumLocked ? " 🔒" : isMystery ? " ★" : ""}
                      </Text>
                      <Text style={s.selectorFaction}>{isPremiumLocked && premiumCfg ? `${premiumCfg.tokenPrice} tokens to unlock` : p.faction}</Text>
                    </View>
                    {isSelected && !isPremiumLocked && <Ionicons name="checkmark-circle" size={18} color={p.color} />}
                  </Pressable>
                );
              };
              return (
                <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 8, paddingBottom: 12 }} showsVerticalScrollIndicator={false}>
                  {CATEGORIES.map((cat) => {
                    const catIds = [
                      ...cat.ids.filter((id) => getPersona(id)),
                      ...cat.mysteryIds.filter((id) => unlockedMystery.includes(id) && getPersona(id)),
                    ];
                    if (catIds.length === 0) return null;
                    return (
                      <View key={cat.label} style={{ marginBottom: 4 }}>
                        <Text style={{ color: "#FFD700", fontSize: 10, fontWeight: "bold" as const, letterSpacing: 1, marginBottom: 6, marginTop: 10, paddingHorizontal: 2 }}>{cat.label}</Text>
                        <View style={{ flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 6 }}>
                          {catIds.map((pid) => renderPersonaCard(pid, cat.mysteryIds.includes(pid)))}
                        </View>
                      </View>
                    );
                  })}
                  {lockedMysteryIds.length > 0 && (
                    <View style={{ marginTop: 10, borderTopWidth: 1, borderTopColor: "rgba(255,215,0,0.15)", paddingTop: 10 }}>
                      <Text style={{ color: "#FFD700", fontSize: 10, fontWeight: "bold" as const, letterSpacing: 1, marginBottom: 4, paddingHorizontal: 2 }}>🔒  MYSTERY PERSONAS</Text>
                      <Text style={{ color: "rgba(255,255,255,0.35)", fontSize: 10, marginBottom: 8, paddingHorizontal: 2 }}>10–15 D.C. Tokens to unlock each</Text>
                      <View style={{ flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 6 }}>
                        {lockedMysteryIds.map((pid) => (
                          <Pressable
                            key={pid}
                            onPress={() => unlockMysteryPersona(pid)}
                            style={[s.selectorItem, { borderColor: "rgba(255,215,0,0.3)", backgroundColor: "rgba(255,215,0,0.05)" }]}
                          >
                            {mysteryUnlocking === pid ? (
                              <ActivityIndicator size="small" color="#FFD700" />
                            ) : (
                              <View style={[s.selectorAvatarFallback, { backgroundColor: "rgba(255,215,0,0.2)" }]}>
                                <Ionicons name="help" size={18} color="#FFD700" />
                              </View>
                            )}
                            <View style={s.selectorInfo}>
                              <Text style={[s.selectorName, { color: "#FFD700" }]}>???</Text>
                              <Text style={{ color: "rgba(255,215,0,0.5)", fontSize: 9 }}>TAP TO UNLOCK</Text>
                            </View>
                            <Ionicons name="lock-closed" size={14} color="#FFD700" />
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  )}
                {Object.entries(PREMIUM_PERSONA_CONFIGS).filter(([id]) => isHidden(id)).length > 0 && (
                  <View style={{ marginTop: 10, borderTopWidth: 1, borderTopColor: "rgba(255,107,0,0.2)", paddingTop: 10 }}>
                    <Text style={{ color: "#FF6B00", fontSize: 10, fontWeight: "bold" as const, letterSpacing: 1, marginBottom: 4, paddingHorizontal: 2 }}>🔓  PREMIUM (LOCKED)</Text>
                    <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 10, marginBottom: 8, paddingHorizontal: 2 }}>Tap to unlock with tokens</Text>
                    <View style={{ flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 6 }}>
                      {Object.entries(PREMIUM_PERSONA_CONFIGS).filter(([id]) => isHidden(id)).map(([pid, cfg]) => (
                        <Pressable
                          key={pid}
                          onPress={() => deviceId && unlockWithTokens(pid, deviceId, refreshBalance)}
                          style={[{ flexDirection: "row" as const, alignItems: "center" as const, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5, borderColor: cfg.badgeColor + "60", backgroundColor: cfg.badgeColor + "10" }]}
                        >
                          {premiumUnlocking === pid ? (
                            <ActivityIndicator size="small" color={cfg.badgeColor} style={{ marginRight: 6 }} />
                          ) : (
                            <Ionicons name="lock-closed" size={12} color={cfg.badgeColor} style={{ marginRight: 5 }} />
                          )}
                          <Text style={{ color: cfg.badgeColor, fontSize: 11, fontWeight: "700" as const }}>{cfg.name} ({cfg.tokenPrice}🪙)</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                )}
                </ScrollView>
              );
            })()}
            <View style={s.selectorActions}>
              <Pressable
                onPress={() => setSelectedPersonas([...PERSONA_IDS, ...unlockedMystery, ...unlockedPremium.filter(id => !PERSONA_IDS.includes(id))])}
                style={s.selectorSelectAll}
              >
                <Text style={s.selectorSelectAllText}>Select All</Text>
              </Pressable>
              <Pressable
                onPress={() => { if (selectedPersonas.length >= 2) setShowPersonaSelector(false); }}
                style={[s.selectorDoneBtn, selectedPersonas.length < 2 && { opacity: 0.4 }]}
              >
                <Text style={s.selectorDoneText}>Done ({selectedPersonas.length})</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showExitModal} transparent animationType="fade">
        <View style={s.paywallOverlay}>
          <Animated.View entering={ZoomIn.duration(300)} style={[s.summaryCard, { maxWidth: 340 }]}>
            <Ionicons name="exit-outline" size={40} color="#ff4d4d" />
            <Text style={s.summaryTitle}>Leave Debate?</Text>
            <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, textAlign: "center", marginVertical: 10, lineHeight: 19 }}>
              {hasSession ? "Your paid session will be paused and saved. You can resume when you return." : "Your progress in this debate will be lost."}
            </Text>
            <Pressable onPress={cancelExit} style={[s.paywallBtn, { marginBottom: 10, width: "100%" }]}>
              <Text style={s.paywallBtnText}>Stay in Debate</Text>
            </Pressable>
            <Pressable onPress={confirmExit} style={[s.summaryActionBtn, { backgroundColor: "transparent", borderWidth: 1, borderColor: "#ff4d4d", width: "100%" }]}>
              <Ionicons name="exit-outline" size={16} color="#ff4d4d" />
              <Text style={[s.summaryActionText, { color: "#ff4d4d" }]}>Leave</Text>
            </Pressable>
          </Animated.View>
        </View>
      </Modal>

      <Modal visible={showContinuePrompt} transparent animationType="fade">
        <View style={s.paywallOverlay}>
          <Animated.View entering={ZoomIn.duration(400)} style={s.summaryCard}>
            <Ionicons name="timer-outline" size={40} color="#FFD700" />
            <Text style={s.summaryTitle}>TIME'S UP!</Text>
            <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 14, textAlign: "center" as const, marginBottom: 6 }}>
              Want to keep the debate going? Your scores will carry over.
            </Text>
            <Text style={{ color: "#FFD700", fontSize: 13, textAlign: "center" as const, marginBottom: 16 }}>
              1 token per minute
            </Text>
            <View style={s.durationRow}>
              {([5, 10, 15] as const).map((dur) => (
                <Pressable
                  key={dur}
                  onPress={() => setSelectedDuration(dur)}
                  style={[s.durationChip, selectedDuration === dur && s.durationChipActive]}
                >
                  <Text style={[s.durationChipText, selectedDuration === dur && s.durationChipTextActive]}>
                    {dur} min
                  </Text>
                  <Text style={[s.durationChipCost, selectedDuration === dur && s.durationChipCostActive]}>
                    {dur} tokens
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={s.paywallBalanceRow}>
              <Ionicons name="diamond" size={16} color="#FFD700" />
              <Text style={s.paywallBalance}>{balance?.totalAvailable ?? 0} tokens available</Text>
            </View>
            <Pressable
              onPress={() => {
                setShowContinuePrompt(false);
                unlockSession(true);
              }}
              disabled={isUnlocking}
              style={[s.paywallBtn, isUnlocking && { opacity: 0.6 }, { marginBottom: 10 }]}
            >
              {isUnlocking ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <Text style={s.paywallBtnText}>Continue Debate ({selectedDuration} tokens)</Text>
              )}
            </Pressable>
            <Pressable
              onPress={async () => {
                setShowContinuePrompt(false);
                const totalPts = Object.values(personaPointsRef.current).reduce((a, b) => a + b, 0);
                playWinnerChosenSound();
                setShowEndSummary(true);
                clearSavedSession();
                awardBadge("arena_debut");
                setTimeout(() => { playWinnerAfterSound(); }, 4000);
                if (totalPts === 0) {
                  // Nobody voted — AI picks the winner, then auto-fires Trump roast + winner clapback
                  setIsLoadingRoast(true);
                  try {
                    const r = await fetch(new URL("/api/arena/verdict", getApiUrl()).toString(), {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        topic: currentTopic || "General debate",
                        messages: messagesRef.current
                          .filter((m) => !m.isSystem && (m.text?.length ?? 0) > 5)
                          .slice(-60)
                          .map((m) => ({ speakerName: m.speakerName || m.speakerId, text: m.text })),
                        personas: selectedPersonasRef.current,
                      }),
                    });
                    if (r.ok) {
                      const v = await r.json();
                      const vWinner = (v.winner || "").toLowerCase();
                      const winnerId = selectedPersonasRef.current.find((pid) => {
                        const name = (getPersona(pid)?.name || "").toLowerCase();
                        return name.includes(vWinner) || vWinner.includes(name);
                      }) ?? selectedPersonasRef.current[0];
                      if (winnerId) {
                        // Set synthetic point so leaderboard renders the AI winner
                        personaPointsRef.current = { [winnerId]: 1 };
                        setPersonaPoints({ [winnerId]: 1 });
                        fetchTrumpRoast();
                      } else {
                        setIsLoadingRoast(false);
                      }
                    } else {
                      setIsLoadingRoast(false);
                    }
                  } catch { setIsLoadingRoast(false); }
                }
              }}
              style={[s.summaryActionBtn, { backgroundColor: "transparent", borderWidth: 1, borderColor: "#ff4d4d", width: "100%" }]}
            >
              <Ionicons name="stop-circle" size={16} color="#ff4d4d" />
              <Text style={[s.summaryActionText, { color: "#ff4d4d" }]}>End Session</Text>
            </Pressable>
            <Pressable onPress={() => { setShowContinuePrompt(false); router.push("/subscribe"); }} style={s.paywallSecondaryBtn}>
              <Text style={s.paywallSecondaryText}>Get More Tokens</Text>
            </Pressable>
          </Animated.View>
        </View>
      </Modal>

      <Modal visible={showEndSummary} transparent animationType="fade">
        <View style={s.paywallOverlay}>
          <Animated.View entering={ZoomIn.duration(500)} style={[s.summaryCard, { maxHeight: "85%" }]}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={{ alignItems: "center" }}>
            <Ionicons name="trophy" size={40} color="#FFD700" />
            <Text style={s.summaryTitle}>SESSION RESULTS</Text>
            <View style={s.summaryLeaderboard}>
              {Object.entries(personaPoints)
                .sort(([, a], [, b]) => b - a)
                .map(([pid, pts], idx) => {
                  const p = getPersona(pid);
                  if (!p) return null;
                  return (
                    <Animated.View key={pid} entering={FadeInDown.delay(idx * 150).duration(300)} style={[s.summaryRow, idx === 0 && s.summaryRowWinner]}>
                      <Text style={[s.summaryRank, idx === 0 && { color: "#FFD700", fontSize: 18 }]}>
                        {idx === 0 ? "👑" : `#${idx + 1}`}
                      </Text>
                      {p.image ? (
                        <Image source={p.image} style={s.summaryAvatar} />
                      ) : (
                        <View style={[s.summaryAvatarFallback, { backgroundColor: p.color }]}>
                          <Text style={{ fontSize: 10, color: "#fff", fontWeight: "800" as const }}>{getInitials(p.name)}</Text>
                        </View>
                      )}
                      <Text style={[s.summaryName, { color: p.color }]}>{p.name}</Text>
                      <Text style={s.summaryPoints}>{pts}</Text>
                    </Animated.View>
                  );
                })}
            </View>
            {trumpRoastText ? (
              <Animated.View entering={FadeIn.delay(800).duration(500)} style={s.roastContainer}>
                <View style={s.roastHeader}>
                  <Ionicons name="flame" size={16} color="#FF6B35" />
                  <Text style={s.roastTitle}>TRUMP'S RESPONSE</Text>
                  <Ionicons name="flame" size={16} color="#FF6B35" />
                </View>
                <Text style={s.roastText}>{trumpRoastText}</Text>
              </Animated.View>
            ) : isLoadingRoast ? (
              <View style={s.roastLoading}>
                <ActivityIndicator size="small" color="#FFD700" />
                <Text style={s.roastLoadingText}>Trump is fuming...</Text>
              </View>
            ) : (
              <Pressable
                onPress={() => {
                  playCrowdCheer();
                  playDrumroll();
                  fetchTrumpRoast();
                }}
                style={s.roastTriggerBtn}
              >
                <Ionicons name="flame" size={18} color="#000" />
                <Text style={s.roastTriggerText}>Let Trump React!</Text>
              </Pressable>
            )}
            {winnerClapBack ? (
              <Animated.View entering={FadeIn.delay(500).duration(500)} style={[s.roastContainer, { borderColor: "#3b82f6", marginTop: 10 }]}>
                <View style={s.roastHeader}>
                  <Ionicons name="megaphone" size={16} color="#3b82f6" />
                  <Text style={[s.roastTitle, { color: "#3b82f6" }]}>WINNER FIRES BACK!</Text>
                  <Ionicons name="megaphone" size={16} color="#3b82f6" />
                </View>
                <Text style={[s.roastText, { color: "#93c5fd" }]}>{winnerClapBack}</Text>
              </Animated.View>
            ) : isLoadingClapBack ? (
              <View style={[s.roastLoading, { marginTop: 8 }]}>
                <ActivityIndicator size="small" color="#3b82f6" />
                <Text style={[s.roastLoadingText, { color: "#3b82f6" }]}>Winner is preparing a response...</Text>
              </View>
            ) : null}
            {Object.keys(winTallyGlobal).length > 0 && (
              <Animated.View entering={FadeIn.delay(1200).duration(500)} style={[s.roastContainer, { borderColor: "#4ADE80", marginTop: 12 }]}>
                <View style={s.roastHeader}>
                  <Ionicons name="globe" size={16} color="#4ADE80" />
                  <Text style={[s.roastTitle, { color: "#4ADE80" }]}>GLOBAL WIN TALLY</Text>
                  <Ionicons name="globe" size={16} color="#4ADE80" />
                </View>
                {Object.entries(winTallyGlobal)
                  .sort(([, a], [, b]) => b - a)
                  .slice(0, 10)
                  .map(([pid, wins], idx) => {
                    const p = getPersona(pid);
                    if (!p) return null;
                    const userWins = winTallyUser[pid] || 0;
                    return (
                      <View key={pid} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 3, paddingHorizontal: 8 }}>
                        <Text style={{ color: "#FFD700", fontSize: 12, width: 24, fontWeight: "700" as const }}>#{idx + 1}</Text>
                        <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: p.color, alignItems: "center", justifyContent: "center", marginRight: 6 }}>
                          <Text style={{ fontSize: 8, color: "#fff", fontWeight: "800" as const }}>{p.shortName?.[0] || p.name[0]}</Text>
                        </View>
                        <Text style={{ color: "#fff", fontSize: 12, flex: 1, fontWeight: "600" as const }}>{p.name}</Text>
                        <Text style={{ color: "#4ADE80", fontSize: 12, fontWeight: "700" as const }}>{wins} {wins === 1 ? "win" : "wins"}</Text>
                        {userWins > 0 && (
                          <Text style={{ color: "#93c5fd", fontSize: 10, marginLeft: 6 }}>(you: {userWins})</Text>
                        )}
                      </View>
                    );
                  })}
              </Animated.View>
            )}
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setViralClipVideoStates({});
                setShowViralClips(true);
              }}
              style={[s.summaryActionBtn, { backgroundColor: "#7c3aed", flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 }]}
            >
              <Ionicons name="film" size={16} color="#fff" />
              <Text style={[s.summaryActionText, { color: "#fff" }]}>Viral Clips</Text>
            </Pressable>

            <View style={s.summaryActions}>
              <Pressable
                onPress={async () => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  const sortedPersonas = Object.entries(personaPoints).sort(([, a], [, b]) => b - a);
                  const winner = sortedPersonas[0];
                  const winnerName = winner ? getPersona(winner[0])?.name || "Unknown" : "Unknown";
                  const pts = winner ? winner[1] : 0;
                  const topicName = currentTopic || "The Arena";
                  const totalMessages = messages.filter((m) => !m.isSystem && m.speakerId !== "user").length;
                  const personaCount = selectedPersonas.length;
                  let viral = `🏛️ THE ARENA RESULTS\n`;
                  viral += `📰 "${topicName}"\n\n`;
                  viral += `👑 WINNER: ${winnerName} — ${pts} pts\n`;
                  if (sortedPersonas[1]) {
                    const p2 = getPersona(sortedPersonas[1][0]);
                    if (p2) viral += `🥈 Runner-Up: ${p2.name} — ${sortedPersonas[1][1]} pts\n`;
                  }
                  viral += `\n💬 ${totalMessages} AI statements across ${personaCount} personas\n`;
                  if (trumpRoastText) {
                    viral += `\n🔥 Trump said: "${trumpRoastText.substring(0, 80)}…"\n`;
                  }
                  viral += `\nWatch 20 voice-cloned AI personas debate LIVE 👇\nChat DJT — chatdjt.com`;

                  try {
                    if (Platform.OS === "web") {
                      if (navigator.share) {
                        await navigator.share({ title: `${winnerName} wins The Arena!`, text: viral, url: "https://chatdjt.com" });
                      } else {
                        Linking.openURL(`https://twitter.com/intent/tweet?text=${encodeURIComponent(viral)}`);
                      }
                    } else {
                      await Share.share({ message: viral, title: `${winnerName} wins The Arena!` });
                    }
                  } catch {}
                }}
                style={[s.summaryActionBtn, { backgroundColor: "#D4A420" }]}
              >
                <Ionicons name="share-social" size={16} color="#000" />
                <Text style={s.summaryActionText}>Share Results</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setShowEndSummary(false);
                  setShowPaywall(true);
                }}
                style={s.summaryActionBtn}
              >
                <Ionicons name="refresh" size={16} color="#000" />
                <Text style={s.summaryActionText}>Play Again</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setShowEndSummary(false);
                  saveCurrentSession();
                  router.push("/arena-replay");
                }}
                style={[s.summaryActionBtn, { backgroundColor: "transparent", borderWidth: 1, borderColor: "#FFD700" }]}
              >
                <Ionicons name="albums" size={16} color="#FFD700" />
                <Text style={[s.summaryActionText, { color: "#FFD700" }]}>View Replays</Text>
              </Pressable>
            </View>
            <Pressable onPress={() => { setShowEndSummary(false); setShowPaywall(true); }} style={s.paywallDismiss}>
              <Text style={s.paywallDismissText}>Close</Text>
            </Pressable>
            </View>
          </ScrollView>
          </Animated.View>
        </View>
      </Modal>

      <ViralClipsModal
        visible={showViralClips}
        onClose={() => setShowViralClips(false)}
        messages={messages}
        currentTopic={currentTopic}
        videoStates={viralClipVideoStates}
        setVideoStates={setViralClipVideoStates}
        deviceId={deviceId}
      />

      {/* Audio connecting overlay — shows from session start until first voice plays */}
      {isRunning && !firstAudioPlayed && (
        <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(600)} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.78)", alignItems: "center", justifyContent: "center", zIndex: 200, pointerEvents: "none" }}>
          <ActivityIndicator size="large" color="#FFD700" />
          <Text style={{ color: "#FFD700", fontSize: 15, fontWeight: "900", marginTop: 14, letterSpacing: 1.5 }}>🎙️ AUDIO CONNECTING</Text>
          <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 12, marginTop: 6 }}>Voices loading — stay tuned!</Text>
        </Animated.View>
      )}

      {/* AI Verdict Modal */}
      <Modal visible={showVerdictModal} transparent animationType="fade" onRequestClose={() => setShowVerdictModal(false)}>
        <Pressable style={s.paywallOverlay} onPress={() => !verdictLoading && setShowVerdictModal(false)}>
          <Pressable style={s.verdictCard} onPress={(e) => e.stopPropagation()}>
            <LinearGradient colors={["#1c1400", "#0a0a0a"]} style={StyleSheet.absoluteFill} borderRadius={20} />
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Ionicons name="scale" size={20} color="#FFD700" />
                <Text style={{ color: "#FFD700", fontSize: 14, fontWeight: "900", letterSpacing: 1 }}>AI VERDICT</Text>
              </View>
              {!verdictLoading && <Pressable onPress={() => setShowVerdictModal(false)}><Ionicons name="close" size={22} color="rgba(255,255,255,0.4)" /></Pressable>}
            </View>

            {verdictLoading ? (
              <View style={{ alignItems: "center", paddingVertical: 32 }}>
                <ActivityIndicator color="#FFD700" size="large" />
                <Text style={{ color: "#888", fontSize: 13, marginTop: 14 }}>The AI judge is reviewing the arguments…</Text>
              </View>
            ) : verdictData ? (
              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 480 }}>
                <View style={{ backgroundColor: "rgba(255,215,0,0.08)", borderRadius: 12, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: "rgba(255,215,0,0.25)" }}>
                  <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 10, fontWeight: "900", letterSpacing: 1, marginBottom: 4 }}>🏆 WINNER</Text>
                  <Text style={{ color: "#FFD700", fontSize: 22, fontWeight: "900" }}>{verdictData.winner}</Text>
                  <Text style={{ color: "rgba(255,255,255,0.75)", fontSize: 13, marginTop: 8, lineHeight: 19 }}>{verdictData.verdict}</Text>
                </View>

                {verdictData.scores && Object.keys(verdictData.scores).length > 0 && (
                  <View style={{ marginBottom: 14 }}>
                    <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 10, fontWeight: "900", letterSpacing: 1, marginBottom: 8 }}>📊 SCORES</Text>
                    {Object.entries(verdictData.scores as Record<string, number>).map(([name, score]) => (
                      <View key={name} style={{ marginBottom: 8 }}>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                          <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>{name}</Text>
                          <Text style={{ color: "#FFD700", fontSize: 12, fontWeight: "900" }}>{score}/100</Text>
                        </View>
                        <View style={{ height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                          <View style={{ height: "100%", width: `${score}%` as any, backgroundColor: score >= 70 ? "#4ADE80" : score >= 45 ? "#FFD700" : "#ff4d4d", borderRadius: 3 }} />
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                {verdictData.factChecks?.length > 0 && (
                  <View style={{ marginBottom: 14 }}>
                    <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 10, fontWeight: "900", letterSpacing: 1, marginBottom: 8 }}>🔍 FACT CHECKS</Text>
                    {(verdictData.factChecks as any[]).map((fc: any, i: number) => (
                      <View key={i} style={{ backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 10, padding: 10, marginBottom: 6, borderLeftWidth: 3, borderLeftColor: fc.verdict === "TRUE" ? "#4ADE80" : fc.verdict === "FALSE" ? "#ff4d4d" : "#facc15" }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
                          <Text style={{ color: fc.verdict === "TRUE" ? "#4ADE80" : fc.verdict === "FALSE" ? "#ff4d4d" : "#facc15", fontSize: 10, fontWeight: "900" }}>{fc.verdict}</Text>
                          <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 10 }}>— {fc.persona}</Text>
                        </View>
                        <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 11, fontStyle: "italic", marginBottom: 3 }}>"{fc.claim}"</Text>
                        <Text style={{ color: "#fff", fontSize: 11, lineHeight: 16 }}>{fc.fact}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {verdictData.summary && (
                  <View style={{ borderTopWidth: 1, borderTopColor: "rgba(255,215,0,0.15)", paddingTop: 12, marginBottom: 8 }}>
                    <Text style={{ color: "#FFD700", fontSize: 13, fontStyle: "italic", textAlign: "center", lineHeight: 18 }}>"{verdictData.summary}"</Text>
                  </View>
                )}

                <Pressable onPress={shareVerdict} style={{ marginTop: 10, backgroundColor: "#FFD700", borderRadius: 12, padding: 13, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <Ionicons name="share-social" size={16} color="#000" />
                  <Text style={{ color: "#000", fontSize: 13, fontWeight: "900" }}>SHARE VERDICT</Text>
                </Pressable>
                <View style={{ height: 12 }} />
              </ScrollView>
            ) : (
              <View style={{ alignItems: "center", paddingVertical: 24 }}>
                <Text style={{ color: "#ff4d4d", fontSize: 13 }}>Failed to generate verdict. Try again.</Text>
                <Pressable onPress={fetchVerdict} style={{ marginTop: 12, backgroundColor: "rgba(255,215,0,0.12)", borderRadius: 10, padding: 10, borderWidth: 1, borderColor: "rgba(255,215,0,0.3)" }}>
                  <Text style={{ color: "#FFD700", fontWeight: "900" }}>RETRY</Text>
                </Pressable>
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={showPaywall} transparent animationType="fade">
        <View style={s.paywallOverlay}>
          <View style={s.paywallCard}>
            {paywallSpeechPaused ? (
              <Animated.View style={[{ marginBottom: 6 }, paywallPulseStyle]}>
                <Ionicons name="volume-high" size={36} color="#FFD700" />
              </Animated.View>
            ) : (
              <Ionicons name="lock-closed" size={36} color="#FFD700" />
            )}
            {paywallSpeechPaused && (
              <Text style={{ color: "#FFD70099", fontSize: 11, marginBottom: 4, textAlign: "center" }}>
                Audio paused — resume when ready
              </Text>
            )}
            <Text style={s.paywallTitle}>Arena Access Required</Text>
            <Text style={s.paywallSubtitle}>
              Choose your debate duration. 1 token per minute.
            </Text>
            <View style={s.durationRow}>
              {([5, 10, 15] as const).map((dur) => (
                <Pressable
                  key={dur}
                  onPress={() => setSelectedDuration(dur)}
                  style={[s.durationChip, selectedDuration === dur && s.durationChipActive]}
                >
                  <Text style={[s.durationChipText, selectedDuration === dur && s.durationChipTextActive]}>
                    {dur} min
                  </Text>
                  <Text style={[s.durationChipCost, selectedDuration === dur && s.durationChipCostActive]}>
                    {dur} tokens
                  </Text>
                </Pressable>
              ))}
            </View>
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
                <Text style={s.paywallBtnText}>Unlock {selectedDuration} Min for {selectedDuration} Tokens</Text>
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

      {interruptionOverlay && (
        <Animated.View
          entering={FadeInDown.duration(300).springify()}
          style={[s.interruptOverlay, { bottom: insets.bottom + webBottomInset + 20 }]}
        >
          <LinearGradient
            colors={[
              interruptionOverlay.speakerId === "trump"
                ? "rgba(255,77,77,0.95)"
                : `${getPersona(interruptionOverlay.speakerId)?.color || "#666"}ee`,
              "rgba(20,20,20,0.98)",
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.interruptGrad}
          >
            <View style={s.interruptHeader}>
              <Ionicons name="flash" size={16} color="#fff" />
              <Text style={s.interruptLabel}>INTERRUPTION</Text>
              <Pressable onPress={() => setInterruptionOverlay(null)} hitSlop={12}>
                <Ionicons name="close" size={18} color="rgba(255,255,255,0.6)" />
              </Pressable>
            </View>
            <View style={s.interruptBody}>
              <View style={[s.interruptAvatar, { backgroundColor: getPersona(interruptionOverlay.speakerId)?.color || "#666" }]}>
                <Text style={s.interruptAvatarText}>
                  {interruptionOverlay.speakerName.split(" ").map((w) => w[0]).join("").substring(0, 2)}
                </Text>
              </View>
              <View style={s.interruptContent}>
                <Text style={s.interruptName}>{interruptionOverlay.speakerName}</Text>
                <Text style={s.interruptText} numberOfLines={3}>{interruptionOverlay.text}</Text>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>
      )}

      <Modal visible={showJoinPrompt || showJoinForm} transparent animationType="fade">
        <View style={s.joinPromptOverlay}>
          <Animated.View entering={FadeInUp.duration(400).springify()} style={s.joinFormCard}>
            <View style={{ flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "center" as const, gap: 8, marginBottom: 6 }}>
              <Ionicons name="mic" size={18} color="#4ADE80" />
              <Text style={s.joinFormTitle}>Jump In</Text>
            </View>
            <TextInput
              style={s.joinInput}
              placeholder="Your name *"
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={userName}
              onChangeText={(t) => {
                setUserName(t);
                if (joinTimerRef.current) { clearInterval(joinTimerRef.current); joinTimerRef.current = null; setJoinCountdown(0); }
              }}
              maxLength={30}
              autoCapitalize="words"
              autoFocus
            />
            <TextInput
              style={s.joinInput}
              placeholder="City (optional)"
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={userCity}
              onChangeText={setUserCity}
              maxLength={40}
              autoCapitalize="words"
            />
            <Text style={s.joinPickerLabel}>State {userState ? `· ${userState}` : ""}</Text>
            <ScrollView style={s.joinPickerGrid} nestedScrollEnabled>
              <View style={s.joinPickerWrap}>
                {US_STATES.map((st) => (
                  <Pressable
                    key={st}
                    onPress={() => setUserState(st)}
                    style={[s.joinPickerChip, userState === st && s.joinPickerChipActive]}
                  >
                    <Text style={[s.joinPickerChipText, userState === st && s.joinPickerChipTextActive]}>{st}</Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
            <Text style={s.joinPickerLabel}>Country {userCountry ? `· ${userCountry}` : ""}</Text>
            <ScrollView style={s.joinPickerGrid} nestedScrollEnabled>
              <View style={s.joinPickerWrap}>
                {COUNTRIES.map((c) => (
                  <Pressable
                    key={c}
                    onPress={() => setUserCountry(c)}
                    style={[s.joinPickerChip, userCountry === c && s.joinPickerChipActive]}
                  >
                    <Text style={[s.joinPickerChipText, userCountry === c && s.joinPickerChipTextActive]}>{c}</Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
            <View style={s.joinFormActions}>
              <Pressable
                onPress={() => {
                  if (joinTimerRef.current) clearInterval(joinTimerRef.current);
                  setShowJoinPrompt(false);
                  setShowJoinForm(false);
                }}
                style={s.joinFormCancel}
              >
                <Text style={s.joinFormCancelText}>Watch</Text>
              </Pressable>
              <Pressable
                onPress={submitJoinForm}
                disabled={!userName.trim()}
                style={[s.joinFormSubmit, !userName.trim() && { opacity: 0.4 }]}
              >
                <Ionicons name="enter" size={14} color="#000" />
                <Text style={s.joinFormSubmitText}>Join</Text>
              </Pressable>
            </View>
            {showJoinPrompt && joinCountdown > 0 && (
              <Text style={s.joinCountdownText}>Auto-dismiss in {joinCountdown}s</Text>
            )}
          </Animated.View>
        </View>
      </Modal>

      {/* Lie detector flash overlay */}
      {lieFlashOn && (
        <View pointerEvents="none" style={s.lieFlashOverlay} />
      )}

      {/* Lies sheet (mirrors 1-on-1 interview lie detector UI) */}
      <Modal visible={liesSheetOpen} transparent animationType="slide" onRequestClose={() => setLiesSheetOpen(false)}>
        <View style={s.paywallOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setLiesSheetOpen(false)} />
          <View style={s.liesSheet}>
            <View style={s.liesHandle} />
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
              <Ionicons name="flash" size={20} color="#ff4d4d" />
              <Text style={{ flex: 1, color: "#fff", fontSize: 18, fontWeight: "900", marginLeft: 8 }}>LIE DETECTOR · {lies.length}</Text>
              {latestTruthScore !== null && (
                <View style={{ marginRight: 8, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: latestTruthScore < 40 ? "rgba(255,77,77,0.18)" : "rgba(74,222,128,0.18)", borderWidth: 1, borderColor: latestTruthScore < 40 ? "rgba(255,77,77,0.4)" : "rgba(74,222,128,0.4)" }}>
                  <Text style={{ color: latestTruthScore < 40 ? "#ff4d4d" : "#4ADE80", fontSize: 10, fontWeight: "900" }}>TRUTH {latestTruthScore}</Text>
                </View>
              )}
              <Pressable onPress={() => setLiesSheetOpen(false)}><Ionicons name="close" size={22} color="#fff" /></Pressable>
            </View>
            {altFactCount > 0 && (
              <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 6, marginBottom: 10, borderRadius: 8, backgroundColor: "rgba(251,191,36,0.1)", borderWidth: 1, borderColor: "rgba(251,191,36,0.35)" }}>
                <Ionicons name="star-half" size={14} color="#FBB924" />
                <Text style={{ color: "#FBB924", fontSize: 12, fontWeight: "800", marginLeft: 6 }}>ALTERNATIVE FACTS · {altFactCount}</Text>
                <Text style={{ color: "rgba(251,191,36,0.7)", fontSize: 11, marginLeft: 6, flex: 1 }}>half-truths &amp; spin caught this session</Text>
              </View>
            )}
            <ScrollView style={{ maxHeight: 480 }}>
              {(() => {
                const sessionCounts: Record<string, number> = {};
                for (const l of lies) {
                  if (l.pending) continue;
                  if (typeof l.score === "number" && l.score >= 40) continue;
                  sessionCounts[l.speakerId] = (sessionCounts[l.speakerId] || 0) + 1;
                }
                const sessionEntries = Object.entries(sessionCounts).sort((a, b) => b[1] - a[1]);
                const personalEntries = Object.entries(personalLieHistory).sort((a, b) => b[1] - a[1]).slice(0, 6);
                const lod = globalLieStats?.liarOfTheDay;
                const sessionTop = sessionEntries[0];
                return (
                  <View style={{ marginBottom: 14 }}>
                    <View style={s.liarOfDayBanner}>
                      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
                        <Ionicons name="trophy" size={14} color="#FFD700" />
                        <Text style={s.liarOfDayLabel}>  LIAR OF THE DAY</Text>
                      </View>
                      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                        <View style={{ flex: 1 }}>
                          <Text style={s.liarOfDaySub}>GLOBAL (everyone)</Text>
                          {lod ? (
                            <Text style={s.liarOfDayName} numberOfLines={1}>
                              {lod.name} <Text style={s.liarOfDayCount}>· {lod.count} {lod.count === 1 ? "lie" : "lies"}</Text>
                            </Text>
                          ) : (
                            <Text style={s.liarOfDayEmpty}>No lies caught yet today</Text>
                          )}
                        </View>
                        <View style={{ width: 12 }} />
                        <View style={{ flex: 1 }}>
                          <Text style={s.liarOfDaySub}>THIS SESSION</Text>
                          {sessionTop ? (
                            <Text style={s.liarOfDayName} numberOfLines={1}>
                              {getPersona(sessionTop[0])?.shortName || getPersona(sessionTop[0])?.name || sessionTop[0]} <Text style={s.liarOfDayCount}>· {sessionTop[1]}</Text>
                            </Text>
                          ) : (
                            <Text style={s.liarOfDayEmpty}>None yet</Text>
                          )}
                        </View>
                      </View>
                    </View>
                    {personalEntries.length > 0 && (
                      <View style={s.lieBreakdown}>
                        <Text style={s.lieBreakdownTitle}>YOUR LIE TALLY (lifetime, this device)</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                          {personalEntries.map(([pid, count]) => {
                            const p = getPersona(pid);
                            return (
                              <View key={pid} style={[s.lieBreakdownChip, { borderColor: (p?.color || "#ff4d4d") + "55" }]}>
                                <Text style={[s.lieBreakdownChipName, { color: p?.color || "#fff" }]} numberOfLines={1}>{p?.shortName || p?.name || pid}</Text>
                                <Text style={s.lieBreakdownChipCount}>{count}</Text>
                              </View>
                            );
                          })}
                        </ScrollView>
                      </View>
                    )}
                    {globalLieStats?.allTime && globalLieStats.allTime.length > 0 && (
                      <View style={s.lieBreakdown}>
                        <Text style={s.lieBreakdownTitle}>ALL-TIME LIARS (global)</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                          {globalLieStats.allTime.slice(0, 8).map((row) => {
                            const p = getPersona(row.personaId);
                            return (
                              <View key={row.personaId} style={[s.lieBreakdownChip, { borderColor: "rgba(255,77,77,0.4)" }]}>
                                <Text style={[s.lieBreakdownChipName, { color: p?.color || "#fff" }]} numberOfLines={1}>{row.name}</Text>
                                <Text style={s.lieBreakdownChipCount}>{row.count}</Text>
                              </View>
                            );
                          })}
                        </ScrollView>
                      </View>
                    )}
                  </View>
                );
              })()}
              {lies.length === 0 ? (
                <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, textAlign: "center" as const, padding: 30 }}>No flagged statements yet. Tap the flag on any quote — or wait for the AI to call out a whopper.</Text>
              ) : lies.map((l) => {
                const v = lieVotes[l.id] || { up: 0, down: 0, myVote: 0 };
                return (
                  <View key={l.id} style={s.lieRow}>
                    <View style={s.lieHeader}>
                      <Text style={{ color: "#FFD700", fontSize: 12, fontWeight: "900", flex: 1 }} numberOfLines={1}>{l.speakerName}</Text>
                      {l.userFlagged && (
                        <View style={s.userFlagBadge}>
                          <Ionicons name="flag" size={9} color="#60a5fa" />
                          <Text style={s.userFlagBadgeText}>USER-FLAGGED</Text>
                        </View>
                      )}
                      <View style={s.lieScore}>
                        {l.pending ? (
                          <ActivityIndicator size="small" color="#ff4d4d" />
                        ) : (
                          <Text style={{ color: "#ff4d4d", fontSize: 11, fontWeight: "900" }}>{l.score}/100</Text>
                        )}
                      </View>
                    </View>
                    <Text style={s.lieQuote}>"{l.text}"</Text>
                    {!!l.fact && <Text style={s.lieFact}>FACT: {l.fact}</Text>}
                    {!!l.reason && <Text style={s.lieReason}>{l.reason}</Text>}
                    <View style={s.voteRow}>
                      <Pressable
                        onPress={() => submitLieVote(l, 1)}
                        disabled={!!l.pending}
                        style={[s.voteBtn, v.myVote === 1 && s.voteBtnUpActive, l.pending && { opacity: 0.4 }]}
                        testID={`lie-vote-up-${l.id}`}
                        hitSlop={6}
                      >
                        <Ionicons name={v.myVote === 1 ? "thumbs-up" : "thumbs-up-outline"} size={14} color={v.myVote === 1 ? "#4ADE80" : "rgba(255,255,255,0.7)"} />
                        <Text style={[s.voteBtnText, v.myVote === 1 && { color: "#4ADE80" }]}>{v.up}</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => submitLieVote(l, -1)}
                        disabled={!!l.pending}
                        style={[s.voteBtn, v.myVote === -1 && s.voteBtnDownActive, l.pending && { opacity: 0.4 }]}
                        testID={`lie-vote-down-${l.id}`}
                        hitSlop={6}
                      >
                        <Ionicons name={v.myVote === -1 ? "thumbs-down" : "thumbs-down-outline"} size={14} color={v.myVote === -1 ? "#ff4d4d" : "rgba(255,255,255,0.7)"} />
                        <Text style={[s.voteBtnText, v.myVote === -1 && { color: "#ff4d4d" }]}>{v.down}</Text>
                      </Pressable>
                      <Text style={s.voteTally}>
                        {v.up + v.down === 0 ? "Be the first to weigh in" : `${v.up} agree · ${v.down} disagree`}
                      </Text>
                    </View>
                  </View>
                );
              })}
              <View style={{ height: 30 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {showUserInput && askingPersona && (
        <Animated.View
          entering={FadeInUp.duration(300)}
          style={[s.userInputOverlay, { bottom: insets.bottom + webBottomInset + 8 }]}
        >
          <View style={s.userInputCard}>
            <View style={s.userInputHeader}>
              <View style={[s.userInputDot, { backgroundColor: getPersona(askingPersona)?.color || "#4ADE80" }]} />
              <Text style={s.userInputLabel} numberOfLines={1}>
                {getPersona(askingPersona)?.shortName || "Someone"} asks:
              </Text>
              <Pressable
                onPress={() => { setShowUserInput(false); setAskingPersona(null); setAskQuestion(""); }}
                hitSlop={8}
              >
                <Ionicons name="close" size={16} color="rgba(255,255,255,0.4)" />
              </Pressable>
            </View>
            {askQuestion ? (
              <Text style={s.userInputQuestion}>{askQuestion}</Text>
            ) : null}
            <View style={s.userInputRow}>
              <Pressable
                onPress={isRecording ? stopVoiceRecording : startVoiceRecording}
                style={[s.micBtn, isRecording && s.micBtnActive]}
                hitSlop={4}
              >
                <Ionicons name={isRecording ? "stop" : "mic"} size={18} color={isRecording ? "#fff" : "#4ADE80"} />
              </Pressable>
              <TextInput
                style={s.userInputField}
                placeholder={isTranscribing ? "Transcribing..." : "Type or speak your response..."}
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={userInputText}
                onChangeText={setUserInputText}
                maxLength={280}
                multiline
                autoFocus
              />
              <Pressable
                onPress={submitUserResponse}
                disabled={!userInputText.trim()}
                style={[s.userInputSend, !userInputText.trim() && { opacity: 0.4 }]}
              >
                <Ionicons name="send" size={18} color="#000" />
              </Pressable>
            </View>
          </View>
        </Animated.View>
      )}

      {userJoined && !showUserInput && isRunning && (
        <View style={[s.userChatBar, { bottom: insets.bottom + webBottomInset + 8 }]}>
          <View style={s.userChatBarInner}>
            <Pressable
              onPress={isRecording ? stopVoiceRecording : startVoiceRecording}
              style={[s.micBtn, isRecording && s.micBtnActive]}
              hitSlop={4}
            >
              <Ionicons name={isRecording ? "stop" : "mic"} size={18} color={isRecording ? "#fff" : "#4ADE80"} />
            </Pressable>
            <TextInput
              style={s.userChatInput}
              placeholder={isTranscribing ? "Transcribing..." : "Say something or change the topic..."}
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={userInputText}
              onChangeText={setUserInputText}
              maxLength={280}
              multiline
            />
            <Pressable
              onPress={async () => {
                if (!userInputText.trim() || isUserSendingRef.current) return;
                isUserSendingRef.current = true;
                const text = userInputText.trim();
                const audioUri = lastRecordedAudioRef.current;
                lastRecordedAudioRef.current = null;
                setUserInputText("");
                userResponseCountRef.current += 1;
                addMessage({
                  id: "user-msg-" + Date.now(),
                  speakerId: "user",
                  speakerName: userNameRef.current || "Viewer",
                  text,
                  timestamp: Date.now(),
                  audioUri: audioUri || undefined,
                });
                try {
                  const active = selectedPersonasRef.current;
                  const targeted = detectTargetPersona(text, active);
                  const reactor = targeted || active[Math.floor(Math.random() * active.length)];
                  const headers: Record<string, string> = { "Content-Type": "application/json" };
                  if (deviceId) headers["x-device-id"] = deviceId;
                  const locationParts = [userCityRef.current, userStateRef.current, userCountryRef.current].filter(Boolean);
                  const res = await fetch(new URL("/api/arena/respond", getApiUrl()).toString(), {
                    method: "POST",
                    headers,
                    body: JSON.stringify({
                      responderId: reactor,
                      toSpeakerId: "user",
                      conversationHistory: messagesRef.current.filter((m: any) => !m.isSystem).slice(-4).map((m: any) => ({ speakerName: m.speakerName, text: m.text })),
                      topic: text,
                      activePersonas: active,
                      userContext: { name: userNameRef.current, location: locationParts.join(", ") },
                    }),
                  });
                  if (res.status === 403 && mountedRef.current) {
                    setFreeRemaining(0);
                    setShowPaywall(true);
                    setIsRunning(false);
                    return;
                  }
                  if (res.ok && mountedRef.current) {
                    const data = await res.json();
                    const persona = getPersona(reactor);
                    addMessage({
                      id: "react-user-" + Date.now(),
                      speakerId: reactor,
                      speakerName: persona.name,
                      text: data.response,
                      timestamp: Date.now(),
                    });
                    queueTTS(data.response, reactor);
                    if (data.freeRemaining !== undefined) setFreeRemaining(data.freeRemaining);
                  }
                } catch (_e) {} finally {
                  isUserSendingRef.current = false;
                }
              }}
              disabled={!userInputText.trim() || !!isUserSendingRef.current}
              style={[s.userInputSend, !userInputText.trim() && { opacity: 0.4 }]}
            >
              <Ionicons name="send" size={18} color="#000" />
            </Pressable>
          </View>
        </View>
      )}
      <TokenWinVideo
        visible={tokenWinVisible}
        onClose={() => setTokenWinVisible(false)}
        amount={tokenWinAmount}
        source={tokenWinSource}
      />
    </ImageBackground>
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
  verdictCard: {
    margin: 20,
    backgroundColor: "#15151A",
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(255,215,0,0.3)",
    overflow: "hidden" as const,
    maxWidth: 420,
    width: "100%",
    alignSelf: "center",
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
  durationRow: {
    flexDirection: "row" as const,
    gap: 10,
    marginTop: 14,
    marginBottom: 4,
  },
  durationChip: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center" as const,
    borderWidth: 2,
    borderColor: "transparent",
  },
  durationChipActive: {
    borderColor: "#FFD700",
    backgroundColor: "rgba(255,215,0,0.12)",
  },
  durationChipText: {
    fontSize: 15,
    fontWeight: "700" as const,
    color: "rgba(255,255,255,0.6)",
  },
  durationChipTextActive: {
    color: "#FFD700",
  },
  durationChipCost: {
    fontSize: 11,
    color: "rgba(255,255,255,0.35)",
    marginTop: 2,
  },
  durationChipCostActive: {
    color: "rgba(255,215,0,0.7)",
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
  arenaActionBtn: {
    flexDirection: "row",
    paddingHorizontal: 8,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(212,164,32,0.12)",
    justifyContent: "center",
    alignItems: "center",
    gap: 3,
  },
  arenaActionBtnText: {
    color: "#D4A420",
    fontSize: 9,
    fontWeight: "700" as const,
    letterSpacing: 0.5,
  },
  interruptOverlay: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 100,
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#ff4d4d",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
  },
  interruptGrad: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,77,77,0.3)",
  },
  interruptHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  interruptLabel: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "800" as const,
    letterSpacing: 1.5,
    flex: 1,
  },
  heatMeterContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
    backgroundColor: "rgba(0,0,0,0.35)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,160,0,0.3)",
  },
  heatLabel: {
    fontSize: 10,
  },
  heatBarOuter: {
    width: 44,
    height: 5,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 3,
    overflow: "hidden",
  },
  heatBarInner: {
    height: "100%",
    borderRadius: 3,
  },
  interruptBody: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  interruptAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  interruptAvatarText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "bold" as const,
  },
  interruptContent: {
    flex: 1,
  },
  interruptName: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700" as const,
    marginBottom: 2,
  },
  interruptText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 13,
    lineHeight: 18,
  },
  joinPromptOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  joinPromptCard: {
    width: "100%",
    maxWidth: 340,
    borderRadius: 20,
    overflow: "hidden",
  },
  joinPromptGrad: {
    padding: 28,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(74,222,128,0.3)",
    borderRadius: 20,
  },
  joinPromptTitle: {
    fontSize: 22,
    fontWeight: "900" as const,
    color: "#fff",
    marginTop: 12,
  },
  joinPromptSub: {
    fontSize: 13,
    color: "rgba(255,255,255,0.6)",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 18,
  },
  joinCountdownText: {
    fontSize: 28,
    fontWeight: "900" as const,
    color: "#4ADE80",
    marginTop: 12,
  },
  joinPromptBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#4ADE80",
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 16,
  },
  joinPromptBtnText: {
    fontSize: 15,
    fontWeight: "900" as const,
    color: "#000",
  },
  joinPromptDismiss: {
    marginTop: 12,
    paddingVertical: 8,
  },
  joinPromptDismissText: {
    fontSize: 13,
    color: "rgba(255,255,255,0.4)",
  },
  joinFormOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "center",
    padding: 20,
  },
  joinFormCard: {
    backgroundColor: "#1a1a1a",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(74,222,128,0.2)",
    marginHorizontal: 16,
  },
  joinFormTitle: {
    fontSize: 16,
    fontWeight: "900" as const,
    color: "#fff",
  },
  joinFormSub: {
    fontSize: 11,
    color: "rgba(255,255,255,0.5)",
    textAlign: "center",
    marginTop: 4,
    marginBottom: 10,
  },
  joinInput: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: "#fff",
    fontSize: 13,
    marginBottom: 6,
  },
  joinPickerLabel: {
    fontSize: 10,
    fontWeight: "700" as const,
    color: "rgba(255,255,255,0.5)",
    textTransform: "uppercase" as const,
    letterSpacing: 1,
    marginTop: 2,
    marginBottom: 4,
  },
  joinPickerGrid: {
    maxHeight: 90,
    marginBottom: 6,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  joinPickerWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    padding: 4,
  },
  joinPickerChip: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "transparent",
  },
  joinPickerChipActive: {
    backgroundColor: "rgba(74,222,128,0.15)",
    borderColor: "#4ADE80",
  },
  joinPickerChipText: {
    fontSize: 11,
    color: "rgba(255,255,255,0.5)",
  },
  joinPickerChipTextActive: {
    color: "#4ADE80",
    fontWeight: "700" as const,
  },
  joinFormActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  joinFormCancel: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  joinFormCancelText: {
    fontSize: 12,
    fontWeight: "700" as const,
    color: "rgba(255,255,255,0.5)",
  },
  joinFormSubmit: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#4ADE80",
  },
  joinFormSubmitText: {
    fontSize: 12,
    fontWeight: "900" as const,
    color: "#000",
  },
  userInputOverlay: {
    position: "absolute",
    left: 12,
    right: 12,
    zIndex: 90,
  },
  userInputCard: {
    backgroundColor: "rgba(26,26,26,0.98)",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(74,222,128,0.3)",
    shadowColor: "#4ADE80",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  userInputHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  userInputDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  userInputLabel: {
    flex: 1,
    fontSize: 12,
    fontWeight: "600" as const,
    color: "rgba(255,255,255,0.6)",
  },
  userInputQuestion: {
    fontSize: 13,
    color: "rgba(255,255,255,0.85)",
    lineHeight: 18,
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  userInputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  userInputField: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#fff",
    fontSize: 14,
    maxHeight: 80,
  },
  userInputSend: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#4ADE80",
    justifyContent: "center",
    alignItems: "center",
  },
  micBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(74,222,128,0.12)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(74,222,128,0.3)",
  },
  micBtnActive: {
    backgroundColor: "rgba(239,68,68,0.3)",
    borderColor: "#EF4444",
  },
  speakUpBtn: {
    position: "absolute",
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(74,222,128,0.15)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(74,222,128,0.3)",
    zIndex: 80,
  },
  speakUpText: {
    fontSize: 12,
    fontWeight: "700" as const,
    color: "#4ADE80",
  },
  userChatBar: {
    position: "absolute",
    left: 12,
    right: 12,
    zIndex: 85,
  },
  userChatBarInner: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    backgroundColor: "rgba(26,26,26,0.95)",
    borderRadius: 24,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "rgba(74,222,128,0.25)",
  },
  userChatInput: {
    flex: 1,
    color: "#fff",
    fontSize: 14,
    maxHeight: 60,
    paddingVertical: 4,
  },
  pointBtn: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: "rgba(255,215,0,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,215,0,0.2)",
  },
  pointBtnText: {
    fontSize: 10,
    color: "rgba(255,215,0,0.7)",
    fontWeight: "700" as const,
  },
  pointBtnAwarded: {
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  scoreboardToggle: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: "rgba(255,215,0,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,215,0,0.2)",
  },
  scoreboardToggleText: {
    fontSize: 11,
    fontWeight: "800" as const,
    color: "#FFD700",
  },
  scoreboardPanel: {
    marginHorizontal: 12,
    marginBottom: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "rgba(255,215,0,0.06)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,215,0,0.15)",
  },
  scoreboardTitle: {
    fontSize: 11,
    fontWeight: "800" as const,
    color: "#FFD700",
    letterSpacing: 1.5,
    marginBottom: 6,
    textAlign: "center" as const,
  },
  scoreRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 6,
    paddingVertical: 3,
  },
  scoreRank: {
    fontSize: 11,
    fontWeight: "700" as const,
    color: "rgba(255,255,255,0.5)",
    width: 20,
  },
  scoreAvatar: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  scoreAvatarFallback: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  scoreName: {
    fontSize: 12,
    fontWeight: "700" as const,
    flex: 1,
  },
  scorePoints: {
    fontSize: 12,
    fontWeight: "800" as const,
    color: "#FFD700",
  },
  scoreVotes: {
    fontSize: 10,
    color: "rgba(255,255,255,0.4)",
    marginLeft: 4,
  },
  scoreEmpty: {
    fontSize: 11,
    color: "rgba(255,255,255,0.3)",
    textAlign: "center" as const,
    fontStyle: "italic" as const,
  },
  votePopup: {
    position: "absolute" as const,
    top: -8,
    right: -4,
    backgroundColor: "#FFD700",
    borderRadius: 10,
    paddingHorizontal: 5,
    paddingVertical: 1,
    zIndex: 10,
  },
  votePopupText: {
    fontSize: 11,
    fontWeight: "900" as const,
    color: "#000",
  },
  personaScoreBadge: {
    backgroundColor: "rgba(255,215,0,0.2)",
    borderRadius: 6,
    paddingHorizontal: 4,
    paddingVertical: 1,
    marginTop: 1,
  },
  personaScoreText: {
    fontSize: 9,
    fontWeight: "800" as const,
    color: "#FFD700",
  },
  votableIndicator: {
    position: "absolute" as const,
    bottom: 18,
    right: -2,
    backgroundColor: "rgba(255,215,0,0.3)",
    borderRadius: 8,
    width: 16,
    height: 16,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  summaryCard: {
    backgroundColor: "#1a1a2e",
    borderRadius: 20,
    padding: 24,
    alignItems: "center" as const,
    width: "90%" as const,
    maxWidth: 380,
    borderWidth: 2,
    borderColor: "#FFD700",
  },
  summaryTitle: {
    fontSize: 22,
    fontWeight: "900" as const,
    color: "#FFD700",
    letterSpacing: 2,
    marginTop: 8,
    marginBottom: 16,
  },
  summaryLeaderboard: {
    width: "100%" as const,
    gap: 4,
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  summaryRowWinner: {
    backgroundColor: "rgba(255,215,0,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,215,0,0.3)",
  },
  summaryRank: {
    fontSize: 14,
    fontWeight: "800" as const,
    color: "rgba(255,255,255,0.5)",
    width: 28,
    textAlign: "center" as const,
  },
  summaryAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  summaryAvatarFallback: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  summaryName: {
    fontSize: 14,
    fontWeight: "700" as const,
    flex: 1,
  },
  summaryPoints: {
    fontSize: 16,
    fontWeight: "900" as const,
    color: "#FFD700",
  },
  roastContainer: {
    width: "100%" as const,
    backgroundColor: "rgba(255,107,53,0.08)",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(255,107,53,0.2)",
  },
  roastHeader: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: 6,
    marginBottom: 8,
  },
  roastTitle: {
    fontSize: 12,
    fontWeight: "800" as const,
    color: "#FF6B35",
    letterSpacing: 1.5,
  },
  roastText: {
    fontSize: 14,
    color: "#fff",
    lineHeight: 20,
    textAlign: "center" as const,
    fontStyle: "italic" as const,
  },
  roastLoading: {
    alignItems: "center" as const,
    gap: 8,
    paddingVertical: 16,
    marginBottom: 16,
  },
  roastLoadingText: {
    fontSize: 13,
    color: "rgba(255,215,0,0.6)",
    fontStyle: "italic" as const,
  },
  roastTriggerBtn: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 8,
    backgroundColor: "#FF6B35",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    marginBottom: 16,
  },
  roastTriggerText: {
    fontSize: 15,
    fontWeight: "800" as const,
    color: "#000",
  },
  summaryActions: {
    flexDirection: "row" as const,
    gap: 12,
    width: "100%" as const,
  },
  summaryActionBtn: {
    flex: 1,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: 6,
    backgroundColor: "#FFD700",
    paddingVertical: 12,
    borderRadius: 12,
  },
  summaryActionText: {
    fontSize: 14,
    fontWeight: "800" as const,
    color: "#000",
  },
  // ── LIE DETECTOR ──────────────────────────────────────────────────────────
  liesSheet: {
    backgroundColor: "#0a0a0a",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
    borderTopWidth: 2,
    borderTopColor: "rgba(255,77,77,0.4)",
  },
  liesHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.25)",
    alignSelf: "center" as const,
    marginBottom: 12,
  },
  lieFlashOverlay: {
    position: "absolute" as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(255,77,77,0.18)",
    zIndex: 999,
  },
  lieRow: {
    backgroundColor: "rgba(255,77,77,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,77,77,0.25)",
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  lieHeader: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 6,
    marginBottom: 6,
  },
  lieScore: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: "rgba(255,77,77,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,77,77,0.4)",
    minWidth: 56,
    alignItems: "center" as const,
  },
  lieQuote: {
    color: "#fff",
    fontSize: 13,
    fontStyle: "italic" as const,
    lineHeight: 18,
    marginBottom: 6,
  },
  lieFact: {
    color: "#4ADE80",
    fontSize: 11,
    fontWeight: "800" as const,
    marginBottom: 4,
  },
  lieReason: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 11,
    lineHeight: 15,
  },
  voteRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 8,
    marginTop: 8,
  },
  voteBtn: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  voteBtnUpActive: {
    backgroundColor: "rgba(74,222,128,0.18)",
    borderColor: "rgba(74,222,128,0.5)",
  },
  voteBtnDownActive: {
    backgroundColor: "rgba(255,77,77,0.18)",
    borderColor: "rgba(255,77,77,0.5)",
  },
  voteBtnText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 11,
    fontWeight: "800" as const,
  },
  voteTally: {
    marginLeft: "auto" as const,
    color: "rgba(255,255,255,0.4)",
    fontSize: 10,
    fontStyle: "italic" as const,
  },
  userFlagBadge: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: "rgba(96,165,250,0.15)",
    borderWidth: 1,
    borderColor: "rgba(96,165,250,0.4)",
  },
  userFlagBadgeText: {
    color: "#60a5fa",
    fontSize: 9,
    fontWeight: "900" as const,
    letterSpacing: 0.5,
  },
  liarOfDayBanner: {
    backgroundColor: "rgba(255,215,0,0.07)",
    borderWidth: 1,
    borderColor: "rgba(255,215,0,0.35)",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  liarOfDayLabel: {
    color: "#FFD700",
    fontSize: 11,
    fontWeight: "900" as const,
    letterSpacing: 1,
  },
  liarOfDaySub: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 9,
    fontWeight: "800" as const,
    letterSpacing: 0.8,
    marginBottom: 3,
  },
  liarOfDayName: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "900" as const,
  },
  liarOfDayCount: {
    color: "#ff4d4d",
    fontSize: 11,
    fontWeight: "800" as const,
  },
  liarOfDayEmpty: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 11,
    fontStyle: "italic" as const,
  },
  lieBreakdown: {
    marginBottom: 8,
  },
  lieBreakdownTitle: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 10,
    fontWeight: "900" as const,
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  lieBreakdownChip: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: "rgba(255,255,255,0.04)",
    marginRight: 6,
  },
  lieBreakdownChipName: {
    fontSize: 11,
    fontWeight: "800" as const,
    maxWidth: 90,
  },
  lieBreakdownChipCount: {
    color: "#ff4d4d",
    fontSize: 11,
    fontWeight: "900" as const,
  },
  iqPill: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  iqPillText: {
    fontSize: 9,
    fontWeight: "900" as const,
    letterSpacing: 0.5,
  },
  personaIqLabel: {
    fontSize: 9,
    fontWeight: "900" as const,
    letterSpacing: 0.4,
    marginTop: 1,
  },
  personaAltTruthLabel: {
    fontSize: 9,
    fontWeight: "900" as const,
    letterSpacing: 0.4,
    marginTop: 1,
    color: "#F59E0B",
  },
});
