import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
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
import Animated, { FadeInDown, FadeInUp, FadeIn, FadeOut, SlideInLeft, SlideInRight, SlideInUp, SlideOutUp, ZoomIn, ZoomOut, BounceIn } from "react-native-reanimated";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system/legacy";
import { getApiUrl } from "@/lib/query-client";
import { playTTS, playAudioFromUrl } from "@/lib/audio-helper";
import { playPointAwardSound, playVoteClickSound, playVoteSound2, playBellSound, playCrowdCheer, playDrumroll, playWinnerChosenSound, playWinnerAfterSound, playBreakingNewsAlert } from "@/lib/arena-sfx";
import { useTokens } from "@/lib/token-context";
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
  audioUri?: string;
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
      elon: { sentiment: 65 },
      joyreid: { sentiment: 5 },
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
    image: null,
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
    },
    triggerWords: {
      positive: ["mars", "tesla", "spacex", "innovation", "x", "doge", "efficiency", "rockets"],
      negative: ["apartheid", "racism", "salute", "privilege", "billionaire", "exploit", "workers"],
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
    image: null,
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
    image: null,
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
    image: null,
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
    image: null,
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
    },
    triggerWords: {
      positive: ["justice", "democracy", "voting rights", "equality", "civil rights", "accountability"],
      negative: ["trump", "maga", "fascist", "racist", "authoritarian", "insurrection", "proud boys"],
    },
  },
};

const PERSONA_IDS = ["trump", "elon", "netanyahu", "ruckus", "galloway", "mcconnell", "carville", "maddow", "omar", "biden", "rosie", "berniemc", "graham", "megynkelly", "pambondi", "candace", "joyreid"];

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
};

function detectTrumpAttack(text: string, speakerId: string): boolean {
  if (speakerId === "trump" || speakerId === "ruckus" || speakerId === "netanyahu" || speakerId === "graham" || speakerId === "megynkelly" || speakerId === "pambondi") return false;
  const lower = text.toLowerCase();
  const trumpMentions = /(?:trump|donald|mr\.?\s*president)/i.test(lower);
  if (!trumpMentions) return false;
  const hostilePatterns = /(?:epstein war|your fault|you started|you caused|your war|felon|convicted|criminal|diaper|stench|dementia|corrupt(?:ion)?|liar|lying|racist|fascist|dictator|brain.?dead|anti-?christ|cover.?up|war criminal|impeach|lock(?:ed)?\s*(?:him|you)\s*up|prison|jail|indicted|guilty)/i;
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

const FACTION_COLORS = {
  self: "#FFD700",
  supporter: "#22c55e",
  opponent: "#3b82f6",
};

function getInitials(name: string) {
  return name.split(" ").map(w => w[0]).join("").substring(0, 2);
}

const INTERRUPTERS = ["biden", "rosie", "galloway", "berniemc", "omar", "elon", "candace", "megynkelly", "pambondi", "joyreid"];

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
      playTTS("/api/nav-speak", { text: "Political Arena." })
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
    <View style={introStyles.container}>
      <LinearGradient colors={["#0a0a0a", "#111", "#0a0a0a"]} style={StyleSheet.absoluteFill} />
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
              const p = ARENA_PERSONAS[pid];
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
    </View>
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

export default function ArenaScreen() {
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const webBottomInset = Platform.OS === "web" ? 34 : 0;
  const { deviceId, balance, refreshBalance } = useTokens();

  const [showIntro, setShowIntro] = useState(false);
  const [showPreDebateSetup, setShowPreDebateSetup] = useState(true);
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [customTopicText, setCustomTopicText] = useState("");
  const [useCustomTopic, setUseCustomTopic] = useState(false);
  const [showGlobalLeaderboard, setShowGlobalLeaderboard] = useState(false);
  const [showArenaRules, setShowArenaRules] = useState(false);
  const [globalLeaderboardData, setGlobalLeaderboardData] = useState<{ topUsers: any[]; topPersonas: any[] }>({ topUsers: [], topPersonas: [] });
  const [breakingNewsBanner, setBreakingNewsBanner] = useState<{ headline: string; source: string } | null>(null);
  const breakingNewsBannerRef = useRef<{ headline: string; source: string } | null>(null);
  const lastBreakingNewsIdRef = useRef<string>("");
  const breakingNewsTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [bannerFlash, setBannerFlash] = useState(false);

  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [emotionalStates, setEmotionalStates] = useState<Record<string, EmotionalState>>(() => {
    const s: Record<string, EmotionalState> = {};
    PERSONA_IDS.forEach((id) => {
      s[id] = { anger: 20, happiness: 50, engagement: 50, lastSpoke: null };
    });
    return s;
  });
  const [currentSpeaker, setCurrentSpeaker] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
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

  const [personaPoints, setPersonaPoints] = useState<Record<string, number>>({});
  const [awardedMessages, setAwardedMessages] = useState<Set<string>>(new Set());
  const [showScoreboard, setShowScoreboard] = useState(false);
  const [showEndSummary, setShowEndSummary] = useState(false);
  const [trumpRoastText, setTrumpRoastText] = useState("");
  const [isLoadingRoast, setIsLoadingRoast] = useState(false);
  const [winnerClapBack, setWinnerClapBack] = useState("");
  const [isLoadingClapBack, setIsLoadingClapBack] = useState(false);
  const personaPointsRef = useRef<Record<string, number>>({});
  useEffect(() => { personaPointsRef.current = personaPoints; }, [personaPoints]);
  const [thankYouPlayed, setThankYouPlayed] = useState(false);

  const [allTimeScores, setAllTimeScores] = useState<Record<string, { totalPoints: number; totalVotes: number }>>({});
  const [speakerVoteCounts, setSpeakerVoteCounts] = useState<Record<string, number>>({});
  const [voteAnimations, setVoteAnimations] = useState<Record<string, number>>({});
  const [lastSpeakerId, setLastSpeakerId] = useState<string | null>(null);

  useEffect(() => {
    if (currentSpeaker && currentSpeaker !== lastSpeakerId) {
      setSpeakerVoteCounts((prev) => ({ ...prev, [currentSpeaker]: 0 }));
      setLastSpeakerId(currentSpeaker);
    }
  }, [currentSpeaker, lastSpeakerId]);

  const loadAllTimeScores = useCallback(async () => {
    try {
      const baseUrl = getApiUrl().replace(/\/$/, "");
      const res = await fetch(`${baseUrl}/api/arena/leaderboard`);
      const ct = res.headers.get("content-type") || "";
      if (!ct.includes("application/json")) return;
      const data = await res.json();
      const scores: Record<string, { totalPoints: number; totalVotes: number }> = {};
      (data.leaderboard || []).forEach((item: any) => {
        scores[item.personaId] = { totalPoints: item.totalPoints, totalVotes: item.totalVotes };
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
          [personaId]: { totalPoints: data.totalPoints, totalVotes: data.totalVotes },
        }));
      }
    } catch {}
  }, [speakerVoteCounts]);

  const [dynamicTopics, setDynamicTopics] = useState<DynamicTopic[]>(FALLBACK_TOPICS);
  const [topicTimer, setTopicTimer] = useState<number>(0);
  const topicTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const TOPIC_DURATION = 5 * 60;

  const [freeRemaining, setFreeRemaining] = useState(5);
  const [hasSession, setHasSession] = useState(false);
  const [sessionExpiresAt, setSessionExpiresAt] = useState<number | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);
  const [sessionTimer, setSessionTimer] = useState<number>(0);
  const [isUnlocking, setIsUnlocking] = useState(false);

  const flatListRef = useRef<FlatList>(null);
  const isRunningRef = useRef(true);
  const sessionEndedRef = useRef(false);
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
  const pendingResponseRef = useRef<string | null>(null);
  const [selectedDuration, setSelectedDuration] = useState<number>(5);
  const arenaMemoryContextRef = useRef<string>("");
  const arenaUserContextRef = useRef<string>("");

  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { currentSpeakerRef.current = currentSpeaker; }, [currentSpeaker]);
  useEffect(() => { currentTopicRef.current = currentTopic; }, [currentTopic]);
  useEffect(() => { emotionalStatesRef.current = emotionalStates; }, [emotionalStates]);
  useEffect(() => { isRunningRef.current = isRunning; }, [isRunning]);
  useEffect(() => { voiceEnabledRef.current = voiceEnabled; }, [voiceEnabled]);

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
    ttsQueueRef.current = [];
    isProcessingTTSRef.current = false;
    forcePlayRef.current = false;
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

  const processTTSQueue = useCallback(async () => {
    if (isProcessingTTSRef.current || ttsQueueRef.current.length === 0) return;
    isProcessingTTSRef.current = true;
    if (mountedRef.current) setIsPlayingAudio(true);
    while (ttsQueueRef.current.length > 0) {
      if (!forcePlayRef.current && sessionEndedRef.current) break;
      if (!forcePlayRef.current && !voiceEnabledRef.current) break;
      const item = ttsQueueRef.current.shift();
      if (!item || !mountedRef.current) break;
      try {
        const sound = await playTTS("/api/persona-speak", { text: item.text, personaId: item.personaId }, { volume: 1.0 });
        currentSoundRef.current = sound;
        await new Promise<void>((resolve) => {
          let resolved = false;
          const cleanup = () => { if (resolved) return; resolved = true; sound.setOnPlaybackStatusUpdate(null); sound.getStatusAsync().then((st: any) => { if (st.isLoaded) sound.unloadAsync().catch(() => {}); }).catch(() => {}); currentSoundRef.current = null; resolve(); };
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
    if (!force && sessionEndedRef.current) return;
    if (!force && !voiceEnabledRef.current) return;
    if (force) forcePlayRef.current = true;
    ttsQueueRef.current.push({ text, personaId });
    processTTSQueue();
  }, [processTTSQueue]);

  const playInterruptionAudio = useCallback(async (text: string, personaId: string) => {
    if (!voiceEnabledRef.current) return;
    try {
      const sound = await playTTS("/api/persona-speak", { text, personaId }, { volume: 1.0 });
      let cleaned = false;
      const cleanup = () => {
        if (cleaned) return;
        cleaned = true;
        sound.setOnPlaybackStatusUpdate(null);
        sound.getStatusAsync().then((st: any) => {
          if (st.isLoaded) sound.stopAsync().then(() => sound.unloadAsync()).catch(() => {});
        }).catch(() => {});
      };
      sound.setOnPlaybackStatusUpdate((status: any) => {
        if (status.didJustFinish || status.error) cleanup();
      });
      setTimeout(cleanup, 3000);
    } catch {}
  }, []);

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
        setFreeRemaining(data.freeRemaining ?? 5);
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
        body: JSON.stringify({ duration: selectedDuration }),
      });
      const data = await res.json();
      if (data.granted) {
        setHasSession(true);
        setSessionExpiresAt(data.expiresAt);
        setShowPaywall(false);
        setShowEndSummary(false);
        setPersonaPoints({});
        setAwardedMessages(new Set());
        setTrumpRoastText("");
        setIsLoadingRoast(false);
        setShowScoreboard(false);
        setIsRunning(true);
        isRunningRef.current = true;
        refreshBalance();
        const mins = data.durationMinutes || selectedDuration;
        addSystemMessage(`Session unlocked! ${mins} minutes of unlimited access.`);
        setTimeout(() => { if (mountedRef.current && scheduleNextRef.current) scheduleNextRef.current(); }, 1000);
      } else if (data.error === "insufficient_tokens") {
        addSystemMessage("Not enough tokens. Visit the store to get more!");
      }
    } catch {}
    setIsUnlocking(false);
  }, [deviceId, refreshBalance, selectedDuration]);

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
        setIsRunning(false);
        isRunningRef.current = false;
        sessionEndedRef.current = true;
        if (breakingNewsTimerRef.current) { clearInterval(breakingNewsTimerRef.current); breakingNewsTimerRef.current = null; }
        setBreakingNewsBanner(null);
        breakingNewsBannerRef.current = null;
        stopAllTTS();
        setCurrentSpeaker(null);
        currentSpeakerRef.current = null;
        if (conversationTimerRef.current) clearTimeout(conversationTimerRef.current);
        conversationTimerRef.current = null;
        playBellSound();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        addSystemMessage("TIME'S UP! The bell has rung!");
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
                }, 3000);
              }
            }
          } catch {}
        })();
        const totalPts = Object.values(personaPointsRef.current).reduce((a, b) => a + b, 0);
        if (totalPts > 0) {
          setTimeout(() => {
            playWinnerChosenSound();
            setShowEndSummary(true);
            setTimeout(() => { playWinnerAfterSound(); }, 4000);
          }, 1500);
        } else {
          setTimeout(() => { setShowPaywall(true); }, 2000);
        }
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
    }, 4000);
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

  const addMessage = useCallback((msg: ConversationMessage) => {
    setMessages((prev) => {
      const next = [...prev, msg].slice(-50);
      messagesRef.current = next;
      return next;
    });
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
      if (!mountedRef.current || sessionEndedRef.current) return;
      setCurrentSpeaker(responderId);
      currentSpeakerRef.current = responderId;

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
          topic: currentTopicRef.current,
          activePersonas: selectedPersonasRef.current,
        };
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
        const persona = ARENA_PERSONAS[responderId];

        if (data.freeRemaining !== undefined) setFreeRemaining(data.freeRemaining);
        if (data.hasSession !== undefined) setHasSession(data.hasSession);
        if (data.sessionExpiresAt) setSessionExpiresAt(data.sessionExpiresAt);

        if (data.questionTargetId && selectedPersonasRef.current.includes(data.questionTargetId)) {
          pendingResponseRef.current = data.questionTargetId;
        }

        if (sessionEndedRef.current) return;

        addMessage({
          id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
          speakerId: responderId,
          speakerName: persona.name,
          text: data.response,
          timestamp: Date.now(),
        });

        updateEmotions(responderId, toSpeakerId);
        if (!sessionEndedRef.current) queueTTS(data.response, responderId);

        if (data.response && data.response.length > 30) {
          recordArenaMoment(responderId, toSpeakerId, data.response, currentTopicRef.current || "debate").catch(() => {});
        }
      } catch (err) {
        console.warn("Arena AI error:", err);
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
    if (!mountedRef.current || isInterruptingRef.current) return;
    isInterruptingRef.current = true;
    const active = selectedPersonasRef.current;
    const availableInterrupters = INTERRUPTERS.filter((id) => active.includes(id));
    if (availableInterrupters.length === 0) { isInterruptingRef.current = false; return; }

    const interrupter = availableInterrupters[Math.floor(Math.random() * availableInterrupters.length)];

    await new Promise((r) => setTimeout(r, 3000 + Math.random() * 1000));
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
        showInterruptionBanner(interrupter, persona.name, data.response);
        lastInterruptionRef.current = { text: data.response, interrupterId: interrupter };
        playInterruptionAudio(data.response, interrupter);

        await new Promise((r) => setTimeout(r, 500 + Math.random() * 500));
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
          await new Promise((r) => setTimeout(r, 500));
        }
      }
    } catch {} finally {
      isInterruptingRef.current = false;
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
        showInterruptionBanner("trump", "Donald Trump", data.response);
        lastInterruptionRef.current = { text: data.response, interrupterId: "trump" };
        playInterruptionAudio(data.response, "trump");
        await new Promise((r) => setTimeout(r, 500));
      }
    } catch {} finally {
      isInterruptingRef.current = false;
    }
  }, [deviceId, addMessage, showInterruptionBanner, playInterruptionAudio]);

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
        }),
      });
      if (res.ok && mountedRef.current) {
        const data = await res.json();
        const persona = ARENA_PERSONAS[welcomer];
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
            { speakerName: ARENA_PERSONAS[askerPersona]?.name || "Someone", text: askQuestion || "What do you think?" },
            { speakerName: userNameRef.current || "Viewer", text: responseText },
          ],
          topic: currentTopicRef.current || "debate",
          activePersonas: active,
          userContext: { name: userNameRef.current, location: locationParts.join(", ") },
        }),
      });
      if (res.ok && mountedRef.current) {
        const data = await res.json();
        const persona = ARENA_PERSONAS[reactor];
        addMessage({
          id: "react-" + Date.now(),
          speakerId: reactor,
          speakerName: persona.name,
          text: data.response,
          timestamp: Date.now(),
        });
        queueTTS(data.response, reactor);
      }
    } catch {}
  }, [userInputText, askingPersona, askQuestion, deviceId, addMessage, queueTTS]);

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
        const persona = ARENA_PERSONAS[personaId];
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
      const willInterrupt = !isInterruptingRef.current && chosen.id === "trump" && !trumpAttacked && Math.random() < 0.35;

      await generateAIResponse(chosen.id, lastMsg.speakerId);
      recentSpeakersRef.current = [...recentSpeakersRef.current, chosen.id].slice(-4);

      if (willInterrupt && mountedRef.current && isRunningRef.current && !isInterruptingRef.current) {
        await new Promise((r) => setTimeout(r, 500 + Math.random() * 500));
        if (!mountedRef.current || !isRunningRef.current) return;

        const trumpMsg = messagesRef.current.filter((m) => !m.isSystem && m.speakerId !== "user").slice(-1)[0];
        if (trumpMsg && trumpMsg.speakerId === "trump") {
          await triggerInterruption(trumpMsg.text);
        }
      }
    }
  }, [generateAIResponse, triggerInterruption, askUserQuestion, showUserInput]);

  const scheduleNext = useCallback(() => {
    if (sessionEndedRef.current) return;
    if (conversationTimerRef.current) clearTimeout(conversationTimerRef.current);
    const waitForClear = () => {
      if (sessionEndedRef.current) return;
      if (isInterruptingRef.current || currentSpeakerRef.current) {
        conversationTimerRef.current = setTimeout(waitForClear, 100);
        return;
      }
      const delay = 50 + Math.random() * 100;
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
    sessionEndedRef.current = false;
    setIsRunning(true);
    isRunningRef.current = true;
    try {
      const ctx = await getArenaMemoryContext("", selectedPersonasRef.current);
      arenaMemoryContextRef.current = ctx;
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
          const reactorPersona = ARENA_PERSONAS[reactorId];
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
      text: "The Political Arena is live. Personas are entering...",
      timestamp: Date.now(),
      isSystem: true,
    });
    const active = selectedPersonasRef.current;
    const starter = active.includes("trump") ? "trump" : active[0];
    const pool = active.filter((p) => p !== starter);
    const target = pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : starter;
    await generateAIResponse(starter, target);
    if (mountedRef.current) scheduleNext();
  }, [addMessage, generateAIResponse, scheduleNext]);

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
      if (prev.length >= 11) return prev;
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
        body: JSON.stringify({ winnerId, winnerName, trumpRoast, customerName, leaderboard }),
      });
      if (res.ok && mountedRef.current) {
        const data = await res.json();
        setWinnerClapBack(data.clapBack);
        queueTTS(data.clapBack, winnerId, true);
      }
    } catch {} finally {
      if (mountedRef.current) setIsLoadingClapBack(false);
    }
  }, [deviceId, queueTTS]);

  const fetchTrumpRoast = useCallback(async () => {
    const pts = personaPointsRef.current;
    const sorted = Object.entries(pts).sort(([, a], [, b]) => b - a);
    if (sorted.length === 0) return;
    const winnerId = sorted[0][0];
    const winnerName = ARENA_PERSONAS[winnerId]?.name || "someone";
    const winnerPts = sorted[0][1];
    const trumpPts = pts["trump"] || 0;
    const customerName = userNameRef.current || "this person";
    const leaderboard = sorted.slice(0, 5).map(([id, p]) => ({ name: ARENA_PERSONAS[id]?.name || id, points: p }));

    setIsLoadingRoast(true);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (deviceId) headers["x-device-id"] = deviceId;
      const res = await fetch(new URL("/api/arena/roast", getApiUrl()).toString(), {
        method: "POST",
        headers,
        body: JSON.stringify({
          winnerName,
          winnerPoints: winnerPts,
          trumpPoints: trumpPts,
          customerName,
          leaderboard,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setTrumpRoastText(data.roast);
        queueTTS(data.roast, "trump", true);
        if (winnerId !== "trump") {
          if (clapBackTimeoutRef.current) clearTimeout(clapBackTimeoutRef.current);
          clapBackTimeoutRef.current = setTimeout(() => fetchWinnerClapBack(winnerId, winnerName, data.roast, leaderboard), 3000);
        }
      }
    } catch {} finally {
      setIsLoadingRoast(false);
    }
  }, [deviceId, queueTTS, fetchWinnerClapBack]);

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
            <Text style={s.msgText}>{item.text}</Text>
          </Animated.View>
        );
      }
      const persona = ARENA_PERSONAS[item.speakerId];
      if (!persona) return null;
      const isLatest = item.id === latestPersonaMsgId;
      return (
        <Animated.View entering={SlideInLeft.duration(350).springify()} style={[s.msgRow, { borderLeftColor: persona.color }]}>
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
          <TypewriterText text={item.text} style={s.msgText} voiceEnabled={voiceEnabled} isLatest={isLatest} />
        </Animated.View>
      );
    },
    [queueTTS, voiceEnabled, latestPersonaMsgId, awardedMessages]
  );

  if (showPreDebateSetup) {
    return (
      <View style={[s.container, { paddingTop: insets.top + webTopInset }]}>
        <LinearGradient colors={["rgba(255,77,77,0.15)", "rgba(0,0,0,0)", Colors.background]} style={StyleSheet.absoluteFill} />
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
          <View style={{ alignItems: "center", marginBottom: 12 }}>
            <Ionicons name="flame" size={40} color="#FF4D4D" />
            <Text style={{ color: "#fff", fontSize: 24, fontWeight: "900", marginTop: 8 }}>POLITICAL ARENA</Text>
            <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, marginTop: 4 }}>Pick your debaters and topic</Text>
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

          <Text style={{ color: "#FFD700", fontSize: 14, fontWeight: "800", marginBottom: 10 }}>CHOOSE DEBATERS ({selectedPersonas.length} selected)</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
            {PERSONA_IDS.map((pid) => {
              const p = ARENA_PERSONAS[pid];
              const isSelected = selectedPersonas.includes(pid);
              return (
                <Pressable
                  key={pid}
                  onPress={() => togglePersona(pid)}
                  style={{
                    flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 6,
                    borderRadius: 20, borderWidth: 1.5,
                    borderColor: isSelected ? p.color : "rgba(255,255,255,0.15)",
                    backgroundColor: isSelected ? p.color + "20" : "rgba(255,255,255,0.05)",
                  }}
                >
                  {p.image ? (
                    <Image source={p.image} style={{ width: 24, height: 24, borderRadius: 12, marginRight: 6 }} />
                  ) : (
                    <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: p.color + "40", justifyContent: "center", alignItems: "center", marginRight: 6 }}>
                      <Text style={{ fontSize: 9, color: "#fff", fontWeight: "800" }}>{getInitials(p.name)}</Text>
                    </View>
                  )}
                  <Text style={{ color: isSelected ? p.color : "#888", fontSize: 12, fontWeight: "700" }}>{p.shortName}</Text>
                  {isSelected && <Ionicons name="checkmark-circle" size={14} color={p.color} style={{ marginLeft: 4 }} />}
                </Pressable>
              );
            })}
          </View>
          <Pressable
            onPress={() => setSelectedPersonas(PERSONA_IDS)}
            style={{ alignSelf: "flex-start", marginBottom: 16 }}
          >
            <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>Select All</Text>
          </Pressable>

          <Text style={{ color: "#FFD700", fontSize: 14, fontWeight: "800", marginBottom: 10 }}>CHOOSE TOPIC</Text>

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
            onPress={() => {
              const canStart = selectedPersonas.length >= 2 && !(useCustomTopic && !customTopicText.trim());
              if (!canStart) return;
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
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
            }}
            style={{
              marginTop: 20, paddingVertical: 16, borderRadius: 16, alignItems: "center",
              backgroundColor: (selectedPersonas.length >= 2 && !(useCustomTopic && !customTopicText.trim())) ? "#FF4D4D" : "rgba(255,255,255,0.1)",
              opacity: (selectedPersonas.length >= 2 && !(useCustomTopic && !customTopicText.trim())) ? 1 : 0.4,
            }}
          >
            <Text style={{ color: "#fff", fontSize: 18, fontWeight: "900", letterSpacing: 1 }}>
              START DEBATE
            </Text>
            <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 11, marginTop: 2 }}>
              {selectedPersonas.length} debaters{useCustomTopic && customTopicText.trim() ? " • Custom topic" : selectedTopicId ? " • Topic selected" : " • Random topic"}
            </Text>
          </Pressable>
        </ScrollView>
      </View>
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
    <View style={[s.container, { paddingTop: insets.top + webTopInset }]}>
      <LinearGradient
        colors={["rgba(255,77,77,0.08)", "rgba(0,0,0,0)", Colors.background]}
        style={StyleSheet.absoluteFill}
      />

      <Animated.View entering={FadeInDown.duration(400)} style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </Pressable>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>POLITICAL ARENA</Text>
          <Animated.View entering={ZoomIn.duration(500).delay(300)} style={s.liveBadge}>
            <View style={s.liveDot} />
            <Text style={s.liveText}>LIVE</Text>
          </Animated.View>
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
              const p = ARENA_PERSONAS[pid];
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
                  const p = ARENA_PERSONAS[pid];
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

      <Animated.View entering={FadeInDown.delay(200).duration(400)} style={s.personaRow}>
        {selectedPersonas.map((pid) => {
          const p = ARENA_PERSONAS[pid];
          const emo = emotionalStates[pid];
          const isSpeaking = currentSpeaker === pid;
          const isFocused = focusedPersona === pid;
          const voteAnim = voteAnimations[pid] || 0;
          const allTime = allTimeScores[pid];
          const sessionPts = personaPoints[pid] || 0;
          return (
            <Pressable
              key={pid}
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
              <Text style={[s.personaLabel, { color: p.color }]} numberOfLines={1}>
                {p.shortName}
              </Text>
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

      <Animated.View entering={FadeInUp.duration(500).delay(400)} style={s.streamContainer}>
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
          ListFooterComponent={currentTopic && pollCandidates.length >= 2 ? (
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
                const persona = ARENA_PERSONAS[p.personaId];
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
                  const p = ARENA_PERSONAS[pid];
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
            <View style={s.summaryActions}>
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

      <Modal visible={showPaywall} transparent animationType="fade">
        <View style={s.paywallOverlay}>
          <View style={s.paywallCard}>
            <Ionicons name="lock-closed" size={36} color="#FFD700" />
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
                : `${ARENA_PERSONAS[interruptionOverlay.speakerId]?.color || "#666"}ee`,
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
              <View style={[s.interruptAvatar, { backgroundColor: ARENA_PERSONAS[interruptionOverlay.speakerId]?.color || "#666" }]}>
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

      {showUserInput && askingPersona && (
        <Animated.View
          entering={FadeInUp.duration(300)}
          style={[s.userInputOverlay, { bottom: insets.bottom + webBottomInset + 8 }]}
        >
          <View style={s.userInputCard}>
            <View style={s.userInputHeader}>
              <View style={[s.userInputDot, { backgroundColor: ARENA_PERSONAS[askingPersona]?.color || "#4ADE80" }]} />
              <Text style={s.userInputLabel} numberOfLines={1}>
                {ARENA_PERSONAS[askingPersona]?.shortName || "Someone"} asks:
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
                    const persona = ARENA_PERSONAS[reactor];
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
});
