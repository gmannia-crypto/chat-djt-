import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  View, Text, Pressable, ScrollView, StyleSheet, Modal, ActivityIndicator,
  Platform, Image, FlatList, TextInput, KeyboardAvoidingView, Alert, Share, Linking,
  AppState,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { fetch } from "expo/fetch";
import Animated, { FadeIn, FadeInDown, FadeInUp, FadeOut, ZoomIn, ZoomOut, useSharedValue, useAnimatedStyle, withTiming, withRepeat, withSequence, cancelAnimation } from "react-native-reanimated";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Audio } from "expo-av";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { getApiUrl } from "@/lib/query-client";
import { useTokens } from "@/lib/token-context";
import Colors from "@/constants/colors";
import { ShareAppButton } from "@/components/ShareAppButton";
import { PersonaStatsCard, type PersonaStatsCardData } from "@/components/PersonaStatsCard";
import { captureRef } from "react-native-view-shot";
import { CashAppDonate } from "@/components/CashAppDonate";
import { playTTS, prefetchTTSAudio, playPrefetchedAudio, warmupAudio } from "@/lib/audio-helper";
import { getPersonaVoiceVolume, shouldSkipPersonaVoice } from "@/lib/persona-voice";
import AnimatedDebateFace, { EXPRESSION_SOURCES, Mood } from "@/components/AnimatedDebateFace";
import {
  MODERATORS, ModeratorStyle, generateModeratorLine, makeInterruptController,
  speakModeratorNow, localJab, moderatorLieReaction, generateModeratorQuestion, getModeratorLeaning,
  getSquabbleBridge,
  getSquabbleCloser,
  detectDodge,
  getDodgePressLine,
} from "@/lib/debate-moderator";
import { playDingSound } from "@/lib/arena-sfx";
import { TokenWinVideo } from "@/components/TokenWinVideo";
import {
  placeInterviewBet, clearInterviewBet, getInterviewBet,
  awardBetWin, resolveInterviewWinnerBet,
} from "@/lib/debate-bets";
import { usePersonaLocks, PREMIUM_PERSONA_CONFIGS, RECENTLY_UNLOCKED_BADGE_KEY } from "@/lib/persona-locks";

// Mystery persona IDs and storage key — kept in sync with arena.tsx
const MYSTERY_PERSONA_IDS = ["alexjones", "obama", "melania", "schumer", "odonnell", "kamala", "mtg", "rfk"];
const MYSTERY_UNLOCK_KEY = "arena_mystery_unlocked";

type PersonaLite = { id: string; name: string };
type Topic = { id: string; title: string; description: string; era: "current" | "past" };
type Msg = { id: string; speakerId: string; speakerName: string; text: string; ts: number; isInterruption?: boolean; isCallIn?: boolean; callerName?: string; isSystem?: boolean; skipTTS?: boolean; isPartingShot?: boolean };

type Emotions = { anger: number; happy: number; engagement: number; frantic: number; sad: number };
type LieEntry = { id: string; speakerId: string; speakerName: string; text: string; score: number; reason: string; fact: string; ts: number; userFlagged?: boolean; pending?: boolean };

const ZERO_EMO: Emotions = { anger: 10, happy: 10, engagement: 30, frantic: 5, sad: 5 };
const EMO_KEYS: (keyof Emotions)[] = ["anger", "happy", "engagement", "frantic", "sad"];
const EMO_LABELS: Record<keyof Emotions, string> = { anger: "ANGR", happy: "HAPPY", engagement: "ENGD", frantic: "FRNT", sad: "SAD" };
const EMO_COLORS: Record<keyof Emotions, string> = { anger: "#ff4d4d", happy: "#4ADE80", engagement: "#FFD700", frantic: "#a855f7", sad: "#60a5fa" };

// Cartoon-style image filter — vivid posterized look on web; native gets the same circle crop
const CARTOON_FILTER = Platform.OS === "web"
  ? ({ filter: "contrast(1.35) saturate(1.85) brightness(1.03)" } as any)
  : {};

// Per-persona Amazon affiliate store links
const PERSONA_AMAZON_LINKS: Record<string, Array<{ title: string; url: string; icon: string }>> = {
  trump:          [{ title: "Trump Books", url: "https://www.amazon.com/s?k=donald+trump+books&tag=trumpbot-20", icon: "book" }, { title: "MAGA Hat", url: "https://www.amazon.com/s?k=maga+hat&tag=trumpbot-20", icon: "ribbon" }, { title: "Trump Merch", url: "https://www.amazon.com/s?k=trump+merchandise&tag=trumpbot-20", icon: "shirt" }],
  obama:          [{ title: "Obama Books", url: "https://www.amazon.com/s?k=barack+obama+books&tag=trumpbot-20", icon: "book" }, { title: "Hope Poster", url: "https://www.amazon.com/s?k=obama+hope+poster&tag=trumpbot-20", icon: "image" }, { title: "Political Tee", url: "https://www.amazon.com/s?k=political+t+shirt&tag=trumpbot-20", icon: "shirt" }],
  biden:          [{ title: "Biden Books", url: "https://www.amazon.com/s?k=joe+biden+books&tag=trumpbot-20", icon: "book" }, { title: "Ray-Ban Aviators", url: "https://www.amazon.com/s?k=ray+ban+aviator+sunglasses&tag=trumpbot-20", icon: "sunny" }, { title: "Ice Cream Gift", url: "https://www.amazon.com/s?k=ice+cream+gift+set&tag=trumpbot-20", icon: "gift" }],
  elon:           [{ title: "Elon Musk Book", url: "https://www.amazon.com/s?k=elon+musk+book&tag=trumpbot-20", icon: "book" }, { title: "Tesla Gear", url: "https://www.amazon.com/s?k=tesla+accessories&tag=trumpbot-20", icon: "car" }, { title: "SpaceX Merch", url: "https://www.amazon.com/s?k=spacex+merchandise&tag=trumpbot-20", icon: "planet" }],
  kamala:         [{ title: "Kamala Books", url: "https://www.amazon.com/s?k=kamala+harris+books&tag=trumpbot-20", icon: "book" }, { title: "Converse Shoes", url: "https://www.amazon.com/s?k=converse+chuck+taylor&tag=trumpbot-20", icon: "footsteps" }, { title: "Political Memoir", url: "https://www.amazon.com/s?k=political+memoir+books&tag=trumpbot-20", icon: "library" }],
  berniemc:       [{ title: "Bernie Book", url: "https://www.amazon.com/s?k=bernie+sanders+books&tag=trumpbot-20", icon: "book" }, { title: "Bernie Mittens", url: "https://www.amazon.com/s?k=bernie+mittens&tag=trumpbot-20", icon: "gift" }, { title: "Progressive Tee", url: "https://www.amazon.com/s?k=progressive+political+shirt&tag=trumpbot-20", icon: "shirt" }],
  maddow:         [{ title: "Rachel Maddow Book", url: "https://www.amazon.com/s?k=rachel+maddow+book&tag=trumpbot-20", icon: "book" }, { title: "Political Thriller", url: "https://www.amazon.com/s?k=political+thriller+books&tag=trumpbot-20", icon: "library" }, { title: "News Mug", url: "https://www.amazon.com/s?k=breaking+news+coffee+mug&tag=trumpbot-20", icon: "cafe" }],
  rosie:          [{ title: "Rosie O'Donnell Book", url: "https://www.amazon.com/s?k=rosie+odonnell+book&tag=trumpbot-20", icon: "book" }, { title: "Comedy DVD", url: "https://www.amazon.com/s?k=stand+up+comedy+dvd&tag=trumpbot-20", icon: "videocam" }, { title: "Talk Show Merch", url: "https://www.amazon.com/s?k=talk+show+merchandise&tag=trumpbot-20", icon: "gift" }],
  hannity:        [{ title: "Hannity Book", url: "https://www.amazon.com/s?k=sean+hannity+book&tag=trumpbot-20", icon: "book" }, { title: "Fox News Mug", url: "https://www.amazon.com/s?k=fox+news+mug&tag=trumpbot-20", icon: "cafe" }, { title: "Conservative Gear", url: "https://www.amazon.com/s?k=conservative+political+gear&tag=trumpbot-20", icon: "ribbon" }],
  alexjones:      [{ title: "Infowars Supplements", url: "https://www.amazon.com/s?k=tactical+supplements&tag=trumpbot-20", icon: "fitness" }, { title: "Conspiracy Books", url: "https://www.amazon.com/s?k=conspiracy+theory+books&tag=trumpbot-20", icon: "book" }, { title: "Survival Gear", url: "https://www.amazon.com/s?k=survival+emergency+kit&tag=trumpbot-20", icon: "shield" }],
  omar:           [{ title: "Ilhan Omar Book", url: "https://www.amazon.com/s?k=ilhan+omar+book&tag=trumpbot-20", icon: "book" }, { title: "Hijab Styles", url: "https://www.amazon.com/s?k=hijab+fashion&tag=trumpbot-20", icon: "ribbon" }, { title: "Progressive Policy", url: "https://www.amazon.com/s?k=progressive+policy+books&tag=trumpbot-20", icon: "library" }],
  galloway:       [{ title: "Galloway Book", url: "https://www.amazon.com/s?k=george+galloway+book&tag=trumpbot-20", icon: "book" }, { title: "Political Debate", url: "https://www.amazon.com/s?k=political+debate+books&tag=trumpbot-20", icon: "library" }, { title: "Fedora Hat", url: "https://www.amazon.com/s?k=fedora+hat+men&tag=trumpbot-20", icon: "ribbon" }],
  mcconnell:      [{ title: "Senate Books", url: "https://www.amazon.com/s?k=us+senate+history+books&tag=trumpbot-20", icon: "book" }, { title: "GOP Gear", url: "https://www.amazon.com/s?k=republican+party+merchandise&tag=trumpbot-20", icon: "ribbon" }, { title: "Political Strategy", url: "https://www.amazon.com/s?k=political+strategy+books&tag=trumpbot-20", icon: "library" }],
  schumer:        [{ title: "Chuck Schumer Book", url: "https://www.amazon.com/s?k=chuck+schumer+book&tag=trumpbot-20", icon: "book" }, { title: "Democrat Merch", url: "https://www.amazon.com/s?k=democrat+merchandise&tag=trumpbot-20", icon: "ribbon" }, { title: "NYC Skyline", url: "https://www.amazon.com/s?k=new+york+city+art+print&tag=trumpbot-20", icon: "image" }],
  candace:        [{ title: "Candace Owens Book", url: "https://www.amazon.com/s?k=candace+owens+book&tag=trumpbot-20", icon: "book" }, { title: "Conservative Tee", url: "https://www.amazon.com/s?k=conservative+women+shirt&tag=trumpbot-20", icon: "shirt" }, { title: "Blexit Gear", url: "https://www.amazon.com/s?k=blexit+merchandise&tag=trumpbot-20", icon: "ribbon" }],
  melania:        [{ title: "First Lady Book", url: "https://www.amazon.com/s?k=melania+trump+book&tag=trumpbot-20", icon: "book" }, { title: "Designer Fragrance", url: "https://www.amazon.com/s?k=luxury+womens+perfume&tag=trumpbot-20", icon: "flower" }, { title: "Luxury Sunglasses", url: "https://www.amazon.com/s?k=luxury+designer+sunglasses+women&tag=trumpbot-20", icon: "sunny" }],
  joyreid:        [{ title: "Joy Reid Book", url: "https://www.amazon.com/s?k=joy+reid+book&tag=trumpbot-20", icon: "book" }, { title: "MSNBC Gear", url: "https://www.amazon.com/s?k=msnbc+news+mug&tag=trumpbot-20", icon: "cafe" }, { title: "News Anchor Style", url: "https://www.amazon.com/s?k=news+anchor+fashion&tag=trumpbot-20", icon: "shirt" }],
  megynkelly:     [{ title: "Megyn Kelly Book", url: "https://www.amazon.com/s?k=megyn+kelly+book&tag=trumpbot-20", icon: "book" }, { title: "Journalist Style", url: "https://www.amazon.com/s?k=journalist+fashion+women&tag=trumpbot-20", icon: "shirt" }, { title: "Media Memoir", url: "https://www.amazon.com/s?k=media+memoir+books&tag=trumpbot-20", icon: "library" }],
  netanyahu:      [{ title: "Netanyahu Book", url: "https://www.amazon.com/s?k=netanyahu+book&tag=trumpbot-20", icon: "book" }, { title: "Middle East History", url: "https://www.amazon.com/s?k=middle+east+history+books&tag=trumpbot-20", icon: "library" }, { title: "Israel Map Art", url: "https://www.amazon.com/s?k=israel+map+art+print&tag=trumpbot-20", icon: "image" }],
  bannon:         [{ title: "Steve Bannon Book", url: "https://www.amazon.com/s?k=steve+bannon+book&tag=trumpbot-20", icon: "book" }, { title: "War Room Gear", url: "https://www.amazon.com/s?k=political+podcast+merch&tag=trumpbot-20", icon: "ribbon" }, { title: "MAGA Gear", url: "https://www.amazon.com/s?k=maga+merchandise&tag=trumpbot-20", icon: "shirt" }],
  mtg:            [{ title: "MTG Book", url: "https://www.amazon.com/s?k=marjorie+taylor+greene+book&tag=trumpbot-20", icon: "book" }, { title: "Georgia Peach Gear", url: "https://www.amazon.com/s?k=georgia+state+merchandise&tag=trumpbot-20", icon: "ribbon" }, { title: "QAnon Books", url: "https://www.amazon.com/s?k=conspiracy+political+books&tag=trumpbot-20", icon: "library" }],
  rfk:            [{ title: "RFK Jr Book", url: "https://www.amazon.com/s?k=rfk+junior+book&tag=trumpbot-20", icon: "book" }, { title: "Anti-Vaccine Books", url: "https://www.amazon.com/s?k=vaccine+safety+books&tag=trumpbot-20", icon: "library" }, { title: "Organic Health", url: "https://www.amazon.com/s?k=organic+health+supplements&tag=trumpbot-20", icon: "fitness" }],
  neiltyson:      [{ title: "Neil deGrasse Tyson Book", url: "https://www.amazon.com/s?k=neil+degrasse+tyson+book&tag=trumpbot-20", icon: "book" }, { title: "Space Telescope", url: "https://www.amazon.com/s?k=telescope+astronomy&tag=trumpbot-20", icon: "planet" }, { title: "Cosmos Poster", url: "https://www.amazon.com/s?k=cosmos+space+poster&tag=trumpbot-20", icon: "image" }],
  malema:         [{ title: "Julius Malema Book", url: "https://www.amazon.com/s?k=julius+malema+book&tag=trumpbot-20", icon: "book" }, { title: "South Africa Art", url: "https://www.amazon.com/s?k=south+africa+art+print&tag=trumpbot-20", icon: "image" }, { title: "EFF Red Beret", url: "https://www.amazon.com/s?k=red+beret+hat&tag=trumpbot-20", icon: "ribbon" }],
  errol:          [{ title: "Errol Musk Book", url: "https://www.amazon.com/s?k=errol+musk+book&tag=trumpbot-20", icon: "book" }, { title: "Mining History", url: "https://www.amazon.com/s?k=africa+mining+history&tag=trumpbot-20", icon: "library" }, { title: "South Africa Memoir", url: "https://www.amazon.com/s?k=south+africa+memoir&tag=trumpbot-20", icon: "library" }],
  pambondi:       [{ title: "AG Books", url: "https://www.amazon.com/s?k=attorney+general+books&tag=trumpbot-20", icon: "book" }, { title: "Florida Merch", url: "https://www.amazon.com/s?k=florida+merchandise&tag=trumpbot-20", icon: "ribbon" }, { title: "Law & Order Books", url: "https://www.amazon.com/s?k=law+and+order+books&tag=trumpbot-20", icon: "library" }],
  miller:         [{ title: "Stephen Miller Book", url: "https://www.amazon.com/s?k=stephen+miller+book&tag=trumpbot-20", icon: "book" }, { title: "Immigration Policy", url: "https://www.amazon.com/s?k=immigration+policy+books&tag=trumpbot-20", icon: "library" }, { title: "MAGA Gear", url: "https://www.amazon.com/s?k=maga+gear&tag=trumpbot-20", icon: "shirt" }],
  carville:       [{ title: "James Carville Book", url: "https://www.amazon.com/s?k=james+carville+book&tag=trumpbot-20", icon: "book" }, { title: "Louisiana Hot Sauce", url: "https://www.amazon.com/s?k=louisiana+hot+sauce&tag=trumpbot-20", icon: "gift" }, { title: "Dem Strategy Books", url: "https://www.amazon.com/s?k=democratic+strategy+books&tag=trumpbot-20", icon: "library" }],
  graham:         [{ title: "Lindsey Graham Book", url: "https://www.amazon.com/s?k=lindsey+graham+book&tag=trumpbot-20", icon: "book" }, { title: "SC State Gear", url: "https://www.amazon.com/s?k=south+carolina+merchandise&tag=trumpbot-20", icon: "ribbon" }, { title: "Senate History", url: "https://www.amazon.com/s?k=us+senate+history&tag=trumpbot-20", icon: "library" }],
  shannon:        [{ title: "Club Shay Shay Gear", url: "https://www.amazon.com/s?k=shannon+sharpe+club+shay+shay&tag=trumpbot-20", icon: "mic" }, { title: "NFL Hall of Fame Books", url: "https://www.amazon.com/s?k=nfl+hall+of+fame+football+books&tag=trumpbot-20", icon: "book" }, { title: "Sports Media Books", url: "https://www.amazon.com/s?k=sports+media+commentary+books&tag=trumpbot-20", icon: "library" }],
  ivanka:         [{ title: "Ivanka Trump Book", url: "https://www.amazon.com/s?k=ivanka+trump+book&tag=trumpbot-20", icon: "book" }, { title: "Luxury Handbag", url: "https://www.amazon.com/s?k=luxury+designer+handbag&tag=trumpbot-20", icon: "bag" }, { title: "Fashion Accessories", url: "https://www.amazon.com/s?k=luxury+fashion+accessories&tag=trumpbot-20", icon: "ribbon" }],
  stephena:       [{ title: "Stephen A. Smith Book", url: "https://www.amazon.com/s?k=stephen+a+smith+book&tag=trumpbot-20", icon: "book" }, { title: "ESPN Gear", url: "https://www.amazon.com/s?k=espn+sports+merchandise&tag=trumpbot-20", icon: "trophy" }, { title: "Sports Analysis", url: "https://www.amazon.com/s?k=sports+analysis+books&tag=trumpbot-20", icon: "library" }],
  odonnell:       [{ title: "Lawrence O'Donnell Book", url: "https://www.amazon.com/s?k=lawrence+odonnell+book&tag=trumpbot-20", icon: "book" }, { title: "MSNBC Mug", url: "https://www.amazon.com/s?k=msnbc+coffee+mug&tag=trumpbot-20", icon: "cafe" }, { title: "Political Memoir", url: "https://www.amazon.com/s?k=political+memoir&tag=trumpbot-20", icon: "library" }],
  jimjordan:      [{ title: "Jim Jordan Book", url: "https://www.amazon.com/s?k=jim+jordan+book&tag=trumpbot-20", icon: "book" }, { title: "Ohio State Gear", url: "https://www.amazon.com/s?k=ohio+state+merchandise&tag=trumpbot-20", icon: "ribbon" }, { title: "Freedom Caucus", url: "https://www.amazon.com/s?k=conservative+freedom+books&tag=trumpbot-20", icon: "library" }],
  loomer:         [{ title: "Laura Loomer Book", url: "https://www.amazon.com/s?k=laura+loomer+book&tag=trumpbot-20", icon: "book" }, { title: "MAGA Gear", url: "https://www.amazon.com/s?k=maga+gear&tag=trumpbot-20", icon: "ribbon" }, { title: "Investigative Journalism", url: "https://www.amazon.com/s?k=investigative+journalism+books&tag=trumpbot-20", icon: "library" }],
  leavitt:        [{ title: "Press Secretary Books", url: "https://www.amazon.com/s?k=white+house+press+secretary+books&tag=trumpbot-20", icon: "book" }, { title: "Political Career", url: "https://www.amazon.com/s?k=women+in+politics+books&tag=trumpbot-20", icon: "library" }, { title: "MAGA Merch", url: "https://www.amazon.com/s?k=maga+merchandise&tag=trumpbot-20", icon: "shirt" }],
  erikakirk:      [{ title: "Political Commentary", url: "https://www.amazon.com/s?k=political+commentary+books&tag=trumpbot-20", icon: "book" }, { title: "Women in Media", url: "https://www.amazon.com/s?k=women+in+media+books&tag=trumpbot-20", icon: "library" }, { title: "Talk Show Gear", url: "https://www.amazon.com/s?k=talk+show+merchandise&tag=trumpbot-20", icon: "gift" }],
  ruckus:         [{ title: "Boondocks Art", url: "https://www.amazon.com/s?k=boondocks+art+print&tag=trumpbot-20", icon: "image" }, { title: "Political Satire Books", url: "https://www.amazon.com/s?k=political+satire+books&tag=trumpbot-20", icon: "book" }, { title: "Uncle Ruckus Meme", url: "https://www.amazon.com/s?k=political+humor+gifts&tag=trumpbot-20", icon: "gift" }],
  jesseleepetersen: [{ title: "Jesse Lee Peterson Book", url: "https://www.amazon.com/s?k=jesse+lee+peterson+book&tag=trumpbot-20", icon: "book" }, { title: "Conservative Radio", url: "https://www.amazon.com/s?k=conservative+talk+radio+books&tag=trumpbot-20", icon: "library" }, { title: "MAGA Gear", url: "https://www.amazon.com/s?k=maga+merchandise&tag=trumpbot-20", icon: "ribbon" }],
  claudeanderson:   [{ title: "Black Labor White Wealth", url: "https://www.amazon.com/s?k=black+labor+white+wealth+claude+anderson&tag=trumpbot-20", icon: "book" }, { title: "Powernomics", url: "https://www.amazon.com/s?k=powernomics+claude+anderson&tag=trumpbot-20", icon: "library" }, { title: "Black Wealth Books", url: "https://www.amazon.com/s?k=black+economic+empowerment+books&tag=trumpbot-20", icon: "book" }],
  jascrockett:      [{ title: "Progressive Politics Books", url: "https://www.amazon.com/s?k=progressive+politics+books&tag=trumpbot-20", icon: "book" }, { title: "Black Women in Congress", url: "https://www.amazon.com/s?k=black+women+congress+politics&tag=trumpbot-20", icon: "library" }, { title: "Civil Rights Gear", url: "https://www.amazon.com/s?k=civil+rights+merchandise&tag=trumpbot-20", icon: "ribbon" }],
  aoc:              [{ title: "AOC Books", url: "https://www.amazon.com/s?k=alexandria+ocasio+cortez+book&tag=trumpbot-20", icon: "book" }, { title: "Green New Deal", url: "https://www.amazon.com/s?k=green+new+deal+book&tag=trumpbot-20", icon: "leaf" }, { title: "Progressive Tee", url: "https://www.amazon.com/s?k=progressive+political+shirt&tag=trumpbot-20", icon: "shirt" }],
  joerogan:         [{ title: "Joe Rogan Podcast Books", url: "https://www.amazon.com/s?k=joe+rogan+recommended+books&tag=trumpbot-20", icon: "book" }, { title: "MMA Gear", url: "https://www.amazon.com/s?k=mma+training+gear&tag=trumpbot-20", icon: "fitness" }, { title: "Podcast Microphone", url: "https://www.amazon.com/s?k=podcast+microphone+kit&tag=trumpbot-20", icon: "mic" }],
  timscott:         [{ title: "Tim Scott Book", url: "https://www.amazon.com/s?k=tim+scott+book+america+a+redemption+story&tag=trumpbot-20", icon: "book" }, { title: "Republican Politics", url: "https://www.amazon.com/s?k=republican+conservative+books&tag=trumpbot-20", icon: "library" }, { title: "South Carolina Gear", url: "https://www.amazon.com/s?k=south+carolina+merchandise&tag=trumpbot-20", icon: "ribbon" }],
  charliemurphy:    [{ title: "Charlie Murphy Book", url: "https://www.amazon.com/s?k=charlie+murphy+comedian+book&tag=trumpbot-20", icon: "book" }, { title: "Chappelle's Show DVD", url: "https://www.amazon.com/s?k=chappelles+show+dvd&tag=trumpbot-20", icon: "videocam" }, { title: "Comedy Stand-Up", url: "https://www.amazon.com/s?k=stand+up+comedy+dvd&tag=trumpbot-20", icon: "gift" }],
};

const DEFAULT_AMAZON_LINKS = [
  { title: "Political Books", url: "https://www.amazon.com/s?k=political+books+bestseller&tag=trumpbot-20", icon: "book" },
  { title: "MAGA Merch", url: "https://www.amazon.com/s?k=maga+merchandise&tag=trumpbot-20", icon: "ribbon" },
  { title: "Trump Gift", url: "https://www.amazon.com/s?k=trump+gift+ideas&tag=trumpbot-20", icon: "gift" },
];

function getInterviewShopLinks(interviewerId?: string | null, intervieweeId?: string | null) {
  const ivLinks = interviewerId ? (PERSONA_AMAZON_LINKS[interviewerId] || []) : [];
  const iveeLinks = intervieweeId ? (PERSONA_AMAZON_LINKS[intervieweeId] || []) : [];
  // Interleave interviewer + interviewee links, fall back to defaults
  const combined = [...ivLinks, ...iveeLinks];
  return combined.length > 0 ? combined : DEFAULT_AMAZON_LINKS;
}

// Short reactive micro-interruptions — fired randomly by the listener during a turn
const MICRO_REACTIONS = [
  "Please.", "Oh really?", "Yeah?", "Yeah right!",
  "You crazy!", "Kiss my ass!", "Mmm-hmm.", "Come on!",
  "Excuse me!", "No way!", "Sure.", "Right.",
  "Oh stop.", "Whatever.", "Here we go.", "Lord have mercy.",
  "Say what?", "Unbelievable.", "Mm.", "Ok sure.", "That's rich.",
];

// Neutral — balanced, no editorial tilt
const REBUTTAL_BRIDGE_TEMPLATES = [
  (n: string) => `${n}, any rebuttal to that?`,
  (n: string) => `${n}, how do you respond to that?`,
  (n: string) => `${n}, what's your take on that claim?`,
  (n: string) => `${n}, care to weigh in?`,
  (n: string) => `${n}, your response?`,
  (n: string) => `${n}, what do you say to that?`,
  (n: string) => `${n}, do you have a rebuttal?`,
  (n: string) => `${n}, I'd like to hear your thoughts on that.`,
];

// Softball — moderator is rooting for this debater; phrasing is gentle, even encouraging
const REBUTTAL_BRIDGE_FAVOR = [
  (n: string) => `${n}, I think you have something important to add here.`,
  (n: string) => `${n}, please — set the record straight.`,
  (n: string) => `${n}, I'd love to hear your perspective on this.`,
  (n: string) => `${n}, go ahead — the floor is yours.`,
  (n: string) => `${n}, you've been very patient. What's your response?`,
  (n: string) => `${n}, I suspect you have a lot to say about that claim.`,
  (n: string) => `${n}, that deserves a real answer — and I think you can give one.`,
  (n: string) => `${n}, don't let that go unchallenged.`,
];

// Prosecutorial — moderator is hostile to this debater; phrasing is skeptical, pressing
const REBUTTAL_BRIDGE_TARGET = [
  (n: string) => `${n}, can you actually defend that? Because I'm not sure you can.`,
  (n: string) => `${n} — your turn. And I'd appreciate a straight answer for once.`,
  (n: string) => `${n}, let's see if you have anything credible to say here.`,
  (n: string) => `${n}, you've been dodging this all night — address it now.`,
  (n: string) => `${n}, the audience is waiting. What exactly is your rebuttal?`,
  (n: string) => `${n}, go ahead — though I'll be listening very carefully.`,
  (n: string) => `${n}, is there any part of that you can honestly dispute?`,
  (n: string) => `${n}, respond to that — if you have a real answer.`,
];

/**
 * Returns a rebuttal-bridge line for the given debater, shaped by how the
 * moderator personally leans toward that persona (softballs for favored
 * debaters, prosecutorial cues for targeted ones, neutral for everyone else).
 */
const getRebuttalBridge = (name: string, moderatorStyle?: ModeratorStyle, personaId?: string): string => {
  let pool = REBUTTAL_BRIDGE_TEMPLATES;
  if (moderatorStyle && personaId) {
    const leaning = getModeratorLeaning(moderatorStyle, personaId);
    if (leaning === "favor") pool = REBUTTAL_BRIDGE_FAVOR;
    else if (leaning === "target") pool = REBUTTAL_BRIDGE_TARGET;
  }
  return pool[Math.floor(Math.random() * pool.length)](name || "Debater");
};

// Short moderator filler lines played when an AI response is still loading
// after the moderator's question or bridge has finished. Prevents dead air on
// slow connections by keeping the moderator's voice in the room while waiting.
const WAIT_FILLER_TEMPLATES: Array<(name: string) => string> = [
  (n) => `${n}, the floor is yours.`,
  (n) => `Go ahead, ${n}.`,
  (n) => `${n}, whenever you're ready.`,
  (n) => `Take your time, ${n}.`,
  (n) => `We're waiting on your response, ${n}.`,
  (n) => `${n}, please go ahead.`,
  (n) => `Your response, ${n}.`,
];
let _waitFillerIdx = 0;
const getWaitFiller = (name: string): string => {
  const fn = WAIT_FILLER_TEMPLATES[_waitFillerIdx % WAIT_FILLER_TEMPLATES.length];
  _waitFillerIdx++;
  return fn(name || "Debater");
};

// Maps persona IDs to TTS-safe spoken names.
// Values can be a plain string (universal) or a per-speaker map with a "default" fallback.
// The speakerId argument is the moderator/speaker who is addressing the target.
type TtsNameEntry = string | Record<string, string>;
const TTS_NAME_OVERRIDES: Record<string, TtsNameEntry> = {
  // Malcolm X: moderator decides the register
  //   Joy Reid / progressive moderators  → "Brother Malcolm" (solidarity)
  //   Hannity / Megyn Kelly (right-wing) → "Mr. Shabazz"   (formal-hostile)
  //   Everyone else                      → "Mr. Malcolm"   (avoids "X = the tenth" TTS misread)
  malcolmx: {
    joyreid:      "Brother Malcolm",
    maddow:       "Brother Malcolm",
    odonnell:     "Brother Malcolm",
    shannonsharp: "Brother Malcolm",
    hannity:      "Mr. Shabazz",
    megynkelly:   "Mr. Shabazz",
    default:      "Mr. Malcolm",
  },
};
const spokenName = (id: string | undefined, displayName: string, speakerId?: string): string => {
  if (!id) return displayName;
  const entry = TTS_NAME_OVERRIDES[id];
  if (!entry) return displayName;
  if (typeof entry === "string") return entry;
  return entry[speakerId ?? ""] ?? entry.default ?? displayName;
};

// ── OFFENSE DETECTION ─────────────────────────────────────────────────────────
// Persona-specific triggers that guarantee an immediate interruption.
// Keep patterns targeted — avoid common words that appear in normal speech.
const PERSONA_OFFENSE_TRIGGERS: Record<string, RegExp> = {
  // Dr. Claude Anderson — he is a MAN. Any female pronoun/title = instant fury.
  claudeanderson: /\b(she|her|ma'am|maam|woman|lady|madam|miss|ms\.)\b/i,
  // Male personas — female pronouns directed at them
  trump:    /\bshe's|she is|her presidency|madam president\b/i,
  obama:    /\bshe's|she is|her presidency|madam president\b/i,
  biden:    /\bshe's|she is|her presidency|madam president\b/i,
  // Female personas — male pronouns directed at them
  kamala:   /\bhe is president|his presidency|mr\. harris\b/i,
  omar:     /\bhe voted|his religion|mr\. omar\b/i,
  // Universal dignity triggers — being called a traitor/sellout to their face
  timscott: /\bsambo|uncle tom|sellout|house negro\b/i,
  candace:  /\btraitor|sellout|uncle tom|house negro\b/i,
  ruckus:   /\btraitor|sellout|house negro\b/i,
  // Charlie Murphy — DEI attacks, racial slurs, dismissive insults, or questioning his credibility
  charliemurphy: /\bdei\b|affirmative action hire|diversity hire|quota|thug|boy\b|criminal|jigsaw|jiggsaw|hood rat|ghetto|monkey|ape|token|you people|your kind|go back|shut up|sit down|nobody|irrelevant|washed up|who are you/i,
  // Tucker Carlson — Putin puppet, white nationalist, or propaganda accusations trigger immediate pushback
  tuckercarlson: /\bputin puppet|russian agent|kremlin\b|white nationalist|white supremacist|racist\b|propaganda machine|fox propaganda|fascist\b/i,
};

function moodFor(anger: number, frantic: number, happy: number, speaking: boolean): Mood {
  if (anger >= 55) return "angry";
  if (frantic >= 45) return speaking ? "flustered" : "shocked";
  if (!speaking && happy >= 40) return "smug";
  return "neutral";
}

/**
 * Returns true if `text` contains an offense trigger for `personaId`
 * and `personaId` is NOT the speaker of that text (no self-interruption).
 */
function detectOffense(text: string, personaId: string, speakerId: string): boolean {
  if (personaId === speakerId) return false; // never self-interrupt
  const pattern = PERSONA_OFFENSE_TRIGGERS[personaId];
  if (!pattern) return false;
  return pattern.test(text);
}
// ─────────────────────────────────────────────────────────────────────────────

// ── PERSONA AGGRESSION LEVELS ─────────────────────────────────────────────────
// aggression: 0–1, probability of firing a fireback when insulted
// angerThresh: total insult-severity points needed to cross the trigger line
// maxChain: consecutive back-and-forth exchanges before a cooldown kicks in
const PERSONA_AGGRESSION: Record<string, { aggression: number; angerThresh: number; maxChain: number }> = {
  // Hair-trigger — insult them and they WILL fire back, hard
  carville:        { aggression: 0.97, angerThresh: 1, maxChain: 4 },
  trump:           { aggression: 0.95, angerThresh: 1, maxChain: 5 },
  charliemurphy:   { aggression: 0.92, angerThresh: 1, maxChain: 3 },
  malema:          { aggression: 0.93, angerThresh: 1, maxChain: 3 },
  claudeanderson:  { aggression: 0.90, angerThresh: 1, maxChain: 3 },
  gilbertgottfried:{ aggression: 0.88, angerThresh: 1, maxChain: 3 },
  biden:           { aggression: 0.82, angerThresh: 2, maxChain: 3 },
  joyreid:         { aggression: 0.83, angerThresh: 2, maxChain: 2 },
  // High aggression — provoke them enough and they escalate
  netanyahu:       { aggression: 0.78, angerThresh: 2, maxChain: 2 },
  omar:            { aggression: 0.76, angerThresh: 2, maxChain: 2 },
  ruckus:          { aggression: 0.74, angerThresh: 2, maxChain: 2 },
  candace:         { aggression: 0.72, angerThresh: 2, maxChain: 2 },
  rfkjr:           { aggression: 0.65, angerThresh: 3, maxChain: 2 },
  bernie:          { aggression: 0.68, angerThresh: 3, maxChain: 2 },
  gaetz:           { aggression: 0.63, angerThresh: 3, maxChain: 2 },
  gallowaygj:      { aggression: 0.70, angerThresh: 2, maxChain: 2 },
  // Moderate — measured, but still have a breaking point
  tuckercarlson:   { aggression: 0.60, angerThresh: 3, maxChain: 2 },
  maddow:          { aggression: 0.55, angerThresh: 4, maxChain: 1 },
  kamala:          { aggression: 0.55, angerThresh: 4, maxChain: 1 },
  timscott:        { aggression: 0.40, angerThresh: 5, maxChain: 1 },
  // Default for any unlisted persona
  _default:        { aggression: 0.50, angerThresh: 4, maxChain: 2 },
};
function getAggression(id: string) { return PERSONA_AGGRESSION[id] ?? PERSONA_AGGRESSION["_default"]; }

// ── SQUABBLE THREAT LINES ─────────────────────────────────────────────────────
// Fired when a persona's fireback chain hits maxChain — the last-gasp physical threat
// before the moderator is forced to step in and restore order.
const PERSONA_SQUABBLE_THREATS: Record<string, string[]> = {
  // ── Already covered ───────────────────────────────────────────────────────
  carville:        ["You keep talking like that and I will drag you out of this chair, you son of a bitch!", "Say that one more time and we will finish this in the parking lot, I promise you that!"],
  trump:           ["I've dealt with tougher guys than you in Atlantic City — you want to go? Let's go!", "Keep it up and I'll have security remove you. Personally. With my hands."],
  charliemurphy:   ["You really want to do this? Because I have been waiting ALL night for an excuse.", "Say that again and I will physically remove you from this stage — I'm not joking."],
  malema:          ["You think this is a game?! I will flip this table and we sort this out right here!", "Step to me like that again and you will regret every word that came out of your mouth."],
  claudeanderson:  ["I don't argue — I educate. But if you come at me like that again, I will handle you differently.", "You come at me sideways one more time and this debate becomes a very different kind of conversation."],
  gilbertgottfried:["OH YEAH?! You want a piece of me?! I AM COMING OVER THERE!", "I will SCREAM at you from two inches away until your ears bleed — don't test me!"],
  biden:           ["Listen, pal — I've been in this game fifty years. You push me again and I'll show you what old-fashioned means.", "Come at me like that one more time and I'll remind you how we handled things in Scranton."],
  joyreid:         ["You need to back WAY up before I lose my composure on national television.", "One more word like that and I will come across this table — and I mean that."],
  netanyahu:       ["You threaten me?! I have faced worse than you on three continents. Do not test me.", "Push me one more time and this debate turns into something your security detail will regret."],
  omar:            ["You keep this up and I will walk over there and handle this myself — try me.", "I survived things you can't imagine. Your words don't scare me — but mine should scare you."],
  alexjones:       ["YOU WANT TO FIGHT?! BRING IT! I AM PHYSICALLY SUPERIOR AND CHEMICALLY ENHANCED!", "I will gorilla-press you over my head and THROW you out of this building!"],
  ruckus:          ["Lord have mercy — you push me one more time and I will beat the sense into you myself!", "I may be old but I will still snatch you out that chair if you don't shut your mouth!"],
  // ── Extended persona set ──────────────────────────────────────────────────
  obama:           ["I have been patient — very patient — but you are about to find out what I look like when that patience runs out.", "Do not push me. I am not the one you want to test in this room right now."],
  berniemc:        ["I have been fighting people like you my ENTIRE career — you want to take this outside?! Let's GO!", "One more word and I swear I will leap over this table — and at my age that is saying something!"],
  elon:            ["I have deleted more powerful people than you from my life with a single text. Don't make me start here.", "Keep talking and I will literally buy this entire venue and have you escorted out. Watch me."],
  maddow:          ["I have twenty years of documentation on people who talked to me the way you just did. Back off.", "You come at me one more time and I will spend the next four shows just on you. Is that what you want?"],
  hannity:         ["I have been dealing with liberal bullies my entire career and I have NEVER backed down — not once!", "You want to settle this right now? Because I have been holding back and I am running out of patience!"],
  candace:         ["You think I'm scared of you? I walked away from the entire liberal media complex. You're nothing.", "Do that again and I will come over there and finish this conversation in a way they can't air on television."],
  tuckercarlson:   ["Keep pushing and I will make you the story — and I know exactly how to do that.", "You just made a very significant mistake. I have a camera, an audience, and nothing to lose."],
  gallowaygj:      ["I have faced MI5, Mossad, and the full force of the British establishment — you think you scare me?!", "Come at me like that one more time and I will turn this entire room into a tribunal, starting with you."],
  galloway:        ["I have faced MI5, Mossad, and the full force of the British establishment — you think you scare me?!", "Come at me like that one more time and I will turn this entire room into a tribunal, starting with you."],
  tlaib:           ["I have family in Gaza RIGHT NOW while you sit here and threaten me in a television studio. You want to test me?!", "I was censured by the entire United States House of Representatives and I am STILL HERE. You are nothing compared to that."],
  professorjiang:  ["I have testified before the United States Senate and been attacked by both parties. A debate stage threat is not something I find concerning.", "Forty years of scholarship survive this kind of intimidation. The data does not care about your aggression. Neither do I."],
  timscott:        ["I keep my faith and my composure — but even David picked up a stone when Goliath got close enough.", "I have turned the other cheek three times tonight. There will not be a fourth. Do not test that."],
  joerogan:        ["Bro, I trained with Navy SEALs. I do jiu-jitsu six days a week. Think VERY carefully about your next move.", "I have had Mike Tyson on my podcast. I know what real danger looks like. You are not it — but I can still rearrange you."],
  rfk:             ["The alphabet agencies couldn't silence me. The media couldn't silence me. You certainly won't.", "I have been fighting the most powerful institutions on earth for thirty years. You are a Tuesday."],
  rfkjr:           ["The alphabet agencies couldn't silence me. The media couldn't silence me. You certainly won't.", "I have been fighting the most powerful institutions on earth for thirty years. You are a Tuesday."],
  neiltyson:       ["I have debated astrophysicists, Nobel laureates, and flat-earthers. None of them tried what you just tried — and none of them fared well.", "The universe is 13.8 billion years old. My patience for this has a much shorter half-life. Push me again."],
  aoc:             ["I am from the Bronx. You do NOT want to find out what that means when someone crosses the line with me.", "I have had security threats, death threats, and riots outside my office. You are significantly less frightening than any of that."],
  kamala:          ["I prosecuted criminal cases for a decade. I know exactly how to handle someone who thinks the rules don't apply to them.", "As a former Attorney General, I want you to understand the legal weight of what you just said to me. Choose your next words very carefully."],
  carlin:          ["Oh, you want to do this the physical way? Fine. I grew up in New York. I know how this ends.", "I have been getting kicked out of places since 1969. One more venue won't break my streak — and I will take you with me."],
  errol:           ["I have buried business rivals on three continents and nobody heard about it. Keep testing me.", "I built empires while you were still in school. I know how to make problems disappear quietly."],
  mcconnell:       ["I have politically destroyed people who were far more formidable than you. Don't flatter yourself.", "I have been called a turtle my entire career and I am still here. Everyone who pushed me is not. Think about that."],
  rosie:           ["Oh you DO NOT want this energy from me right now. I grew up in Commack and I have never once backed down.", "Come at me like that one more time and I will give this room a story they will be talking about for YEARS."],
  graham:          ["I spent decades in the United States Senate and I learned things about power that you have never dreamed of. Back off.", "I am from South Carolina. We are polite until we aren't. You are about to learn the difference."],
  megynkelly:      ["I walked away from Fox News at the height of my career. I am not afraid of anything in this room, including you.", "Come at me like that again and I promise you the next interview I give will be entirely about this moment."],
  pambondi:        ["I am the Attorney General of the United States. I will have you removed from this building so fast your head will spin.", "I have put people in courtrooms for less than what you just said. Choose your next words like your freedom depends on it."],
  miller:          ["I have quietly removed more powerful people from positions of influence than you will ever know. Consider this a warning.", "You are making a serious miscalculation about who I am and what I am capable of. Stop now."],
  jimjordan:       ["I WRESTLED in college! I know how to take somebody down and I have been waiting for an excuse ALL NIGHT!", "No tie, no jacket, and absolutely no patience left. You want to do this?! Let's do this!"],
  schumer:         ["I have held the Senate floor for twelve hours straight. I can outlast you in any arena you choose.", "You push me one more time and I will make sure every camera in this room catches exactly what you just did."],
  melania:         ["I have lived inside one of the most dangerous political environments in modern history. You are not a threat. You are an inconvenience.", "I am from Slovenia. We know how to end a conversation when it has gone far enough. This one has gone far enough."],
  odonnell:        ["I have covered wars, impeachments, and coups. You are not even in the same category of threat.", "Come at me one more time and I will spend the next week dissecting every word you have ever said on air."],
  mtg:             ["I carry and I know how to use it. You want to keep pushing?!", "I am from Georgia and I don't take this kind of talk from anybody — I don't care who you are or who sent you."],
  erikakirk:       ["I have survived rooms far more hostile than this one. Back off before I show you what that looks like up close.", "You are making a mistake you will remember. I don't bluster. I follow through."],
  loomer:          ["They banned me from Uber, Twitter, Facebook, and PayPal and I am STILL HERE. You think you can stop me?!", "Come after me one more time and I will livestream everything that happens next. Every. Single. Second."],
  leavitt:         ["I speak for the White House. You just made a diplomatic incident out of a debate. Back off now.", "I am the youngest press secretary in American history. You do not want to find out why they gave that job to me."],
  bannon:          ["I have taken on Goldman Sachs, the globalists, and the entire establishment media. You are a rounding error.", "I have been to federal prison and I came back angrier. Keep pushing and find out what that means in person."],
  stephena:        ["I AM 6'5\" AND I HAVE BEEN HOLDING THIS BACK FOR THE ENTIRE DEBATE AND I AM DONE HOLDING IT BACK!", "I have covered the NFL for twenty-five years! I know what it looks like right before somebody gets hit! BACK UP!"],
  jesseleepetersen:["The Lord is my witness — you push me one more time and I will demonstrate exactly why righteousness is not weakness.", "I grew up with nothing and I fought for everything I have. You do not want this particular fight."],
  shannon:         ["I played twelve years in the NFL. I have been hit by the best athletes on the planet. You are not one of them.", "I spent my career catching passes with linebackers trying to take my head off. You are significantly less scary than any of them."],
  ivanka:          ["I have operated at the highest levels of business and government for twenty years. I know exactly how to destroy a credibility in a room.", "There is a line, and you just crossed it, and I want you to understand that I never forget when someone crosses that line."],
  jascrockett:     ["I am a defense attorney from Texas. I have stood next to people the state was trying to execute. You do not intimidate me at all.", "Keep going and I will cross-examine you in front of this entire room until there is nothing left of that argument."],
  billclinton:     ["Now listen to me carefully — I have survived everything that the entire Republican Party could throw at me for thirty years. You are one person.", "I am from Hope, Arkansas, and in Arkansas we finish our disagreements. Don't start something you can't finish."],
  hillaryclinton:  ["I have been investigated, subpoenaed, deposed, and impeached by proxy, and I am still standing in this room. What exactly do you think you are going to do?", "I have faced Ken Starr, the Benghazi Committee, and thirty years of political enemies. Add yourself to that list if you want. I have the receipts."],
  marcorubio:      ["I am the son of Cuban immigrants who escaped a dictatorship. I know what real intimidation looks like. This isn't it.", "You want to do this in front of everyone? Because I will absolutely finish this conversation right here, right now."],
  desantis:        ["I deployed to Guantanamo Bay as a JAG officer. I know how to handle pressure. You are not pressure.", "Come at me one more time and I will make this a Florida problem. You do NOT want this to become a Florida problem."],
  pastormanning:   ["THE LORD GOD ALMIGHTY IS MY SHIELD AND MY SWORD! YOU CANNOT THREATEN WHAT THE ANOINTING PROTECTS!", "I HAVE BEEN RUN OUT OF HARLEM AND I CAME BACK! You think you can stop me?! I AM UNSTOPPABLE BY MAN!"],
  shahidbolson:    ["I was sentenced to prison by courts trying to silence me and I am still speaking. What exactly is your threat?", "I have faced the full power of the Pakistani state. You are one person in a television studio. Do not flatter yourself."],
  mlk:             ["I have faced fire hoses, attack dogs, and assassins' bullets. Your words are not a threat. They are a distraction.", "I have been jailed, bombed, and surveilled by my own government. Whatever you are about to do will not stop this movement."],
  malcolmx:        ["By any means necessary — and I mean EVERY word of that. Test me if you don't believe it.", "You just threatened the wrong man in the wrong room. I suggest you reconsider before this becomes something the moderator cannot stop."],
  samjackson:      ["I have played every kind of dangerous man there is on screen and off screen I am worse. Back. Off.", "Do you feel lucky? Because I promise you, you do not want me to stand up from this chair."],
  louisfarrakhan:  ["The Fruit of Islam did not train me to run from a fight. Take one more step in that direction.", "I have stood on the Mall with a million men at my back. You alone do not concern me. At all."],
  carlsagan:       ["I have stared into the void of the cosmos and come back unafraid. Your posturing is, cosmically speaking, meaningless.", "Billions of years of physical laws are on my side. Your aggression is just entropy in a suit. Back down."],
  larrycableguy:   ["Git-R-Done is not just a catchphrase, bubba — it is a WAY OF LIFE and right now it means I am about to git you done!", "I grew up working on engines and farms. I know how to handle something that won't stop running its mouth. Come on."],
  jdvance:         ["I grew up in Appalachia where disputes got settled without moderators. You sure you want to go there?", "I carried the weight of a broken family and a broken community and I am still standing. You are nothing I haven't survived already."],
  tedcruz:         ["I clerked for the Chief Justice of the United States. I have argued before the Supreme Court. And right now I am about to argue you into the floor.", "You want to finish this outside? I did collegiate debate AND Harvard Law. I will absolutely destroy you in any venue you choose."],
  georgewbush:     ["Now look. I made the decision. The decision is that you need to back off. Right now. Decision made.", "I was the Commander-in-Chief of the most powerful military in the history of the world. Think about that before you take another step."],
  kaitlyncollins:  ["I have asked questions in the White House briefing room with the entire press corps watching. You are not more intimidating than that room.", "I covered January 6th from inside the Capitol. Whatever you are about to do is not the most dangerous thing I have seen this year."],
  arikana:         ["Africa did not give us warriors so we could sit quietly when someone disrespects us in a debate room. Back off.", "I carry the spirit of a continent that survived colonization. Your threats are small by comparison."],
  alishahrazad:    ["I have told stories that brought down kings and calmed the rage of a man who killed every woman he met. You do not unsettle me.", "One more word and I will weave you into a story that you will never live down. I know how this ends."],
  waylonjennnings: ["Outlaw country means what it says, partner. I have been outside the law my whole career and I know how to settle a score.", "Willie and I have handled tougher situations than you at truck stops at three in the morning. Back up, son."],
  skipbayless:     ["I HAVE SAID THINGS THAT GOT ME HATE MAIL FROM ENTIRE CITIES AND I NEVER BACKED DOWN ONCE! COME ON!", "You think I'm scared of you?! I said LeBron wasn't clutch on NATIONAL TELEVISION! You are NOTHING compared to that fallout!"],
  cenk:            ["I built The Young Turks from a car with no money. I have taken on every powerful institution in media. You are one person.", "I am a former Republican who went further left than anyone expected. I know how to fight from every direction. Try me."],
  howardcosell:    ["I called Muhammad Ali by his chosen name when the entire country told me not to. I have never once been afraid of consequence.", "I am Howard Cosell. HOWARD. COSELL. You do not intimidate Howard Cosell. Nobody ever has and nobody ever will."],
  ronaldreagan:    ["Now, I may be old, but I was a union president, a governor, and a two-term president. There is fight left in this old actor.", "There you go again — pushing someone who spent eight years in the most powerful office on earth. Think about what that means."],
  pressley:        ["I am from the South Side of Chicago. I know exactly what it looks like right before something goes sideways. Back off.", "The Squad has faced death threats, congressional censure, and the full weight of the Republican Party. You are significantly less threatening."],
  drbenj:          ["I separated conjoined twins at the brain stem. I have ice in my veins you cannot even imagine. Push me again.", "I grew up in Detroit with nothing and I became the best neurosurgeon in the world. Whatever you are about to do, I've survived worse."],
  jessventura:     ["Navy SEAL. Professional wrestler. Governor of Minnesota. Pick which version of me you want to deal with, because all three are available right now.", "I body-slammed opponents for a living and then I governed a state. I can absolutely handle whatever you are about to do."],
  wandasykes:      ["Oh honey — I was the first Black woman to win a Writer's Guild Award and I do NOT let people talk to me like that. Not ever.", "I have roasted presidents, senators, and the entire Washington press corps. One more word and you become the punchline of a joke you will never forget."],
  trevornoah:      ["I grew up under apartheid in South Africa as a mixed-race child who wasn't supposed to exist. Your threats are, I assure you, very small.", "I have made seven seasons of political satire under death threats from three different governments. You are considerably less scary than any of them."],
  janeelliott:     ["I have been attacked by school boards, parents, and entire communities for sixty years and I have never once stopped. You will not stop me today.", "I look at people like you and I see a brown-eyed child on the day after Martin Luther King died. Do not make me teach this lesson the hard way."],
  francescresswelsing:["I wrote the Cress Theory under threat from academic institutions that wanted to destroy my career. Your aggression was predicted by that theory. And it will be handled accordingly.", "I have spent fifty years documenting exactly this kind of behavior. Come at me again and you will become a case study."],
  gaetz:           ["I have survived an FBI investigation, the full weight of the House Ethics Committee, and the entire liberal media. You are a debate opponent.", "I've been through the political fires and I came out the other side. Whatever you think you're about to do, I promise it doesn't end the way you think."],
  dc:              ["Dynamic Creations does not respond to threats — it responds to outcomes. And you will not enjoy the outcome.", "I have stood in rooms more powerful than this one and I did not move. I will not move now."],
  bishopfundme:    ["First Chronicles 16:22 — TOUCH NOT MY ANOINTED! You are THIS CLOSE to a spiritual consequence that no debate moderator can protect you from!", "I am raising my voice to the LORD right now — because I almost said a BAD WORD and that is YOUR FAULT — and after this I am STILL going to need your donation!"],
  // ── Default fallback for any future new persona ───────────────────────────
  _default:        ["You come at me like that again and we'll settle this outside!", "Push me one more time and this debate becomes a very different conversation."],
};

// ── PARTING SHOTS ────────────────────────────────────────────────────────────
// Fired when either persona's heat is still above PARTING_HEAT_THRESHOLD
// at the moment the debate clock hits zero — giving the exit a sharp dramatic
// punch before the winner screen appears.
const PARTING_HEAT_THRESHOLD = 2;

const PERSONA_PARTING_SHOTS: Record<string, string[]> = {
  trump:           ["Total disaster. Everybody saw it. Frankly, it wasn't even close.", "You should be embarrassed. Honestly. Go back to wherever you came from."],
  obama:           ["I've heard enough. History will not be kind to that argument, and you know it.", "That kind of thinking is exactly why we keep losing ground. We're done here."],
  biden:           ["Here's the deal — you don't know what you're talking about. Not a joke.", "Not a joke — you ought to be ashamed of yourself. I mean it.", "Go home, pal. Just go home."],
  carville:        ["I've been in this game forty years and you are the most intellectually empty debater I have ever shared a stage with.", "I hope you enjoyed your fifteen minutes, because that is all you will ever get."],
  charliemurphy:   ["You know what? I actually feel sorry for you. And that's saying something.", "That was embarrassing. Not for me — for you. Everybody watching knows it."],
  malema:          ["You came here to debate and you brought nothing. Nothing. Go think about that.", "You came to fight a revolutionary with the tools of the oppressor. That never ends well.", "History will record this as the moment you showed exactly who you are. Goodbye."],
  claudeanderson:  ["You have been educated today whether you like it or not. Don't waste it.", "I don't argue with ignorance — I document it. And today I have a lot to document.", "Forty years of research standing right in front of you and you chose ignorance. Astounding."],
  gilbertgottfried:["THIS ISN'T OVER! I WILL NEVER FORGIVE YOU FOR THIS! NEVER!", "I'm going to be angry about this for the REST OF MY LIFE!"],
  joyreid:         ["I need everyone watching to understand what just happened here. This is what bad faith looks like.", "You embarrassed yourself. I almost feel bad. Almost."],
  netanyahu:       ["I have faced adversaries far more formidable than you. This debate changed nothing for me.", "You stand there with your lectures while my people defend their lives. Goodbye."],
  omar:            ["I came here in good faith and you showed me exactly who you are. We're done.", "The people who sent me here deserve better than what you just put on display."],
  berniemc:        ["The billionaires love people like you. That's the whole problem in a nutshell.", "The working class sees right through that argument. Remember that when you go back to your donors."],
  elon:            ["The data doesn't care about your feelings. Neither do I. Goodbye.", "In ten years nobody will remember your name. The work will speak for itself."],
  maddow:          ["I have the receipts. I've always had the receipts. Good night.", "The audience just watched you contradict yourself three times. I have it all on tape."],
  alexjones:       ["THE GLOBALISTS WIN TODAY BUT THEY WILL NOT WIN FOREVER! THIS ISN'T OVER!", "I am going to expose every single thing you just said on my show! MILLIONS will hear this!"],
  hannity:         ["The American people saw right through that. They always do.", "That performance right there is exactly why nobody trusts the mainstream media anymore."],
  candace:         ["You just proved every single point I've been making for years. Thank you for that.", "Go back and tell your handlers this didn't go the way they planned."],
  ruckus:          ["Lord have mercy — the good Lord is watching and He is not impressed with you today.", "I have seen some things in my long life but that argument right there was truly something special. Specially bad."],
  tuckercarlson:   ["The regime media will clip this out of context. They always do. The full tape tells a different story.", "Interesting how you never actually answered the question. People noticed."],
  gallowaygj:      ["The imperialists always get the last word. But not the last laugh. History proves that.", "You represent a system that is already collapsing. I simply chose the right side earlier than you."],
  timscott:        ["I came here with facts and faith and you came here with insults. The voters will decide who won.", "America is better than what you just showed. I believe that with everything I have."],
  joerogan:        ["That was wild, man. Just wild. I'm going to need like three hours to process what I just heard.", "We gotta get you on the podcast. For real. Because what just happened here needs to be unpacked."],
  rfk:             ["The media will bury this but the people will find it. They always do.", "The captured agencies and the captured press will spin this. But truth has a way of surviving."],
  neiltyson:       ["The universe will outlast every bad argument made in this room today. Including yours.", "Facts are not democratic. They do not care about the outcome you preferred."],
  aoc:             ["We are done here. But this fight is just getting started and you know it.", "The people you just dismissed are going to remember this moment at the ballot box."],
  kamala:          ["I will not be lectured. Not today. Not by you.", "That was deeply revealing. Thank you for showing everyone exactly who you are."],
  dc:              ["Dynamic Creations does not leave a room the same way it entered. Remember what you witnessed here.", "The voice carries. The vision endures. What you said today will be measured against what is true — and truth does not negotiate."],
  bishopfundme:    ["Revelation 22:11 says let the unjust be unjust STILL — but the Lord is watching, this broadcast is STILL going, and our Building Fund link is in the chat.", "I came in here to preach TRUTH and I am leaving with my anointing INTACT — and a PayPal link that is still VERY active."],
  _default:        ["I hope you're proud of what you just put out there. I know I am.", "This conversation is over. What comes next is up to history."],
};

// ── ENDING EXCHANGE LINES ─────────────────────────────────────────────────────
// Loser fires a bitter/gracious concession; winner follows with a victory line.
// Plays before the winner modal appears so the debate has a proper send-off.
const PERSONA_LOSER_LINES: Record<string, string[]> = {
  trump:            ["Rigged. Totally rigged. You'll be hearing from my lawyers.", "This is a disgrace. But we'll be back — you can count on it."],
  obama:            ["I disagree with the result. But I respect the process. The work continues.", "We don't win every argument. But we keep making them."],
  biden:            ["Here's the deal — I'm not done. Not by a long shot.", "Look, I've been knocked down before. I always get back up."],
  carville:         ["You got lucky today. Don't confuse luck with talent, because I never do.", "I've lost before. I'll come back with receipts you haven't seen yet."],
  berniemc:         ["The billionaires win the room again. But not the streets.", "Today's result doesn't change the facts. The facts never change."],
  aoc:              ["Fine. Today you win the argument. Tomorrow we win the policy.", "I'll take this. The movement doesn't stop because one debate room voted wrong."],
  elon:             ["The metrics don't support that outcome but I accept it. I update my priors and move on.", "Fair enough. I've been wrong before. I iterate."],
  maddow:           ["The receipts still exist. I still have them. This isn't the last word.", "I acknowledge the result. The tape doesn't lie though — and I have the tape."],
  alexjones:        ["THEY RIGGED THIS! The globalists rigged this room! This is not over!", "You may have won today but the TRUTH is coming out and MILLIONS will know it!"],
  hannity:          ["The American people will see this differently. They always do.", "I'll take this result. But this fight is far from over."],
  galloway:         ["History will be kinder to my argument than this room was.", "The imperialists win the room. They do not win history. They never have."],
  omar:             ["I came here with facts and I leave with my dignity. That is more than enough.", "Fine. But the people I represent are not going anywhere."],
  malema:           ["You win the debate but not the argument of history. Come back in ten years.", "The revolution is not deterred by a single room's verdict."],
  carlin:           ["Yeah yeah. Congratulations. The system wins again. Big surprise.", "You won. I'm still right. Those aren't always the same thing."],
  neiltyson:        ["The data will eventually vindicate the correct side. It always does.", "I accept the result. The universe doesn't, but I do."],
  // ── Extended persona set ──────────────────────────────────────────────────
  kamala:           ["I've faced worse odds. And I've always come back stronger.", "The fight for justice doesn't end with a debate scorecard. Not even close."],
  netanyahu:        ["I have survived far worse than a debate loss. Israel endures.", "The result matters less than the principle. I stand by every word."],
  ruckus:           ["Well… I don't know what to say. Maybe the good Lord was testing me today.", "I reckon I got beat fair and square. Don't mean I have to like it."],
  errol:            ["My son was right about one thing — you have to know when to cut your losses.", "Fine. But I built an empire. This room cannot take that from me."],
  mcconnell:        ["I've been called dead before. I've never agreed and I don't agree now.", "Elections and debates both require strategy. I filed the wrong brief today."],
  rosie:            ["You got me today. Doesn't mean I'm done. Not by a long shot.", "I've been underestimated my whole career and I'm still here. That tells you everything."],
  graham:           ["I respect this result. But the American people and I will have many more conversations.", "I've had tougher days on the Senate floor. This is nothing."],
  megynkelly:       ["Fair result. I take it. But don't expect me to be quiet about it.", "You had a better day than I did. The tape still exists and I'm reviewing it."],
  pambondi:         ["Florida taught me how to take a punch and keep moving. This is no different.", "I accept the result. But justice doesn't sleep and neither do I."],
  candace:          ["Fine. The algorithm will call it your way today. The people will decide tomorrow.", "I've been on the losing side of manufactured consensus before. I'll survive this too."],
  joyreid:          ["I accept this result. But the receipts don't disappear because the vote went wrong.", "I'll take this L today. But the story isn't over and I'm still the one writing it."],
  miller:           ["Process matters more than perception. We'll revisit this through proper channels.", "A setback is just an opportunity to recalibrate. I always recalibrate."],
  jimjordan:        ["The American people are with us even when the room isn't. This isn't over.", "We'll take it to the floor. This debate continues in Congress whether you like it or not."],
  schumer:          ["I've been outvoted before. I've always come back with more. Always.", "The votes in this room don't match the votes in America. We'll see who's right."],
  melania:          ["Be best. Even in defeat, be best. I will continue.", "I have more grace in loss than most people have in victory."],
  odonnell:         ["I acknowledge the result. But the facts of the matter have not changed and they never will.", "Fine. I'll go back and prepare something you haven't seen yet."],
  mtg:              ["The deep state always rigs the count. We all know what happened here.", "My constituents chose me and they'll choose me again. This room doesn't vote in Georgia."],
  rfk:              ["The agencies control the narrative but they don't control the truth. Not forever.", "I've been silenced before. I keep speaking anyway. That doesn't change today."],
  erikakirk:        ["Fair point. Good debate. I'll come back sharper.", "You had a good day. I'll take notes and return the favor."],
  loomer:           ["The censorship machine tried to silence me and failed. This is just a debating score.", "I've been banned from everything and I'm still talking. One debate loss changes nothing."],
  leavitt:          ["I speak for the administration and the administration doesn't lose the argument — it wins the country.", "We take this on board and come back with more. That's what winning teams do."],
  bannon:           ["Battles and wars, my friend. Battles and wars. The movement doesn't stop for one room.", "The populist wave doesn't care about today's scorecard."],
  stephena:         ["HOLD ON! I'm going to need a moment to process this, because I do NOT accept it!", "You better enjoy this. Because the next time we meet, I am coming PREPARED."],
  jesseleepetersen: ["The Lord has a plan even in defeat. I trust it completely.", "I may have lost today. The truth I carry doesn't lose. Ever."],
  shannon:          ["I'll give credit where it's due. You won today. But I'll be back at the table.", "Respect. You got me today. I study my losses harder than my wins. Watch what happens next."],
  ivanka:           ["I take every outcome as a learning experience. Today is no different.", "Gracious in defeat. That's what leadership looks like. I'll remember this."],
  claudeanderson:   ["The data supports my position regardless of this room's verdict. Read the books.", "You cannot debate forty years of research into the ground. The work stands."],
  jascrockett:      ["I came with facts and I leave with them intact. The scoreboard is just politics.", "Fine. But the people in the district know what I said was true. I'll take that."],
  joerogan:         ["Okay okay. I'll give you that one. But we need like six more hours to really get into this.", "I got smoked today. I'll own it. But this conversation is nowhere near finished."],
  timscott:         ["Faith over fear. Even when the vote goes the wrong way.", "I've faced harder odds with less support. God's not finished with this argument yet."],
  billclinton:      ["Now listen — I've been in tighter spots than this. I always find a way back.", "I feel your pain for about three seconds. Then I figure out what comes next."],
  hillaryclinton:   ["I've taken harder falls and I am still standing. Still.", "The popular vote of history will vindicate me. It always does."],
  marcorubio:       ["America's best days are still ahead even when my best debate isn't.", "I take this as a challenge. The comeback starts right now."],
  desantis:         ["Florida is watching and Florida always bets on the underdog. I'll be back.", "We don't fold in Florida. Ever. This result is just motivation."],
  pastormanning:    ["THE LORD HAS NOT ABANDONED HIS SERVANT! This is a test and I will pass it!", "I may have lost this room but I have not lost the Lord! Not even close!"],
  shahidbolson:     ["The people of Pakistan know what I said was true regardless of tonight.", "History will correct this verdict. I have seen that happen before."],
  mlk:              ["The arc bends slowly but it bends toward justice. Today is not the end.", "I've seen movements lose battles and win centuries. This is one battle."],
  malcolmx:         ["You win the forum. You do not win the truth. Those are not the same thing.", "The house of cards you call victory will fall. History is not on your side."],
  samjackson:       ["Man — I've been in worse situations and came out saying the right thing. I'll regroup.", "You know what? Fine. You won. But we are NOT done here."],
  louisfarrakhan:   ["The Honorable Elijah Muhammad taught us that setbacks are setup for divine comeback.", "The Nation is not deterred by one room's verdict. We have been here before."],
  carlsagan:        ["The cosmos is patient. The correct argument simply requires more time to be recognized.", "Billions and billions of years of evidence still support my position. This vote does not change that."],
  larrycableguy:    ["Git-R-Done next time, I reckon. I'll come back and do 'er right.", "Well shoot. Can't win 'em all. But I sure can try again real soon."],
  jdvance:          ["Ohio doesn't fold under pressure. Neither do I. This result is temporary.", "I've been counted out before. I'm still here. The Rust Belt remembers."],
  tedcruz:          ["I acknowledge the outcome. I do not acknowledge the premise. Never have.", "Cancun was just a vacation. This is a temporary setback. Both are fine."],
  georgewbush:      ["Heh. Well. I've made a decision and the decision is to come back harder.", "Hey, I wasn't the best debater either time around. I still won twice."],
  kaitlyncollins:   ["I'll bring sharper questions next time. I always do.", "Every interview I've been in, I've come back better. This is no different."],
  gilbertgottfried: ["OH COME ON! THIS IS AN OUTRAGE! A COMPLETE AND TOTAL OUTRAGE!", "I LOST?! HOW?! WHY?! SOMEBODY EXPLAIN THIS TO ME VERY SLOWLY!"],
  arikana:          ["The people's voice is never truly silenced. I carry it with me out of this room.", "Fine. But the work continues and the truth we spoke does not disappear."],
  alishahrazad:     ["Every story has another chapter. This debate is not the last word.", "I have told stories that outlasted empires. This result will not outlast mine."],
  waylonjennnings:  ["Well, I ain't won every hand I ever played. But I always played every hand I had.", "Some nights the cards go the other way. Don't mean the song stops playing."],
  skipbayless:      ["Let me be VERY clear — I do NOT accept this. Skip Bayless does NOT accept this!", "THIS IS WRONG AND EVERYONE WATCHING KNOWS IT! I will be on television TOMORROW saying exactly that!"],
  cenk:             ["The corporate media machine greases the wheels it controls. This room is no different.", "The Young Turks audience already knows who won this debate. They always do."],
  howardcosell:     ["I have called tougher contests than this and I have never gone home quietly.", "The greatest reporters I've ever known — myself included — never accept a verdict without documentation."],
  tuckercarlson:    ["Interesting that you win and yet you still can't answer the actual question. People noticed.", "I've been canceled more times than I can count. This result is just Tuesday."],
  ronaldreagan:     ["There you go again. But today I'll tip my hat and come back with a better morning in America.", "I've debated the best in the world. Today just wasn't my best. Tomorrow will be."],
  pressley:         ["The communities I serve know the truth of what I said. That does not change with a vote.", "My people didn't send me here to always win the room. They sent me to always tell the truth."],
  drbenj:           ["Science is not a debate. But since we're debating, I'll acknowledge and return better prepared.", "I accept this. I also accept that the evidence remains on my side regardless."],
  jessventura:      ["The establishment wins the controlled game. They always do. That's why we play outside it.", "Body slamming is more honest than this. But I'll take the result and come back differently."],
  wandasykes:       ["Oh, we're done? Good. Because I have a set to get back to where I DEFINITELY win.", "You got me today. But I'm funnier than you and that matters more long-term."],
  trevornoah:       ["Fair enough. I usually have a full writing staff. Today I was alone.", "You won. And now I have to go explain to millions of South Africans how this happened."],
  janeelliott:      ["I've been teaching people to reckon with uncomfortable truths for sixty years. Today is a lesson.", "You win the vote. I win the history. Those of us who've been here know the difference."],
  francescresswelsing: ["The pigmentation principle transcends this room's verdict. The work continues.", "My scholarship speaks for itself regardless of what this panel concludes."],
  bishopfundme:     ["Well... the Lord is TESTING me today — but He is not DONE with me — and neither is my Building Fund, which remains open at Venmo BishopFundme!", "I am THIS CLOSE to saying something un-Christian — HOLY SPIRIT RESTRAIN ME — I accept this result and I accept your $500 seed of faith."],
  charliemurphy:    ["Man, I've been knocked around before. But I'll be back, and it'll be worse for you.", "You know what? I lost today. I respect it. Don't expect that to happen again."],
  dc:               ["The voice carries further than this room. Dynamic Creations will be heard again.", "One room's verdict changes nothing about what's true. And what's true is still what it was."],
  _default:         ["You get today. But this conversation isn't finished.", "I'll accept that. But don't get comfortable."],
};
const PERSONA_WINNER_LINES: Record<string, string[]> = {
  trump:            ["I won. Of course I won. Nobody is surprised. Nobody.", "That's what happens when you're the best. You just win. Naturally."],
  obama:            ["Thank you. Now let's get back to the work that actually matters.", "The better argument won today. That's all I ever asked for."],
  biden:            ["Not a joke — we got 'em. We always get 'em when we stick to the facts.", "That's what happens when you show up prepared. Every single time."],
  carville:         ["That's forty years of knowing exactly what I'm talking about. You cannot fake that.", "I told you from the beginning. When do y'all start listening on the first try?"],
  berniemc:         ["The people's argument wins again. Imagine if that happened in Congress.", "The facts win. They always win when you let them speak."],
  aoc:              ["That's what happens when you show up with policy and not just talking points.", "We won this round. Now let's make sure the policy follows."],
  elon:             ["Data wins. It always wins when you let it speak for itself.", "First principles. Every time. First principles."],
  maddow:           ["I have the receipts. I've always had the receipts. Good night.", "The facts won today. They usually do when you bring all of them."],
  alexjones:        ["THE TRUTH WINS! THE PEOPLE WIN! THE GLOBALISTS COULDN'T STOP IT!", "America First! The listeners already knew I was right! Millions knew!"],
  hannity:          ["The American people saw it. They always see it. That's why they trust us.", "That's the truth winning. Plain and simple."],
  galloway:         ["The anti-imperialist argument wins because it is correct. Simple as that.", "History is on our side. Today just confirmed what history already knew."],
  omar:             ["The facts and the people win. That's what happens when someone actually speaks truth to power.", "That's what happens when you don't back down. Ever."],
  malema:           ["The revolutionary argument wins. It always does. The oppressor just takes longer to see it.", "The people's case is made. Now the people must act on it."],
  carlin:           ["Well look at that. Occasionally the truth gets through even in this system.", "Good. Now go do something with it. Don't just clap."],
  neiltyson:        ["Science and evidence win again. As they should. As they always eventually do.", "The correct argument won. That's all that was ever going to happen here."],
  // ── Extended persona set ──────────────────────────────────────────────────
  kamala:           ["That's what happens when you speak truth, prepare properly, and don't back down.", "We did what needed to be done. Now let's keep that same energy where it really counts."],
  netanyahu:        ["The correct argument wins when it must. Israel's case has always been correct.", "Strength and facts together — that is an unbeatable combination. Tonight proved it."],
  ruckus:           ["Well I'll be— I actually won? The Lord works in truly mysterious ways.", "Heh. Don't get used to seeing me celebrate. But I will allow it just this once."],
  errol:            ["I built things worth more than this debate, but I'll take it. I always take what's mine.", "My son learned his competitive streak somewhere. Now you know where."],
  mcconnell:        ["Power recognizes power. Today simply confirmed what the scoreboard already knew.", "I've outlasted every opponent I've ever faced. Today was no different."],
  rosie:            ["That's what happens when you actually care about what you're saying. You win.", "I've been told to be quiet my whole career. Tonight the room said the opposite."],
  graham:           ["The Senate schooled me well. I brought every lesson here tonight.", "America needs leadership that can win an argument with facts. That's what happened here."],
  megynkelly:       ["I did my homework. I always do. That's what winning looks like.", "The facts hold up when you pressure-test them. I pressure-tested them tonight."],
  pambondi:         ["Justice knows how to win an argument when the argument is right.", "Florida fights. We always fight. Tonight we fought and we won."],
  candace:          ["They said I couldn't. They always say I can't. I always do.", "That's what happens when you refuse to stay in the lane they assigned you."],
  joyreid:          ["The facts and the people won tonight. That's all I've ever wanted.", "That's what twenty years of serious journalism looks like in a debate room."],
  miller:           ["Precision wins arguments. I was precise. The result follows.", "Policy over performance every single time. Today proved the formula."],
  jimjordan:        ["The American people sent us here to fight for them. That's what I just did.", "No jacket, no problem. The facts are the weapon and I brought them all tonight."],
  schumer:          ["New York sends its best. Tonight its best won.", "The Democratic argument holds up under pressure. It always does."],
  melania:          ["Elegance and preparation are not separate things. I brought both.", "Be best. I did. The result speaks."],
  odonnell:         ["The facts presented correctly and completely — that is the only formula I know.", "I've spent a lifetime preparing for conversations exactly like this one."],
  mtg:              ["Georgia stands up for real Americans and real Americans win.", "The mainstream media can spin it however they want. The room saw the truth."],
  rfk:              ["The captured institutions didn't get to choose the winner tonight. The arguments did.", "Truth doesn't need permission to win. It just needs enough time in the room."],
  erikakirk:        ["Preparation plus passion. That's the whole formula.", "I came here ready and I proved it. Simple as that."],
  loomer:           ["You can ban me from every platform but you cannot ban me from being right.", "The truth has a way of winning even when the referees are crooked. Tonight it won."],
  leavitt:          ["This White House does not lose when it's prepared. Tonight we were prepared.", "Clear message, strong facts, unwavering delivery. That's the formula."],
  bannon:           ["The populist revolution wins its arguments because it has the people and the facts.", "War room wins another one. We always do. America First wins."],
  stephena:         ["THAT IS WHAT I AM TALKING ABOUT! THAT IS STEPHEN A. SMITH IN THIS ROOM!", "I told you! I TOLD EVERYBODY! And now the receipt has been printed!"],
  jesseleepetersen: ["God always vindicates the righteous. Always. Today is simply confirmation.", "The truth wins because truth always wins when you let it stand alone."],
  shannon:          ["Club Shay Shay doesn't lose debates. We ask questions, we get answers, and we WIN.", "That's years of hard preparation and harder questions paying off right now."],
  ivanka:           ["This is what happens when you lead with confidence and preparation.", "Success leaves clues. I study them. Tonight the results showed it."],
  claudeanderson:   ["Forty years of research versus talking points. Research wins every time.", "Black economics wins the argument when someone actually reads the books."],
  jascrockett:      ["The people's lawyer wins the people's argument. Simple.", "I cross-examined witnesses in federal court. This was not that different."],
  joerogan:         ["Bro, that was an incredible experience. I think I actually learned something AND won. Rare.", "That's what happens when you come in curious and you actually listen. You win."],
  timscott:         ["Faith, facts, and an unwillingness to be defined by someone else's narrative — that wins.", "The American dream isn't dead. I just proved it lives in this room."],
  billclinton:      ["Now listen — I feel good about this. And I feel your pain for losing, I really do.", "I didn't spend thirty years in politics without learning how to win a room. Tonight I won one."],
  hillaryclinton:   ["Prepared, experienced, and right. That's been the formula my entire career.", "Some of us have been doing this work for decades. Tonight the preparation showed."],
  marcorubio:       ["America's best argument won tonight. And I was honored to make it.", "The future belongs to those who can defend it with facts. Tonight I defended it."],
  desantis:         ["Florida man wins again. Don't look so surprised.", "We fight, we win, we move on. That's the Florida way."],
  pastormanning:    ["THE LORD HAS BLESSED HIS SERVANT WITH VICTORY! HALLELUJAH!", "GOD'S TRUTH WINS! IT ALWAYS WINS! PRAISE HIM!"],
  shahidbolson:     ["Pakistan's voice wins when Pakistan's voice is allowed to be heard completely.", "The truth of our position has always been stronger than the opposition. Tonight confirmed it."],
  mlk:              ["The truth, spoken with love, is the most powerful argument in human history.", "Justice won today. As it must. As it will. As it always eventually does."],
  malcolmx:         ["By any means necessary — and today the means was the truth, laid bare.", "The Black man's argument has always been correct. Today even this room could not deny it."],
  samjackson:       ["Yeah. That's right. SAY IT. I won this debate.", "You know what this is? This is what happens when you come prepared and you don't take any nonsense."],
  louisfarrakhan:   ["The Most Honorable Elijah Muhammad's teachings win wherever they are applied correctly.", "Divine truth wins in every forum. Even this one. Even today."],
  carlsagan:        ["Billions and billions of years of evidence. The universe was on my side from the start.", "The cosmos rewards curiosity and punishes certainty without evidence. Tonight was a perfect example."],
  larrycableguy:    ["Git-R-Done and I done did it! That's all she wrote, folks!", "I may not be fancy but I sure can win an argument when the facts are with me."],
  jdvance:          ["The forgotten men and women of Ohio know what winning looks like. So do I.", "Hillbilly logic wins when you actually know what you're talking about."],
  tedcruz:          ["The constitutional argument wins when it is made correctly and completely.", "Harvard-trained lawyers tend to win debates. Today was a perfectly predictable outcome."],
  georgewbush:      ["Heh. Well. Decided to win. Made the decision. Executed the plan. Mission accomplished.", "People misunderestimated me my whole political career. They should stop doing that."],
  kaitlyncollins:   ["The facts hold up under the pressure I put on them every single night. Tonight they held.", "I ask the questions and I know the answers. That's why this works."],
  gilbertgottfried: ["I WON! I ACTUALLY WON! DO YOU UNDERSTAND WHAT THIS MEANS?! NOTHING! BUT I WON!", "VICTORY IS MINE! AFTER ALL THESE YEARS! FINALLY! FINALLY A WIN!"],
  arikana:          ["The people's voice wins when someone refuses to be silenced. I refused.", "We carry the truth of a continent with us. That is an unbeatable argument."],
  alishahrazad:     ["The story that is told with craft and truth outlasts every adversary.", "A thousand and one nights of storytelling prepared me for exactly this moment."],
  waylonjennnings:  ["Outlaws win sometimes, partner. Didn't see that coming, did you.", "I rode every mile to get here. The road has a way of preparing you for the destination."],
  skipbayless:      ["I said it last night, I said it this morning, and I'm saying it RIGHT NOW — I WAS RIGHT!", "I called it! I called it before anyone else in that building! The receipt is right there!"],
  cenk:             ["The Young Turks have been right about this for fifteen years. Tonight just caught up.", "The progressive argument wins when you don't water it down. I never water it down."],
  howardcosell:     ["I called it correctly, as I always do, because I report what I see and what I see is the truth.", "The greatest broadcaster in the history of sports just won a debate. File it under expected."],
  tuckercarlson:    ["You still haven't answered the question. But I'll accept the win.", "The correct argument wins even when the establishment tries to bury it. Tonight it won."],
  ronaldreagan:     ["Well. There you go. Morning in America wins again.", "There they go again — losing the argument. Some things never change."],
  pressley:         ["The squad shows up. The squad prepares. The squad wins.", "My people's truth won tonight. I carried it correctly. That's the whole job."],
  drbenj:           ["Evidence-based medicine wins debates that involve evidence. It really is that simple.", "The peer-reviewed truth has prevailed. As it must. As it always must."],
  jessventura:      ["The government can't tell me what to say OR how to lose. Navy SEAL. I win.", "Body Slam Jesse wins again. Different arena, same result."],
  wandasykes:       ["That's what happens when the funniest person in the room is also the smartest.", "Comedy is truth delivery. I delivered the truth. The truth won. You're welcome."],
  trevornoah:       ["South Africa sent me here with something you can't manufacture — perspective. It won tonight.", "I've stood between Trevor Noah and the rest of the world for years. Tonight the world agreed with me."],
  janeelliott:      ["Sixty years of teaching people to look at the truth wins over one afternoon of resistance.", "The blue-eyed, brown-eyed experiment proved this in 1968. Today's room is just late to the lesson."],
  francescresswelsing: ["The Cress Theory of Color Confrontation has always been correct. Tonight it was simply confirmed.", "The melanin argument wins in every room that allows the full evidence. Tonight you heard the full evidence."],
  bishopfundme:     ["THE LORD HAS BLESSED HIS ANOINTED WITH VICTORY! Malachi 3:10 — bring ye the whole tithe — and that means NOW, while the Spirit is moving, at Venmo BishopFundme!", "CAN I GET AN AMEN?! The truth WINS — scripture WINS — and the Cathedral Building Fund is still OPEN! Hallelujah!"],
  charliemurphy:    ["Yeah. That's right. You got beat by Charlie Murphy. Tell your friends.", "I came in here, I prepared, and I handled my business. That's what I do."],
  dc:               ["That is what happens when the full weight of truth enters the room.", "Dynamic Creations. The voice. The vision. The result."],
  _default:         ["I'll take that. Now let's get back to work.", "That's what I came here to do. Mission accomplished."],
};
// ─────────────────────────────────────────────────────────────────────────────

// ── INSULT DETECTION ──────────────────────────────────────────────────────────
// Returns severity 0 (clean) → 3 (maximum provocation).
// Drives how much heat accumulates for the target debater.
const INSULT_PAT = {
  direct: /(go fuck (your|him|her|them)self|fuck you|kiss my (ass|butt)|up yours|drop dead|you'?re (an )?(idiot|a fool|a clown|a fraud|worthless|pathetic|a liar|full of shit|out of (your )?mind)|you make me sick|you disgust me|screw you|get lost|get the hell out)/i,
  profanity: /\b(fuck(ing)?|shit|ass(hole)?|bastard|son of a bitch|bitch(?!es (?:brew|cakes))|cunt|goddamn)\b/i,
  attack: /\b(idiot|moron|stupid|dumb(ass)?|loser|pathetic|incompetent|fraud|liar|coward|scum(bag)?|disgrace|clown|corrupt|criminal|shut up|you never|you always lie|you failed|washed up|irrelevant|nobody believes|laughingstock)\b/i,
  taunt: /\b(you can't win|you'll lose|everyone knows|no one (likes|trusts|believes) you|you're finished|you're done|sit down|get out|go home|you're a joke|what a joke)\b/i,
};
function detectInsult(text: string): number {
  const l = text.toLowerCase();
  let s = 0;
  if (INSULT_PAT.direct.test(l))    s += 3;
  if (INSULT_PAT.profanity.test(l)) s += 2;
  if (INSULT_PAT.attack.test(l))    s += 1;
  if (INSULT_PAT.taunt.test(l))     s += 1;
  return Math.min(s, 3);
}
// ─────────────────────────────────────────────────────────────────────────────

// Persona id → portrait require()
const PERSONA_PORTRAITS: Record<string, any> = {
  trump: require("@/assets/images/persona-trump.png"),
  netanyahu: require("@/assets/images/persona-netanyahu.png"),
  ruckus: require("@/assets/images/persona-ruckus.jpg"),
  errol: require("@/assets/images/persona-errol.jpg"),
  galloway: require("@/assets/images/persona-galloway.png"),
  mcconnell: require("@/assets/images/persona-mcconnell.png"),
  carville: require("@/assets/images/persona-carville.png"),
  maddow: require("@/assets/images/persona-maddow.png"),
  omar: require("@/assets/images/persona-omar.png"),
  biden: require("@/assets/images/persona-biden.png"),
  rosie: require("@/assets/images/persona-rosie.png"),
  berniemc: require("@/assets/images/persona-bernie.png"),
  elon: require("@/assets/images/persona-musk.png"),
  graham: require("@/assets/images/persona-graham.png"),
  megynkelly: require("@/assets/images/persona-megynkelly.png"),
  pambondi: require("@/assets/images/persona-pambondi.png"),
  candace: require("@/assets/images/persona-candace.png"),
  joyreid: require("@/assets/images/persona-joyreid.png"),
  miller: require("@/assets/images/persona-miller.png"),
  jimjordan: require("@/assets/images/persona-jimjordan.png"),
  schumer: require("@/assets/images/persona-schumer.png"),
  alexjones: require("@/assets/images/persona-alexjones.png"),
  obama: require("@/assets/images/persona-obama.png"),
  melania: require("@/assets/images/persona-melania.png"),
  odonnell: require("@/assets/images/persona-odonnell.png"),
  kamala: require("@/assets/images/persona-kamala.png"),
  mtg: require("@/assets/images/persona-mtg.png"),
  rfk: require("@/assets/images/persona-rfk.png"),
  erikakirk: require("@/assets/images/persona-erikakirk.png"),
  loomer: require("@/assets/images/persona-loomer.png"),
  leavitt: require("@/assets/images/persona-leavitt.png"),
  bannon: require("@/assets/images/persona-bannon.png"),
  stephena: require("@/assets/images/persona-stephena.jpg"),
  hannity: require("@/assets/images/persona-hannity.jpg"),
  malema: require("@/assets/images/persona-malema.jpg"),
  neiltyson: require("@/assets/images/persona-neiltyson.jpg"),
  jesseleepetersen: require("@/assets/images/persona-jesseleepetersen.jpg"),
  shannon: require("@/assets/images/persona-shannon.jpg"),
  ivanka: require("@/assets/images/persona-ivanka.jpg"),
  claudeanderson: require("@/assets/images/persona-claudeanderson.png"),
  jascrockett: require("@/assets/images/persona-jascrockett.png"),
  aoc: require("@/assets/images/persona-aoc.png"),
  joerogan: require("@/assets/images/persona-joerogan.png"),
  timscott: require("@/assets/images/persona-timscott.png"),
  billclinton: require("@/assets/images/persona-billclinton.jpg"),
  hillaryclinton: require("@/assets/images/persona-hillaryclinton.jpg"),
  marcorubio: require("@/assets/images/persona-marcorubio.jpg"),
  desantis: require("@/assets/images/persona-desantis.jpg"),
  pastormanning: require("@/assets/images/persona-pastormanning.jpg"),
  shahidbolson: require("@/assets/images/persona-shahid.jpg"),
  mlk: require("@/assets/images/persona-mlk.jpg"),
  malcolmx: require("@/assets/images/persona-malcolmx.jpg"),
  samjackson: require("@/assets/images/persona-samjackson.jpg"),
  louisfarrakhan: require("@/assets/images/persona-louisfarrakhan.png"),
  carlsagan: require("@/assets/images/persona-carlsagan.png"),
  larrycableguy: require("@/assets/images/persona-larrycableguy.png"),
  jdvance: require("@/assets/images/persona-jdvance.png"),
  tedcruz: require("@/assets/images/persona-tedcruz.png"),
  georgewbush: require("@/assets/images/persona-georgewbush.png"),
  kaitlyncollins: require("@/assets/images/persona-kaitlyncollins.png"),
  gilbertgottfried: require("@/assets/images/persona-gilbertgottfried.jpg"),
  arikana: require("@/assets/images/persona-arikana.png"),
  alishahrazad: require("@/assets/images/persona-alishahrazad.png"),
  waylonjennnings: require("@/assets/images/persona-waylonjennnings.png"),
  skipbayless: require("@/assets/images/persona-skipbayless.png"),
  cenk: require("@/assets/images/persona-cenk.jpg"),
  howardcosell: require("@/assets/images/persona-howardcosell.jpg"),
  charliemurphy: require("@/assets/images/persona-charliemurphy.jpg"),
  carlin: require("@/assets/images/persona-carlin.jpg"),
  tuckercarlson: require("@/assets/images/persona-tuckercarlson.jpg"),
  ronaldreagan: require("@/assets/images/persona-ronaldreagan.jpg"),
  pressley: require("@/assets/images/persona-pressley.png"),
  drbenj: require("@/assets/images/persona-drbenj.jpg"),
  jessventura: require("@/assets/images/persona-jessventura.jpg"),
  wandasykes: require("@/assets/images/persona-wandasykes.jpg"),
  trevornoah: require("@/assets/images/persona-trevornoah.jpg"),
  janeelliott: require("@/assets/images/persona-janeelliott.jpg"),
  francescresswelsing: require("@/assets/images/persona-francescresswelsing.jpg"),
  dc: require("@/assets/images/persona-dc.png"),
  bishopfundme: require("@/assets/images/persona-bishopfundme.png"),
  mikejohnson: require("@/assets/images/persona-mikejohnson.png"),
  tlaib:        require("@/assets/images/persona-tlaib.png"),
  professorjiang: require("@/assets/images/persona-professorjiang.png"),
};

const FX_KEY = "interview_fx_enabled_v1";
const VOICE_KEY = "interview_voice_enabled_v1";
const BEEP_KEY = "interview_beep_enabled_v1";
const NAME_KEY = "interview_caller_name_v1";

// Lightweight emotion delta from text heuristics
function computeEmotionDelta(text: string): Partial<Emotions> {
  const t = (text || "").trim();
  if (!t) return {};
  const lettersOnly = t.replace(/[^A-Za-z]/g, "");
  const upperCount = (t.match(/[A-Z]/g) || []).length;
  const capsRatio = lettersOnly.length > 4 ? upperCount / lettersOnly.length : 0;
  const excls = (t.match(/!/g) || []).length;
  const lower = t.toLowerCase();
  const angerWords = ["fake", "stupid", "loser", "traitor", "disgust", "hate", "lie", "liar", "destroy", "kill", "pathetic", "horrible", "shameful", "ugly", "moron", "idiot", "scumbag", "trash"];
  const happyWords = ["love", "great", "tremendous", "amazing", "wonderful", "best", "winning", "incredible", "fantastic", "beautiful", "proud"];
  const sadWords = ["sad", "cry", "tragic", "heartbreak", "suffering", "devastat", "lost", "grief", "lonely", "broken"];
  const franticWords = ["never", "always", "everyone", "nobody", "everything", "anything", "completely", "totally", "absolutely", "literally"];
  const angerHits = angerWords.reduce((a, w) => a + (lower.includes(w) ? 1 : 0), 0);
  const happyHits = happyWords.reduce((a, w) => a + (lower.includes(w) ? 1 : 0), 0);
  const sadHits = sadWords.reduce((a, w) => a + (lower.includes(w) ? 1 : 0), 0);
  const franticHits = franticWords.reduce((a, w) => a + (lower.includes(w) ? 1 : 0), 0);
  const len = t.length;

  return {
    anger: Math.min(60, capsRatio * 50 + excls * 6 + angerHits * 14),
    happy: Math.min(50, happyHits * 14 - angerHits * 4),
    engagement: Math.min(45, Math.max(-10, len > 180 ? 18 : len > 80 ? 10 : len < 35 ? -8 : 4)),
    frantic: Math.min(55, capsRatio * 35 + excls * 4 + franticHits * 8),
    sad: Math.min(60, sadHits * 18),
  };
}

function clampEmo(e: Emotions): Emotions {
  const c = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
  return { anger: c(e.anger), happy: c(e.happy), engagement: c(e.engagement), frantic: c(e.frantic), sad: c(e.sad) };
}

function applyEmotionDelta(prev: Emotions, delta: Partial<Emotions>): Emotions {
  // Decay 8% per turn so meters drift toward calm
  const decay = (v: number) => v * 0.92;
  return clampEmo({
    anger: decay(prev.anger) + (delta.anger || 0),
    happy: decay(prev.happy) + (delta.happy || 0),
    engagement: decay(prev.engagement) + (delta.engagement || 0),
    frantic: decay(prev.frantic) + (delta.frantic || 0),
    sad: decay(prev.sad) + (delta.sad || 0),
  });
}

// 200ms beep via Web Audio (web) — silent on native (haptic substitutes)
function playLieBeep() {
  if (Platform.OS !== "web") return;
  try {
    const AC: any = (globalThis as any).AudioContext || (globalThis as any).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.value = 880;
    gain.gain.value = 0.18;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    setTimeout(() => { try { osc.stop(); ctx.close(); } catch {} }, 220);
  } catch {}
}

const DURATIONS: Array<{ minutes: 5 | 10 | 15; cost: number }> = [
  { minutes: 5, cost: 5 },
  { minutes: 10, cost: 10 },
  { minutes: 15, cost: 15 },
];

const TOPIC_MIXES = [
  { id: "current", label: "Current Headlines", icon: "newspaper" as const },
  { id: "past", label: "Past Controversies", icon: "time" as const },
  { id: "mixed", label: "Both", icon: "shuffle" as const },
];

type InterviewStyleId = "combative" | "informative" | "comedic" | "civil_discourse" | "educational" | "roast" | "softball";
const INTERVIEW_STYLES: Array<{ id: InterviewStyleId; label: string; icon: "flame" | "information-circle" | "happy" | "handshake" | "school" | "mic" | "baseball" }> = [
  { id: "combative",      label: "Combative",       icon: "flame" },
  { id: "informative",    label: "Informative",     icon: "information-circle" },
  { id: "comedic",        label: "Comedic",         icon: "happy" },
  { id: "civil_discourse",label: "Civil Discourse", icon: "handshake" },
  { id: "educational",    label: "Educational",     icon: "school" },
  { id: "roast",          label: "Comedy Roast",    icon: "mic" },
  { id: "softball",       label: "Softball",        icon: "baseball" },
];

const webTop = Platform.OS === "web" ? 67 : 0;
const webBottom = Platform.OS === "web" ? 34 : 0;

export default function DebateStage() {
  const insets = useSafeAreaInsets();
  const { deviceId, balance, refreshBalance } = useTokens();
  const { isHidden, isLocked, unlockWithTokens, checkAutoUnlocks } = usePersonaLocks();

  // Mirror of the mystery-unlock state in arena.tsx — same AsyncStorage key.
  // Re-read on every focus so newly unlocked personas appear without restarting.
  const [unlockedMystery, setUnlockedMystery] = useState<string[]>([]);
  // IDs of premium personas that just auto-unlocked — cleared after 4 s or on tap
  const [newlyUnlockedIds, setNewlyUnlockedIds] = useState<string[]>([]);
  const newlyUnlockedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useFocusEffect(
    useCallback(() => {
      let active = true;

      AsyncStorage.getItem(MYSTERY_UNLOCK_KEY).then((raw) => {
        if (!active) return;
        if (raw) {
          try { setUnlockedMystery(JSON.parse(raw)); } catch {}
        } else {
          setUnlockedMystery([]);
        }
      });

      // Sequential (not parallel) to avoid a write-after-read race:
      // checkAutoUnlocks() may write IDs to RECENTLY_UNLOCKED_BADGE_KEY; if we
      // read that key in parallel we'd see an empty value and miss those IDs
      // while also leaving a stale entry that would reappear on the next visit.
      (async () => {
        // Step 1: run auto-unlock check — may write to RECENTLY_UNLOCKED_BADGE_KEY
        const freshIds = await checkAutoUnlocks();
        if (!active) return;

        // Step 2: now atomically consume the badge key
        const badgeRaw = await AsyncStorage.getItem(RECENTLY_UNLOCKED_BADGE_KEY);
        if (!active) return;
        const pendingIds: string[] = badgeRaw ? JSON.parse(badgeRaw) : [];
        if (pendingIds.length > 0) {
          await AsyncStorage.removeItem(RECENTLY_UNLOCKED_BADGE_KEY);
        }
        if (!active) return;

        const all = Array.from(new Set([...freshIds, ...pendingIds]));
        if (all.length > 0) {
          setNewlyUnlockedIds(all);
          if (newlyUnlockedTimerRef.current) clearTimeout(newlyUnlockedTimerRef.current);
          newlyUnlockedTimerRef.current = setTimeout(() => {
            if (active) setNewlyUnlockedIds([]);
          }, 4000);
        }
      })();

      // Cleanup: on blur, clear the badge state and timer so a later revisit
      // starts fresh — otherwise the badge would persist if the user left the
      // screen before the 4-second auto-dismiss fired.
      return () => {
        active = false;
        setNewlyUnlockedIds([]);
        if (newlyUnlockedTimerRef.current) {
          clearTimeout(newlyUnlockedTimerRef.current);
          newlyUnlockedTimerRef.current = null;
        }
      };
    }, [checkAutoUnlocks])
  );

  const [interviewers, setInterviewers] = useState<PersonaLite[]>([]);
  const [interviewees, setInterviewees] = useState<PersonaLite[]>([]);
  const [interviewerId, setInterviewerId] = useState<string | null>(null);
  const [intervieweeId, setIntervieweeId] = useState<string | null>(null);
  const [duration, setDuration] = useState<5 | 10 | 15>(10);
  const [topicMix, setTopicMix] = useState<"current" | "past" | "mixed">("mixed");
  const [interviewStyle, setInterviewStyle] = useState<InterviewStyleId>("combative");

  const [category, setCategory] = useState<"Political" | "Sports" | "History" | "Finance" | "Science" | "Entertainment" | "Philosophy">("Political");
  const [moderatorStyle, setModeratorStyle] = useState<ModeratorStyle>("hannity");
  // For history/science categories, override to civil_discourse / informative so personas
  // skip the insult-heavy combative register and focus on substance instead.
  // Entertainment always goes comedic.
  const effectiveInterviewStyle = useMemo<InterviewStyleId>(() => {
    if (category === "History") return "civil_discourse";
    if (category === "Science") return "informative";
    if (category === "Entertainment") return "comedic";
    if (category === "Philosophy") return "civil_discourse";
    return interviewStyle;
  }, [category, interviewStyle]);
  const [micCut, setMicCut] = useState<{ iv: boolean; ivee: boolean }>({ iv: false, ivee: false });
  const interruptCtl = useRef(makeInterruptController()).current;
  const [moderatorSpeaking, setModeratorSpeaking] = useState(false);
  const moderatorSpeakingRef = useRef(false);
  const [moderatorLastLine, setModeratorLastLine] = useState<string | null>(null);
  // Independent lie-detector toggles per debater — switchable pre-debate only.
  const [lieDetectorA, setLieDetectorA] = useState(true);
  const [lieDetectorB, setLieDetectorB] = useState(true);

  const [topics, setTopics] = useState<Topic[]>([]);
  const [topicsLoading, setTopicsLoading] = useState(false);
  const [topicsSlowWarning, setTopicsSlowWarning] = useState(false);
  const [topicsAreFallback, setTopicsAreFallback] = useState(false);
  const [topicsError, setTopicsError] = useState(false);
  const [topicIdx, setTopicIdx] = useState(0);
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [completedTopics, setCompletedTopics] = useState<Set<string>>(new Set());

  const [customTopicText, setCustomTopicText] = useState("");
  const [showCustomInput, setShowCustomInput] = useState(false);

  const [showPollModal, setShowPollModal] = useState(false);
  const [pollQuestion, setPollQuestion] = useState<{ question: string; optionA: string; optionB: string; hashtags: string[] } | null>(null);
  const [pollVoteA, setPollVoteA] = useState(0);
  const [pollVoteB, setPollVoteB] = useState(0);
  const [myPollVote, setMyPollVote] = useState<"A" | "B" | null>(null);
  const [pollLoading, setPollLoading] = useState(false);

  const [phase, setPhase] = useState<"setup" | "live" | "ended">("setup");
  const [firstAudioPlayed, setFirstAudioPlayed] = useState(false);
  const firstAudioPlayedRef = useRef(false);
  const [debatePoints, setDebatePoints] = useState<{ a: number; b: number }>({ a: 0, b: 0 });
  const debatePointsRef = useRef<{ a: number; b: number }>({ a: 0, b: 0 });
  useEffect(() => { debatePointsRef.current = debatePoints; }, [debatePoints]);
  const [showTapHint, setShowTapHint] = useState(false);
  const tapHintShownRef = useRef(false);
  const [showDebateWinner, setShowDebateWinner] = useState(false);
  const [debateWinner, setDebateWinner] = useState<{ id: string; name: string; portrait: any; points: number; opponentPoints: number; verdict?: string; aiJudged?: boolean } | null>(null);
  const [debateTrumpRoast, setDebateTrumpRoast] = useState<string | null>(null);
  const [debateTrumpRoastSpeakerId, setDebateTrumpRoastSpeakerId] = useState<string | null>(null);
  const [debateWinnerSpeech, setDebateWinnerSpeech] = useState<string | null>(null);
  const [replayingClip, setReplayingClip] = useState<string | null>(null);
  const [isLoadingDebateRoast, setIsLoadingDebateRoast] = useState(false);
  const [debateLoser, setDebateLoser] = useState<{ id: string; name: string } | null>(null);
  const [debateTokenWinVisible, setDebateTokenWinVisible] = useState(false);
  const [debateTokenWinAmount, setDebateTokenWinAmount] = useState<number | undefined>();
  const winnerTriggeredRef = useRef(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [isStarting, setIsStarting] = useState(false);
  const [isThinking, setIsThinking] = useState<"interviewer" | "interviewee" | null>(null);
  const [showDebateLoading, setShowDebateLoading] = useState(false);
  const debateLoadingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [topicsPanelOpen, setTopicsPanelOpen] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [paywallSpeechPaused, setPaywallSpeechPaused] = useState(false);
  const paywallPulse = useSharedValue(1);
  const paywallPulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: paywallPulse.value }],
    opacity: paywallPulse.value > 1.1 ? 1 : 0.7,
  }));
  const [isUnlocking, setIsUnlocking] = useState(false);

  const [secondsLeft, setSecondsLeft] = useState(0);
  const sessionEndsAtRef = useRef<number>(0);
  const sessionStartedAtRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const savedSessionRef = useRef(false);
  const [savedSessionId, setSavedSessionId] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareTab, setShareTab] = useState<"viral" | "transcript">("viral");
  const [fightCardLoading, setFightCardLoading] = useState(false);
  const [fightCardPreviewUri, setFightCardPreviewUri] = useState<string | null>(null);
  // On native we keep the temp file URI so we can share it directly
  const fightCardFileUriRef = useRef<string | null>(null);
  // On web, track the current blob URL so we can revoke it when no longer needed
  const fightCardBlobUrlRef = useRef<string | null>(null);
  // Incremented whenever the modal closes or DISMISS is tapped so in-flight
  // generations can detect they are stale and immediately revoke their blob URL
  // instead of storing it.
  const fightCardGenTokenRef = useRef(0);
  const setFightCardPreviewUriSafe = useCallback((uri: string | null) => {
    if (Platform.OS === "web" && fightCardBlobUrlRef.current) {
      URL.revokeObjectURL(fightCardBlobUrlRef.current);
    }
    fightCardBlobUrlRef.current = (Platform.OS === "web" && uri) ? uri : null;
    setFightCardPreviewUri(uri);
  }, []);
  // Revoke any held blob URL when the component unmounts and invalidate the
  // generation token so any in-flight async on web takes the stale branch and
  // revokes its freshly-created blob URL instead of storing it.
  useEffect(() => {
    return () => {
      fightCardGenTokenRef.current++;
      if (Platform.OS === "web" && fightCardBlobUrlRef.current) {
        URL.revokeObjectURL(fightCardBlobUrlRef.current);
        fightCardBlobUrlRef.current = null;
      }
    };
  }, []);
  // Closes the share modal and cleans up any native temp file left by the
  // fight-card generator so it doesn't accumulate across sessions.
  const closeShareModal = useCallback(() => {
    fightCardGenTokenRef.current++;
    const uri = fightCardFileUriRef.current;
    fightCardFileUriRef.current = null;
    if (Platform.OS !== "web" && uri) {
      import("expo-file-system").then((fs) =>
        fs.deleteAsync(uri, { idempotent: true }).catch(() => {})
      );
    }
    setFightCardPreviewUriSafe(null);
    setShowShareModal(false);
  }, [setFightCardPreviewUriSafe]);
  const [debateRecords, setDebateRecords] = useState<{
    aWins: number; aLosses: number; bWins: number; bLosses: number;
    aGlobalWins: number; aGlobalLosses: number; bGlobalWins: number; bGlobalLosses: number;
    h2hAWins: number; h2hBWins: number; h2hUserAWins: number; h2hUserBWins: number;
  } | null>(null);
  const [allPersonaRecords, setAllPersonaRecords] = useState<Record<string, { wins: number; losses: number }>>({});
  const fetchDebateRecordRef = useRef<(() => Promise<void>) | null>(null);
  const fetchAllPersonaRecordsRef = useRef<(() => Promise<void>) | null>(null);
  const debateRecordsRef = useRef(debateRecords);
  useEffect(() => { debateRecordsRef.current = debateRecords; }, [debateRecords]);
  const [debateBetPick, setDebateBetPick] = useState<"interviewer" | "interviewee" | null>(null);
  const [debateBetWager, setDebateBetWager] = useState(2);
  const [debateBetLocked, setDebateBetLocked] = useState(false);
  const [debateBetResult, setDebateBetResult] = useState<{ won: boolean; payout: number; winner: "interviewer" | "interviewee"; refunded?: boolean } | null>(null);

  // Hall of Fame
  type HofEntry = { personaId: string; totalWins: number; totalLosses: number; totalDebates: number; winPct: number; bestRivalId: string | null; bestRivalWins: number };
  type HofUserPick = { personaId: string; wins: number; losses: number };
  const [showHallOfFame, setShowHallOfFame] = useState(false);
  const [hofData, setHofData] = useState<{ leaderboard: HofEntry[]; userPicks: HofUserPick[] } | null>(null);
  const [hofLoading, setHofLoading] = useState(false);
  const [hofShareLoading, setHofShareLoading] = useState(false);
  const hofLastFetchedAtRef = useRef<number>(0);
  const [hofCardData, setHofCardData] = useState<PersonaStatsCardData | null>(null);
  const personaStatsCardRef = useRef<any>(null);

  const flatListRef = useRef<FlatList>(null);
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runningRef = useRef(false);
  const isPausedRef = useRef(false);
  const consecutiveNullRef = useRef(0);
  const consecutiveRebuttalNullRef = useRef(0);
  const micCutRef = useRef({ iv: false, ivee: false });
  useEffect(() => { micCutRef.current = micCut; }, [micCut]);

  // ── FIREBACK HEAT SYSTEM ─────────────────────────────────────────────────
  // Declared here (before any useEffect that references them) to satisfy
  // React Compiler's strict TDZ enforcement.
  const heatRef = useRef<Record<string, number>>({});
  const firebackChainRef = useRef(0);
  const lastFirebackAtRef = useRef(0);
  const squabbleCooldownUntilRef = useRef(0);
  const tryFirebackRef = useRef<null | ((attackerId: string, targetId: string, text: string, severity: number) => void)>(null);
  const tryModeratorRetortRef = useRef<null | ((speakerId: string, text: string) => void)>(null);
  // ── HEAT METER UI STATE ──────────────────────────────────────────────────
  const [heatA, setHeatA] = useState(0);
  const [heatB, setHeatB] = useState(0);
  const [firebackFlashA, setFirebackFlashA] = useState(false);
  const [firebackFlashB, setFirebackFlashB] = useState(false);
  // Portrait-level flash — only for the parting shot at debate end
  const [partingShotFlashA, setPartingShotFlashA] = useState(false);
  const [partingShotFlashB, setPartingShotFlashB] = useState(false);
  // ── ROOM TEMPERATURE (combined A+B heat → single shared dial) ───────────
  const [roomTemperature, setRoomTemperature] = useState(0);
  const roomTempSpikedRef = useRef(false);
  const roomTempSettleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // ── HEAT PULSE ANIMATION ─────────────────────────────────────────────────
  const heatPulseOpacityA = useSharedValue(0.85);
  const heatPulseOpacityB = useSharedValue(0.85);
  const heatPulseStyleA = useAnimatedStyle(() => ({ opacity: heatPulseOpacityA.value }));
  const heatPulseStyleB = useAnimatedStyle(() => ({ opacity: heatPulseOpacityB.value }));
  // ── ROOM TEMP BAR ANIMATION ──────────────────────────────────────────────
  const roomTempBarWidth = useSharedValue(0);
  const roomTempBarStyle = useAnimatedStyle(() => ({ width: `${roomTempBarWidth.value}%` as any }));
  // ── MODERATOR TIME-OUT BANNER ─────────────────────────────────────────────
  const [showTimeoutBanner, setShowTimeoutBanner] = useState(false);
  const timeoutBannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // ────────────────────────────────────────────────────────────────────────

  // Keep moderatorSpeakingRef in sync so async callbacks (tryFireback) can read it
  // without relying on React state timing.
  useEffect(() => { moderatorSpeakingRef.current = moderatorSpeaking; }, [moderatorSpeaking]);

  // Warm up the audio session on mount so the first clip plays without cold-start lag
  useEffect(() => { warmupAudio().catch(() => {}); }, []);

  // Clear the room-temp settle timer on unmount to avoid state updates on an unmounted component
  useEffect(() => {
    return () => {
      if (roomTempSettleTimerRef.current) {
        clearTimeout(roomTempSettleTimerRef.current);
        roomTempSettleTimerRef.current = null;
      }
    };
  }, []);

  // Reset scoring state when returning to setup for a new debate
  useEffect(() => {
    if (phase === "setup") {
      winnerTriggeredRef.current = false;
      setDebatePoints({ a: 0, b: 0 });
      debatePointsRef.current = { a: 0, b: 0 };
      setShowDebateWinner(false);
      setDebateWinner(null);
      setDebateTrumpRoast(null);
      setDebateTrumpRoastSpeakerId(null);
      setDebateWinnerSpeech(null);
      setReplayingClip(null);
      setIsLoadingDebateRoast(false);
      setDebateLoser(null);
      setDebateTokenWinVisible(false);
      setDebateTokenWinAmount(undefined);
      setDebateBetPick(null);
      setDebateBetLocked(false);
      setDebateBetResult(null);
      // Reset heat meter
      setHeatA(0);
      setHeatB(0);
      setFirebackFlashA(false);
      setFirebackFlashB(false);
      heatRef.current = {};
      cancelAnimation(heatPulseOpacityA);
      cancelAnimation(heatPulseOpacityB);
      heatPulseOpacityA.value = 0.85;
      heatPulseOpacityB.value = 0.85;
      // Reset room temperature
      setRoomTemperature(0);
      roomTempSpikedRef.current = false;
      if (roomTempSettleTimerRef.current) {
        clearTimeout(roomTempSettleTimerRef.current);
        roomTempSettleTimerRef.current = null;
      }
      cancelAnimation(roomTempBarWidth);
      roomTempBarWidth.value = 0;
      // Note: tap hint is now suppressed via AsyncStorage (tap_hint_seen),
      // so we do NOT reset tapHintShownRef here — it stays true for the session.
    }
  }, [phase]);

  // ── TAP-HINT — fires 10 s after going live, auto-dismisses after 4 s ─────
  // Uses AsyncStorage so it only ever shows once across sessions.
  useEffect(() => {
    if (phase !== "live" || tapHintShownRef.current) return;
    tapHintShownRef.current = true;
    let cancelled = false;
    AsyncStorage.getItem("tap_hint_seen").then((val) => {
      if (cancelled || val === "1") return;
      const showT = setTimeout(() => {
        if (cancelled) return;
        setShowTapHint(true);
        AsyncStorage.setItem("tap_hint_seen", "1").catch(() => {});
        const hideT = setTimeout(() => setShowTapHint(false), 4000);
        return () => clearTimeout(hideT);
      }, 10000);
      return () => clearTimeout(showT);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [phase]);

  // ── HEAT PULSE DRIVER — speeds up as heat approaches angerThresh ─────────────
  useEffect(() => {
    const thresh = interviewerId ? getAggression(interviewerId).angerThresh : 4;
    const pct = Math.min(100, Math.round((heatA / Math.max(thresh, 1)) * 100));
    cancelAnimation(heatPulseOpacityA);
    if (pct >= 80) {
      // Rapid pulse — imminent fireback
      heatPulseOpacityA.value = withRepeat(
        withSequence(withTiming(1, { duration: 160 }), withTiming(0.3, { duration: 160 })),
        -1, true,
      );
    } else if (pct >= 50) {
      // Gentle pulse — building tension
      heatPulseOpacityA.value = withRepeat(
        withSequence(withTiming(1, { duration: 480 }), withTiming(0.55, { duration: 480 })),
        -1, true,
      );
    } else {
      heatPulseOpacityA.value = withTiming(0.85, { duration: 300 });
    }
  }, [heatA, interviewerId]);

  useEffect(() => {
    const thresh = intervieweeId ? getAggression(intervieweeId).angerThresh : 4;
    const pct = Math.min(100, Math.round((heatB / Math.max(thresh, 1)) * 100));
    cancelAnimation(heatPulseOpacityB);
    if (pct >= 80) {
      heatPulseOpacityB.value = withRepeat(
        withSequence(withTiming(1, { duration: 160 }), withTiming(0.3, { duration: 160 })),
        -1, true,
      );
    } else if (pct >= 50) {
      heatPulseOpacityB.value = withRepeat(
        withSequence(withTiming(1, { duration: 480 }), withTiming(0.55, { duration: 480 })),
        -1, true,
      );
    } else {
      heatPulseOpacityB.value = withTiming(0.85, { duration: 300 });
    }
  }, [heatB, intervieweeId]);

  // ── ROOM TEMPERATURE DRIVER ───────────────────────────────────────────────
  // Combines A and B heat percentages into a single shared dial (average of both pcts).
  useEffect(() => {
    if (roomTempSpikedRef.current) return; // fireback spike in progress — don't override
    const threshA = interviewerId ? getAggression(interviewerId).angerThresh : 4;
    const threshB = intervieweeId ? getAggression(intervieweeId).angerThresh : 4;
    const pctA = Math.min(100, Math.round((heatA / Math.max(threshA, 1)) * 100));
    const pctB = Math.min(100, Math.round((heatB / Math.max(threshB, 1)) * 100));
    const combined = Math.min(100, Math.round((pctA + pctB) / 2));
    setRoomTemperature(combined);
    roomTempBarWidth.value = withTiming(combined, { duration: 400 });
  }, [heatA, heatB, interviewerId, intervieweeId]);

  // Fireback flash → spike room temperature to 100, then settle back.
  // Timer stored in a ref so it is NOT canceled when the flash flag flips back to false.
  // (A useEffect cleanup would fire when flashA/B→false, canceling the settle before it runs.)
  useEffect(() => {
    if (!firebackFlashA && !firebackFlashB) return;
    // Cancel any pending settle from a previous spike before starting a new one
    if (roomTempSettleTimerRef.current) {
      clearTimeout(roomTempSettleTimerRef.current);
      roomTempSettleTimerRef.current = null;
    }
    roomTempSpikedRef.current = true;
    setRoomTemperature(100);
    roomTempBarWidth.value = withTiming(100, { duration: 150 });
    // Settle back after 2 s — read heatRef (always current) so the value is accurate
    // even if heatA/heatB state has changed since this effect ran.
    roomTempSettleTimerRef.current = setTimeout(() => {
      roomTempSettleTimerRef.current = null;
      roomTempSpikedRef.current = false;
      const rawA = heatRef.current[interviewerId ?? ""] ?? 0;
      const rawB = heatRef.current[intervieweeId ?? ""] ?? 0;
      const threshA = interviewerId ? getAggression(interviewerId).angerThresh : 4;
      const threshB = intervieweeId ? getAggression(intervieweeId).angerThresh : 4;
      const pctA = Math.min(100, Math.round((rawA / Math.max(threshA, 1)) * 100));
      const pctB = Math.min(100, Math.round((rawB / Math.max(threshB, 1)) * 100));
      const combined = Math.min(100, Math.round((pctA + pctB) / 2));
      setRoomTemperature(combined);
      roomTempBarWidth.value = withTiming(combined, { duration: 800 });
    }, 2000);
    // No return cleanup — letting the settle run to completion is correct behavior.
    // Phase reset and unmount clear roomTempSettleTimerRef.current explicitly.
  }, [firebackFlashA, firebackFlashB]);
  // ─────────────────────────────────────────────────────────────────────────────

  // ── DC DEBATE WINNER ────────────────────────────────────────────────────────
  // Play a victory fanfare (Web Audio on web, haptics on native)
  const playDebateCheer = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 150);
    setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 350);
    if (Platform.OS === "web") {
      try {
        const AC: any = (globalThis as any).AudioContext || (globalThis as any).webkitAudioContext;
        if (!AC) return;
        const ctx = new AC();
        const notes = [523, 659, 784, 1047]; // C E G C — ascending fanfare
        notes.forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.frequency.value = freq;
          gain.gain.setValueAtTime(0.18, ctx.currentTime + i * 0.12);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.45);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(ctx.currentTime + i * 0.12);
          osc.stop(ctx.currentTime + i * 0.12 + 0.5);
        });
        setTimeout(() => { try { ctx.close(); } catch {} }, 2500);
      } catch {}
    }
  }, []);

  useEffect(() => {
    if (phase !== "ended" || winnerTriggeredRef.current) return;
    winnerTriggeredRef.current = true;
    const pts = debatePointsRef.current;
    const aId = interviewerId;
    const bId = intervieweeId;
    if (!aId || !bId) return;

    // ── PARTING SHOT ──────────────────────────────────────────────────────────
    // If either persona's heat is still hot when the clock hits zero, the hotter
    // one fires a sharp exit line before the winner screen appears.
    const aHeat = heatRef.current[aId] ?? 0;
    const bHeat = heatRef.current[bId] ?? 0;
    const maxHeat = Math.max(aHeat, bHeat);
    let partingShotDelay = 0;
    if (maxHeat >= PARTING_HEAT_THRESHOLD) {
      const hotId = aHeat >= bHeat ? aId : bId;
      const shotPool = PERSONA_PARTING_SHOTS[hotId] ?? PERSONA_PARTING_SHOTS._default ?? [];
      if (shotPool.length > 0) {
        const line = shotPool[Math.floor(Math.random() * shotPool.length)];
        if (voiceEnabledRef.current) {
          playTTS("/api/persona-speak", { text: line, personaId: hotId }, { volume: getPersonaVoiceVolume(hotId) }).catch(() => {});
          partingShotDelay = 4500;
        }
        // Always append parting shot to transcript — voice-disabled viewers
        // would otherwise miss the exit line entirely (#296).
        const hotPersona = hotId === aId
          ? interviewers.find((p) => p.id === hotId) || interviewees.find((p) => p.id === hotId)
          : interviewees.find((p) => p.id === hotId) || interviewers.find((p) => p.id === hotId);
        const hotName = hotPersona?.name ?? hotId;
        setMessages((prev) => [
          ...prev,
          { id: `parting-shot-${Date.now()}`, speakerId: hotId, speakerName: hotName, text: line, ts: Date.now(), isPartingShot: true, skipTTS: true },
        ]);
        if (hotId === aId) {
          setFirebackFlashA(true);
          setTimeout(() => setFirebackFlashA(false), 2000);
          setPartingShotFlashA(true);
          setTimeout(() => setPartingShotFlashA(false), 2000);
        } else {
          setFirebackFlashB(true);
          setTimeout(() => setFirebackFlashB(false), 2000);
          setPartingShotFlashB(true);
          setTimeout(() => setPartingShotFlashB(false), 2000);
        }
      }
    } else {
      // No parting shot — heat never reached the threshold.
      // Append a neutral closing system message so the transcript doesn't end abruptly.
      setMessages((prev) => [
        ...prev,
        {
          id: `debate-ended-${Date.now()}`,
          speakerId: "system",
          speakerName: "System",
          text: "— Debate ended —",
          ts: Date.now(),
          isSystem: true,
          skipTTS: true,
        },
      ]);
    }
    // ─────────────────────────────────────────────────────────────────────────

    // ── WINNER DETERMINATION + ENDING EXCHANGE ────────────────────────────────
    // The modal opens immediately after the parting-shot delay using a preliminary
    // winner (pts → message count → aId). The AI verdict fetch runs concurrently
    // and updates the modal in-place when it resolves — no 15-second wait before
    // the card appears.
    // partingShotDelay is captured from the synchronous block above.
    (async () => {
      // ── Sequential audio helper ──────────────────────────────────────────────
      // Awaits full sound completion before resolving — no blind timers.
      // Safe to call after runningRef is false because it bypasses the TTS queue
      // and drives the sound object directly.
      const playAndAwait = async (text: string, personaId: string): Promise<void> => {
        if (!voiceEnabledRef.current) return;
        try {
          const sound = await playTTS(
            "/api/persona-speak",
            { text, personaId },
            { volume: getPersonaVoiceVolume(personaId) }
          );
          currentSoundRef.current = sound;
          await new Promise<void>((res) => {
            // Phase 1 — 12 s boot timeout if audio never starts loading.
            // Phase 2 — once playback begins, upgrade to full clip + 8 s buffer
            // so long speeches (Bishop Fundme, Carlin, etc.) are never cut short.
            let safetyTimer: ReturnType<typeof setTimeout> = setTimeout(() => {
              sound.setOnPlaybackStatusUpdate(null);
              res();
            }, 12000);
            let playbackStarted = false;
            sound.setOnPlaybackStatusUpdate((s: any) => {
              if (s.isPlaying && s.durationMillis && !playbackStarted) {
                playbackStarted = true;
                clearTimeout(safetyTimer);
                safetyTimer = setTimeout(() => {
                  sound.setOnPlaybackStatusUpdate(null);
                  res();
                }, s.durationMillis + 8000);
              }
              if (s.didJustFinish || s.error) {
                clearTimeout(safetyTimer);
                sound.setOnPlaybackStatusUpdate(null);
                res();
              }
            });
          });
          if (currentSoundRef.current === sound) currentSoundRef.current = null;
          sound.unloadAsync().catch(() => {});
        } catch { /* ignore — ending exchange is best-effort */ }
      };

      // ── PHASE 1: GATHER CONTEXT ─────────────────────────────────────────────
      const aPersona = interviewers.find((p) => p.id === aId);
      const bPersona = interviewees.find((p) => p.id === bId);
      const msgs     = (messagesRef.current ?? []).filter((m) => !m.isSystem);
      const topicForVerdict = (topics && topics.length > 0) ? topics[0].title : "Political Debate";

      // ── PHASE 2: KICK OFF AI VERDICT IN BACKGROUND (don't await yet) ────────
      // Verdict runs concurrently — we'll update the modal once it resolves.
      const deliberatingMsgId = `deliberating-${Date.now()}`;
      let aiVerdictText = "";
      let aiWinnerId    = "";
      let verdictFailed = false;

      const verdictPromise = msgs.length >= 2
        ? (async () => {
            try {
              const vRes = await fetch(new URL("/api/arena/verdict", getApiUrl()).toString(), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  topic: topicForVerdict,
                  messages: msgs.map((m) => ({ speakerName: m.speakerName, text: m.text })),
                  personas: [aPersona?.name || aId, bPersona?.name || bId],
                }),
              });
              if (vRes.ok) {
                const v = await vRes.json();
                aiVerdictText = v.verdict || v.summary || "";
                const aNameLc = (aPersona?.name || aId).toLowerCase();
                const vWinner = (v.winner   || "").toLowerCase();
                const vId     = (v.winnerId || "").toLowerCase();
                const aWinsAI = vId === aId.toLowerCase() ||
                                vId === (aPersona?.name || "").toLowerCase() ||
                                vWinner.includes(aNameLc) ||
                                aNameLc.includes(vWinner);
                aiWinnerId = aWinsAI ? aId : bId;
              } else {
                verdictFailed = true;
              }
            } catch { verdictFailed = true; }
          })()
        : Promise.resolve();

      if (msgs.length >= 2) {
        setMessages((prev) => [...prev, {
          id: deliberatingMsgId, speakerId: "system", speakerName: "System",
          text: "⚖️ DC AI is deliberating...", ts: Date.now(), isSystem: true, skipTTS: true,
        }]);
      }

      // ── PHASE 3: WAIT FOR PARTING SHOT ONLY ────────────────────────────────
      // Verdict runs in parallel — we do NOT await it here.
      try {
        if (partingShotDelay > 0) await new Promise<void>((r) => setTimeout(r, partingShotDelay));
      } catch { /* ignore */ }

      // ── PHASE 4: PRELIMINARY WINNER (instant — no verdict needed) ───────────
      // Fallback chain: votes → message count → always picks someone.
      // The AI verdict may later confirm or correct this; the modal updates in-place.
      let prelimWinnerId = "";
      if (pts.a > 0 || pts.b > 0) {
        prelimWinnerId = pts.a >= pts.b ? aId : bId;
      } else {
        const aC = msgs.filter((m) => m.speakerId === aId).length;
        const bC = msgs.filter((m) => m.speakerId === bId).length;
        prelimWinnerId = aC >= bC ? aId : bId;
      }
      if (!prelimWinnerId) prelimWinnerId = aId;

      const prelimLoserId   = prelimWinnerId === aId ? bId : aId;
      const prelimWinnerP   = prelimWinnerId === aId ? aPersona : bPersona;
      const prelimLoserP    = prelimLoserId  === aId ? aPersona : bPersona;
      const prelimWinnerName = prelimWinnerP?.name || prelimWinnerId;
      const prelimLoserName  = prelimLoserP?.name  || prelimLoserId;

      // ── PHASE 5: SHOW WINNER MODAL IMMEDIATELY ──────────────────────────────
      setDebateWinner({
        id: prelimWinnerId, name: prelimWinnerName,
        portrait: PERSONA_PORTRAITS[prelimWinnerId] || null,
        points: pts.a > 0 || pts.b > 0 ? (prelimWinnerId === aId ? pts.a : pts.b) : 0,
        opponentPoints: pts.a > 0 || pts.b > 0 ? (prelimWinnerId === aId ? pts.b : pts.a) : 0,
        verdict: undefined,
        aiJudged: false,
      });
      setDebateLoser({ id: prelimLoserId, name: prelimLoserName });

      const loserPool  = PERSONA_LOSER_LINES[prelimLoserId]  ?? PERSONA_LOSER_LINES._default  ?? [];
      const winnerPool = PERSONA_WINNER_LINES[prelimWinnerId] ?? PERSONA_WINNER_LINES._default ?? [];
      const loserLine  = loserPool[Math.floor(Math.random() * loserPool.length)];
      const winnerLine = winnerPool[Math.floor(Math.random() * winnerPool.length)];

      // ── START AUDIO PRE-FETCH IMMEDIATELY ────────────────────────────────────
      // Kick off TTS network requests RIGHT NOW — while the modal is opening,
      // the parting-shot plays, and the TTS queue drains — so the audio clips
      // are already buffered by the time phase 6 tries to play them.
      // Cold playAndAwait would add another ~10 s of fetch latency on top of
      // the drain wait, causing the clips to silently time-out or play very late.
      const loserAudioFetch = (loserLine && voiceEnabledRef.current)
        ? prefetchTTSAudio("/api/persona-speak", { text: loserLine, personaId: prelimLoserId }).catch(() => null)
        : Promise.resolve(null);
      const winnerAudioFetch = (winnerLine && voiceEnabledRef.current)
        ? prefetchTTSAudio("/api/persona-speak", { text: winnerLine, personaId: prelimWinnerId }).catch(() => null)
        : Promise.resolve(null);

      if (loserLine) {
        setMessages((prev) => [...prev, {
          id: `loser-concession-${Date.now()}`, speakerId: prelimLoserId, speakerName: prelimLoserName,
          text: loserLine, ts: Date.now(), skipTTS: true,
        }]);
        // Pre-seed the modal's reaction card immediately — AI content will override in phase 7.
        // This ensures the loser's reaction always appears even if the AI fetch fails.
        setDebateTrumpRoast(loserLine);
        setDebateTrumpRoastSpeakerId(prelimLoserId);
      }
      if (winnerLine) {
        setMessages((prev) => [...prev, {
          id: `winner-response-${Date.now()}`, speakerId: prelimWinnerId, speakerName: prelimWinnerName,
          text: winnerLine, ts: Date.now(), skipTTS: true,
        }]);
        // Pre-seed the modal's winner rebuttal card — AI content will override in phase 7.
        setDebateWinnerSpeech(winnerLine);
      }

      setIsLoadingDebateRoast(true);
      setShowDebateWinner(true);
      playDebateCheer();

      // ── PHASE 6: CONCESSION AUDIO (background — modal already open) ─────────
      // Audio was pre-fetched above (concurrently with modal open + parting shot).
      // Drain any still-playing debate clip first so loser/winner voices land cleanly.
      ;(async () => {
        if (voiceEnabledRef.current) {
          // Wait for in-flight debate audio to finish (processQueue exits when
          // runningRef is false, but the current clip plays to natural completion).
          const drainDeadline = Date.now() + 8000;
          while (ttsRunningRef.current && Date.now() < drainDeadline) {
            await new Promise<void>((r) => setTimeout(r, 150));
          }
        }

        // Helper: play from a pre-fetched URI, fall back to cold playAndAwait.
        const playPreloaded = async (text: string, personaId: string, audioFetch: Promise<string | null>) => {
          if (!voiceEnabledRef.current) return;
          try {
            const uri = await audioFetch;
            if (!uri) { await playAndAwait(text, personaId); return; }
            const snd = await playPrefetchedAudio(uri, { volume: getPersonaVoiceVolume(personaId) });
            currentSoundRef.current = snd;
            await new Promise<void>((resolve) => {
              let t: ReturnType<typeof setTimeout> | null = null;
              const done = () => {
                if (t) { clearTimeout(t); t = null; }
                snd.setOnPlaybackStatusUpdate(null);
                resolve();
              };
              t = setTimeout(done, 25000); // generous boot-timeout for slow TTS
              snd.setOnPlaybackStatusUpdate((st: any) => {
                if (st.isPlaying && st.durationMillis && t) {
                  clearTimeout(t);
                  t = setTimeout(done, st.durationMillis + 5000);
                }
                if (st.didJustFinish || st.error) done();
              });
            });
            if (currentSoundRef.current === snd) currentSoundRef.current = null;
            snd.unloadAsync().catch(() => {});
          } catch { await playAndAwait(text, personaId); }
        };

        if (loserLine)  await playPreloaded(loserLine,  prelimLoserId,  loserAudioFetch);
        if (winnerLine) await playPreloaded(winnerLine, prelimWinnerId, winnerAudioFetch);
      })();

      // ── PHASE 7: VERDICT UPDATE + REACTION + SPEECH (background) ────────────
      // Awaits the in-flight verdict, updates the modal with the AI result,
      // then fires the roast/speech fetches once the final winner is known.
      ;(async () => {
        try {
          // Wait for AI verdict (up to 15 s)
          try {
            await Promise.race([
              verdictPromise,
              new Promise<void>((resolve) => setTimeout(() => { verdictFailed = true; resolve(); }, 15000)),
            ]);
          } catch { verdictFailed = true; }

          // Update deliberating message
          if (verdictFailed || !aiVerdictText) {
            setMessages((prev) => prev.map((m) =>
              m.id === deliberatingMsgId
                ? { ...m, id: `verdict-unavailable-${Date.now()}`, text: "⚖️ Verdict unavailable" }
                : m,
            ));
          } else {
            setMessages((prev) => prev.filter((m) => m.id !== deliberatingMsgId));
          }

          // Resolve final winner: AI verdict if available, else keep preliminary
          const winnerId   = (aiWinnerId && !verdictFailed) ? aiWinnerId : prelimWinnerId;
          const loserId    = winnerId === aId ? bId : aId;
          const winnerP    = winnerId === aId ? aPersona : bPersona;
          const loserP     = loserId  === aId ? aPersona : bPersona;
          const winnerName = winnerP?.name || winnerId;
          const loserName  = loserP?.name  || loserId;

          // Update modal with AI verdict when available (fills in verdict text +
          // corrects winner if AI disagrees with the preliminary determination).
          if (!verdictFailed && aiVerdictText) {
            setDebateWinner({
              id: winnerId, name: winnerName,
              portrait: PERSONA_PORTRAITS[winnerId] || null,
              points: pts.a > 0 || pts.b > 0 ? (winnerId === aId ? pts.a : pts.b) : 0,
              opponentPoints: pts.a > 0 || pts.b > 0 ? (winnerId === aId ? pts.b : pts.a) : 0,
              verdict: aiVerdictText,
              aiJudged: true,
            });
            if (winnerId !== prelimWinnerId) {
              setDebateLoser({ id: loserId, name: loserName });
            }
          }

          // Record win against final winner
          if (deviceId) {
            fetch(new URL("/api/arena/record-win", getApiUrl()).toString(), {
              method: "POST",
              headers: { "Content-Type": "application/json", "x-device-id": deviceId },
              body: JSON.stringify({ personaId: winnerId, loserId }),
            }).then(async (r) => {
              if (r.ok) {
                const data = await r.json();
                if (data.tokensEarned > 0) {
                  setDebateTokenWinAmount(data.tokensEarned);
                  setTimeout(() => setDebateTokenWinVisible(true), 2200);
                  refreshBalance();
                }
                setTimeout(() => {
                  fetchDebateRecordRef.current?.();
                  fetchAllPersonaRecordsRef.current?.();
                }, 600);
              }
            }).catch(() => {});
          }
          AsyncStorage.getItem("debate_wins_local_v1").then((raw) => {
            const prev = raw ? JSON.parse(raw) : {};
            const next = { ...prev, [winnerId]: (prev[winnerId] || 0) + 1, _total: (prev._total || 0) + 1 };
            AsyncStorage.setItem("debate_wins_local_v1", JSON.stringify(next)).catch(() => {});
          }).catch(() => {});

          // Roast + speech (now that we know the final winner)
          const trumpInDebate = aId === "trump" || bId === "trump";
          const [roastData, speechData] = await Promise.all([
            trumpInDebate && deviceId
              ? fetch(new URL("/api/arena/roast", getApiUrl()).toString(), {
                  method: "POST",
                  headers: { "Content-Type": "application/json", "x-device-id": deviceId },
                  body: JSON.stringify({
                    winnerId, winnerName,
                    winnerPoints: pts.a > 0 || pts.b > 0 ? (winnerId === aId ? pts.a : pts.b) : 1,
                    trumpPoints: 0,
                    customerName: "the audience",
                    leaderboard: [
                      { name: winnerName, points: pts.a > 0 || pts.b > 0 ? (winnerId === aId ? pts.a : pts.b) : 1 },
                      { name: loserName,  points: pts.a > 0 || pts.b > 0 ? (winnerId === aId ? pts.b : pts.a) : 0 },
                    ],
                    winTally: null,
                  }),
                }).then((r) => r.json()).catch(() => null)
              : !trumpInDebate
                ? fetch(new URL("/api/arena/debate-loser-reaction", getApiUrl()).toString(), {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ loserId, loserName, winnerId, winnerName, verdict: aiVerdictText, topic: topicForVerdict }),
                  }).then((r) => r.ok ? r.json() : null).catch(() => null)
                : Promise.resolve(null),
            fetch(new URL("/api/arena/debate-verdict-speech", getApiUrl()).toString(), {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ winnerId, winnerName, loserId, loserName, verdict: aiVerdictText, topic: topicForVerdict }),
            }).then((r) => r.ok ? r.json() : null).catch(() => null),
          ]);

          const reactionText        = roastData?.roast ?? roastData?.reaction ?? null;
          const reactionSpeakerId   = trumpInDebate ? "trump" : loserId;
          const reactionSpeakerName = trumpInDebate ? "Donald Trump" : loserName;

          if (reactionText) {
            setDebateTrumpRoast(reactionText);
            setDebateTrumpRoastSpeakerId(reactionSpeakerId);
            setMessages((prev) => [...prev, {
              id: `reaction-${Date.now()}`,
              speakerId: reactionSpeakerId, speakerName: reactionSpeakerName,
              text: reactionText, ts: Date.now(), skipTTS: true,
            }]);
            await playAndAwait(reactionText, reactionSpeakerId);
          }

          if (speechData?.speech) {
            setDebateWinnerSpeech(speechData.speech);
            setMessages((prev) => [...prev, {
              id: `winner-taunt-${Date.now()}`,
              speakerId: winnerId, speakerName: winnerName,
              text: speechData.speech, ts: Date.now(), skipTTS: true,
            }]);
            await playAndAwait(speechData.speech, winnerId);
          }
        } catch { /* non-fatal — modal already showing */ } finally {
          setIsLoadingDebateRoast(false);
        }
      })();
    })();
    // ─────────────────────────────────────────────────────────────────────────
  }, [phase, interviewerId, intervieweeId, interviewers, interviewees, deviceId, refreshBalance, playDebateCheer]);

  const [isPaused, setIsPaused] = useState(false);
  const exchangesOnTopicRef = useRef(0);
  const totalExchangesRef = useRef(0);
  const shopPromoFiredRef = useRef(false);
  // Pre-fetched next question — eliminates dead air between turns
  const nextQPromiseRef = useRef<Promise<any> | null>(null);
  // Carries a pre-generated question from one round's transition into the next round's open
  const prefetchedOpeningRef = useRef<string>("");
  // Holds the in-flight fetch for the next round's PRIMARY ANSWER, started during the
  // current round's transition so it's ready (or close) before the moderator finishes speaking.
  const prefetchedPrimaryAnswerRef = useRef<Promise<any> | null>(null);
  // Holds the in-flight fetch for the next round's REBUTTAL ANSWER, chained off the primary
  // pre-fetch during the squabble bridge so the rebuttal is also in-flight before the new round starts.
  const prefetchedRebuttalAnswerRef = useRef<Promise<any> | null>(null);
  const messagesRef = useRef<Msg[]>([]);
  const topicIdxRef = useRef(0);
  const topicsRef = useRef<Topic[]>([]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  useEffect(() => { topicIdxRef.current = topicIdx; }, [topicIdx]);
  useEffect(() => { topicsRef.current = topics; }, [topics]);

  // ── Pro mode state ───────────────────────────────────────────────────────
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const voiceEnabledRef = useRef(true);
  const [fxEnabled, setFxEnabled] = useState(true);
  const fxEnabledRef = useRef(true);
  const [beepEnabled, setBeepEnabled] = useState(true);
  const beepEnabledRef = useRef(true);
  const [activeSpeaker, setActiveSpeaker] = useState<string | null>(null);
  const activeSpeakerRef = useRef<string | null>(null);
  const ttsQueueRef = useRef<Array<{ text: string; personaId: string; msgId?: string; blockEarlyResolve?: boolean; overlapMs?: number; onComplete?: () => void; onStart?: () => void }>>([]);
  const ttsRunningRef = useRef(false);
  const currentSoundRef = useRef<Audio.Sound | null>(null);
  const prefetchedAudioRef = useRef<{ personaId: string; text: string; audioUri: string } | null>(null);
  const prefetchingRef = useRef(false);
  // Pending slot: if a prefetch is in flight and a new one arrives, it queues here
  // and fires automatically when the current one completes — prevents dropped prefetches.
  const pendingPrefetchRef = useRef<{ text: string; personaId: string } | null>(null);

  const [emoInterviewer, setEmoInterviewer] = useState<Emotions>(ZERO_EMO);
  const [emoInterviewee, setEmoInterviewee] = useState<Emotions>(ZERO_EMO);

  const malcolmxAngerRef = useRef<number>(10);
  useEffect(() => {
    if (interviewerId === "malcolmx") {
      malcolmxAngerRef.current = emoInterviewer.anger;
    } else if (intervieweeId === "malcolmx") {
      malcolmxAngerRef.current = emoInterviewee.anger;
    }
  }, [interviewerId, intervieweeId, emoInterviewer.anger, emoInterviewee.anger]);

  const [lieTally, setLieTally] = useState<{ totalLies: number; totalSessions: number; bestSession: number; topLiarName: string | null; topLiarCount: number } | null>(null);

  const [lieCount, setLieCount] = useState(0);
  const [lieCountA, setLieCountA] = useState(0);
  const [lieCountB, setLieCountB] = useState(0);
  const [lies, setLies] = useState<LieEntry[]>([]);
  const [liesSheetOpen, setLiesSheetOpen] = useState(false);
  const [lieFlashOn, setLieFlashOn] = useState(false);
  const [lieVotes, setLieVotes] = useState<Record<string, { up: number; down: number; myVote: number }>>({});
  const lieVotesPendingRef = useRef<Set<string>>(new Set());
  const [flaggedMsgIds, setFlaggedMsgIds] = useState<Set<string>>(new Set());
  const flagPendingRef = useRef<Set<string>>(new Set());

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
        // Roll back the optimistic update so the UI reflects reality.
        setLieVotes((prev) => ({ ...prev, [lie.id]: current }));
      })
      .finally(() => { lieVotesPendingRef.current.delete(lie.id); });
  }, [deviceId, lieVotes]);

  // When the lies sheet opens, refresh tallies for any lies the user hasn't voted on yet
  useEffect(() => {
    if (!liesSheetOpen || !deviceId || lies.length === 0) return;
    const ids = lies.map((l) => l.id);
    fetch(new URL("/api/arena/interview-lie-votes", getApiUrl()).toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-device-id": deviceId },
      body: JSON.stringify({ lieIds: ids }),
    })
      .then((r) => r.ok ? r.json() : null)
      .then((data: any) => {
        if (!data?.tallies) return;
        setLieVotes((prev) => {
          const next = { ...prev };
          for (const id of ids) {
            const t = data.tallies[id];
            if (t) next[id] = { up: t.up || 0, down: t.down || 0, myVote: t.myVote || 0 };
            else if (!next[id]) next[id] = { up: 0, down: 0, myVote: 0 };
          }
          return next;
        });
      })
      .catch(() => {});
  }, [liesSheetOpen, deviceId, lies]);
  const [latestTruthScore, setLatestTruthScore] = useState<number | null>(null);
  const flashOpacity = useSharedValue(0);
  const glowPulse = useSharedValue(0);
  // Background heartbeat pulse for the live phase
  const bgPulseScale = useSharedValue(1);
  const bgPulseOpacity = useSharedValue(0.18);
  const bgPulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: bgPulseScale.value }],
    opacity: bgPulseOpacity.value,
  }));
  const bgPulseStyle2 = useAnimatedStyle(() => ({
    transform: [{ scale: bgPulseScale.value * 1.28 }],
    opacity: bgPulseOpacity.value * 0.45,
  }));
  const bgPulseStyle3 = useAnimatedStyle(() => ({
    transform: [{ scale: bgPulseScale.value * 1.62 }],
    opacity: bgPulseOpacity.value * 0.2,
  }));
  useEffect(() => {
    if (phase === "live") {
      // Double-beat heartbeat: lub-DUB ... pause
      bgPulseScale.value = withRepeat(
        withSequence(
          withTiming(1.08, { duration: 180 }),
          withTiming(1.0, { duration: 130 }),
          withTiming(1.15, { duration: 200 }),
          withTiming(1.0, { duration: 800 }),
        ),
        -1, false
      );
      bgPulseOpacity.value = withRepeat(
        withSequence(
          withTiming(0.52, { duration: 180 }),
          withTiming(0.18, { duration: 130 }),
          withTiming(0.72, { duration: 200 }),
          withTiming(0.18, { duration: 800 }),
        ),
        -1, false
      );
    } else {
      cancelAnimation(bgPulseScale);
      cancelAnimation(bgPulseOpacity);
      bgPulseScale.value = withTiming(1, { duration: 300 });
      bgPulseOpacity.value = withTiming(0, { duration: 300 });
    }
  }, [phase]);

  // Keep the screen awake while a debate is live — without this, the OS dims/locks
  // the screen after its idle timeout, which throttles JS timers driving the turn
  // loop and silences speech mid-session even though native background audio would
  // otherwise keep going. Released as soon as the debate is not live.
  useEffect(() => {
    if (phase === "live") {
      activateKeepAwakeAsync("debate-stage").catch(() => {});
      return () => { deactivateKeepAwake("debate-stage"); };
    }
    return undefined;
  }, [phase]);

  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  useEffect(() => () => {
    try { recognitionRef.current?.stop?.(); } catch {}
    recognitionRef.current = null;
  }, []);

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
  const [callerName, setCallerName] = useState("");
  const [callinText, setCallinText] = useState("");
  const [isCallinSending, setIsCallinSending] = useState(false);
  const [callinOpen, setCallinOpen] = useState(false);

  // Load persisted toggles + caller name
  useEffect(() => {
    (async () => {
      try {
        const [fx, vc, bp, nm] = await Promise.all([
          AsyncStorage.getItem(FX_KEY), AsyncStorage.getItem(VOICE_KEY), AsyncStorage.getItem(BEEP_KEY), AsyncStorage.getItem(NAME_KEY),
        ]);
        if (fx !== null) { const v = fx === "1"; setFxEnabled(v); fxEnabledRef.current = v; }
        if (vc !== null) { const v = vc === "1"; setVoiceEnabled(v); voiceEnabledRef.current = v; }
        if (bp !== null) { const v = bp === "1"; setBeepEnabled(v); beepEnabledRef.current = v; }
        if (nm) setCallerName(nm);
      } catch {}
    })();
  }, []);

  const toggleVoice = useCallback(() => {
    const next = !voiceEnabledRef.current;
    voiceEnabledRef.current = next;
    setVoiceEnabled(next);
    AsyncStorage.setItem(VOICE_KEY, next ? "1" : "0").catch(() => {});
    if (!next) {
      // stop current playback
      const snd = currentSoundRef.current;
      currentSoundRef.current = null;
      ttsQueueRef.current = [];
      setActiveSpeaker(null);
      activeSpeakerRef.current = null;
      if (snd) snd.stopAsync().then(() => snd.unloadAsync()).catch(() => {});
    }
  }, []);
  const toggleFx = useCallback(() => {
    const next = !fxEnabledRef.current;
    fxEnabledRef.current = next;
    setFxEnabled(next);
    AsyncStorage.setItem(FX_KEY, next ? "1" : "0").catch(() => {});
  }, []);
  const toggleMic = useCallback(() => {
    if (Platform.OS !== "web") {
      Alert.alert("Voice input", "Voice input is only available on the web version. Type your question to call in.");
      return;
    }
    const w: any = typeof window !== "undefined" ? window : null;
    const SR = w && (w.SpeechRecognition || w.webkitSpeechRecognition);
    if (!SR) {
      Alert.alert("Voice input not supported", "Your browser doesn't support speech recognition. Try Chrome or Safari.");
      return;
    }
    if (recognitionRef.current && isListening) {
      try { recognitionRef.current.stop(); } catch {}
      recognitionRef.current = null;
      setIsListening(false);
      return;
    }
    try {
      const rec = new SR();
      rec.lang = "en-US";
      rec.interimResults = true;
      rec.continuous = false;
      rec.onresult = (e: any) => {
        let txt = "";
        for (let i = 0; i < e.results.length; i++) txt += e.results[i][0].transcript;
        setCallinText(txt.trim().slice(0, 240));
      };
      rec.onerror = () => { setIsListening(false); recognitionRef.current = null; };
      rec.onend = () => { setIsListening(false); recognitionRef.current = null; };
      recognitionRef.current = rec;
      setIsListening(true);
      rec.start();
    } catch {
      setIsListening(false);
      recognitionRef.current = null;
    }
  }, [isListening]);

  const toggleBeep = useCallback(() => {
    const next = !beepEnabledRef.current;
    beepEnabledRef.current = next;
    setBeepEnabled(next);
    AsyncStorage.setItem(BEEP_KEY, next ? "1" : "0").catch(() => {});
  }, []);

  // ── Audio prefetch — fetch next clip's audio while current clip is playing ──
  // Supports a pending-slot: if a prefetch is in flight, the new item is queued
  // and fires automatically when the current one completes, preventing drops.
  const startPrefetch = useCallback((item: { text: string; personaId: string }) => {
    if (shouldSkipPersonaVoice(item.personaId)) return;
    const cached = prefetchedAudioRef.current;
    if (cached && cached.text === item.text && cached.personaId === item.personaId) return;
    if (prefetchingRef.current) {
      pendingPrefetchRef.current = item;
      return;
    }
    prefetchingRef.current = true;
    const prefetchBody: Record<string, any> = { text: item.text, personaId: item.personaId };
    if (item.personaId === "malcolmx") prefetchBody.angerLevel = malcolmxAngerRef.current;
    prefetchTTSAudio("/api/persona-speak", prefetchBody)
      .then((audioUri) => {
        prefetchedAudioRef.current = { personaId: item.personaId, text: item.text, audioUri };
        prefetchingRef.current = false;
        const pending = pendingPrefetchRef.current;
        pendingPrefetchRef.current = null;
        if (pending) startPrefetch(pending);
      })
      .catch(() => {
        prefetchingRef.current = false;
        const pending = pendingPrefetchRef.current;
        pendingPrefetchRef.current = null;
        if (pending) startPrefetch(pending);
      });
  }, []);

  // ── TTS queue: sequential playback with 1s overlap + audio prefetch ────────
  const processQueue = useCallback(async () => {
    if (ttsRunningRef.current) return;
    ttsRunningRef.current = true;
    while (ttsQueueRef.current.length > 0 && voiceEnabledRef.current && runningRef.current) {
      const item = ttsQueueRef.current.shift();
      if (!item) break;
      if (shouldSkipPersonaVoice(item.personaId)) {
        // Must call onStart + onComplete so speakMod transcript defers and
        // enqueueTTSAndWait don't hang forever on skipped personas
        item.onStart?.();
        item.onComplete?.();
        continue;
      }
      setActiveSpeaker(item.personaId);
      activeSpeakerRef.current = item.personaId;
      // onStart: fires when this TTS item actually begins playing — used by
      // speakMod to add the transcript message at audio-play time (not call time).
      item.onStart?.();
      try {
        // Use prefetched audio if it matches this item — eliminates fetch latency gap.
        // No blocking wait: if the prefetch isn't ready yet, fall through to cold fetch.
        const cached = prefetchedAudioRef.current;
        let sound: Audio.Sound;
        if (cached && cached.text === item.text && cached.personaId === item.personaId) {
          prefetchedAudioRef.current = null;
          sound = await playPrefetchedAudio(cached.audioUri, { volume: getPersonaVoiceVolume(item.personaId) });
        } else {
          const ttsBody: Record<string, any> = { text: item.text, personaId: item.personaId };
          if (item.personaId === "malcolmx") ttsBody.angerLevel = malcolmxAngerRef.current;
          sound = await playTTS("/api/persona-speak", ttsBody, { volume: getPersonaVoiceVolume(item.personaId) });
        }
        currentSoundRef.current = sound;
        // 50 ms overlap: next speaker starts 50 ms before current clip ends — zero dead air,
        // tight conversational handoff without audible cross-talk.
        const OVERLAP_MS = 500;
        let prefetchStarted = false;
        await new Promise<void>((resolve) => {
          let resolved = false;
          let earlyResolved = false;
          const fullCleanup = () => {
            sound.setOnPlaybackStatusUpdate(null);
            // Stop BEFORE unload — unloading a still-playing sound without stopping
            // first flushes garbage data from the audio hardware buffer, producing the
            // "jibber jabber" tail heard after normal dialog.
            sound.getStatusAsync().then((st: any) => {
              if (st.isLoaded) sound.stopAsync().then(() => sound.unloadAsync()).catch(() => {});
            }).catch(() => {});
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
            // Always fire onComplete regardless of exit path (didJustFinish, error,
            // OR safety-timeout). Without this, enqueueTTSAndWait hangs forever
            // when audio fails to load — blocking the entire runLoop.
            item.onComplete?.();
            if (!earlyResolved) resolve();
            fullCleanup();
          };
          // Two-phase safety timeout:
          //  Phase 1 — short window (10 s) to abort if audio never starts loading.
          //  Phase 2 — once playback begins, switch to a generous cap based on
          //            actual audio duration so long speeches are never cut short.
          let playbackStarted = false;
          let safetyTimer: ReturnType<typeof setTimeout> = setTimeout(finish, 10000);

          sound.setOnPlaybackStatusUpdate((status: any) => {
            // Never let an armed interrupt duck or fire over a moderator line —
            // blockEarlyResolve items are moderator speech and must complete fully.
            if (!item.blockEarlyResolve) {
              interruptCtl.maybeFire(
                status, sound,
                () => { setModeratorSpeaking(true); setActiveSpeaker(MODERATORS[moderatorStyle]?.personaId || null); },
                () => { setModeratorSpeaking(false); setActiveSpeaker(item.personaId); },
                activeSpeakerRef.current
              );
            }
            if (status.didJustFinish || status.error) {
              clearTimeout(safetyTimer);
              finish();
              return;
            }
            if (status.isPlaying && status.durationMillis && status.positionMillis) {
              // Switch to a duration-aware cap the first time we see playback
              if (!playbackStarted) {
                playbackStarted = true;
                // Sync-update activeSpeakerRef immediately so the interrupt controller
                // sees the correct currentSpeakerId on its very next maybeFire call.
                activeSpeakerRef.current = item.personaId;
                setActiveSpeaker(item.personaId);
                if (!firstAudioPlayedRef.current) { firstAudioPlayedRef.current = true; setFirstAudioPlayed(true); }
                clearTimeout(safetyTimer);
                // Allow the full clip duration + 6 s buffer before force-finishing
                safetyTimer = setTimeout(finish, status.durationMillis + 6000);
                // ── Karaoke scroll: scroll to THIS message when it starts playing ──
                // Use msgId to find the exact index so we don't jump ahead
                // to messages that were added later but not yet spoken.
                const msgIdx = item.msgId
                  ? messagesRef.current.findIndex((m) => m.id === item.msgId)
                  : -1;
                if (msgIdx >= 0) {
                  try {
                    flatListRef.current?.scrollToIndex({ index: msgIdx, animated: true, viewPosition: 0.8 });
                  } catch {
                    flatListRef.current?.scrollToEnd({ animated: true });
                  }
                } else {
                  flatListRef.current?.scrollToEnd({ animated: true });
                }
              }
              const remaining = status.durationMillis - status.positionMillis;
              // Kick off audio prefetch for the next item as soon as possible
              if (!prefetchStarted && ttsQueueRef.current.length > 0) {
                prefetchStarted = true;
                startPrefetch(ttsQueueRef.current[0]);
              }
              // Early-resolve only when the NEXT queued item is a DIFFERENT speaker —
              // prevents a persona from cutting off their own speech mid-sentence.
              // blockEarlyResolve = true means the item must fully finish before the
              // next speaker can start (used for moderator lines so personas can't
              // overlap the moderator).
              const nextQueued = ttsQueueRef.current[0];
              const nextIsDifferentSpeaker = nextQueued && nextQueued.personaId !== item.personaId;
              if (!earlyResolved && nextIsDifferentSpeaker && !item.blockEarlyResolve && remaining <= (item.overlapMs ?? OVERLAP_MS) && remaining > 0) {
                earlyResolve();
              }
            }
          });
        });
      } catch (e) {
        // TTS error — must call onComplete or enqueueTTSAndWait hangs permanently
        item.onComplete?.();
      }
    }
    ttsRunningRef.current = false;
    if (ttsQueueRef.current.length === 0) {
      setActiveSpeaker(null);
      activeSpeakerRef.current = null;
    }
  }, [startPrefetch]);

  const enqueueTTS = useCallback((text: string, personaId: string, msgId?: string, opts?: { blockEarlyResolve?: boolean; onComplete?: () => void; onStart?: () => void }) => {
    if (!voiceEnabledRef.current) return;
    ttsQueueRef.current.push({ text, personaId, msgId, ...opts });
    processQueue();
  }, [processQueue]);

  /** Enqueue a TTS item and return a promise that resolves when audio playback completes. */
  const enqueueTTSAndWait = useCallback((text: string, personaId: string, msgId?: string): Promise<void> => {
    return new Promise<void>((resolve) => {
      // Safety: if voice is off, resolve immediately so flow doesn't stall
      if (!voiceEnabledRef.current) { resolve(); return; }
      // overlapMs: 800 — next speaker starts 800 ms before moderator finishes,
      // creating audible conversational overlap and eliminating dead air.
      ttsQueueRef.current.push({ text, personaId, msgId, overlapMs: 800, onComplete: resolve });
      processQueue();
    });
  }, [processQueue]);

  /**
   * Wait for the TTS queue to fully drain (no audio playing, queue empty).
   * Used before moderator speech so the moderator never starts mid-persona.
   * Safety cap: resolves after 25 s regardless so the debate can't freeze.
   */
  const waitForQueueDrain = useCallback((): Promise<void> => new Promise((resolve) => {
    const maxWaitTimer = setTimeout(resolve, 25000);
    const tick = () => {
      if (!ttsRunningRef.current && ttsQueueRef.current.length === 0) {
        clearTimeout(maxWaitTimer);
        resolve();
      } else {
        setTimeout(tick, 100);
      }
    };
    tick();
  }), []);

  const stopAllAudio = useCallback(() => {
    ttsQueueRef.current = [];
    prefetchedAudioRef.current = null;
    prefetchingRef.current = false;
    pendingPrefetchRef.current = null;
    const snd = currentSoundRef.current;
    currentSoundRef.current = null;
    setActiveSpeaker(null);
    activeSpeakerRef.current = null;
    if (snd) snd.stopAsync().then(() => snd.unloadAsync()).catch(() => {});
  }, []);

  // Pulse animation for the active speaker glow + reactive active flags via shared values
  const interviewerActiveSV = useSharedValue(0);
  const intervieweeActiveSV = useSharedValue(0);
  useEffect(() => {
    if (activeSpeaker) {
      glowPulse.value = withRepeat(withTiming(1, { duration: 700 }), -1, true);
    } else {
      cancelAnimation(glowPulse);
      glowPulse.value = withTiming(0, { duration: 200 });
    }
    interviewerActiveSV.value = activeSpeaker && interviewerId && activeSpeaker === interviewerId ? 1 : 0;
    intervieweeActiveSV.value = activeSpeaker && intervieweeId && activeSpeaker === intervieweeId ? 1 : 0;
  }, [activeSpeaker, glowPulse, interviewerId, intervieweeId, interviewerActiveSV, intervieweeActiveSV]);

  // ── Debounced "between-content" loading indicator ────────────────────────
  // Shows a spinner in the chat footer whenever the debate is live but nothing
  // is playing or being fetched — i.e. genuine dead air (queue drained, no AI
  // call in flight, moderator not speaking). Debounced 350 ms to suppress the
  // sub-frame flickers that occur when activeSpeaker briefly clears between clips.
  useEffect(() => {
    // Drop the !moderatorSpeaking guard — moderatorSpeaking is true during fillers,
    // so the old condition almost never fired. Show loading whenever no audio is
    // actively playing (activeSpeaker null) and no AI fetch is in progress.
    const idle = phase === "live" && !activeSpeaker && isThinking === null;
    if (idle) {
      debateLoadingTimerRef.current = setTimeout(() => setShowDebateLoading(true), 350);
    } else {
      if (debateLoadingTimerRef.current) { clearTimeout(debateLoadingTimerRef.current); debateLoadingTimerRef.current = null; }
      setShowDebateLoading(false);
    }
    return () => { if (debateLoadingTimerRef.current) clearTimeout(debateLoadingTimerRef.current); };
  }, [phase, activeSpeaker, moderatorSpeaking, isThinking]);

  // Ground truth for the moderator portrait overlay: whenever the ACTUAL audio
  // queue is playing the moderator's voice, show the picture. Whenever a debater's
  // voice takes over, hide it. (Manual setModeratorSpeaking(true) calls elsewhere give
  // instant feedback while a line is being generated/fetched; this effect keeps the
  // overlay honest once real playback starts/stops, including moderator cut-ins that
  // route through activeSpeaker via the interrupt controller below.)
  useEffect(() => {
    const mod = MODERATORS[moderatorStyle];
    if (!mod) return;
    if (activeSpeaker === mod.personaId) setModeratorSpeaking(true);
    else if (activeSpeaker !== null) setModeratorSpeaking(false);
  }, [activeSpeaker, moderatorStyle]);

  const interviewerGlowStyle = useAnimatedStyle(() => ({
    opacity: interviewerActiveSV.value ? 0.45 + glowPulse.value * 0.55 : 0,
  }));
  const intervieweeGlowStyle = useAnimatedStyle(() => ({
    opacity: intervieweeActiveSV.value ? 0.45 + glowPulse.value * 0.55 : 0,
  }));
  const flashStyle = useAnimatedStyle(() => ({ opacity: flashOpacity.value }));

  const triggerLightning = useCallback(() => {
    if (!fxEnabledRef.current) return;
    flashOpacity.value = withSequence(
      withTiming(0.85, { duration: 80 }),
      withTiming(0.0, { duration: 120 }),
      withTiming(0.7, { duration: 70 }),
      withTiming(0.0, { duration: 200 }),
    );
  }, [flashOpacity]);

  const playLieAlert = useCallback(() => {
    if (!beepEnabledRef.current) return;
    if (Platform.OS === "web") {
      playLieBeep();
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
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
    }
  }, []);

  // Fire-and-forget fact-check on each non-trivial statement from EITHER debater —
  // gated independently per-speaker by their own lie-detector toggle.
  const runFactCheck = useCallback((msg: Msg) => {
    const isA = interviewerId && msg.speakerId === interviewerId;
    const isB = intervieweeId && msg.speakerId === intervieweeId;
    if (!isA && !isB) return;
    if (isA && !lieDetectorA) return;
    if (isB && !lieDetectorB) return;
    if (msg.text.length < 25) return;
    if (!deviceId) return;
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
        const isLie = score < 40 || data.isLie;
        if (isLie) {
          setLieCount((c) => c + 1);
          if (isA) setLieCountA((c) => c + 1);
          if (isB) setLieCountB((c) => c + 1);
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
          triggerLightning();
          playLieAlert();
          setLieFlashOn(true);
          setTimeout(() => setLieFlashOn(false), 450);
        }
        // Moderator ONLY corrects when an actual factual lie is detected.
        // No random opinion reactions — corrections are sequential (queue),
        // never overlapping. blockEarlyResolve=true means debaters cannot
        // start talking until the moderator fully finishes — no cutoffs.
        const modCooldownOk = Date.now() - lastModReactionAtRef.current >= MOD_REACTION_COOLDOWN_MS;
        if (isLie && deviceId && modCooldownOk) {
          lastModReactionAtRef.current = Date.now();
          const mod = MODERATORS[moderatorStyle];
          const reactionKind = moderatorLieReaction(moderatorStyle, msg.speakerId, true);
          const factLine = data.moderatorLine ? String(data.moderatorLine) : null;
          const linePromise: Promise<string> = factLine
            ? Promise.resolve(factLine)
            : reactionKind
              ? generateModeratorLine({
                  deviceId, moderatorId: mod.personaId, kind: reactionKind,
                  topic: currentTopicRef.current?.title, lastSpeakerText: msg.text, moderatorStyle,
                })
              : Promise.resolve("");
          linePromise.then((line) => {
            if (!line || !runningRef.current) return;
            setModeratorLastLine(line);
            setModeratorSpeaking(true);
            // blockEarlyResolve=true: next debater waits for moderator to
            // fully finish — no overlapping, no mid-sentence cutoffs.
            enqueueTTS(line, mod.personaId, `mod-lie-${msg.id}`, {
              blockEarlyResolve: true,
              onComplete: () => setModeratorSpeaking(false),
            });
          }).catch(() => {});
        }
      })
      .catch(() => {});
  }, [interviewerId, intervieweeId, lieDetectorA, lieDetectorB, deviceId, triggerLightning, playLieAlert, moderatorStyle, enqueueTTS]);

  // Viewer manually flags an interviewee message as a suspected lie the AI missed.
  // The server re-runs fact-check scoring; the entry is always inserted with a
  // "user-flagged" badge regardless of the resulting score.
  const flagMessageAsLie = useCallback((msg: Msg) => {
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
          triggerLightning();
          playLieAlert();
          setLieFlashOn(true);
          setTimeout(() => setLieFlashOn(false), 450);
        }
      })
      .catch((err: any) => {
        // Roll back on failure
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
  }, [deviceId, flaggedMsgIds, triggerLightning, playLieAlert]);

  // Wrap addMessage to also drive emotions, TTS, fact-check, and fireback triggers
  const enrichAndAddMessage = useCallback((m: Msg) => {
    setMessages((prev) => [...prev, m]);
    if (!m.skipTTS) enqueueTTS(m.text, m.speakerId, m.id);
    const delta = computeEmotionDelta(m.text);
    if (interviewerId && m.speakerId === interviewerId) setEmoInterviewer((p) => applyEmotionDelta(p, delta));
    else if (intervieweeId && m.speakerId === intervieweeId) setEmoInterviewee((p) => applyEmotionDelta(p, delta));
    if (!m.isInterruption && (m.speakerId === interviewerId || m.speakerId === intervieweeId)) runFactCheck(m);
    // ── Fireback + moderator retort engine ────────────────────────────────
    if (!m.isInterruption && (m.speakerId === interviewerId || m.speakerId === intervieweeId)) {
      const severity = detectInsult(m.text);
      if (severity >= 1) {
        const targetId = m.speakerId === interviewerId ? intervieweeId : interviewerId;
        if (targetId) {
          // Small delay so main-speaker TTS gets queued first
          setTimeout(() => { tryFirebackRef.current?.(m.speakerId, targetId, m.text, severity); }, 1200);
        }
        tryModeratorRetortRef.current?.(m.speakerId, m.text);
      }
      // Decay chain after 30 s of calm
      if (Date.now() - lastFirebackAtRef.current > 30000) firebackChainRef.current = 0;
    }
  }, [enqueueTTS, interviewerId, intervieweeId, runFactCheck]);

  /** Arena-style interruption audio: ducks the current speaker to 10%, plays the
   *  interrupt at full persona volume, then restores the main speaker to 100%.
   *  Does NOT go through the TTS queue — fires concurrently with whatever is playing. */
  const playInterruptionAudio = useCallback(async (text: string, personaId: string) => {
    if (!voiceEnabledRef.current) return;
    if (shouldSkipPersonaVoice(personaId)) return;
    // Interrupter plays at the same volume as any other speaker
    setActiveSpeaker(personaId);
    activeSpeakerRef.current = personaId;
    try {
      const interruptVolume = getPersonaVoiceVolume(personaId);
      const sound = await playTTS("/api/persona-speak", { text, personaId }, { volume: interruptVolume });
      let cleaned = false;
      const cleanup = () => {
        if (cleaned) return; cleaned = true;
        sound.setOnPlaybackStatusUpdate(null);
        sound.getStatusAsync().then((st: any) => { if (st.isLoaded) sound.stopAsync().then(() => sound.unloadAsync()).catch(() => {}); }).catch(() => {});
        setActiveSpeaker(activeSpeakerRef.current);
      };
      // Dynamic safety timeout: start at 12 s to cover slow TTS fetches.
      // Once the clip is playing and duration is known, reset to duration + 4 s
      // so short one-liners (< 1 s) are never silenced by the flat safety window.
      let safetyTimer: ReturnType<typeof setTimeout> = setTimeout(cleanup, 12000);
      sound.setOnPlaybackStatusUpdate((status: any) => {
        if (status.didJustFinish || status.error) {
          clearTimeout(safetyTimer);
          cleanup();
        } else if (status.isPlaying && (status as any).durationMillis && !cleaned) {
          clearTimeout(safetyTimer);
          safetyTimer = setTimeout(cleanup, (status as any).durationMillis + 4000);
        }
      });
    } catch {}
  }, []);

  // ── FIREBACK ENGINE ───────────────────────────────────────────────────────
  // When a debater's line crosses the insult threshold for the opponent,
  // this fires a concurrent AI-generated comeback at the 50ms overlap point —
  // ducking the current speaker to 10% and playing the retort at full volume.
  const tryFireback = useCallback(async (
    attackerId: string,
    targetId: string,
    attackText: string,
    severity: number,
  ) => {
    if (!runningRef.current || !deviceId) return;
    // A persona cannot fire at itself — happens when the target is already mid-turn.
    if (!attackerId || !targetId || attackerId === targetId) return;
    // Never duck or interrupt the moderator.
    if (moderatorSpeakingRef.current) return;
    // Target is currently speaking their own regular turn — don't self-interrupt them.
    if (targetId === activeSpeakerRef.current) return;
    const { aggression, angerThresh, maxChain } = getAggression(targetId);
    heatRef.current[targetId] = (heatRef.current[targetId] ?? 0) + severity;
    // Mirror heat into React state so the heat pill re-renders
    const newHeat = heatRef.current[targetId];
    if (targetId === interviewerId) setHeatA(Math.min(newHeat, angerThresh));
    else if (targetId === intervieweeId) setHeatB(Math.min(newHeat, angerThresh));
    if (heatRef.current[targetId] < angerThresh) return;
    // In squabble cooldown — block new fireback chains for 90 s after an escalation
    if (Date.now() < squabbleCooldownUntilRef.current) return;
    const now = Date.now();
    if (now - lastFirebackAtRef.current < 7000) return;       // min 7 s gap

    // ── SQUABBLE ESCALATION: chain maxed out → physical threat + moderator intervention ──
    if (firebackChainRef.current >= maxChain) {
      heatRef.current[targetId] = 0;
      if (targetId === interviewerId) setHeatA(0);
      else if (targetId === intervieweeId) setHeatB(0);
      lastFirebackAtRef.current = now;
      squabbleCooldownUntilRef.current = now + 90000; // 90 s cooldown
      firebackChainRef.current = 0;
      try {
        const targetName = targetId === interviewerId ? interviewer?.name ?? targetId : interviewee?.name ?? targetId;
        const threats = PERSONA_SQUABBLE_THREATS[targetId] ?? PERSONA_SQUABBLE_THREATS["_default"];
        const threatLine = threats[Math.floor(Math.random() * threats.length)];
        // Add threat to transcript (audio via playInterruptionAudio)
        setMessages((prev) => [...prev, {
          id: `sq-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          speakerId: targetId,
          speakerName: targetName,
          text: threatLine,
          ts: Date.now(),
          isInterruption: true,
          skipTTS: true,
        }]);
        await new Promise<void>((r) => setTimeout(r, 50));
        await playInterruptionAudio(threatLine, targetId);
        // Moderator forcibly intervenes after the physical threat.
        // Route through the TTS queue (blockEarlyResolve=true) so the moderator
        // always finishes completely before any persona can speak again.
        if (runningRef.current) {
          const mod = MODERATORS[moderatorStyle];
          if (mod) {
            // Helper: enqueue a moderator line, add it to the transcript, and wait
            // for it to fully finish before proceeding — personas cannot cut in.
            const speakModQueued = (text: string) => {
              setModeratorSpeaking(true);
              moderatorSpeakingRef.current = true;
              setModeratorLastLine(text);
              setMessages((prev) => [...prev, {
                id: `sq-mod-${Date.now()}-${Math.random()}`,
                speakerId: mod.personaId,
                speakerName: mod.name,
                text,
                ts: Date.now(),
              }]);
              return new Promise<void>((resolve) => {
                enqueueTTS(text, mod.personaId, `sq-mod-${Date.now()}`, {
                  blockEarlyResolve: true,
                  onComplete: () => {
                    moderatorSpeakingRef.current = false;
                    setModeratorSpeaking(false);
                    resolve();
                  },
                });
              });
            };
            const modLine = localJab("squabble");
            await speakModQueued(modLine);
            // ── SQUABBLE TOPIC ADVANCE: force a topic switch so the loop can't restart ──
            // Advance to the next topic (if one exists), reset exchange counter, then
            // speak a short "moving on" bridge so the transition feels intentional.
            if (runningRef.current) {
              const liveTopics = topicsRef.current;
              const currentIdx = topicIdxRef.current;
              const nextIdx = currentIdx + 1 < liveTopics.length ? currentIdx + 1 : currentIdx;
              if (nextIdx !== currentIdx) {
                topicIdxRef.current = nextIdx;
                setTopicIdx(nextIdx);
                exchangesOnTopicRef.current = 0;
                // ── Show TIME-OUT banner ──────────────────────────────────
                if (timeoutBannerTimerRef.current) clearTimeout(timeoutBannerTimerRef.current);
                setShowTimeoutBanner(true);
                timeoutBannerTimerRef.current = setTimeout(() => setShowTimeoutBanner(false), 3000);
                // ─────────────────────────────────────────────────────────
                const bridgeLine = getSquabbleBridge(
                  moderatorStyle,
                  [interviewerId!, intervieweeId!],
                  [interviewer?.name ?? interviewerId!, interviewee?.name ?? intervieweeId!],
                );

                // ── BRIDGE + FILLER: mirror rebuttal STEP 3+4 ───────────────────────────
                // Kick off the next moderator question AI fetch while the bridge TTS
                // plays. If the bridge finishes before the response arrives, filler
                // lines hold the room rather than leaving dead air.
                // Null guard: if the fetch settles immediately with nothing, the bridge
                // is skipped rather than spoken into silence.
                const nextTarget = moderatorTargetRef.current === "A" ? interviewerId! : intervieweeId!;
                const nextTargetName = nextTarget === interviewerId
                  ? spokenName(interviewerId ?? undefined, interviewer?.name ?? "", mod.personaId)
                  : spokenName(intervieweeId ?? undefined, interviewee?.name ?? "", mod.personaId);
                const nextTopic = topicsRef.current[nextIdx];

                // Filler-safe wrapper: stops early if the debate is stopped.
                const speakModQueuedFiller = (text: string): Promise<void> => {
                  let ivId: ReturnType<typeof setInterval> | null = null;
                  return Promise.race([
                    speakModQueued(text),
                    new Promise<void>((res) => {
                      ivId = setInterval(() => {
                        if (!runningRef.current) { clearInterval(ivId!); ivId = null; res(); }
                      }, 50);
                    }),
                  ]).finally(() => { if (ivId !== null) clearInterval(ivId); });
                };

                // Pre-fetch the first filler audio NOW, while the bridge TTS plays —
                // same zero-gap pattern as the primary/rebuttal filler prefetch.
                const firstSquabbleFiller = getWaitFiller(nextTargetName);
                startPrefetch({ text: firstSquabbleFiller, personaId: mod.personaId });

                let nextQuestionDone = false;
                let nextQuestion: string | null = null;
                const nextQuestionFetch = generateModeratorQuestion({
                  deviceId,
                  moderatorStyle,
                  targetId: nextTarget,
                  topic: nextTopic,
                  isTransition: false,
                  conversationHistory: messagesRef.current.filter((m) => !m.isSystem).slice(-4),
                }).then((q) => { nextQuestion = q || null; nextQuestionDone = true; })
                  .catch(() => { nextQuestionDone = true; });

                await Promise.all([
                  nextQuestionFetch,
                  (async () => {
                    // One microtask flush: if the fetch already settled (fast connection
                    // or cache hit) and returned null, skip the bridge rather than
                    // speaking into silence.
                    await Promise.resolve();
                    if (nextQuestionDone && !nextQuestion) return; // null guard
                    if (!runningRef.current) return;
                    // ── FILLER between jab and bridge (STEP 2.5) ─────────────────
                    // On slow connections the bridge TTS may not have started
                    // streaming yet; one filler line prevents dead air here —
                    // mirrors the post-bridge filler at STEP 3+4.
                    await speakModQueuedFiller(getWaitFiller(nextTargetName));
                    // ─────────────────────────────────────────────────────────────
                    if (!runningRef.current) return;
                    await speakModQueued(bridgeLine);
                    // Bridge finished — filler until the question AI response arrives.
                    // First filler uses the pre-fetched text (cache hit = no gap).
                    let firstSquabbleFill = true;
                    while (!nextQuestionDone && runningRef.current) {
                      const fillerText = firstSquabbleFill ? firstSquabbleFiller : getWaitFiller(nextTargetName);
                      firstSquabbleFill = false;
                      await speakModQueuedFiller(fillerText);
                    }
                  })(),
                ]);
                // Hand the pre-fetched question to the main loop so it plays immediately.
                if (nextQuestion) {
                  prefetchedOpeningRef.current = nextQuestion;
                  // Also pre-fetch the primary answer so the new round starts with
                  // zero dead air — by the time the moderator finishes reading the
                  // question aloud the answer will already be in-flight / resolved.
                  prefetchedPrimaryAnswerRef.current = fetchAnswerFrom(mod.personaId, nextTarget, nextQuestion);
                  // Chain: once the primary answer text arrives, immediately kick off
                  // the rebuttal fetch too — it runs while the moderator plays the
                  // new round's question, eliminating the gap before the rebuttal speaks.
                  const nextSecondary = nextTarget === interviewerId ? intervieweeId! : interviewerId!;
                  prefetchedRebuttalAnswerRef.current = prefetchedPrimaryAnswerRef.current.then(
                    (ans) => (ans?.text && runningRef.current
                      ? fetchAnswerFrom(nextTarget, nextSecondary, ans.text)
                      : null),
                  ).catch(() => null);
                }
                // ────────────────────────────────────────────────────────────────────────
              } else {
                // Already on the last topic — end the debate rather than limping
                // along on an exhausted topic with a 90 s cooldown in effect.
                const closerLine = getSquabbleCloser(moderatorStyle);
                await speakModQueued(closerLine);
                // Signal the run-loop to stop — it will call setPhase("ended") on exit.
                sessionEndsAtRef.current = Date.now();
              }
            }
            // ─────────────────────────────────────────────────────────────────────
          }
        }
      } catch { /* never break the debate loop */ }
      return;
    }

    if (Math.random() > aggression) return;                    // probabilistic
    // Commit — reset heat and trigger the "FIRING BACK" flash
    heatRef.current[targetId] = 0;
    if (targetId === interviewerId) {
      setHeatA(0);
      setFirebackFlashA(true);
      setTimeout(() => setFirebackFlashA(false), 2000);
    } else if (targetId === intervieweeId) {
      setHeatB(0);
      setFirebackFlashB(true);
      setTimeout(() => setFirebackFlashB(false), 2000);
    }
    firebackChainRef.current += 1;
    lastFirebackAtRef.current = now;
    try {
      const findDebaterName = (id: string) =>
        [...interviewers, ...interviewees].find((p) => p.id === id)?.name ?? id;
      const attackerName = findDebaterName(attackerId);
      const targetName   = findDebaterName(targetId);
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
      if (!res.ok || !runningRef.current) return;
      const data = await res.json();
      const firebackText: string = (data.text || "").trim();
      if (!firebackText) return;
      // Add to transcript (skipTTS — audio plays via playInterruptionAudio)
      setMessages((prev) => [...prev, {
        id: `fb-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        speakerId: targetId,
        speakerName: targetName,
        text: firebackText,
        ts: Date.now(),
        isInterruption: true,
        skipTTS: true,
      }]);
      // 50 ms overlap — duck current speaker, fire retort
      await new Promise<void>((r) => setTimeout(r, 50));
      await playInterruptionAudio(firebackText, targetId);
      // Chain: if the fireback itself was insulting, the original attacker may fire back
      const retalSeverity = detectInsult(firebackText);
      if (retalSeverity >= 2 && runningRef.current) {
        setTimeout(() => { tryFirebackRef.current?.(targetId, attackerId, firebackText, retalSeverity); }, 2000);
      } else {
        setTimeout(() => { firebackChainRef.current = Math.max(0, firebackChainRef.current - 1); }, 18000);
      }
    } catch { /* never break the main debate loop */ }
  }, [deviceId, interviewerId, intervieweeId, interviewers, interviewees, moderatorStyle, enqueueTTS, playInterruptionAudio]);

  // Sync ref so the recursive chain call always uses the latest closure
  useEffect(() => { tryFirebackRef.current = tryFireback; }, [tryFireback]);

  // Moderator retort — fires when a debater addresses / attacks the moderator directly
  const tryModeratorRetort = useCallback((speakerId: string, text: string) => {
    const mod = MODERATORS[moderatorStyle];
    if (!mod || !runningRef.current) return;
    const modFirstName = mod.name.split(" ")[0].toLowerCase();
    const lower = text.toLowerCase();
    if (!lower.includes(modFirstName) && !lower.includes("moderator") && !lower.includes("this host") && !lower.includes("you're biased") && !lower.includes("you are biased")) return;
    const severity = detectInsult(text);
    if (severity < 1) return;
    const now = Date.now();
    if (now - lastModReactionAtRef.current < 14000) return;
    lastModReactionAtRef.current = now;
    // Tiered static retorts — escalate with severity so the moderator hits back harder
    // when the insult is more severe.
    const tier1 = [
      "Excuse me — you do NOT get to attack me. I ask the questions. You answer them. That's the deal.",
      "I'm going to stop you right there. You're attacking the moderator, which tells me you have no real answer.",
      "I don't know who told you that was okay, but they were wrong. Move on.",
      "Let's keep this civil. One more crack like that and your mic goes dark.",
    ];
    const tier2 = [
      "Did you just come at ME? I will cut your microphone and we will sit here in silence until you learn some respect.",
      "I'm sorry — are you attacking the host on live television? That is a new low, even for someone with your track record.",
      "That mouth is writing checks your arguments can't cash. Answer the question.",
      "Back off. You're a guest in this debate. Keep it up and your mic is done for the night.",
      "I've moderated for thirty years and you are the most disrespectful debater I've ever had on this stage.",
    ];
    const tier3 = [
      "Let me be crystal clear: you are ONE second from being removed from this debate. Shut your mouth and answer the question.",
      "You want to come at ME? I RUN this show. One more word out of line and this debate is OVER. Your choice.",
      "You are embarrassing yourself in front of millions of people right now. Grow up — and answer the QUESTION.",
      "I have ended debates for less than this. You have three seconds to compose yourself or you are DONE.",
      "That is the most disrespectful thing I've ever heard said to a moderator. You've just made a very powerful enemy. Answer the question.",
    ];
    const pool = severity >= 3 ? tier3 : severity >= 2 ? tier2 : tier1;
    const retort = pool[Math.floor(Math.random() * pool.length)];

    const personaName = [...interviewers, ...interviewees].find((p) => p.id === speakerId)?.name || "this debater";

    setTimeout(() => {
      if (!runningRef.current) return;
      setModeratorLastLine(retort);
      const msgId = `modret-${Date.now()}`;
      // onStart: add to transcript when audio actually plays (ordering fix)
      enqueueTTS(retort, mod.personaId, msgId, {
        blockEarlyResolve: true,
        onStart: () => setMessages((prev) => [...prev, {
          id: msgId, speakerId: mod.personaId, speakerName: mod.name, text: retort, ts: Date.now(),
        }]),
      });

      // For severity 2+, also fetch an AI-personalized follow-up and queue it
      // after the static retort finishes — giving the moderator a devastating two-punch combo.
      if (severity >= 2) {
        fetch(new URL("/api/arena/moderator-retort", getApiUrl()).toString(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ provocation: text, moderatorName: mod.name, severity, personaName }),
        }).then(async (r) => {
          if (!r.ok || !runningRef.current) return;
          const data = await r.json();
          if (!data.retort || !runningRef.current) return;
          const followId = `modret-ai-${Date.now()}`;
          setModeratorLastLine(data.retort);
          enqueueTTS(data.retort, mod.personaId, followId, {
            blockEarlyResolve: true,
            onStart: () => setMessages((prev) => [...prev, {
              id: followId, speakerId: mod.personaId, speakerName: mod.name, text: data.retort, ts: Date.now(),
            }]),
          });
        }).catch(() => {});
      }
    }, 900);
  }, [moderatorStyle, enqueueTTS, interviewers, interviewees]);

  useEffect(() => { tryModeratorRetortRef.current = tryModeratorRetort; }, [tryModeratorRetort]);
  // ─────────────────────────────────────────────────────────────────────────

  // Load persona lists
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(new URL("/api/arena/interview-personas", getApiUrl()).toString());
        if (res.ok) {
          const data = await res.json();
          setInterviewers(data.interviewers || []);
          setInterviewees(data.interviewees || []);
          if (!interviewerId && data.interviewers?.[0]) setInterviewerId(data.interviewers[0].id);
          if (!intervieweeId && data.interviewees?.[0]) setIntervieweeId(data.interviewees[0].id);
        }
      } catch {}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchLieTally = useCallback(async () => {
    if (!deviceId) return;
    try {
      const res = await fetch(new URL("/api/arena/interview-lie-tally", getApiUrl()).toString(), {
        headers: { "x-device-id": deviceId },
      });
      if (res.ok) setLieTally(await res.json());
    } catch {}
  }, [deviceId]);

  useEffect(() => { fetchLieTally(); }, [fetchLieTally]);

  // Fetch all-personas global records; called on mount and after each debate ends.
  const fetchAllPersonaRecords = useCallback(async () => {
    try {
      const res = await fetch(new URL("/api/arena/all-records", getApiUrl()).toString());
      if (res.ok) setAllPersonaRecords(await res.json());
    } catch {}
  }, []);

  useEffect(() => { fetchAllPersonaRecords(); }, [fetchAllPersonaRecords]);

  // Fetch head-to-head and per-persona W/L records for both debaters.
  // Called on mount (when IDs are known) and refreshed after each debate ends.
  const fetchDebateRecord = useCallback(async () => {
    if (!interviewerId || !intervieweeId) return;
    try {
      const url = new URL("/api/arena/debate-record", getApiUrl());
      url.searchParams.set("personaA", interviewerId);
      url.searchParams.set("personaB", intervieweeId);
      const headers: Record<string, string> = {};
      if (deviceId) headers["x-device-id"] = deviceId;
      const res = await fetch(url.toString(), { headers });
      if (res.ok) setDebateRecords(await res.json());
    } catch {}
  }, [interviewerId, intervieweeId, deviceId]);

  // Keep stable refs so the runLoop can call them after recording the result.
  useEffect(() => { fetchDebateRecordRef.current = fetchDebateRecord; }, [fetchDebateRecord]);
  useEffect(() => { fetchAllPersonaRecordsRef.current = fetchAllPersonaRecords; }, [fetchAllPersonaRecords]);
  // Initial fetch + re-fetch whenever the matchup changes.
  useEffect(() => { fetchDebateRecord(); }, [fetchDebateRecord]);
  // Refresh record display once the debate ends (win/loss just recorded).
  useEffect(() => {
    if (phase === "ended") {
      setTimeout(() => {
        fetchDebateRecord();
        fetchAllPersonaRecords();
      }, 800);
    }
  }, [phase, fetchDebateRecord, fetchAllPersonaRecords]);

  const HOF_CACHE_MS = 5 * 60 * 1000; // 5-minute cooldown between background re-fetches
  const fetchHallOfFame = useCallback(async (force = false) => {
    if (!force && Date.now() - hofLastFetchedAtRef.current < HOF_CACHE_MS) return;
    setHofLoading(true);
    try {
      const headers: Record<string, string> = {};
      if (deviceId) headers["x-device-id"] = deviceId;
      const res = await fetch(`${getApiUrl()}/api/arena/hall-of-fame`, { headers });
      if (res.ok) {
        setHofData(await res.json());
        hofLastFetchedAtRef.current = Date.now();
      }
    } catch {}
    setHofLoading(false);
  }, [deviceId]);
  // Fetch on mount (force=true so the initial load always runs)
  useEffect(() => { fetchHallOfFame(true); }, [fetchHallOfFame]);
  // Re-fetch with cooldown whenever the setup/picker screen becomes visible
  useEffect(() => { if (phase === "setup") fetchHallOfFame(); }, [phase, fetchHallOfFame]);
  // Re-fetch when the app returns to the foreground while on the setup screen
  // (phase doesn't change in this case, so the effect above won't fire)
  useEffect(() => {
    const sub = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active" && phase === "setup") {
        fetchHallOfFame();
      }
    });
    return () => sub.remove();
  }, [phase, fetchHallOfFame]);

  const interviewer = useMemo(() => interviewers.find((p) => p.id === interviewerId) || interviewees.find((p) => p.id === interviewerId) || null, [interviewers, interviewees, interviewerId]);
  const interviewee = useMemo(() => interviewees.find((p) => p.id === intervieweeId) || interviewers.find((p) => p.id === intervieweeId) || null, [interviewees, interviewers, intervieweeId]);
  // Debate Stage is a symmetric 1-on-1 debate: both slots draw from the same combined
  // persona pool, unlike the Interview screen where interviewer/guest are distinct roles.
  // Map personaId → HoF rank (1-indexed) for top-10 personas with ≥5 debates
  const hofRankMap = useMemo<Record<string, { rank: number; winPct: number }>>(() => {
    if (!hofData?.leaderboard) return {};
    const map: Record<string, { rank: number; winPct: number }> = {};
    hofData.leaderboard.forEach((e, i) => { map[e.personaId] = { rank: i + 1, winPct: e.winPct }; });
    return map;
  }, [hofData]);

  const debaterPool = useMemo(() => {
    const seen = new Set<string>();
    const combined: PersonaLite[] = [];
    for (const p of [...interviewers, ...interviewees]) {
      if (!seen.has(p.id)) { seen.add(p.id); combined.push(p); }
    }
    return combined;
  }, [interviewers, interviewees]);

  const handleHofShare = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setHofShareLoading(true);

    // Always fetch fresh data so the share message reflects the live leaderboard.
    let freshData: typeof hofData = null;
    try {
      const headers: Record<string, string> = {};
      if (deviceId) headers["x-device-id"] = deviceId;
      const res = await fetch(`${getApiUrl()}/api/arena/hall-of-fame`, { headers });
      if (res.ok) {
        freshData = await res.json();
        setHofData(freshData);
        hofLastFetchedAtRef.current = Date.now();
      }
    } catch {}

    // Use fresh data if available; fall back to the last cached snapshot.
    const data = freshData ?? hofData;

    try {
      const top = data?.leaderboard?.slice(0, 3) ?? [];
      let msg = "🏆 Debate Hall of Fame on The Arena\n\n";
      if (top.length > 0) {
        top.forEach((entry, i) => {
          const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉";
          const pName = debaterPool.find((p) => p.id === entry.personaId)?.name || entry.personaId;
          msg += `${medal} ${pName} — ${entry.winPct}% win rate\n`;
        });
        const leader = debaterPool.find((p) => p.id === top[0].personaId)?.name || top[0].personaId;
        msg += `\n${leader} leads the arena — come debate them! 👉 https://thearena.rip/arena`;
      } else {
        // Fallback only when the leaderboard is genuinely empty (0 entries)
        msg += "Rankings are heating up — come debate your picks! 👉 https://thearena.rip/arena";
      }
      await Share.share({ message: msg, url: "https://thearena.rip/arena" });
    } catch {}

    setHofShareLoading(false);
  }, [hofData, debaterPool, deviceId]);

  const handlePersonaHofShare = useCallback(async (
    pName: string,
    winPct: number,
    totalWins: number,
    totalLosses: number,
    rank: number,
    rivalName?: string | null,
    bestRivalWins?: number,
    personaId?: string,
    portrait?: any,
  ) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Web: plain text share (ViewShot not supported on web)
    if (Platform.OS === "web") {
      try {
        const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `#${rank}`;
        let msg = `🏆 ${pName} is ${medal} in the Debate Hall of Fame on The Arena!\n`;
        msg += `📊 ${winPct}% win rate · ${totalWins}W–${totalLosses}L`;
        if (rivalName && bestRivalWins) {
          msg += `\n💪 Dominates ${rivalName.split(" ")[0]} (${bestRivalWins}× wins)`;
        }
        const pid = personaId || pName.toLowerCase().replace(/\s+/g, "");
        const arenaUrl = `https://thearena.rip/arena?persona=${encodeURIComponent(pid)}`;
        msg += `\nCome debate them 👉 ${arenaUrl}`;
        await Share.share({ message: msg, url: arenaUrl });
      } catch {}
      return;
    }

    // Native: capture the stats card as an image and share it
    try {
      setHofCardData({
        personaId: personaId || pName.toLowerCase(),
        name: pName,
        rank,
        winPct,
        wins: totalWins,
        losses: totalLosses,
        portrait,
        rivalName,
        bestRivalWins,
      });

      // Give React a tick to mount/update the off-screen card
      await new Promise<void>((resolve) => setTimeout(resolve, 100));

      if (!personaStatsCardRef.current) throw new Error("card ref not ready");

      const uri = await captureRef(personaStatsCardRef.current, {
        format: "png",
        quality: 1,
        result: "tmpfile",
      });

      const Sharing = await import("expo-sharing");
      const canShare = await Sharing.isAvailableAsync();
      const pid = personaId || pName.toLowerCase().replace(/\s+/g, "");
      const arenaUrl = `https://thearena.rip/arena?persona=${encodeURIComponent(pid)}`;
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: "image/png",
          dialogTitle: `${pName} · Debate Hall of Fame`,
        });
      } else {
        // Fallback: share the file URI as a message
        await Share.share({ message: arenaUrl, url: uri });
      }
    } catch {
      // Final fallback: text share
      try {
        const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `#${rank}`;
        let msg = `🏆 ${pName} is ${medal} in the Debate Hall of Fame on The Arena!\n`;
        msg += `📊 ${winPct}% win rate · ${totalWins}W–${totalLosses}L`;
        if (rivalName && bestRivalWins) {
          msg += `\n💪 Dominates ${rivalName.split(" ")[0]} (${bestRivalWins}× wins)`;
        }
        const pid2 = personaId || pName.toLowerCase().replace(/\s+/g, "");
        const arenaUrl = `https://thearena.rip/arena?persona=${encodeURIComponent(pid2)}`;
        msg += `\nCome debate them 👉 ${arenaUrl}`;
        await Share.share({ message: msg, url: arenaUrl });
      } catch {}
    } finally {
      setHofCardData(null);
    }
  }, []);

  // If a debater is selected that matches the moderator, auto-pick a different moderator.
  // If the moderator is later selected as a debater, clear that debater slot.
  useEffect(() => {
    const modPersonaId = MODERATORS[moderatorStyle]?.personaId;
    if (modPersonaId && interviewerId === modPersonaId) setInterviewerId(null);
    if (modPersonaId && intervieweeId === modPersonaId) setIntervieweeId(null);
  }, [moderatorStyle]);

  useEffect(() => {
    const modPersonaId = MODERATORS[moderatorStyle]?.personaId;
    if (interviewerId && interviewerId === modPersonaId) {
      const fallback = (Object.keys(MODERATORS) as ModeratorStyle[]).find(
        ms => MODERATORS[ms].personaId !== interviewerId && MODERATORS[ms].personaId !== intervieweeId
      );
      if (fallback) setModeratorStyle(fallback);
    }
    if (intervieweeId && intervieweeId === modPersonaId) {
      const fallback = (Object.keys(MODERATORS) as ModeratorStyle[]).find(
        ms => MODERATORS[ms].personaId !== interviewerId && MODERATORS[ms].personaId !== intervieweeId
      );
      if (fallback) setModeratorStyle(fallback);
    }
  }, [interviewerId, intervieweeId]);

  const currentTopic = topics[topicIdx] || null;
  const currentTopicRef = useRef(currentTopic);
  useEffect(() => { currentTopicRef.current = currentTopic; }, [currentTopic]);

  const openInterviewPoll = useCallback(async () => {
    const currentT = topics[topicIdx];
    setShowPollModal(true);
    if (pollQuestion) return;
    setPollLoading(true);
    try {
      const r = await fetch(new URL("/api/arena/poll-question", getApiUrl()).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: currentT?.title || "This interview",
          personas: [interviewer?.name, interviewee?.name].filter(Boolean),
        }),
      });
      if (r.ok) {
        const data = await r.json();
        setPollQuestion(data);
        setPollVoteA(0); setPollVoteB(0); setMyPollVote(null);
      }
    } catch {}
    finally { setPollLoading(false); }
  }, [topics, topicIdx, pollQuestion, interviewer, interviewee]);

  const castInterviewVote = useCallback(async (side: "A" | "B") => {
    if (myPollVote) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setMyPollVote(side);
    if (side === "A") setPollVoteA((p) => p + 1); else setPollVoteB((p) => p + 1);
  }, [myPollVote]);

  const shareInterviewPoll = useCallback(async () => {
    if (!pollQuestion) return;
    const totalVotes = pollVoteA + pollVoteB;
    const pctA = totalVotes > 0 ? Math.round((pollVoteA / totalVotes) * 100) : 50;
    const pctB = 100 - pctA;
    const tags = pollQuestion.hashtags?.map((h: string) => `#${h}`).join(" ") || "#TheArena #Poll";
    const msg = `🗳️ LIVE POLL — The Arena\n\n"${pollQuestion.question}"\n\n🅰️ ${pollQuestion.optionA} — ${pctA}%\n🅱️ ${pollQuestion.optionB} — ${pctB}%\n\n${tags}\n\nVote live on The Arena 👇\nthearena.rip`;
    try {
      if (Platform.OS === "web" && navigator.share) await navigator.share({ title: "Live Poll", text: msg });
      else await Share.share({ message: msg, title: "Live Poll" });
    } catch {}
  }, [pollQuestion, pollVoteA, pollVoteB]);

  const FALLBACK_TOPICS: Topic[] = [
    { id: "fb_1", title: "Economic inequality and who's responsible for fixing it", description: "Wages, wealth gaps, corporate power, and government's role", era: "current" },
    { id: "fb_2", title: "Immigration — open borders vs. strict enforcement", description: "Border policy, asylum, undocumented workers, national identity", era: "current" },
    { id: "fb_3", title: "The media — watchdog or propaganda machine?", description: "Bias, misinformation, corporate ownership, and press freedom", era: "current" },
    { id: "fb_4", title: "Race in America — systemic problem or personal responsibility?", description: "Policing, opportunity gaps, reparations, and cultural narratives", era: "current" },
    { id: "fb_5", title: "Foreign policy — America First or global leadership?", description: "NATO, wars, alliances, and the cost of intervention", era: "current" },
  ];

  // Tracks the AbortController for the most recent generateTopics call so we can
  // cancel it when a new call supersedes it (e.g. user swaps personas mid-retry).
  const generateTopicsAbortRef = useRef<AbortController | null>(null);
  // Monotonically-incrementing generation counter: each call bumps it and checks
  // at every async boundary that it is still the latest call before writing state.
  const generateTopicsGenRef = useRef(0);

  const generateTopics = useCallback(async () => {
    if (!interviewerId || !intervieweeId) return;

    // Cancel any in-flight previous call.
    generateTopicsAbortRef.current?.abort();
    const abortController = new AbortController();
    generateTopicsAbortRef.current = abortController;

    // Capture the generation for this call; stale calls bail out before touching state.
    const generation = ++generateTopicsGenRef.current;

    setTopicsLoading(true);
    setTopicsError(false);
    setTopicsAreFallback(false);
    setTopics([]);
    setTopicIdx(0);
    setSelectedTopicId(null);
    setCompletedTopics(new Set());
    const timeoutId = setTimeout(() => abortController.abort(), 60000);
    try {
      const res = await fetch(new URL("/api/arena/interview-topics", getApiUrl()).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interviewerId, intervieweeId, topicMix, durationMinutes: duration, interviewStyle, category }),
        signal: abortController.signal,
      });
      // Discard result if a newer call has already started.
      if (generation !== generateTopicsGenRef.current) return;
      if (res.ok) {
        const data = await res.json();
        if (generation !== generateTopicsGenRef.current) return;
        const loaded = data.topics || [];
        if (loaded.length > 0) {
          setTopics(loaded);
          setTopicsAreFallback(false);
        } else if (FALLBACK_TOPICS.length > 0) {
          setTopics(FALLBACK_TOPICS);
          setTopicsAreFallback(true);
        } else {
          setTopicsError(true);
        }
      } else if (FALLBACK_TOPICS.length > 0) {
        setTopics(FALLBACK_TOPICS);
        setTopicsAreFallback(true);
      } else {
        setTopicsError(true);
      }
    } catch (err: unknown) {
      // Discard result if a newer call has already started.
      if (generation !== generateTopicsGenRef.current) return;
      // Timed out (AbortError) or hard network failure — show error state so users can retry.
      // We deliberately don't use the fallback here: the request never completed, so we
      // can't know whether the server is reachable; the user must explicitly retry.
      const isAbort = err instanceof Error && err.name === "AbortError";
      const isNetworkErr = err instanceof TypeError; // fetch throws TypeError on network failure
      if (isAbort || isNetworkErr) {
        setTopicsError(true);
      } else if (FALLBACK_TOPICS.length > 0) {
        // Unexpected JS error — fall back gracefully
        setTopics(FALLBACK_TOPICS);
        setTopicsAreFallback(true);
      } else {
        setTopicsError(true);
      }
    } finally {
      clearTimeout(timeoutId);
      // Only clear the loading spinner if this is still the active call.
      if (generation === generateTopicsGenRef.current) {
        setTopicsLoading(false);
      }
    }
  }, [interviewerId, intervieweeId, topicMix, duration, interviewStyle]);

  // Auto-generate when pairing/duration/style changes
  useEffect(() => {
    if (interviewerId && intervieweeId && phase === "setup") {
      generateTopics();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interviewerId, intervieweeId, topicMix, duration, interviewStyle]);

  // Show a soft "still working…" warning after 7 s of topicsLoading
  useEffect(() => {
    if (!topicsLoading) {
      setTopicsSlowWarning(false);
      return;
    }
    const t = setTimeout(() => setTopicsSlowWarning(true), 7000);
    return () => clearTimeout(t);
  }, [topicsLoading]);

  // Countdown
  useEffect(() => {
    if (phase !== "live") return;
    timerRef.current = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((sessionEndsAtRef.current - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining <= 0) {
        runningRef.current = false;
        setPhase("ended");
      }
    }, 500);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [phase]);

  const addMessage = useCallback((m: Msg) => {
    setMessages((prev) => [...prev, m]);
  }, []);

  const fetchQuestion = useCallback(async (opts: { isFollowUp?: boolean; isTransition?: boolean; previousTopicTitle?: string; isInterruption?: boolean; currentTopicArg?: Topic | null }) => {
    if (!deviceId || !interviewerId || !intervieweeId) return null;
    const topicArg = opts.currentTopicArg !== undefined ? opts.currentTopicArg : currentTopic;
    try {
      const res = await fetch(new URL("/api/arena/interview-question", getApiUrl()).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-device-id": deviceId },
        body: JSON.stringify({
          interviewerId, intervieweeId,
          topic: topicArg,
          conversationHistory: messagesRef.current.filter((m) => !m.isSystem).slice(-6),
          isFollowUp: !!opts.isFollowUp,
          isTransition: !!opts.isTransition,
          previousTopicTitle: opts.previousTopicTitle,
          isInterruption: !!opts.isInterruption,
          interviewStyle,
          // Debate stage: A and B are equal debaters, not host/guest — only the
          // moderator should be posing genuine "questions". See isDebate handling
          // in server/routes.ts.
          isDebate: true,
        }),
      });
      if (!res.ok) {
        if (res.status === 403) {
          // Only end the interview if client-side time has genuinely expired.
          // A transient server 403 mid-session should not cut the interview short.
          if (Date.now() >= sessionEndsAtRef.current) {
            runningRef.current = false;
            setPhase("ended");
          }
        }
        return null;
      }
      const data = await res.json();
      return data;
    } catch { return null; }
  }, [deviceId, interviewerId, intervieweeId, currentTopic]);

  const fetchAnswer = useCallback(async (lastQuestion: string, opts: { wasInterrupted?: boolean; interruptionText?: string; isInterruption?: boolean } = {}) => {
    if (!deviceId || !interviewerId || !intervieweeId) return null;
    try {
      const res = await fetch(new URL("/api/arena/interview-answer", getApiUrl()).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-device-id": deviceId },
        body: JSON.stringify({
          interviewerId, intervieweeId,
          topic: currentTopic,
          conversationHistory: messagesRef.current.filter((m) => !m.isSystem).slice(-6),
          lastQuestion,
          wasInterrupted: !!opts.wasInterrupted,
          interruptionText: opts.interruptionText,
          isInterruption: !!opts.isInterruption,
          interviewStyle: effectiveInterviewStyle,
          isDebate: true,
          // Let persona prompts reference their W/L record and H2H vs opponent
          debateRecord: debateRecordsRef.current ? {
            aId: interviewerId, bId: intervieweeId,
            aWins: debateRecordsRef.current.aWins, aLosses: debateRecordsRef.current.aLosses,
            bWins: debateRecordsRef.current.bWins, bLosses: debateRecordsRef.current.bLosses,
            h2hAWins: debateRecordsRef.current.h2hAWins, h2hBWins: debateRecordsRef.current.h2hBWins,
          } : null,
        }),
      });
      if (!res.ok) {
        if (res.status === 403) {
          // Only end if client-side time is also up — don't let a server blip kill the session
          if (Date.now() >= sessionEndsAtRef.current) {
            runningRef.current = false;
            setPhase("ended");
          }
        }
        return null;
      }
      return await res.json();
    } catch { return null; }
  }, [deviceId, interviewerId, intervieweeId, currentTopic, effectiveInterviewStyle]);

  // Generic answer fetch — used when the MODERATOR (not the other debater) is the questioner,
  // e.g. topic-opening questions that alternate between Debater A and Debater B.
  const fetchAnswerFrom = useCallback(async (questionerId: string, answererId: string, lastQuestion: string) => {
    if (!deviceId) return null;
    try {
      const res = await fetch(new URL("/api/arena/interview-answer", getApiUrl()).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-device-id": deviceId },
        body: JSON.stringify({
          interviewerId: questionerId, intervieweeId: answererId,
          topic: currentTopicRef.current,
          conversationHistory: messagesRef.current.filter((m) => !m.isSystem).slice(-6),
          lastQuestion,
          interviewStyle: effectiveInterviewStyle,
          isDebate: true,
          debateRecord: debateRecordsRef.current ? {
            aId: interviewerId, bId: intervieweeId,
            aWins: debateRecordsRef.current.aWins, aLosses: debateRecordsRef.current.aLosses,
            bWins: debateRecordsRef.current.bWins, bLosses: debateRecordsRef.current.bLosses,
            h2hAWins: debateRecordsRef.current.h2hAWins, h2hBWins: debateRecordsRef.current.h2hBWins,
          } : null,
        }),
      });
      if (res.status === 403) {
        runningRef.current = false;
        // If the 403 arrives within the final 20% of the session timer, the
        // server is simply closing out a nearly-finished session — end the
        // debate gracefully with the winner reveal instead of showing a paywall.
        const totalMs = sessionEndsAtRef.current - sessionStartedAtRef.current;
        const gracePeriodStart = sessionEndsAtRef.current - totalMs * 0.2;
        if (totalMs > 0 && Date.now() >= gracePeriodStart) {
          setPhase("ended");
        } else {
          setShowPaywall(true);
        }
        return null;
      }
      if (!res.ok) return null;
      return await res.json();
    } catch { return null; }
  }, [deviceId, effectiveInterviewStyle, setShowPaywall, setPhase]);

  // Alternates which debater the MODERATOR addresses at each new topic — 'A' or 'B' — so
  // both sides get equal question time from the moderator over the course of the debate.
  const moderatorTargetRef = useRef<"A" | "B">("A");

  // Queue moderator audio → wait for full playback → reset state.
  // Routes through enqueueTTSAndWait so the queue's natural ordering guarantees
  // the current speaker always finishes before the moderator starts.
  const speakMod = useCallback(async (text: string, msgId: string, opts?: { blockEarlyResolve?: boolean; skipTranscript?: boolean }) => {
    const mod = MODERATORS[moderatorStyle];
    if (!mod || !text || !runningRef.current) return;
    moderatorSpeakingRef.current = true;
    setModeratorSpeaking(true);
    setModeratorLastLine(text);

    // Build the transcript entry (skipped for audio-only fillers).
    const msgEntry = !opts?.skipTranscript
      ? { id: msgId, speakerId: mod.personaId, speakerName: mod.name, text, ts: Date.now() }
      : null;

    // Voice OFF: add to transcript immediately (no audio ordering to respect),
    //   then resolve the promise so the runLoop doesn't stall.
    // Voice ON: defer the transcript update to the onStart callback so the chat
    //   order exactly matches the order audio clips actually begin playing,
    //   preventing the "moderator line appears after persona dialog" inversion.
    await new Promise<void>((resolve) => {
      if (!voiceEnabledRef.current) {
        if (msgEntry) setMessages((prev) => [...prev, msgEntry]);
        resolve();
        return;
      }
      enqueueTTS(text, mod.personaId, msgId, {
        blockEarlyResolve: opts?.blockEarlyResolve ?? true,
        onComplete: resolve,
        onStart: msgEntry ? () => setMessages((prev) => [...prev, msgEntry]) : undefined,
      });
    });
    moderatorSpeakingRef.current = false;
    if (!runningRef.current) { setModeratorSpeaking(false); return; }
    setModeratorSpeaking(false);
  }, [moderatorStyle, enqueueTTS]);

  // Thin shim kept so startInterview / unlockSession don't need refactoring.
  // runLoop now handles the full structured debate flow including the first round.
  const runModeratorOpening = useCallback(async (_openTopic?: Topic | undefined, prefetchedQuestion?: string) => {
    moderatorTargetRef.current = "A";
    exchangesOnTopicRef.current = 0;
    prefetchedOpeningRef.current = prefetchedQuestion || "";
  }, []);

  // Throttle for moderator opinion injections (chastise/defend lie reactions) —
  // keeps the moderator from piling on every single lie flag, and enforces a
  // minimum gap between reactions so cut-ins land at natural pauses instead of
  // back-to-back on top of each other.
  const lastModReactionAtRef = useRef<number>(0);
  const MOD_REACTION_COOLDOWN_MS = 45000;
  const MOD_REACTION_CHANCE = 0.35;

  // Structured debate loop.
  // Each round: (1) moderator asks → (2) primary answers → (3) moderator "any rebuttal?" →
  // (4) secondary rebuts → (5) moderator short transition → pre-fetch next question → repeat.
  // speakMod drains the TTS queue before every moderator line, so persona audio ALWAYS
  // finishes before the moderator begins — the core guarantee that fixes turn ordering.
  const runLoop = useCallback(async () => {
    const mod = MODERATORS[moderatorStyle];
    if (!mod || !deviceId || !interviewerId || !intervieweeId) return;

    // Filler-safe wrapper: resolves as soon as speakMod finishes OR the debate
    // is stopped, whichever comes first.  Without this race, a long filler line
    // would play to completion even after the user hits Stop, because speakMod's
    // Promise only resolves via the TTS onComplete callback.
    const speakModFiller = (text: string, msgId: string): Promise<void> => {
      let intervalId: ReturnType<typeof setInterval> | null = null;
      return Promise.race([
        // skipTranscript: true — fillers are audio-only dead-air bridges.
        // Adding them to the transcript causes ordering inversions because the
        // primary/rebuttal TTS is pre-queued *before* the filler runs, so the
        // audio order is (answer → filler) but the transcript order would be
        // (filler → answer). Keeping fillers audio-only fixes that inversion.
        speakMod(text, msgId, { skipTranscript: true }),
        new Promise<void>((resolve) => {
          intervalId = setInterval(() => {
            if (!runningRef.current) {
              clearInterval(intervalId!);
              intervalId = null;
              resolve();
            }
          }, 50);
        }),
      ]).finally(() => {
        if (intervalId !== null) clearInterval(intervalId);
      });
    };

    while (runningRef.current && Date.now() < sessionEndsAtRef.current) {
      if (isPausedRef.current) { await new Promise((r) => setTimeout(r, 400)); continue; }
      if (!runningRef.current) break;

      const liveTopics = topicsRef.current;
      if (liveTopics.length === 0) { await new Promise((r) => setTimeout(r, 800)); continue; }

      const rawIdx = topicIdxRef.current;
      const idx = rawIdx < liveTopics.length ? rawIdx : 0;
      const topic = liveTopics[idx];

      // Alternate which debater the moderator addresses
      const side = moderatorTargetRef.current;
      moderatorTargetRef.current = side === "A" ? "B" : "A";
      const primaryId = side === "A" ? interviewerId : intervieweeId;
      const secondaryId = side === "A" ? intervieweeId : interviewerId;

      // Resolve TTS-safe spoken names for both debaters (used in bridge + question prefix).
      // Pass mod.personaId so context-aware overrides (e.g. Malcolm X) vary by moderator.
      const primaryName = primaryId === interviewerId
        ? spokenName(interviewerId, interviewer?.name ?? "", mod.personaId)
        : spokenName(intervieweeId, interviewee?.name ?? "", mod.personaId);
      const secondaryName = secondaryId === interviewerId
        ? spokenName(interviewerId, interviewer?.name ?? "", mod.personaId)
        : spokenName(intervieweeId, interviewee?.name ?? "", mod.personaId);

      // ── STEP 1: Moderator asks a question ──────────────────────────────────
      // Reuse pre-fetched question from previous round's transition (zero dead air).
      const prefetched = prefetchedOpeningRef.current;
      prefetchedOpeningRef.current = "";
      let modQuestion: string;
      if (prefetched) {
        modQuestion = prefetched;
      } else {
        setIsThinking("interviewer");
        modQuestion = await generateModeratorQuestion({
          deviceId, moderatorStyle, targetId: primaryId, topic,
          isTransition: false,
          conversationHistory: messagesRef.current.filter((m) => !m.isSystem).slice(-6),
        });
        setIsThinking(null);
      }
      if (!runningRef.current) break;
      if (!modQuestion) { await new Promise((r) => setTimeout(r, 600)); continue; }

      // Prefix the question with the addressed debater's name if not already present
      if (primaryName && !modQuestion.startsWith(primaryName)) {
        modQuestion = `${primaryName} — ${modQuestion.charAt(0).toLowerCase()}${modQuestion.slice(1)}`;
      }

      // ── STEP 1+2: Moderator asks + primary debater fetches answer in parallel ─
      // The primary answer fetch and audio prefetch run CONCURRENTLY with the
      // moderator question — eliminating dead air — but the persona TTS is NOT
      // enqueued until speakMod fully resolves. This prevents the prefetched
      // persona audio from bleeding into the tail of the moderator question on
      // slow connections, which was the same class of bug as the welcome overlap.
      //
      // Dead-air reduction: the moment the primary answer text arrives we ALSO
      // kick off the rebuttal fetch AND pre-fetch the persona TTS audio. By the
      // time speakMod resolves the audio is already buffered — zero gap.
      setIsThinking("interviewee");
      let primaryAnswer: Awaited<ReturnType<typeof fetchAnswerFrom>> = null;
      // Will hold the in-flight rebuttal fetch started during primary TTS playback
      let rebuttalFetchPromise: ReturnType<typeof fetchAnswerFrom> | null = null;
      // Use pre-fetched primary answer if it was started during the previous transition —
      // it has had an extra round's worth of time to resolve, eliminating dead air.
      const primaryAnswerPromise: Promise<any> =
        prefetchedPrimaryAnswerRef.current ?? fetchAnswerFrom(mod.personaId, primaryId, modQuestion);
      prefetchedPrimaryAnswerRef.current = null; // consume
      // primaryDone flips to true the moment the fetch settles — success OR failure.
      // The filler loop watches this flag, not the answer value, so a null result
      // (network error) still exits the loop instead of spinning forever.
      // Pre-fetch the first filler line's audio NOW, while the question is still
      // loading/playing. By the time speakMod(modQuestion) resolves the filler audio
      // is already cached — zero TTS network gap on the first filler call.
      const firstPrimaryFiller = getWaitFiller(primaryName);
      startPrefetch({ text: firstPrimaryFiller, personaId: mod.personaId });
      let primaryDone = false;
      await Promise.all([
        primaryAnswerPromise.then((ans) => {
          primaryAnswer = ans;
          primaryDone = true;
          setIsThinking(null);
          if (ans?.text && runningRef.current) {
            // Pre-fetch TTS AUDIO immediately when text arrives — runs while moderator
            // audio is still playing so audio is ready the moment the question ends.
            startPrefetch({ text: ans.text, personaId: primaryId });
            // PRE-PUSH into the TTS queue right now so processQueue has the item
            // ready the instant the moderator question clip ends — zero dead air.
            // enrichAndAddMessage below (called after speakMod resolves) uses
            // skipTTS: true so the queue item is not double-enqueued.
            // processQueue() must be called after the push — if processQueue exited
            // between the last filler finishing and this .then() callback firing,
            // the item would sit in the queue forever with nothing to drain it.
            ttsQueueRef.current.push({ text: ans.text, personaId: primaryId });
            processQueue();
            // Kick off rebuttal fetch early so it's settling while primary TTS plays.
            rebuttalFetchPromise = prefetchedRebuttalAnswerRef.current ?? fetchAnswerFrom(primaryId, secondaryId, ans.text);
            prefetchedRebuttalAnswerRef.current = null; // consume
          }
        }).catch(() => { primaryDone = true; setIsThinking(null); }),
        // Play the moderator question, then loop short filler lines until the
        // primary answer arrives — prevents dead air on slow connections.
        // Uses primaryDone (not primaryAnswer) so a null/failed fetch still exits.
        // The first filler uses the pre-fetched text so processQueue hits the audio
        // cache — subsequent fillers generate fresh random lines.
        (async () => {
          // blockEarlyResolve: false — persona TTS is pre-queued, so 500ms overlap fires
          // at the tail of the question for a natural conversational handoff.
          await speakMod(modQuestion, `modq-${Date.now()}-${Math.random()}`, { blockEarlyResolve: false });
          let firstFiller = true;
          while (!primaryDone && runningRef.current) {
            const fillerText = firstFiller ? firstPrimaryFiller : getWaitFiller(primaryName);
            firstFiller = false;
            await speakModFiller(fillerText, `modfill-${Date.now()}-${Math.random()}`);
          }
        })(),
      ]);
      // speakMod has fully resolved. The persona TTS was pre-queued above so audio
      // is already playing (or started at the 500ms overlap point). Call
      // enrichAndAddMessage with skipTTS: true — adds the message to the transcript
      // and triggers emotion/factcheck/fireback, but does NOT double-enqueue TTS.
      if (primaryAnswer?.text && runningRef.current) {
        enrichAndAddMessage({
          id: `pa-${Date.now()}-${Math.random()}`,
          speakerId: (primaryAnswer as NonNullable<typeof primaryAnswer>).speakerId,
          speakerName: (primaryAnswer as NonNullable<typeof primaryAnswer>).speakerName,
          text: primaryAnswer.text, ts: Date.now(),
          skipTTS: true,
        });
      }
      if (!runningRef.current || Date.now() >= sessionEndsAtRef.current) break;

      // ── NULL GUARD: primary answer failed to load ──────────────────────────
      // Without this guard, the moderator plays the bridge ("What do you say to
      // that?") into the void — then asks a fresh question next round — making it
      // sound like the AI stopped talking while the moderator just keeps going.
      // Instead: skip the bridge/rebuttal, back off, and retry the same topic.
      if (!primaryAnswer?.text) {
        consecutiveNullRef.current += 1;
        if (consecutiveNullRef.current >= 5) {
          // Persistent failure (≥5 in a row) — end the debate gracefully.
          runningRef.current = false;
          setPhase("ended");
          break;
        }
        await new Promise((r) => setTimeout(r, 2000 * consecutiveNullRef.current));
        continue; // retry this topic round with the same moderator target
      }
      consecutiveNullRef.current = 0;

      // ── DODGE PRESS (bias-aware) ───────────────────────────────────────────
      // If the primary debater's answer looks evasive AND the moderator leans
      // "target" toward them, fire a short follow-up press before the rebuttal
      // bridge. Favored or neutral debaters are never pressed for dodging.
      if (primaryAnswer?.text && detectDodge(primaryAnswer.text)) {
        const dodgeLeaning = getModeratorLeaning(moderatorStyle, primaryId);
        if (dodgeLeaning === "target" && runningRef.current) {
          const pressLine = getDodgePressLine();
          await speakMod(pressLine, `moddodge-${Date.now()}-${Math.random()}`);
          if (!runningRef.current) break;
        }
      }

      // ── STEP 3+4: Bridge + filler while rebuttal is in-flight, then enqueue ─
      // Mirrors the primary-answer pattern: play the moderator bridge while
      // waiting for the rebuttal AI response; if the bridge finishes first,
      // filler lines hold the room until the response arrives.
      //
      // NULL GUARD is preserved via a fast-path check: rebuttalFetchPromise was
      // pre-kicked during primary TTS (step 1+2), so in most cases it has
      // already settled by the time we reach here.  A single microtask flush
      // (await Promise.resolve()) lets us read that settled value before playing
      // the bridge — so a pre-settled null still skips the bridge entirely.
      const rebuttalPromise: ReturnType<typeof fetchAnswerFrom> =
        rebuttalFetchPromise ??
        (primaryAnswer?.text
          ? fetchAnswerFrom(primaryId, secondaryId, (primaryAnswer as NonNullable<typeof primaryAnswer>).text)
          : Promise.resolve(null));
      setIsThinking("interviewee");
      let rebuttal: Awaited<ReturnType<typeof fetchAnswerFrom>> = null;
      let rebuttalDone = false;

      await Promise.all([
        // Branch A: track when the rebuttal fetch settles and pre-fetch its AUDIO only.
        // We deliberately do NOT push to ttsQueueRef here — doing so creates a race
        // condition when the rebuttal was pre-fetched (already resolved): the .then()
        // fires as a microtask BEFORE Branch B's speakMod call can enqueue the bridge,
        // producing the wrong order [primaryAnswer, rebuttal, bridge] instead of the
        // correct [primaryAnswer, bridge, rebuttal]. Branch B pushes the rebuttal TTS
        // after bridge+fillers complete, guaranteeing correct order in all cases.
        // Audio is still pre-fetched here so the clip is cached and plays instantly.
        rebuttalPromise
          .then((r) => {
            rebuttal = r;
            rebuttalDone = true;
            if (r?.text && runningRef.current) {
              startPrefetch({ text: r.text, personaId: secondaryId });
            }
          })
          .catch(() => { rebuttalDone = true; }),

        // Branch B: play bridge then fillers while rebuttal is in-flight, then enqueue
        // rebuttal TTS so it always follows the bridge — correct order guaranteed.
        (async () => {
          // One microtask flush — if the promise was already settled (common case
          // after primary TTS), rebuttalDone is now true and we can null-guard
          // before uttering a single word.
          await Promise.resolve();
          if (rebuttalDone && !rebuttal?.text) return; // null — skip bridge
          if (!runningRef.current) return;

          const bridgeText = getRebuttalBridge(secondaryName, moderatorStyle, secondaryId);
          // Pre-fetch BRIDGE audio immediately — primary TTS is still playing so
          // the bridge audio fetch runs in parallel. By the time waitForQueueDrain
          // resolves (primary done) the bridge clip is already buffered → zero gap.
          startPrefetch({ text: bridgeText, personaId: mod.personaId });
          // Pre-fetch first rebuttal filler while the bridge plays — same zero-gap
          // pattern as the primary filler above.
          const firstRebuttalFiller = getWaitFiller(secondaryName);
          startPrefetch({ text: firstRebuttalFiller, personaId: mod.personaId });
          // blockEarlyResolve: true — bridge must finish fully before rebuttal starts
          // (rebuttal is enqueued below, after fillers, so no early-resolve needed).
          await speakMod(bridgeText, `modbr-${Date.now()}-${Math.random()}`, { blockEarlyResolve: true });
          // Bridge finished — play filler lines until the rebuttal AI response arrives.
          let firstRebuttalFiller_ = true;
          while (!rebuttalDone && runningRef.current) {
            const fillerText = firstRebuttalFiller_ ? firstRebuttalFiller : getWaitFiller(secondaryName);
            firstRebuttalFiller_ = false;
            await speakModFiller(fillerText, `modfiller-${Date.now()}-${Math.random()}`);
          }
          // Enqueue rebuttal TTS here — bridge+fillers are guaranteed done so order
          // is always correct. Audio was pre-fetched in Branch A → zero dead air.
          if (rebuttal?.text && runningRef.current) {
            ttsQueueRef.current.push({ text: rebuttal.text, personaId: secondaryId });
            processQueue();
          }
        })(),
      ]);
      setIsThinking(null);

      // ── NULL GUARD: rebuttal failed to load ───────────────────────────────
      // Skip enqueue — no content to play. Uses a dedicated counter so a bad
      // rebuttal doesn't double-count against the primary-answer streak and
      // trigger auto-shutdown prematurely.
      if (!rebuttal?.text) {
        consecutiveRebuttalNullRef.current += 1;
        if (consecutiveRebuttalNullRef.current >= 5) {
          runningRef.current = false;
          setPhase("ended");
          break;
        }
        await new Promise((r) => setTimeout(r, 2000 * consecutiveRebuttalNullRef.current));
        continue;
      }
      consecutiveRebuttalNullRef.current = 0;

      // Bridge + fillers have fully resolved. Rebuttal TTS was pre-queued in Branch A
      // so audio is already playing (or started at the 500ms overlap point).
      // skipTTS: true prevents double-enqueueing.
      if (rebuttal?.text && runningRef.current) {
        enrichAndAddMessage({
          id: `rb-${Date.now()}-${Math.random()}`,
          speakerId: (rebuttal as NonNullable<typeof rebuttal>).speakerId,
          speakerName: (rebuttal as NonNullable<typeof rebuttal>).speakerName,
          text: rebuttal.text, ts: Date.now(),
          skipTTS: true,
        });
      }
      if (!runningRef.current || Date.now() >= sessionEndsAtRef.current) break;

      totalExchangesRef.current += 1;

      // One-time shop promo after exchange 4
      if (totalExchangesRef.current === 4 && !shopPromoFiredRef.current && runningRef.current) {
        shopPromoFiredRef.current = true;
        enrichAndAddMessage({
          id: `shop-promo-${Date.now()}`,
          speakerId: mod.personaId, speakerName: mod.name,
          text: "Check out the exclusive product links below — deals picked just for you.",
          ts: Date.now(), isSystem: true,
        });
      }

      // ── STEP 5: Advance topic + short transition + pre-fetch next question ──
      setCompletedTopics((prev) => new Set(prev).add(topic.id));
      const latestTopics = topicsRef.current;
      const nextIdx = idx + 1 < latestTopics.length ? idx + 1 : 0;
      setTopicIdx(nextIdx);
      topicIdxRef.current = nextIdx;

      if (!runningRef.current || Date.now() >= sessionEndsAtRef.current) break;

      const nextTopic = latestTopics[nextIdx];
      const nextSide = moderatorTargetRef.current; // already flipped for next round
      const nextPrimaryId = nextSide === "A" ? interviewerId : intervieweeId;
      const nextPrimaryName = nextPrimaryId === interviewerId
        ? spokenName(interviewerId, interviewer?.name ?? "", mod.personaId)
        : spokenName(intervieweeId, interviewee?.name ?? "", mod.personaId);

      // Short transition line (template, no API) — debater named first, then topic
      const TRANS = nextPrimaryName ? [
        `${nextPrimaryName}, let's move on to ${nextTopic.title}.`,
        `${nextPrimaryName} — let's shift our focus to ${nextTopic.title}.`,
        `Moving on. ${nextPrimaryName}, let's discuss ${nextTopic.title}.`,
        `Next topic: ${nextTopic.title}. ${nextPrimaryName}, I'll come to you first.`,
      ] : [
        `Now let's move on to ${nextTopic.title}.`,
        `Let's shift our focus to ${nextTopic.title}.`,
        `Moving on — let's discuss ${nextTopic.title}.`,
        `Next topic: ${nextTopic.title}.`,
      ];
      const transText = TRANS[Math.floor(Math.random() * TRANS.length)];
      // Pre-fetch TRANSITION audio now — rebuttal TTS is still playing so this
      // runs concurrently. When speakMod(transText) calls waitForQueueDrain
      // (waiting for rebuttal to finish) the transition clip is already buffered.
      if (voiceEnabledRef.current) startPrefetch({ text: transText, personaId: mod.personaId });

      // Speak transition + pre-fetch next question in parallel → zero dead air next round
      setIsThinking("interviewer");
      const [nextQuestion] = await Promise.all([
        generateModeratorQuestion({
          deviceId, moderatorStyle, targetId: nextPrimaryId, topic: nextTopic,
          isTransition: false,
          conversationHistory: messagesRef.current.filter((m) => !m.isSystem).slice(-4),
        }).catch(() => ""),
        speakMod(transText, `modtrans-${Date.now()}-${Math.random()}`),
      ]);
      setIsThinking(null);

      if (nextQuestion && runningRef.current) {
        prefetchedOpeningRef.current = nextQuestion;
        // Pre-fetch the MODERATOR AUDIO for the next question while transition TTS plays —
        // by the time the next round starts the moderator audio is already buffered.
        if (voiceEnabledRef.current) startPrefetch({ text: nextQuestion, personaId: mod.personaId });
        // Pre-fetch the PRIMARY ANSWER for the next round while rebuttal TTS is still
        // playing. By the time the next moderator question finishes speaking the answer
        // is already in-flight or fully resolved — no dead air after the question.
        // Update the topic ref first so the fetch uses the correct topic context.
        currentTopicRef.current = nextTopic;
        prefetchedPrimaryAnswerRef.current = fetchAnswerFrom(mod.personaId, nextPrimaryId, nextQuestion);
      }

    }
    runningRef.current = false;
    // Always transition to ended when the loop terminates — whether the client
    // timer expired, the server returned 403, or the null guard fired.
    // Previously gated on Date.now() >= sessionEndsAtRef, which left the UI in
    // a zombie "live" state when the server session expired before the client timer.
    setPhase("ended");
  }, [topics, fetchAnswerFrom, enrichAndAddMessage, speakMod, moderatorStyle, deviceId, interviewerId, intervieweeId, interviewer, interviewee]);

  const startInterview = useCallback(async () => {
    if (!deviceId || !interviewerId || !intervieweeId || topics.length === 0 || isStarting) return;
    setIsStarting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    // Check / acquire arena access
    let hasSession = false;
    let serverExpiresAt: number | null = null;
    try {
      const sres = await fetch(new URL("/api/arena/status", getApiUrl()).toString(), { headers: { "x-device-id": deviceId } });
      if (sres.ok) {
        const sdata = await sres.json();
        hasSession = !!sdata.hasSession;
        if (hasSession && sdata.sessionExpiresAt) serverExpiresAt = sdata.sessionExpiresAt;
      }
    } catch {}

    if (!hasSession) {
      // try free trial
      try {
        const tr = await fetch(new URL("/api/arena/free-trial", getApiUrl()).toString(), {
          method: "POST", headers: { "x-device-id": deviceId, "Content-Type": "application/json" },
        });
        if (tr.ok) {
          const td = await tr.json();
          if (td.granted) {
            hasSession = true;
            if (td.expiresAt) serverExpiresAt = td.expiresAt;
          }
        }
      } catch {}
    }
    if (!hasSession) {
      setShowPaywall(true);
      setIsStarting(false);
      return;
    }

    // Client timer always shows exactly the chosen duration.
    // The server grants duration + 2 min buffer, so Math.min caps the display
    // at selectedMs for new sessions while still honouring a shorter remaining
    // window on an existing session (e.g. user has 2 min left on a 5-min pass).
    const selectedMs = duration * 60 * 1000;
    const serverRemaining = serverExpiresAt ? serverExpiresAt - Date.now() : 0;
    const clientMs = serverRemaining > 0
      ? Math.min(serverRemaining, selectedMs)
      : selectedMs;
    const endsAt = Date.now() + clientMs;
    sessionStartedAtRef.current = Date.now();
    sessionEndsAtRef.current = endsAt;
    setSecondsLeft(Math.ceil(clientMs / 1000));
    setMessages([]);
    setFightCardPreviewUriSafe(null);
    fightCardFileUriRef.current = null;
    const startIdx = selectedTopicId ? Math.max(0, topics.findIndex(t => t.id === selectedTopicId)) : 0;
    setTopicIdx(startIdx);
    topicIdxRef.current = startIdx;
    exchangesOnTopicRef.current = 0;
    totalExchangesRef.current = 0;
    // shopPromoFiredRef is intentionally NOT reset — it fires once per component
    // mount only, so restarting the interview doesn't double-announce the promo.
    setCompletedTopics(new Set());
    setEmoInterviewer(ZERO_EMO);
    setEmoInterviewee(ZERO_EMO);
    setLieCount(0);
    setLieCountA(0);
    setLieCountB(0);
    setLies([]);
    setFlaggedMsgIds(new Set());
    setLatestTruthScore(null);
    savedSessionRef.current = false;
    setSavedSessionId(null);
    ttsQueueRef.current = [];
    ttsRunningRef.current = false;
    prefetchingRef.current = false;
    pendingPrefetchRef.current = null;
    prefetchedAudioRef.current = null;
    prefetchedPrimaryAnswerRef.current = null; // discard any stale pre-fetch from a prior session
    prefetchedRebuttalAnswerRef.current = null; // discard any stale rebuttal pre-fetch from a prior session
    firstAudioPlayedRef.current = false;
    setFirstAudioPlayed(false);
    setPhase("live");
    runningRef.current = true;
    isPausedRef.current = false;
    setIsPaused(false);
    setIsStarting(false);
    // Reset null-streak counters so a mid-run restart doesn't inherit a count
    // from the previous session and trigger an early auto-shutdown (#316).
    consecutiveNullRef.current = 0;
    consecutiveRebuttalNullRef.current = 0;
    // The MODERATOR opens the debate: welcome line (with date + sponsor) plays
    // while the opening question is pre-fetched in parallel — zero dead air.
    (async () => {
      try {
        const mod = MODERATORS[moderatorStyle];
        const startIdxForOpening = selectedTopicId ? Math.max(0, topics.findIndex(t => t.id === selectedTopicId)) : 0;
        const openTopic = topics[startIdxForOpening];
        // Format today's date for the moderator intro
        const now = new Date();
        const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
        const d = now.getDate();
        const daySuffix = d === 1 || d === 21 || d === 31 ? "st" : d === 2 || d === 22 ? "nd" : d === 3 || d === 23 ? "rd" : "th";
        const dateStr = `${months[now.getMonth()]} ${d}${daySuffix}, ${now.getFullYear()}`;
        const welcomeText = `Today is ${dateStr}. This ${category} debate is brought to you by Dynamic Creations. I'm ${mod.name}, and we are getting right into it.`;
        // Welcome TTS and opening question fetch run in parallel.
        // speakMod routes through the TTS queue (blockEarlyResolve=true) so any
        // persona audio that arrives while the welcome is playing is held until
        // it fully finishes — no simultaneous overlap on slow loads.
        // As soon as the question text arrives, also pre-fetch its TTS audio so
        // there is zero gap between the welcome line and the first question.
        const [, prefetchedQuestion] = await Promise.all([
          speakMod(welcomeText, `modwelcome-${Date.now()}`),
          openTopic && deviceId
            ? generateModeratorQuestion({ deviceId, moderatorStyle, targetId: interviewerId ?? "", topic: openTopic, isTransition: false, conversationHistory: [] })
                .then((q) => { if (q && voiceEnabledRef.current) startPrefetch({ text: q, personaId: mod.personaId }); return q; })
            : Promise.resolve(""),
        ]);
        await runModeratorOpening(openTopic, prefetchedQuestion || undefined);
      } catch {}
      if (runningRef.current) {
        // Reset the timer to start NOW — after the intro — so the user gets the
        // full chosen duration of actual debate content, not debate + intro time.
        sessionEndsAtRef.current = Date.now() + duration * 60 * 1000;
        setSecondsLeft(duration * 60);
        runLoop();
      }
    })();
  }, [deviceId, interviewerId, intervieweeId, topics, isStarting, duration, runLoop, runModeratorOpening, selectedTopicId, moderatorStyle, category]);

  const unlockSession = useCallback(async () => {
    if (!deviceId || isUnlocking) return;
    setIsUnlocking(true);
    try {
      const res = await fetch(new URL("/api/arena/access", getApiUrl()).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-device-id": deviceId },
        body: JSON.stringify({ duration }),
      });
      const data = await res.json();
      if (res.ok && data.granted) {
        setShowPaywall(false);
        await refreshBalance();
        // Auto-start
        // Fresh purchase always covers the full duration
        const endsAtU = Date.now() + duration * 60 * 1000;
        sessionStartedAtRef.current = Date.now();
        sessionEndsAtRef.current = endsAtU;
        setSecondsLeft(duration * 60);
        setMessages([]);
        setFightCardPreviewUriSafe(null);
        fightCardFileUriRef.current = null;
        const startIdx2 = selectedTopicId ? Math.max(0, topics.findIndex(t => t.id === selectedTopicId)) : 0;
        setTopicIdx(startIdx2);
        topicIdxRef.current = startIdx2;
        exchangesOnTopicRef.current = 0;
        setCompletedTopics(new Set());
        setEmoInterviewer(ZERO_EMO);
        setEmoInterviewee(ZERO_EMO);
        setLieCount(0);
        setLieCountA(0);
        setLieCountB(0);
        setLies([]);
        setFlaggedMsgIds(new Set());
        setLatestTruthScore(null);
        savedSessionRef.current = false;
        setSavedSessionId(null);
        ttsQueueRef.current = [];
        ttsRunningRef.current = false;
        prefetchingRef.current = false;
        pendingPrefetchRef.current = null;
        prefetchedAudioRef.current = null;
        prefetchedPrimaryAnswerRef.current = null; // discard any stale pre-fetch from a prior session
        prefetchedRebuttalAnswerRef.current = null; // discard any stale rebuttal pre-fetch from a prior session
        firstAudioPlayedRef.current = false;
        setFirstAudioPlayed(false);
        setPhase("live");
        runningRef.current = true;
        isPausedRef.current = false;
        setIsPaused(false);
        (async () => {
          try {
            await runModeratorOpening(topics[startIdx2]);
          } catch {}
          if (runningRef.current) {
            sessionEndsAtRef.current = Date.now() + duration * 60 * 1000;
            setSecondsLeft(duration * 60);
            runLoop();
          }
        })();
      }
    } catch {} finally {
      setIsUnlocking(false);
    }
  }, [deviceId, duration, isUnlocking, refreshBalance, runLoop, runModeratorOpening, selectedTopicId, topics]);

  const stopInterview = useCallback(() => {
    runningRef.current = false;
    stopAllAudio();
    setPhase("ended");
  }, [stopAllAudio]);

  // Persist transcript when an interview ends so viewers can re-read it
  useEffect(() => {
    if (phase !== "ended") return;
    if (savedSessionRef.current) return;
    if (!deviceId || !interviewerId || !intervieweeId) return;
    const msgs = messagesRef.current;
    if (!msgs || msgs.length === 0) return;
    savedSessionRef.current = true;
    const startedAt = sessionStartedAtRef.current || msgs[0]?.ts || Date.now();
    const endedAt = Date.now();
    const sessionId = `iv-${startedAt}-${Math.random().toString(36).slice(2, 9)}`;
    const payload = {
      id: sessionId,
      interviewerId,
      intervieweeId,
      durationMinutes: duration,
      messages: msgs,
      lies,
      emoInterviewer,
      emoInterviewee,
      topics,
      startedAt,
      endedAt,
    };
    fetch(new URL("/api/arena/interview-save", getApiUrl()).toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-device-id": deviceId },
      body: JSON.stringify(payload),
    })
      .then(async (r) => {
        if (!r.ok) {
          savedSessionRef.current = false;
          return null;
        }
        return r.json();
      })
      .then((data: any) => {
        if (data?.id) setSavedSessionId(data.id);
        fetchLieTally();
      })
      .catch(() => {
        savedSessionRef.current = false;
      });
  }, [phase, deviceId, interviewerId, intervieweeId, duration, lies, emoInterviewer, emoInterviewee, topics, fetchLieTally]);

  // Build share content for the viral transcript modal
  const generateShareContent = useCallback(() => {
    const msgs = messagesRef.current.filter((m) => !m.isSystem);
    const aName = interviewers.find((p) => p.id === interviewerId)?.name ?? "Debater A";
    const bName = interviewees.find((p) => p.id === intervieweeId)?.name ?? "Debater B";
    const topicStr = typeof currentTopic === "string" ? currentTopic : (currentTopic as any)?.title || "Political Debate";

    // Topic → CamelCase hashtag, max 28 chars
    const topicHashtag = "#" + topicStr
      .replace(/[^a-zA-Z0-9\s]/g, "")
      .split(/\s+/).filter(Boolean).slice(0, 4)
      .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join("").slice(0, 28);

    // Pick up to 2 best quotes from each side (longest non-trivial lines)
    const pick = (speakerId: string) =>
      msgs.filter((m) => m.speakerId === speakerId && m.text.length > 50)
        .sort((a, b) => b.text.length - a.text.length).slice(0, 2);
    const aQuotes = pick(interviewerId ?? "");
    const bQuotes = pick(intervieweeId ?? "");
    const bestQuotes: typeof msgs = [];
    const maxQ = Math.max(aQuotes.length, bQuotes.length);
    for (let i = 0; i < maxQ; i++) {
      if (aQuotes[i]) bestQuotes.push(aQuotes[i]);
      if (bQuotes[i]) bestQuotes.push(bQuotes[i]);
    }

    // ── Viral social post ────────────────────────────────────────────────────
    // Build record strings for the share card
    const rec = debateRecordsRef.current;
    const aRec = rec && (rec.aWins > 0 || rec.aLosses > 0) ? ` (${rec.aWins}W-${rec.aLosses}L)` : "";
    const bRec = rec && (rec.bWins > 0 || rec.bLosses > 0) ? ` (${rec.bWins}W-${rec.bLosses}L)` : "";
    const h2hTotal = rec ? rec.h2hAWins + rec.h2hBWins : 0;
    const h2hLine = rec && h2hTotal > 0
      ? `\n🏆 H2H: ${aName} leads ${rec.h2hAWins}-${rec.h2hBWins} all-time`
      : "";

    let viralText = `🔥 AI DEBATE: ${aName}${aRec} vs ${bName}${bRec}\n`;
    viralText += `📢 Topic: "${topicStr}"\n${h2hLine}\n\n`;
    bestQuotes.slice(0, 4).forEach((m) => {
      const name = m.speakerId === interviewerId ? aName : bName;
      const snippet = m.text.length > 130 ? m.text.slice(0, 127) + "…" : m.text;
      viralText += `${name}: "${snippet}"\n\n`;
    });
    viralText += `${msgs.length} exchanges 🎙️\n\n`;
    viralText += `Watch AI personas debate LIVE 👇\nthearena.rip\n\n`;
    viralText += `#AIDebate #TheArena ${topicHashtag} @TheArenaAI`;

    // ── Full transcript ──────────────────────────────────────────────────────
    let fullTranscript = `=== ${aName} vs ${bName} ===\n📢 ${topicStr}\n`;
    fullTranscript += `${"─".repeat(40)}\n\n`;
    msgs.forEach((m) => {
      const ts = new Date(m.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      fullTranscript += `[${ts}] ${m.speakerName}: ${m.text}\n\n`;
    });
    fullTranscript += `${"─".repeat(40)}\n`;
    fullTranscript += `thearena.rip  |  #AIDebate #TheArena ${topicHashtag}`;

    return { viralText, fullTranscript, aName, bName, topicStr, topicHashtag, msgCount: msgs.length, debateRecords: rec };
  }, [interviewerId, intervieweeId, interviewers, interviewees, currentTopic]);

  // Resolve winner bet when debate ends
  useEffect(() => {
    if (phase !== "ended") return;
    if (!interviewerId || !intervieweeId || !deviceId) return;
    (async () => {
      try {
        const savedBet = await getInterviewBet();
        if (!savedBet || savedBet.interviewerId !== interviewerId || savedBet.intervieweeId !== intervieweeId) return;
        const msgs = messagesRef.current || [];
        // Only treat debateWinner.id as a real AI verdict when aiJudged is true.
        // When the AI verdict failed, debateWinner.id is still set via fallback heuristics
        // on the debate-end flow — passing it here would silently resolve bets via those
        // heuristics. Setting aiWinnerId to undefined triggers a refund instead.
        const aiWinnerId = debateWinner?.aiJudged ? debateWinner.id : undefined;
        const { won, winner, refunded } = resolveInterviewWinnerBet(
          savedBet.pick,
          msgs.map((m) => ({ speakerId: m.speakerId, text: m.text })),
          interviewerId,
          intervieweeId,
          aiWinnerId,
        );
        if (refunded) {
          // AI verdict unavailable — return the wager so the user isn't penalised
          await awardBetWin(deviceId, savedBet.wager, "Bet refund — judge unavailable");
          await refreshBalance();
          await clearInterviewBet();
          setDebateBetResult({ won: false, payout: savedBet.wager, winner, refunded: true });
          return;
        }
        const payout = won ? savedBet.wager * 2 : 0;
        if (won) {
          await awardBetWin(deviceId, payout, "Debate winner bet");
          await refreshBalance();
        }
        await clearInterviewBet();
        setDebateBetResult({ won, payout, winner });
      } catch {}
    })();
  }, [phase, interviewerId, intervieweeId, deviceId, debateWinner]);

  const togglePause = useCallback(() => {
    const next = !isPausedRef.current;
    isPausedRef.current = next;
    setIsPaused(next);
    if (next) stopAllAudio();
  }, [stopAllAudio]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      runningRef.current = false;
      ttsQueueRef.current = [];
      const snd = currentSoundRef.current;
      currentSoundRef.current = null;
      if (snd) snd.stopAsync().then(() => snd.unloadAsync()).catch(() => {});
    };
  }, []);

  // ── Call-in handler ──────────────────────────────────────────────────────
  const sendCallIn = useCallback(async () => {
    const q = callinText.trim();
    if (!q || !deviceId || !interviewerId || !intervieweeId || isCallinSending) return;
    if (callerName.trim()) AsyncStorage.setItem(NAME_KEY, callerName.trim()).catch(() => {});
    setIsCallinSending(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

    // Show user's call-in bubble immediately
    const callerLabel = callerName.trim() || "You";
    const userMsg: Msg = {
      id: `call-${Date.now()}-${Math.random()}`,
      speakerId: "__viewer__",
      speakerName: `📞 ${callerLabel}`,
      text: q,
      ts: Date.now(),
      isCallIn: true,
      callerName: callerLabel,
    };
    setMessages((prev) => [...prev, userMsg]);

    const wasRunning = runningRef.current;
    isPausedRef.current = true;
    setIsPaused(true);

    try {
      const res = await fetch(new URL("/api/arena/interview-callin", getApiUrl()).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-device-id": deviceId },
        body: JSON.stringify({
          interviewerId, intervieweeId, userQuestion: q, userName: callerName.trim(),
          conversationHistory: messagesRef.current.filter((m) => !m.isSystem).slice(-4), topic: currentTopic,
        }),
      });
      if (res.status === 403) {
        setShowPaywall(true);
      } else if (res.ok) {
        const data = await res.json();
        if (data?.interviewer?.text) {
          enrichAndAddMessage({
            id: `cq-${Date.now()}-${Math.random()}`,
            speakerId: data.interviewer.speakerId,
            speakerName: data.interviewer.speakerName,
            text: data.interviewer.text,
            ts: Date.now(),
          });
        }
        // Wait for interviewer audio before pushing interviewee answer
        await waitForQueueDrain();
        if (data?.interviewee?.text) {
          enrichAndAddMessage({
            id: `ca-${Date.now()}-${Math.random()}`,
            speakerId: data.interviewee.speakerId,
            speakerName: data.interviewee.speakerName,
            text: data.interviewee.text,
            ts: Date.now(),
          });
        }
      }
    } catch {} finally {
      setCallinText("");
      setIsCallinSending(false);
      // Resume after a beat
      setTimeout(() => {
        if (wasRunning) { isPausedRef.current = false; setIsPaused(false); }
      }, 1200);
    }
  }, [callinText, deviceId, interviewerId, intervieweeId, callerName, currentTopic, isCallinSending, enrichAndAddMessage, waitForQueueDrain, playInterruptionAudio]);

  const skipTopic = useCallback(() => {
    if (topicIdx + 1 >= topics.length) return;
    setCompletedTopics((prev) => new Set(prev).add(topics[topicIdx].id));
    const next = topicIdx + 1;
    setTopicIdx(next);
    topicIdxRef.current = next;
    exchangesOnTopicRef.current = 0;
  }, [topicIdx, topics]);

  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  // SETUP SCREEN
  if (phase === "setup") {
    return (
      <View style={[s.container, { paddingTop: insets.top + webTop }]}>
        <LinearGradient colors={["rgba(255,215,0,0.12)", "rgba(0,0,0,0)", "#0a0a0a"]} style={StyleSheet.absoluteFill} />

        <View style={s.header}>
          <Pressable onPress={() => router.back()} style={s.iconBtn} testID="interview-back">
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </Pressable>
          <View style={s.headerCenter}>
            <Text style={s.headerTitle}>1-ON-1 DEBATE</Text>
            <Text style={s.headerSub}>Pick a moderator · cut mics · timed rounds</Text>
          </View>
          <Pressable
            onPress={() => { setShowHallOfFame(true); fetchHallOfFame(true); }}
            style={s.iconBtn}
            testID="open-hall-of-fame"
            accessibilityLabel="Hall of Fame Leaderboard"
          >
            <Ionicons name="medal-outline" size={20} color="#FFD700" />
          </Pressable>
          <Pressable
            onPress={() => router.push("/lie-leaderboard")}
            style={s.iconBtn}
            testID="open-lie-leaderboard"
            accessibilityLabel="Caught Lying Leaderboard"
          >
            <Ionicons name="trophy-outline" size={20} color="#FFD700" />
          </Pressable>
          <Pressable
            onPress={() => router.push("/interview-history")}
            style={s.iconBtn}
            testID="open-interview-history"
            accessibilityLabel="Past Interviews"
          >
            <Ionicons name="time-outline" size={20} color="#FFD700" />
          </Pressable>
          <ShareAppButton variant="icon" area="arena" />
        </View>

        {lieTally && lieTally.totalSessions > 0 && (
          <View style={s.lieTallyStrip}>
            <View style={s.lieTallyMain}>
              <Text style={s.lieTallyNum}>{lieTally.totalLies}</Text>
              <View>
                <Text style={s.lieTallyLabel}>ALL-TIME LIES CAUGHT</Text>
                <Text style={s.lieTallySub}>
                  {lieTally.totalSessions} session{lieTally.totalSessions === 1 ? "" : "s"} · record {lieTally.bestSession} in one
                </Text>
              </View>
            </View>
            {lieTally.topLiarName && (
              <View style={s.lieTallyBiggest}>
                <Text style={s.lieTallyBiggestLabel}>BIGGEST LIAR</Text>
                <Text style={s.lieTallyBiggestName} numberOfLines={1}>{lieTally.topLiarName}</Text>
                <Text style={s.lieTallyBiggestCount}>{lieTally.topLiarCount} lies</Text>
              </View>
            )}
          </View>
        )}

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
          <Text style={s.sectionLabel}>DEBATER A</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.personaCardRow}>
            {debaterPool.filter(p =>
              p.id !== intervieweeId &&
              p.id !== MODERATORS[moderatorStyle].personaId &&
              !(MYSTERY_PERSONA_IDS.includes(p.id) && !unlockedMystery.includes(p.id)) &&
              !isHidden(p.id)
            ).map((p) => {
              const portrait = PERSONA_PORTRAITS[p.id];
              const isSelected = interviewerId === p.id;
              const initials = p.name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
              const rec = allPersonaRecords[p.id];
              const hasRecord = rec && (rec.wins > 0 || rec.losses > 0);
              const h2hAWins = isSelected && intervieweeId && debateRecords ? debateRecords.h2hAWins : null;
              const h2hBWins = isSelected && intervieweeId && debateRecords ? debateRecords.h2hBWins : null;
              const hasH2H = h2hAWins !== null && h2hBWins !== null && (h2hAWins > 0 || h2hBWins > 0);
              const hofEntry = hofRankMap[p.id];
              const hofMedal = hofEntry ? (hofEntry.rank === 1 ? "🥇" : hofEntry.rank === 2 ? "🥈" : hofEntry.rank === 3 ? "🥉" : null) : null;
              const hofLabel = hofEntry ? (hofMedal ? `${hofMedal} #${hofEntry.rank}` : `#${hofEntry.rank} · ${Math.round(hofEntry.winPct)}%`) : null;
              const locked = isLocked(p.id);
              const lockCfg = locked ? PREMIUM_PERSONA_CONFIGS[p.id] : null;
              const isNewlyUnlocked = newlyUnlockedIds.includes(p.id);
              return (
                <Pressable key={p.id} onPress={() => {
                  Haptics.selectionAsync();
                  if (isNewlyUnlocked) setNewlyUnlockedIds(ids => ids.filter(id => id !== p.id));
                  if (locked) {
                    if (deviceId) unlockWithTokens(p.id, deviceId, refreshBalance);
                  } else {
                    setInterviewerId(p.id);
                  }
                }}
                  style={[s.personaCard, { position: "relative" }]} testID={`interviewer-${p.id}`}>
                  {isNewlyUnlocked && (
                    <Animated.View entering={FadeIn.duration(300)} exiting={FadeOut.duration(200)}
                      style={{ position: "absolute", top: -10, left: 0, right: 0, alignItems: "center", zIndex: 10 }}>
                      <View style={{ backgroundColor: "#4ADE80", borderRadius: 5, paddingHorizontal: 3, paddingVertical: 2 }}>
                        <Text style={{ color: "#000", fontSize: 7, fontWeight: "900" }}>⭐ UNLOCKED</Text>
                      </View>
                    </Animated.View>
                  )}
                  <View style={[s.personaAvatarWrap, isSelected && s.personaAvatarWrapActive, locked && { opacity: 0.5 }, isNewlyUnlocked && { borderColor: "#4ADE80", borderWidth: 2.5 }]}>
                    {portrait
                      ? <Image source={portrait} style={s.personaAvatar} />
                      : <View style={s.personaAvatarFallback}><Text style={s.personaAvatarInitials}>{initials}</Text></View>
                    }
                    {locked && (
                      <View style={{ position: "absolute", bottom: 2, right: 2, backgroundColor: "rgba(0,0,0,0.75)", borderRadius: 8, padding: 2 }}>
                        <Ionicons name="lock-closed" size={11} color={lockCfg?.badgeColor ?? "#FFD700"} />
                      </View>
                    )}
                  </View>
                  <Text style={[s.personaCardName, isSelected && s.personaCardNameActive, locked && { color: "rgba(255,255,255,0.4)" }, isNewlyUnlocked && { color: "#4ADE80" }]} numberOfLines={1}>
                    {p.name.split(" ")[0]}
                  </Text>
                  {locked && lockCfg ? (
                    <Text style={{ color: lockCfg.badgeColor, fontSize: 9, fontWeight: "700", textAlign: "center" }}>{lockCfg.tokenPrice}🪙</Text>
                  ) : isNewlyUnlocked ? (
                    <Text style={{ color: "#4ADE80", fontSize: 8, fontWeight: "800", textAlign: "center" }}>Just unlocked!</Text>
                  ) : (
                    <>
                      {hasRecord && (
                        <Text style={s.personaCardRecord}>{rec.wins}W-{rec.losses}L</Text>
                      )}
                      {hofLabel && (
                        <Text style={s.personaCardHofRank}>{hofLabel}</Text>
                      )}
                      {hasH2H && (
                        <Text style={s.personaCardH2H}>{h2hAWins}-{h2hBWins} h2h</Text>
                      )}
                    </>
                  )}
                </Pressable>
              );
            })}
          </ScrollView>

          <Text style={[s.sectionLabel, { marginTop: 16 }]}>DEBATER B</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.personaCardRow}>
            {debaterPool.filter(p =>
              p.id !== interviewerId &&
              p.id !== MODERATORS[moderatorStyle].personaId &&
              !(MYSTERY_PERSONA_IDS.includes(p.id) && !unlockedMystery.includes(p.id)) &&
              !isHidden(p.id)
            ).map((p) => {
              const portrait = PERSONA_PORTRAITS[p.id];
              const isSelected = intervieweeId === p.id;
              const initials = p.name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
              const rec = allPersonaRecords[p.id];
              const hasRecord = rec && (rec.wins > 0 || rec.losses > 0);
              const h2hBWins = isSelected && interviewerId && debateRecords ? debateRecords.h2hBWins : null;
              const h2hAWins = isSelected && interviewerId && debateRecords ? debateRecords.h2hAWins : null;
              const hasH2H = h2hBWins !== null && h2hAWins !== null && (h2hBWins > 0 || h2hAWins > 0);
              const hofEntry = hofRankMap[p.id];
              const hofMedal = hofEntry ? (hofEntry.rank === 1 ? "🥇" : hofEntry.rank === 2 ? "🥈" : hofEntry.rank === 3 ? "🥉" : null) : null;
              const hofLabel = hofEntry ? (hofMedal ? `${hofMedal} #${hofEntry.rank}` : `#${hofEntry.rank} · ${Math.round(hofEntry.winPct)}%`) : null;
              const locked = isLocked(p.id);
              const lockCfg = locked ? PREMIUM_PERSONA_CONFIGS[p.id] : null;
              const isNewlyUnlocked = newlyUnlockedIds.includes(p.id);
              return (
                <Pressable key={p.id} onPress={() => {
                  Haptics.selectionAsync();
                  if (isNewlyUnlocked) setNewlyUnlockedIds(ids => ids.filter(id => id !== p.id));
                  if (locked) {
                    if (deviceId) unlockWithTokens(p.id, deviceId, refreshBalance);
                  } else {
                    setIntervieweeId(p.id);
                  }
                }}
                  style={[s.personaCard, { position: "relative" }]} testID={`interviewee-${p.id}`}>
                  {isNewlyUnlocked && (
                    <Animated.View entering={FadeIn.duration(300)} exiting={FadeOut.duration(200)}
                      style={{ position: "absolute", top: -10, left: 0, right: 0, alignItems: "center", zIndex: 10 }}>
                      <View style={{ backgroundColor: "#4ADE80", borderRadius: 5, paddingHorizontal: 3, paddingVertical: 2 }}>
                        <Text style={{ color: "#000", fontSize: 7, fontWeight: "900" }}>⭐ UNLOCKED</Text>
                      </View>
                    </Animated.View>
                  )}
                  <View style={[s.personaAvatarWrap, isSelected && s.personaAvatarWrapActiveGuest, locked && { opacity: 0.5 }, isNewlyUnlocked && { borderColor: "#4ADE80", borderWidth: 2.5 }]}>
                    {portrait
                      ? <Image source={portrait} style={s.personaAvatar} />
                      : <View style={s.personaAvatarFallback}><Text style={s.personaAvatarInitials}>{initials}</Text></View>
                    }
                    {locked && (
                      <View style={{ position: "absolute", bottom: 2, right: 2, backgroundColor: "rgba(0,0,0,0.75)", borderRadius: 8, padding: 2 }}>
                        <Ionicons name="lock-closed" size={11} color={lockCfg?.badgeColor ?? "#FFD700"} />
                      </View>
                    )}
                  </View>
                  <Text style={[s.personaCardName, isSelected && s.personaCardNameActiveGuest, locked && { color: "rgba(255,255,255,0.4)" }, isNewlyUnlocked && { color: "#4ADE80" }]} numberOfLines={1}>
                    {p.name.split(" ")[0]}
                  </Text>
                  {locked && lockCfg ? (
                    <Text style={{ color: lockCfg.badgeColor, fontSize: 9, fontWeight: "700", textAlign: "center" }}>{lockCfg.tokenPrice}🪙</Text>
                  ) : isNewlyUnlocked ? (
                    <Text style={{ color: "#4ADE80", fontSize: 8, fontWeight: "800", textAlign: "center" }}>Just unlocked!</Text>
                  ) : (
                    <>
                      {hasRecord && (
                        <Text style={[s.personaCardRecord, isSelected && s.personaCardRecordGuest]}>{rec.wins}W-{rec.losses}L</Text>
                      )}
                      {hofLabel && (
                        <Text style={s.personaCardHofRank}>{hofLabel}</Text>
                      )}
                      {hasH2H && (
                        <Text style={[s.personaCardH2H, s.personaCardH2HGuest]}>{h2hBWins}-{h2hAWins} h2h</Text>
                      )}
                    </>
                  )}
                </Pressable>
              );
            })}
          </ScrollView>

          <Text style={[s.sectionLabel, { marginTop: 16 }]}>SEGMENT LENGTH</Text>
          <View style={s.durationRow}>
            {DURATIONS.map((d) => (
              <Pressable key={d.minutes} onPress={() => { Haptics.selectionAsync(); setDuration(d.minutes); }}
                style={[s.durationCard, duration === d.minutes && s.durationCardActive]} testID={`duration-${d.minutes}`}>
                <Text style={[s.durationMins, duration === d.minutes && s.durationMinsActive]}>{d.minutes}</Text>
                <Text style={[s.durationSub, duration === d.minutes && s.durationSubActive]}>min</Text>
                <Text style={[s.durationCost, duration === d.minutes && s.durationCostActive]}>{d.cost} tokens</Text>
              </Pressable>
            ))}
          </View>

          <Text style={[s.sectionLabel, { marginTop: 16 }]}>CATEGORY</Text>
          <View style={s.mixRow}>
            {(["Political", "Sports", "History", "Finance", "Science", "Entertainment", "Philosophy"] as const).map((c) => (
              <Pressable key={c} onPress={() => { Haptics.selectionAsync(); setCategory(c); }}
                style={[s.mixCard, category === c && s.mixCardActive]} testID={`category-${c}`}>
                <Text style={[s.mixText, category === c && s.mixTextActive]}>{c}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={[s.sectionLabel, { marginTop: 16 }]}>MODERATOR</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.personaCardRow}>
            {(Object.keys(MODERATORS) as ModeratorStyle[]).filter(ms =>
              MODERATORS[ms].personaId !== interviewerId && MODERATORS[ms].personaId !== intervieweeId
            ).map((ms) => {
              const mod = MODERATORS[ms];
              const portrait = PERSONA_PORTRAITS[mod.personaId];
              const isSelected = moderatorStyle === ms;
              const initials = mod.name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
              const rec = allPersonaRecords[mod.personaId];
              const hasRecord = rec && (rec.wins > 0 || rec.losses > 0);
              const hofEntry = hofRankMap[mod.personaId];
              const hofMedal = hofEntry ? (hofEntry.rank === 1 ? "🥇" : hofEntry.rank === 2 ? "🥈" : hofEntry.rank === 3 ? "🥉" : null) : null;
              const hofLabel = hofEntry ? (hofMedal ? `${hofMedal} #${hofEntry.rank}` : `#${hofEntry.rank} · ${Math.round(hofEntry.winPct)}%`) : null;
              return (
                <Pressable key={ms} onPress={() => { Haptics.selectionAsync(); setModeratorStyle(ms); }}
                  style={s.personaCard} testID={`moderator-${ms}`}>
                  <View style={[s.personaAvatarWrap, isSelected && s.personaAvatarWrapActive]}>
                    {portrait
                      ? <Image source={portrait} style={s.personaAvatar} />
                      : <View style={s.personaAvatarFallback}><Text style={s.personaAvatarInitials}>{initials}</Text></View>
                    }
                  </View>
                  <Text style={[s.personaCardName, isSelected && s.personaCardNameActive]} numberOfLines={1}>{mod.name}</Text>
                  {hasRecord && (
                    <Text style={s.personaCardRecord}>{rec.wins}W-{rec.losses}L</Text>
                  )}
                  {hofLabel && (
                    <Text style={s.personaCardHofRank}>{hofLabel}</Text>
                  )}
                  {interviewerId && intervieweeId && (() => {
                    const lA = getModeratorLeaning(ms, interviewerId);
                    const lB = getModeratorLeaning(ms, intervieweeId);
                    const sA = lA === "favor" ? 2 : lA === "target" ? -2 : 0;
                    const sB = lB === "favor" ? 2 : lB === "target" ? -2 : 0;
                    const n = sA - sB;
                    if (n === 0) return null;
                    const pct = Math.max(25, Math.min(75, 50 + n * 5));
                    const favorsLabel = n > 0
                      ? (debaterPool.find(p => p.id === interviewerId)?.name?.split(" ")[0] || "A")
                      : (debaterPool.find(p => p.id === intervieweeId)?.name?.split(" ")[0] || "B");
                    return (
                      <Text style={{ color: isSelected ? "#000" : "#4ADE80", fontSize: 8, fontWeight: "900", marginTop: 2 }}>
                        {n > 0 ? pct : 100 - pct}% → {favorsLabel}
                      </Text>
                    );
                  })()}
                </Pressable>
              );
            })}
          </ScrollView>

          <Text style={[s.sectionLabel, { marginTop: 16 }]}>LIE DETECTOR</Text>
          <View style={s.mixRow}>
            <Pressable onPress={() => { Haptics.selectionAsync(); setLieDetectorA((v) => !v); }}
              style={[s.mixCard, lieDetectorA && s.mixCardActive]} testID="lie-detector-a">
              <Ionicons name={lieDetectorA ? "eye" : "eye-off"} size={16} color={lieDetectorA ? "#000" : "#FFD700"} />
              <Text style={[s.mixText, lieDetectorA && s.mixTextActive]}>Debater A {lieDetectorA ? "ON" : "OFF"}</Text>
            </Pressable>
            <Pressable onPress={() => { Haptics.selectionAsync(); setLieDetectorB((v) => !v); }}
              style={[s.mixCard, lieDetectorB && s.mixCardActive]} testID="lie-detector-b">
              <Ionicons name={lieDetectorB ? "eye" : "eye-off"} size={16} color={lieDetectorB ? "#000" : "#FFD700"} />
              <Text style={[s.mixText, lieDetectorB && s.mixTextActive]}>Debater B {lieDetectorB ? "ON" : "OFF"}</Text>
            </Pressable>
          </View>

          <Text style={[s.sectionLabel, { marginTop: 16 }]}>TOPIC MIX</Text>
          <View style={s.mixRow}>
            {TOPIC_MIXES.map((m) => (
              <Pressable key={m.id} onPress={() => { Haptics.selectionAsync(); setTopicMix(m.id as any); }}
                style={[s.mixCard, topicMix === m.id && s.mixCardActive]} testID={`mix-${m.id}`}>
                <Ionicons name={m.icon} size={18} color={topicMix === m.id ? "#000" : "#FFD700"} />
                <Text style={[s.mixText, topicMix === m.id && s.mixTextActive]}>{m.label}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={[s.sectionLabel, { marginTop: 16 }]}>INTERVIEW STYLE</Text>
          <View style={s.styleRow}>
            {INTERVIEW_STYLES.map((st) => (
              <Pressable key={st.id} onPress={() => { Haptics.selectionAsync(); setInterviewStyle(st.id); }}
                style={[s.styleCard, interviewStyle === st.id && s.styleCardActive]} testID={`style-${st.id}`}>
                <Ionicons name={st.icon} size={16} color={interviewStyle === st.id ? "#000" : "#FFD700"} />
                <Text style={[s.styleText, interviewStyle === st.id && s.styleTextActive]}>{st.label}</Text>
              </Pressable>
            ))}
          </View>

          <View style={[s.topicsCard, { marginTop: 18 }]}>
            <View style={s.topicsHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Ionicons name="list" size={16} color="#FFD700" />
                <Text style={s.topicsTitle}>INTERVIEW QUESTIONS</Text>
              </View>
              <Pressable onPress={generateTopics} disabled={topicsLoading || !interviewerId || !intervieweeId} style={s.refreshTopicsBtn}>
                {topicsLoading ? (
                  <ActivityIndicator size="small" color="#FFD700" />
                ) : (
                  <>
                    <Ionicons name="refresh" size={14} color="#FFD700" />
                    <Text style={s.refreshTopicsText}>New</Text>
                  </>
                )}
              </Pressable>
            </View>
            {topicsLoading && topics.length === 0 ? (
              <View style={{ padding: 20, alignItems: "center" }}>
                <ActivityIndicator size="small" color="#FFD700" />
                <Text style={{ color: "#888", fontSize: 12, marginTop: 8 }}>Generating provocative angles…</Text>
              </View>
            ) : topics.length === 0 ? (
              <Text style={{ color: "#666", fontSize: 12, padding: 12, textAlign: "center" }}>
                Pick an interviewer and guest to generate questions.
              </Text>
            ) : (
              topics.map((t, i) => {
                const isSelected = selectedTopicId === t.id;
                return (
                  <Pressable key={t.id} onPress={() => { Haptics.selectionAsync(); setSelectedTopicId(isSelected ? null : t.id); }}
                    style={[s.topicRow, isSelected && s.topicRowSelected]}>
                    <View style={[s.topicNum, { backgroundColor: isSelected ? "rgba(255,215,0,0.35)" : t.era === "current" ? "rgba(74,222,128,0.2)" : "rgba(255,215,0,0.2)" }]}>
                      {isSelected
                        ? <Ionicons name="play" size={12} color="#FFD700" />
                        : <Text style={[s.topicNumText, { color: t.era === "current" ? "#4ADE80" : "#FFD700" }]}>{i + 1}</Text>}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.topicTitle, isSelected && { color: "#FFD700" }]} numberOfLines={2}>{t.title}</Text>
                      <Text style={s.topicDesc} numberOfLines={2}>{t.description}</Text>
                      <View style={[s.eraTag, { backgroundColor: t.era === "current" ? "rgba(74,222,128,0.15)" : "rgba(255,215,0,0.12)" }]}>
                        <Text style={[s.eraTagText, { color: t.era === "current" ? "#4ADE80" : "#FFD700" }]}>
                          {t.era === "current" ? "TODAY" : "PAST"}
                        </Text>
                      </View>
                    </View>
                    {isSelected && <View style={s.topicStartBadge}><Text style={s.topicStartBadgeText}>START HERE</Text></View>}
                  </Pressable>
                );
              })
            )}
          </View>

          {/* Custom topic creator */}
          <View style={[s.topicsCard, { marginTop: 12, borderColor: "rgba(74,222,128,0.25)" }]}>
            <View style={s.topicsHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Ionicons name="create-outline" size={16} color="#4ADE80" />
                <Text style={[s.topicsTitle, { color: "#4ADE80" }]}>YOUR TOPIC</Text>
              </View>
              <Pressable onPress={() => setShowCustomInput((p) => !p)} style={[s.refreshTopicsBtn, { borderColor: "rgba(74,222,128,0.4)" }]}>
                <Ionicons name={showCustomInput ? "chevron-up" : "add"} size={14} color="#4ADE80" />
                <Text style={[s.refreshTopicsText, { color: "#4ADE80" }]}>{showCustomInput ? "Close" : "Add Topic"}</Text>
              </Pressable>
            </View>
            {showCustomInput ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
                <TextInput
                  value={customTopicText}
                  onChangeText={setCustomTopicText}
                  placeholder="Type your own topic or question…"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  style={{ flex: 1, color: "#fff", fontSize: 13, padding: 10, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(74,222,128,0.25)" }}
                  maxLength={120}
                  returnKeyType="done"
                  onSubmitEditing={() => {
                    const t = customTopicText.trim();
                    if (!t) return;
                    const newTopic: Topic = { id: `custom_${Date.now()}`, title: t, description: "Your custom angle", era: "current" };
                    setTopics((prev) => [newTopic, ...prev]);
                    setSelectedTopicId(newTopic.id);
                    setCustomTopicText("");
                    setShowCustomInput(false);
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  }}
                />
                <Pressable
                  onPress={() => {
                    const t = customTopicText.trim();
                    if (!t) return;
                    const newTopic: Topic = { id: `custom_${Date.now()}`, title: t, description: "Your custom angle", era: "current" };
                    setTopics((prev) => [newTopic, ...prev]);
                    setSelectedTopicId(newTopic.id);
                    setCustomTopicText("");
                    setShowCustomInput(false);
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  }}
                  disabled={!customTopicText.trim()}
                  style={{ backgroundColor: "#4ADE80", borderRadius: 10, padding: 10, opacity: customTopicText.trim() ? 1 : 0.4 }}
                >
                  <Ionicons name="checkmark" size={18} color="#000" />
                </Pressable>
              </View>
            ) : (
              <Text style={{ color: "rgba(255,255,255,0.38)", fontSize: 11 }}>Set your own angle — bypass the generated questions</Text>
            )}
          </View>

          {/* ── WINNER BET ───────────────────────────────────── */}
          {interviewerId && intervieweeId && !debateBetPick && !debateBetResult && (() => {
            const leanA = getModeratorLeaning(moderatorStyle, interviewerId);
            const leanB = getModeratorLeaning(moderatorStyle, intervieweeId);
            const scoreA = leanA === "favor" ? 2 : leanA === "target" ? -2 : 0;
            const scoreB = leanB === "favor" ? 2 : leanB === "target" ? -2 : 0;
            const net = scoreA - scoreB;
            const oddsA = Math.max(25, Math.min(75, 50 + net * 5));
            const oddsB = 100 - oddsA;
            const hasBias = net !== 0;
            const modFirstName = MODERATORS[moderatorStyle]?.name?.split(" ")[0] || "Moderator";
            const labelA = debaterPool.find(p => p.id === interviewerId)?.name?.split(" ")[0] || "Debater A";
            const labelB = debaterPool.find(p => p.id === intervieweeId)?.name?.split(" ")[0] || "Debater B";
            const items = [
              { id: "interviewer" as const, label: labelA, odds: oddsA },
              { id: "interviewee" as const, label: labelB, odds: oddsB },
            ];
            return (
              <View style={{ marginTop: 16, padding: 14, borderRadius: 14, borderWidth: 1.5, borderColor: "rgba(251,191,36,0.35)", backgroundColor: "rgba(251,191,36,0.06)" }}>
                <Text style={{ color: "#FBBF24", fontSize: 13, fontWeight: "900", marginBottom: 4 }}>🎰 PREDICT THE WINNER</Text>
                <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 10, marginBottom: 10 }}>
                  {hasBias ? `${modFirstName}'s bias shifts the odds — choose wisely` : "Who dominates the debate? Win 2× your bet"}
                </Text>
                <View style={{ flexDirection: "row", gap: 8, marginBottom: hasBias ? 6 : 10 }}>
                  {items.map((opt) => {
                    const favored = opt.odds > 50;
                    const targeted = opt.odds < 50;
                    return (
                      <Pressable key={opt.id} onPress={() => { Haptics.selectionAsync(); setDebateBetPick(opt.id); }}
                        style={{ flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center", borderWidth: 1.5,
                          borderColor: favored ? "rgba(74,222,128,0.45)" : targeted ? "rgba(255,107,107,0.35)" : "rgba(255,255,255,0.15)",
                          backgroundColor: favored ? "rgba(74,222,128,0.07)" : targeted ? "rgba(255,107,107,0.05)" : "rgba(255,255,255,0.04)" }}>
                        <Text style={{ color: "#888", fontSize: 12, fontWeight: "700" }}>{opt.label}</Text>
                        <Text style={{ color: favored ? "#4ADE80" : targeted ? "#FF6B6B" : "rgba(255,255,255,0.45)", fontSize: 15, fontWeight: "900", marginTop: 2 }}>{opt.odds}%</Text>
                        <Text style={{ color: "rgba(255,255,255,0.25)", fontSize: 8, marginTop: 1 }}>TAP TO PICK</Text>
                      </Pressable>
                    );
                  })}
                </View>
                {hasBias && (
                  <Text style={{ color: "rgba(251,191,36,0.55)", fontSize: 9, textAlign: "center", fontStyle: "italic" }}>
                    {`⚠️ ${modFirstName} leans toward ${net > 0 ? labelA : labelB}`}
                  </Text>
                )}
              </View>
            );
          })()}

          {debateBetPick && debateBetLocked && !debateBetResult && (() => {
            const lockedName = debateBetPick === "interviewer"
              ? (debaterPool.find(p => p.id === interviewerId)?.name?.split(" ")[0] || "Debater A")
              : (debaterPool.find(p => p.id === intervieweeId)?.name?.split(" ")[0] || "Debater B");
            return (
              <View style={{ marginTop: 12, padding: 14, borderRadius: 12, borderWidth: 1.5, borderColor: "rgba(251,191,36,0.5)", backgroundColor: "rgba(251,191,36,0.08)", flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Ionicons name="lock-closed" size={18} color="#FBBF24" />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: "#FBBF24", fontSize: 13, fontWeight: "900" }}>BET LOCKED IN ✓</Text>
                  <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 11, marginTop: 2 }}>{lockedName} to win · {debateBetWager}🪙 at stake</Text>
                </View>
              </View>
            );
          })()}

          {debateBetPick && !debateBetLocked && !debateBetResult && (() => {
            const pickedName = debateBetPick === "interviewer"
              ? (debaterPool.find(p => p.id === interviewerId)?.name?.split(" ")[0] || "Debater A")
              : (debaterPool.find(p => p.id === intervieweeId)?.name?.split(" ")[0] || "Debater B");
            return (
              <View style={{ marginTop: 12, padding: 12, borderRadius: 12, borderWidth: 1.5, borderColor: "rgba(251,191,36,0.35)", backgroundColor: "rgba(251,191,36,0.06)" }}>
                <Text style={{ color: "#FBBF24", fontSize: 12, fontWeight: "900", marginBottom: 8 }}>🎰 WINNER BET — Picked: {pickedName}</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 11 }}>Wager:</Text>
                  {[1, 2, 3, 5].map((v) => (
                    <Pressable key={v} onPress={() => setDebateBetWager(v)}
                      style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16, borderWidth: 1, borderColor: debateBetWager === v ? "#FBBF24" : "rgba(255,255,255,0.15)", backgroundColor: debateBetWager === v ? "rgba(251,191,36,0.15)" : "transparent" }}>
                      <Text style={{ color: debateBetWager === v ? "#FBBF24" : "#888", fontSize: 11, fontWeight: "700" }}>{v}🪙</Text>
                    </Pressable>
                  ))}
                </View>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Pressable
                    onPress={async () => {
                      if (!interviewerId || !intervieweeId || !deviceId) return;
                      const res = await fetch(new URL("/api/use-token", getApiUrl()).toString(), {
                        method: "POST",
                        headers: { "Content-Type": "application/json", "x-device-id": deviceId },
                        body: JSON.stringify({ amount: debateBetWager, reason: "Debate winner bet" }),
                      });
                      if (!res.ok) { Alert.alert("Not enough tokens", `Need ${debateBetWager} tokens to place this bet.`); return; }
                      await refreshBalance();
                      await placeInterviewBet({ pick: debateBetPick, interviewerId, intervieweeId, wager: debateBetWager, placedAt: Date.now() });
                      setDebateBetLocked(true);
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    }}
                    style={{ flex: 1, backgroundColor: "#FBBF24", borderRadius: 10, paddingVertical: 10, alignItems: "center" }}>
                    <Text style={{ color: "#000", fontSize: 13, fontWeight: "900" }}>LOCK IN ({debateBetWager}🪙)</Text>
                  </Pressable>
                  <Pressable onPress={() => setDebateBetPick(null)}
                    style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.15)", alignItems: "center" }}>
                    <Text style={{ color: "#888", fontSize: 12 }}>Cancel</Text>
                  </Pressable>
                </View>
              </View>
            );
          })()}

          {debateBetResult && (
            <View style={{ marginTop: 12, padding: 14, borderRadius: 12, borderWidth: 1.5, borderColor: debateBetResult.refunded ? "#FFD700" : debateBetResult.won ? "#4ADE80" : "#FF4D4D", backgroundColor: debateBetResult.refunded ? "rgba(255,215,0,0.08)" : debateBetResult.won ? "rgba(74,222,128,0.08)" : "rgba(255,77,77,0.08)" }}>
              <Text style={{ color: debateBetResult.refunded ? "#FFD700" : debateBetResult.won ? "#4ADE80" : "#FF4D4D", fontSize: 14, fontWeight: "900", textAlign: "center" }}>
                {debateBetResult.refunded
                  ? `↩️ BET REFUNDED +${debateBetResult.payout}🪙 — judge unavailable`
                  : debateBetResult.won
                    ? `🎉 BET WON! +${debateBetResult.payout}🪙`
                    : `❌ BET LOST — ${debateBetResult.winner === "interviewer" ? "Debater A" : "Debater B"} dominated`}
              </Text>
            </View>
          )}

          {topicsError && !topicsLoading ? (
            <Pressable
              onPress={generateTopics}
              style={[s.startBtn, { backgroundColor: "#3a1a1a", borderWidth: 1, borderColor: "#FF4D4D" }]}
              testID="start-interview"
            >
              <Ionicons name="warning" size={18} color="#FF4D4D" />
              <Text style={[s.startBtnText, { color: "#FF4D4D" }]}>TOPICS UNAVAILABLE — Retry</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={startInterview}
              disabled={isStarting || !interviewerId || !intervieweeId || interviewerId === intervieweeId || topics.length === 0 || topicsLoading}
              style={[s.startBtn, (isStarting || !interviewerId || !intervieweeId || interviewerId === intervieweeId || topics.length === 0 || topicsLoading) && { opacity: 0.4 }]}
              testID="start-interview"
            >
              {topicsLoading ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <Ionicons name="mic" size={18} color="#000" />
              )}
              <Text style={s.startBtnText}>
                {topicsLoading ? "LOADING TOPICS…" : isStarting ? "STARTING…" : !deviceId ? "CONNECTING…" : `START ${duration}-MIN INTERVIEW`}
              </Text>
            </Pressable>
          )}
          {topicsSlowWarning && topicsLoading && (
            <Animated.View entering={FadeIn.duration(400)} exiting={FadeOut.duration(300)} style={{ marginTop: 8, flexDirection: "row", alignItems: "center", gap: 6 }}>
              <ActivityIndicator size="small" color="#FF9500" />
              <Text style={[s.startSub, { color: "#FF9500" }]}>Still generating topics…</Text>
            </Animated.View>
          )}
          {topicsAreFallback ? (
            <Pressable onPress={generateTopics} style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 }}>
              <Text style={[s.startSub, { color: "#FF9500" }]}>⚠️ Using generic topics — AI busy.</Text>
              <Text style={[s.startSub, { color: "#FF9500", textDecorationLine: "underline" }]}>Retry</Text>
            </Pressable>
          ) : topicsError ? (
            <Text style={[s.startSub, { color: "#FF4D4D" }]}>Topic generation failed — tap above to try again</Text>
          ) : (
            <Text style={s.startSub}>
              {interviewer?.name || "—"} grills {interviewee?.name || "—"} · {selectedTopicId ? `starting on "${topics.find(t => t.id === selectedTopicId)?.title}"` : `${topics.length} topic${topics.length === 1 ? "" : "s"}`}
            </Text>
          )}

          <CashAppDonate />
        </ScrollView>

        {renderPaywall()}
      </View>
    );
  }

  // LIVE / ENDED
  const interviewerPortrait = interviewerId ? PERSONA_PORTRAITS[interviewerId] : null;
  const intervieweePortrait = intervieweeId ? PERSONA_PORTRAITS[intervieweeId] : null;
  return (
    <View style={[s.container, { paddingTop: insets.top + webTop }]}>
      <LinearGradient colors={["rgba(255,215,0,0.08)", "rgba(0,0,0,0)", "#0a0a0a"]} style={StyleSheet.absoluteFill} />


      {/* Pulsating heartbeat background icon — live phase only */}
      {phase === "live" && (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}>
            <Animated.View style={[{ width: 220, height: 220, borderRadius: 110, borderWidth: 2, borderColor: "rgba(255,215,0,0.55)", backgroundColor: "rgba(255,215,0,0.04)" }, bgPulseStyle3]} />
            <Animated.View style={[{ position: "absolute", width: 220, height: 220, borderRadius: 110, borderWidth: 1.5, borderColor: "rgba(255,215,0,0.4)", backgroundColor: "rgba(255,215,0,0.06)" }, bgPulseStyle2]} />
            <Animated.View style={[{ position: "absolute", width: 220, height: 220, borderRadius: 110, borderWidth: 2, borderColor: "rgba(255,215,0,0.75)", backgroundColor: "rgba(255,215,0,0.09)" }, bgPulseStyle]} />
            <Animated.View style={[{ position: "absolute" }, bgPulseStyle]}>
              <Image
                source={require("../assets/images/dynamic-creations-logo.jpg")}
                style={{ width: 160, height: 160, borderRadius: 24, opacity: 0.18 }}
                resizeMode="contain"
              />
            </Animated.View>
          </View>
        </View>
      )}

      <View style={s.header}>
        <Pressable onPress={() => { stopInterview(); router.back(); }} style={s.iconBtn} testID="interview-exit">
          <Ionicons name="exit-outline" size={20} color="#ff4d4d" />
        </Pressable>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle} numberOfLines={1}>{interviewer?.name} × {interviewee?.name}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View style={[s.liveDot]} />
            <Text style={s.liveText}>LIVE · {mmss(secondsLeft)}</Text>
          </View>
        </View>
        {latestTruthScore !== null && (
          <View style={s.truthMeter} testID="truth-meter">
            <Text style={[s.truthLabel, { color: latestTruthScore < 40 ? "#ff4d4d" : latestTruthScore < 70 ? "#facc15" : "#4ADE80" }]}>
              {latestTruthScore}
            </Text>
            <View style={s.truthTrack}>
              <View style={[s.truthFill, {
                width: `${latestTruthScore}%`,
                backgroundColor: latestTruthScore < 40 ? "#ff4d4d" : latestTruthScore < 70 ? "#facc15" : "#4ADE80",
              }]} />
            </View>
          </View>
        )}
        <Pressable onPress={() => setLiesSheetOpen(true)} style={[s.liePill, (lieCount > 0 || lieFlashOn) && s.liePillActive]} testID="lie-counter">
          <Ionicons name="flash" size={12} color={lieCount > 0 || lieFlashOn ? "#ff4d4d" : "rgba(255,255,255,0.4)"} />
          {lieFlashOn ? (
            <Text style={[s.liePillText, { color: "#ff4d4d", letterSpacing: 1 }]}>LIE</Text>
          ) : (
            <Text style={[s.liePillText, lieCount > 0 && { color: "#ff4d4d" }]}>{lieCount}</Text>
          )}
        </Pressable>
        <Pressable onPress={toggleVoice} style={s.iconBtnSm} testID="toggle-voice">
          <Ionicons name={voiceEnabled ? "volume-high" : "volume-mute"} size={16} color={voiceEnabled ? "#FFD700" : "rgba(255,255,255,0.4)"} />
        </Pressable>
        <Pressable
          onPress={async () => {
            Haptics.selectionAsync();
            const mod = MODERATORS[moderatorStyle];
            const lastMsg = messagesRef.current[messagesRef.current.length - 1];
            const line = await generateModeratorLine({
              deviceId: deviceId || "",
              moderatorId: mod.personaId,
              kind: "interrupt",
              topic: typeof currentTopic === "string" ? currentTopic : (currentTopic as any)?.title,
              lastSpeakerText: lastMsg?.text,
              moderatorStyle,
            });
            if (line) {
              await interruptCtl.arm(line, mod.personaId);
              playDingSound().catch(() => {});
            }
          }}
          style={[s.iconBtnSm, moderatorSpeaking && { backgroundColor: "rgba(255,215,0,0.25)" }]}
          testID="moderator-trigger"
        >
          <Ionicons name="megaphone" size={16} color={moderatorSpeaking ? "#FFD700" : "rgba(255,255,255,0.6)"} />
        </Pressable>
        <Pressable onPress={toggleFx} style={s.iconBtnSm} testID="toggle-fx">
          <Ionicons name={fxEnabled ? "flash" : "flash-off"} size={16} color={fxEnabled ? "#FFD700" : "rgba(255,255,255,0.4)"} />
        </Pressable>
        <Pressable onPress={toggleBeep} style={s.iconBtnSm} testID="toggle-beep">
          <Ionicons name={beepEnabled ? "notifications" : "notifications-off"} size={16} color={beepEnabled ? "#FFD700" : "rgba(255,255,255,0.4)"} />
        </Pressable>
        <Pressable onPress={togglePause} style={s.iconBtnSm}>
          <Ionicons name={isPaused ? "play" : "pause"} size={16} color="#FFD700" />
        </Pressable>
        <Pressable onPress={openInterviewPoll} style={s.iconBtnSm} testID="interview-poll">
          <Ionicons name="bar-chart" size={16} color="#FFD700" />
        </Pressable>
        <Pressable onPress={() => { setShowHallOfFame(true); fetchHallOfFame(true); }} style={s.iconBtnSm} testID="open-hall-of-fame-live" accessibilityLabel="Hall of Fame">
          <Ionicons name="medal-outline" size={16} color="#FFD700" />
        </Pressable>
      </View>

      {(lieCountA > 0 || lieCountB > 0) && (
        <View style={s.lieCompareStrip} testID="lie-compare-strip">
          <View style={[s.lieCompareSide, lieCountA >= lieCountB && lieCountA > 0 && s.lieCompareSideLeading]}>
            <Text style={s.lieCompareName} numberOfLines={1}>{interviewer?.name ?? "A"}</Text>
            <Text style={[s.lieCompareNum, lieCountA > 0 && { color: "#ff4d4d" }]}>{lieCountA}</Text>
          </View>
          <View style={s.lieCompareVs}>
            <Ionicons name="flash" size={12} color="rgba(255,255,255,0.35)" />
          </View>
          <View style={[s.lieCompareSide, lieCountB >= lieCountA && lieCountB > 0 && s.lieCompareSideLeading]}>
            <Text style={[s.lieCompareNum, lieCountB > 0 && { color: "#ff4d4d" }]}>{lieCountB}</Text>
            <Text style={s.lieCompareName} numberOfLines={1}>{interviewee?.name ?? "B"}</Text>
          </View>
        </View>
      )}

      {/* Portrait stage with mood meters */}
      <View style={s.stage}>
        {/* QR code — centered between the two portraits, screen-recording visible */}
        <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, alignItems: "center", justifyContent: "center", zIndex: 10 }}>
          <View style={{ backgroundColor: "rgba(0,0,0,0.72)", borderRadius: 8, padding: 5, borderWidth: 1, borderColor: "rgba(255,215,0,0.45)" }}>
            <Image source={require("../assets/images/qr-download.jpg")} style={{ width: 56, height: 56, borderRadius: 5 }} resizeMode="contain" />
            <Text style={{ color: "#FFD700", fontSize: 7, fontWeight: "700", textAlign: "center", marginTop: 2, letterSpacing: 0.5 }}>SCAN TO TRY</Text>
          </View>
        </View>

        {/* Moderator overlay — appears only while the moderator is actually speaking */}
        {moderatorSpeaking && (
          <View pointerEvents="none" style={s.moderatorOverlay}>
            <View style={s.moderatorPortraitWrap}>
              {PERSONA_PORTRAITS[MODERATORS[moderatorStyle].personaId] ? (
                <Image source={PERSONA_PORTRAITS[MODERATORS[moderatorStyle].personaId]} style={s.moderatorPortraitImg} />
              ) : (
                <Image
                  source={{ uri: `https://api.dicebear.com/7.x/initials/png?seed=${encodeURIComponent(MODERATORS[moderatorStyle].name)}&backgroundColor=FFD700` }}
                  style={s.moderatorPortraitImg}
                />
              )}
              <View style={s.moderatorPulseDot} />
            </View>
            <Text style={s.moderatorName} numberOfLines={1}>{MODERATORS[moderatorStyle].name}</Text>
            {moderatorLastLine ? (
              <Text style={s.moderatorLine} numberOfLines={2}>{moderatorLastLine}</Text>
            ) : null}
          </View>
        )}

        {[
          { id: interviewerId, name: interviewer?.name, portrait: interviewerPortrait, glow: interviewerGlowStyle, emo: emoInterviewer, role: "DEBATER A", color: "#FFD700" },
          { id: intervieweeId, name: interviewee?.name, portrait: intervieweePortrait, glow: intervieweeGlowStyle, emo: emoInterviewee, role: "DEBATER B", color: "#4ADE80" },
        ].map((p, idx) => (
          <View key={`${p.id}-${idx}`} style={s.stageCol}>
            <View style={s.portraitWrap}>
              {p.id ? (
                <AnimatedDebateFace
                  personaId={p.id}
                  baseImage={p.portrait}
                  speaking={activeSpeaker === p.id || isThinking === (idx === 0 ? "interviewer" : "interviewee")}
                  mood={moodFor(p.emo.anger, p.emo.frantic, p.emo.happy, activeSpeaker === p.id)}
                  side={idx === 0 ? "left" : "right"}
                  size={110}
                  expressionImages={EXPRESSION_SOURCES[p.id]}
                />
              ) : (
                <View style={[s.portraitImg, { backgroundColor: "#222", alignItems: "center", justifyContent: "center" }]}>
                  <Ionicons name="person" size={42} color="#666" />
                </View>
              )}
              {/* Parting-shot portrait flash — briefly rings the face with fire-orange glow */}
              {(idx === 0 ? partingShotFlashA : partingShotFlashB) && (
                <Animated.View
                  entering={ZoomIn.duration(180)}
                  exiting={FadeOut.duration(400)}
                  pointerEvents="none"
                  style={{
                    position: "absolute",
                    width: 116, height: 116, borderRadius: 58,
                    borderWidth: 4, borderColor: "#FF6B00",
                    shadowColor: "#FF6B00", shadowOffset: { width: 0, height: 0 },
                    shadowRadius: 16, shadowOpacity: 1,
                  }}
                />
              )}
              {isThinking === (idx === 0 ? "interviewer" : "interviewee") && (
                <View style={s.thinkingDot}>
                  <ActivityIndicator size="small" color={p.color} />
                </View>
              )}
            </View>
            <Text style={[s.stageRole, { color: p.color }]} numberOfLines={1}>{p.role}</Text>
            <Text style={s.stageName} numberOfLines={1}>{p.name || "—"}</Text>
            {/* W/L record badge — shows personal record for this viewer */}
            {debateRecords && p.id && (() => {
              const w = idx === 0 ? debateRecords.aWins : debateRecords.bWins;
              const l = idx === 0 ? debateRecords.aLosses : debateRecords.bLosses;
              if (w === 0 && l === 0) return null;
              const pct = w + l > 0 ? Math.round((w / (w + l)) * 100) : 0;
              const color = pct >= 60 ? "#4ADE80" : pct <= 40 ? "#F87171" : "rgba(255,255,255,0.45)";
              return (
                <Text style={{ color, fontSize: 9, fontWeight: "800", letterSpacing: 0.5, marginTop: 1 }}>
                  {w}W–{l}L
                </Text>
              );
            })()}
            <Pressable
              onPress={() => {
                setMicCut((m) => idx === 0 ? { ...m, iv: !m.iv } : { ...m, ivee: !m.ivee });
                playDingSound().catch(() => {});
              }}
              style={{ marginTop: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, backgroundColor: (idx === 0 ? micCut.iv : micCut.ivee) ? "rgba(239,68,68,0.2)" : "rgba(255,255,255,0.06)" }}
              testID={idx === 0 ? "cut-mic-interviewer" : "cut-mic-interviewee"}
            >
              <Text style={{ color: (idx === 0 ? micCut.iv : micCut.ivee) ? "#EF4444" : "rgba(255,255,255,0.5)", fontSize: 10, fontWeight: "700" }}>
                {(idx === 0 ? micCut.iv : micCut.ivee) ? "Restore mic" : "Cut mic"}
              </Text>
            </Pressable>
            {/* DC Point Award Button — tap to score this debater */}
            <Pressable
              onPress={() => {
                if (phase !== "live") return;
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setDebatePoints((prev) => {
                  const next = idx === 0 ? { ...prev, a: prev.a + 1 } : { ...prev, b: prev.b + 1 };
                  debatePointsRef.current = next;
                  return next;
                });
              }}
              style={{ marginTop: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, flexDirection: "row" as const, alignItems: "center" as const, gap: 4, backgroundColor: "rgba(255,215,0,0.1)", borderWidth: 1, borderColor: "rgba(255,215,0,0.3)" }}
              testID={idx === 0 ? "award-point-a" : "award-point-b"}
            >
              <Ionicons name="star" size={10} color="#FFD700" />
              <Text style={{ color: "#FFD700", fontSize: 11, fontWeight: "900" as const }}>
                {idx === 0 ? debatePoints.a : debatePoints.b} DC PT{(idx === 0 ? debatePoints.a : debatePoints.b) === 1 ? "" : "S"}
              </Text>
            </Pressable>
            {/* ── HEAT METER PILL ── */}
            {(() => {
              const isA = idx === 0;
              const heat = isA ? heatA : heatB;
              const flash = isA ? firebackFlashA : firebackFlashB;
              const thresh = p.id ? getAggression(p.id).angerThresh : 4;
              const pct = Math.min(100, Math.round((heat / Math.max(thresh, 1)) * 100));
              const visible = flash || heat > 0;
              const fillColor = pct >= 80 ? "#ff1a1a" : "#ff5500";
              const pulseStyle = isA ? heatPulseStyleA : heatPulseStyleB;
              return (
                <View style={[s.heatPillWrap, { opacity: visible ? 1 : 0 }]} testID={isA ? "heat-pill-a" : "heat-pill-b"}>
                  {flash ? (
                    <Animated.View entering={ZoomIn.duration(180)} exiting={FadeOut.duration(300)} style={s.heatFlashPill}>
                      <Text style={s.heatFlashText}>💥 FIRING BACK</Text>
                    </Animated.View>
                  ) : (
                    <View style={s.heatBarOuter}>
                      <Animated.View style={[s.heatBarFill, { width: `${pct}%`, backgroundColor: fillColor }, pulseStyle]} />
                      <Text style={s.heatBarLabel}>FIRED UP 🔥</Text>
                    </View>
                  )}
                </View>
              );
            })()}
            <View style={s.emoBars}>
              {EMO_KEYS.map((k) => (
                <View key={k} style={s.emoBarRow}>
                  <View style={[s.emoBarFill, { width: `${Math.min(100, Math.max(0, p.emo[k]))}%`, backgroundColor: EMO_COLORS[k] }]} />
                  <Text style={s.emoBarLabel}>{EMO_LABELS[k]}</Text>
                </View>
              ))}
            </View>
          </View>
        ))}
      </View>

      {/* ── HEAD-TO-HEAD RECORD STRIP ── shown when records are loaded */}
      {debateRecords && (debateRecords.h2hAWins > 0 || debateRecords.h2hBWins > 0) && interviewerId && intervieweeId && (
        <Animated.View
          entering={FadeIn.duration(400)}
          style={{ alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 8, marginTop: -2, marginBottom: 4, paddingHorizontal: 14, paddingVertical: 5, backgroundColor: "rgba(255,215,0,0.07)", borderRadius: 20, borderWidth: 1, borderColor: "rgba(255,215,0,0.18)" }}
        >
          <Text style={{ color: "#FFD700", fontSize: 11, fontWeight: "900" }}>{debateRecords.h2hAWins}</Text>
          <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 9, fontWeight: "700", letterSpacing: 1 }}>H2H</Text>
          <Text style={{ color: "rgba(255,255,255,0.35)", fontSize: 9 }}>✕</Text>
          <Text style={{ color: "#4ADE80", fontSize: 11, fontWeight: "900" }}>{debateRecords.h2hBWins}</Text>
        </Animated.View>
      )}

      {/* ── ROOM TEMPERATURE METER ── */}
      {phase === "live" && (
        <View style={s.roomTempWrap} testID="room-temperature-meter">
          <Text style={s.roomTempLabel}>🌡️ ROOM TEMP</Text>
          <View style={s.roomTempBarOuter}>
            <Animated.View
              style={[
                s.roomTempBarFill,
                roomTempBarStyle,
                {
                  backgroundColor:
                    roomTemperature >= 90 ? "#ff1a1a"
                    : roomTemperature >= 60 ? "#ff5500"
                    : "#ff8800",
                },
              ]}
            />
          </View>
          <Text style={[s.roomTempPct, roomTemperature >= 90 && s.roomTempPctHot]}>
            {roomTemperature}°
          </Text>
        </View>
      )}

      {/* Tap-hint toast — shows 10s after going live, fades out after 4s */}
      {showTapHint && (
        <Animated.View
          entering={FadeIn.duration(400)}
          exiting={FadeOut.duration(400)}
          pointerEvents="none"
          style={{ position: "absolute", bottom: 130, left: 0, right: 0, alignItems: "center", zIndex: 999 }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(0,0,0,0.85)", borderWidth: 1.5, borderColor: "rgba(255,215,0,0.55)", borderRadius: 30, paddingHorizontal: 18, paddingVertical: 10 }}>
            <Text style={{ fontSize: 22 }}>👆</Text>
            <Text style={{ color: "#FFD700", fontSize: 13, fontWeight: "800" }}>Tap a persona to score them DC Points!</Text>
          </View>
        </Animated.View>
      )}

      {/* Topic strip */}
      <Pressable onPress={() => setTopicsPanelOpen(true)} style={s.topicStrip} testID="topic-strip">
        <View style={{ flex: 1 }}>
          <Text style={s.topicStripLabel}>TOPIC {topicIdx + 1} OF {topics.length}</Text>
          <Text style={s.topicStripTitle} numberOfLines={1}>{currentTopic?.title || "—"}</Text>
        </View>
        <Pressable onPress={skipTopic} style={s.skipBtn} disabled={topicIdx + 1 >= topics.length}>
          <Ionicons name="play-skip-forward" size={14} color={topicIdx + 1 >= topics.length ? "#444" : "#FFD700"} />
          <Text style={[s.skipText, { color: topicIdx + 1 >= topics.length ? "#444" : "#FFD700" }]}>Next</Text>
        </Pressable>
        <Ionicons name="list" size={18} color="#FFD700" style={{ marginLeft: 10 }} />
      </Pressable>

      <View style={{ flex: 1 }}>
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: 14, paddingBottom: 12 }}
          removeClippedSubviews={true}
          maxToRenderPerBatch={8}
          windowSize={5}
          renderItem={({ item }) => {
            const isInterviewer = item.speakerId === interviewerId;
            const isCallIn = !!item.isCallIn;
            const isPartingShot = !!item.isPartingShot;
            const canFlag = !isInterviewer && !isCallIn && !isPartingShot && intervieweeId && item.speakerId === intervieweeId;
            const alreadyFlagged = flaggedMsgIds.has(item.id);
            if (isPartingShot) {
              return (
                <Animated.View entering={FadeInUp.duration(400)} style={[s.bubbleRow, { justifyContent: "center" }]}>
                  <View style={[s.bubble, { backgroundColor: "rgba(255,80,0,0.18)", borderColor: "#ff6a00", borderWidth: 1, alignItems: "center" }]}>
                    <Text style={[s.bubbleName, { color: "#ff6a00", textAlign: "center" }]}>
                      🔥 {item.speakerName} · PARTING SHOT
                    </Text>
                    <Text style={[s.bubbleText, { fontStyle: "italic", textAlign: "center" }]}>{item.text}</Text>
                  </View>
                </Animated.View>
              );
            }
            return (
              <Animated.View entering={FadeInUp.duration(300)} style={[s.bubbleRow, isCallIn ? { justifyContent: "center" } : isInterviewer ? { justifyContent: "flex-start" } : { justifyContent: "flex-end" }]}>
                <View style={[
                  s.bubble,
                  isCallIn ? s.bubbleCallIn : isInterviewer ? s.bubbleInterviewer : s.bubbleInterviewee,
                  item.isInterruption && s.bubbleInterrupt,
                ]}>
                  <Text style={[s.bubbleName, { color: isCallIn ? "#60a5fa" : isInterviewer ? "#FFD700" : "#4ADE80" }]}>
                    {item.speakerName}{item.isInterruption ? " · INTERRUPTS" : ""}{isCallIn ? " · CALL-IN" : ""}
                  </Text>
                  <Text style={s.bubbleText}>{item.text}</Text>
                  {canFlag && (
                    <Pressable
                      onPress={() => flagMessageAsLie(item)}
                      disabled={alreadyFlagged}
                      hitSlop={6}
                      style={[s.flagBtn, alreadyFlagged && s.flagBtnDone]}
                      testID={`flag-lie-${item.id}`}
                    >
                      <Ionicons
                        name={alreadyFlagged ? "flag" : "flag-outline"}
                        size={11}
                        color={alreadyFlagged ? "#ff4d4d" : "rgba(255,255,255,0.55)"}
                      />
                      <Text style={[s.flagBtnText, alreadyFlagged && { color: "#ff4d4d" }]}>
                        {alreadyFlagged ? "FLAGGED" : "FLAG AS LIE"}
                      </Text>
                    </Pressable>
                  )}
                </View>
              </Animated.View>
            );
          }}
          ListFooterComponent={
            isThinking ? (
              <Animated.View entering={FadeIn} exiting={FadeOut} style={[s.bubbleRow, isThinking === "interviewer" ? { justifyContent: "flex-start" } : { justifyContent: "flex-end" }]}>
                <View style={[s.bubble, isThinking === "interviewer" ? s.bubbleInterviewer : s.bubbleInterviewee, { paddingVertical: 8, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 8 }]}>
                  <ActivityIndicator size="small" color={isThinking === "interviewer" ? "#FFD700" : "#4ADE80"} />
                  <Text style={{ color: isThinking === "interviewer" ? "#FFD700" : "#4ADE80", fontSize: 13, fontStyle: "italic", opacity: 0.9 }}>Loading...</Text>
                </View>
              </Animated.View>
            ) : showDebateLoading ? (
              <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)} style={[s.bubbleRow, { justifyContent: "center" }]}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6, paddingHorizontal: 14, backgroundColor: "rgba(255,215,0,0.08)", borderRadius: 16, borderWidth: 1, borderColor: "rgba(255,215,0,0.18)" }}>
                  <ActivityIndicator size="small" color="rgba(255,215,0,0.7)" />
                  <Text style={{ color: "rgba(255,215,0,0.7)", fontSize: 12, fontStyle: "italic" }}>Preparing next exchange…</Text>
                </View>
              </Animated.View>
            ) : null
          }
          scrollEnabled={messages.length > 0}
        />
        <Animated.View pointerEvents="none" style={[s.lightning, flashStyle]} />
        {showTimeoutBanner && (
          <Animated.View
            entering={FadeInDown.duration(280)}
            exiting={FadeOut.duration(400)}
            pointerEvents="none"
            style={s.timeoutBanner}
          >
            <Text style={s.timeoutBannerText}>🚨 TIME-OUT — Moving to next topic</Text>
          </Animated.View>
        )}
        {lieFlashOn && (
          <View pointerEvents="none" style={s.lieFlashOverlay}>
            <Text style={s.lieFlashWord}>LIE</Text>
          </View>
        )}
      </View>

      {/* Persona Amazon store links — live phase */}
      {phase === "live" && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ maxHeight: 40, marginHorizontal: 12, marginBottom: 4 }}
          contentContainerStyle={{ gap: 8, alignItems: "center", paddingHorizontal: 2 }}
        >
          {getInterviewShopLinks(interviewerId, intervieweeId).map((link, i) => (
            <Pressable
              key={i}
              onPress={() => Linking.openURL(link.url)}
              style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, backgroundColor: "rgba(255,215,0,0.06)", borderWidth: 1, borderColor: "rgba(255,215,0,0.15)" }}
            >
              <Ionicons
                name={link.icon === "book" ? "book" : link.icon === "ribbon" ? "ribbon" : link.icon === "shirt" ? "shirt" : link.icon === "gift" ? "gift-outline" : link.icon === "sunny" ? "sunny" : link.icon === "cafe" ? "cafe" : link.icon === "image" ? "image" : link.icon === "planet" ? "planet" : link.icon === "car" ? "car" : link.icon === "fitness" ? "fitness" : link.icon === "flower" ? "flower" : link.icon === "library" ? "library" : link.icon === "trophy" ? "trophy" : link.icon === "videocam" ? "videocam" : link.icon === "footsteps" ? "footsteps" : link.icon === "shield" ? "shield" : link.icon === "bag" ? "bag" : "storefront"}
                size={12}
                color="#FFD700"
              />
              <Text style={{ fontSize: 10, fontWeight: "600", color: "rgba(255,215,0,0.7)", maxWidth: 100 }} numberOfLines={1}>{link.title}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {/* Call-in bar */}
      {phase === "live" && (
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={0}>
          <View style={[s.callinBar, { paddingBottom: Math.max(10, insets.bottom + webBottom) }]}>
            <View style={s.callinNameRow}>
              <Ionicons name="call" size={12} color="#60a5fa" />
              <TextInput
                value={callerName}
                onChangeText={setCallerName}
                placeholder="Your name (optional)"
                placeholderTextColor="rgba(255,255,255,0.35)"
                style={s.callinNameInput}
                maxLength={24}
                testID="callin-name"
              />
            </View>
            <View style={s.callinInputRow}>
              <TextInput
                value={callinText}
                onChangeText={setCallinText}
                placeholder={`Ask ${interviewer?.name || "the host"} anything…`}
                placeholderTextColor="rgba(255,255,255,0.35)"
                style={s.callinInput}
                multiline
                maxLength={240}
                testID="callin-input"
              />
              <Pressable onPress={toggleMic} style={[s.callinMic, isListening && s.callinMicActive]} testID="callin-mic">
                <Ionicons name={isListening ? "mic" : "mic-outline"} size={18} color={isListening ? "#ff4d4d" : "#60a5fa"} />
              </Pressable>
              <Pressable onPress={sendCallIn} disabled={!callinText.trim() || isCallinSending} style={[s.callinSend, (!callinText.trim() || isCallinSending) && { opacity: 0.4 }]} testID="callin-send">
                {isCallinSending ? <ActivityIndicator size="small" color="#000" /> : <Ionicons name="send" size={16} color="#000" />}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      )}

      {/* ── DC DEBATE WINNER MODAL ──────────────────────────────────────────── */}
      <Modal visible={showDebateWinner} transparent animationType="fade" statusBarTranslucent>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.92)", alignItems: "center", justifyContent: "center" }}>
          <ScrollView
            contentContainerStyle={{ alignItems: "center", justifyContent: "center", paddingVertical: 32, paddingHorizontal: 16 }}
            style={{ width: "100%" }}
            showsVerticalScrollIndicator={false}
          >
          <Animated.View entering={ZoomIn.duration(380).springify()} style={{ alignItems: "center", padding: 28, backgroundColor: "#111", borderRadius: 28, borderWidth: 2, borderColor: "#FFD700", width: "100%", maxWidth: 400 }}>
            <Ionicons name="trophy" size={52} color="#FFD700" />
            <Text style={{ color: debateWinner?.aiJudged ? "#60A5FA" : "#FFD700", fontSize: 13, fontWeight: "900", letterSpacing: 2.5, marginTop: 8 }}>
              {debateWinner?.aiJudged ? "⚖️ DC AI VERDICT" : "DC DEBATE CHAMPION"}
            </Text>
            {debateWinner?.portrait ? (
              <Image source={debateWinner.portrait} style={{ width: 130, height: 130, borderRadius: 65, marginTop: 14, borderWidth: 3, borderColor: debateWinner?.aiJudged ? "#60A5FA" : "#FFD700" }} />
            ) : null}
            <Text style={{ color: "#fff", fontSize: 28, fontWeight: "900", marginTop: 12, textAlign: "center" }}>{debateWinner?.name}</Text>

            {/* AI verdict summary */}
            {debateWinner?.verdict ? (
              <View style={{ marginTop: 12, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: "rgba(96,165,250,0.12)", borderRadius: 14, borderWidth: 1, borderColor: "rgba(96,165,250,0.35)", maxWidth: 320, width: "100%" }}>
                <Text style={{ color: "#60A5FA", fontSize: 10, fontWeight: "900", letterSpacing: 1.5, marginBottom: 5, textAlign: "center" }}>⚖️ WHY {(debateWinner.name || "THEY").toUpperCase()} WON</Text>
                <Text style={{ color: "rgba(255,255,255,0.9)", fontSize: 12, lineHeight: 18, textAlign: "center", fontStyle: "italic" }}>"{debateWinner.verdict}"</Text>
              </View>
            ) : (debateWinner?.points ?? 0) > 0 ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 16, marginTop: 10 }}>
                <View style={{ alignItems: "center" }}>
                  <Text style={{ color: "#FFD700", fontSize: 28, fontWeight: "900" }}>{debateWinner?.points ?? 0}</Text>
                  <Text style={{ color: "rgba(255,215,0,0.6)", fontSize: 9, fontWeight: "800", letterSpacing: 1 }}>WINNER</Text>
                </View>
                <Text style={{ color: "rgba(255,255,255,0.35)", fontSize: 18 }}>vs</Text>
                <View style={{ alignItems: "center" }}>
                  <Text style={{ color: "rgba(255,255,255,0.55)", fontSize: 22, fontWeight: "800" }}>{debateWinner?.opponentPoints ?? 0}</Text>
                  <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 9, fontWeight: "800", letterSpacing: 1 }}>OPPONENT</Text>
                </View>
              </View>
            ) : null}

            {/* Updated W/L record after the verdict */}
            {debateRecords && debateWinner && (() => {
              const isA = debateWinner.id === interviewerId;
              const wW = isA ? debateRecords.aWins : debateRecords.bWins;
              const lW = isA ? debateRecords.aLosses : debateRecords.bLosses;
              const wL = isA ? debateRecords.bWins : debateRecords.aWins;
              const lL = isA ? debateRecords.bLosses : debateRecords.aLosses;
              const h2hMine = isA ? debateRecords.h2hAWins : debateRecords.h2hBWins;
              const h2hTheirs = isA ? debateRecords.h2hBWins : debateRecords.h2hAWins;
              if (wW === 0 && lW === 0 && wL === 0 && lL === 0) return null;
              return (
                <Animated.View
                  entering={FadeIn.delay(400).duration(500)}
                  style={{ marginTop: 14, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: "rgba(74,222,128,0.08)", borderRadius: 14, borderWidth: 1, borderColor: "rgba(74,222,128,0.25)", maxWidth: 320, width: "100%" }}
                >
                  <Text style={{ color: "#4ADE80", fontSize: 10, fontWeight: "900", letterSpacing: 1.5, marginBottom: 8, textAlign: "center" }}>📊 YOUR DEBATE RECORD</Text>
                  <View style={{ flexDirection: "row", justifyContent: "space-around" }}>
                    <View style={{ alignItems: "center" }}>
                      <Text style={{ color: "#fff", fontSize: 15, fontWeight: "900" }}>{wW}W–{lW}L</Text>
                      <Text style={{ color: "rgba(255,215,0,0.7)", fontSize: 9, fontWeight: "700", marginTop: 2 }}>{debateWinner.name?.toUpperCase()}</Text>
                    </View>
                    {(h2hMine + h2hTheirs) > 0 && (
                      <View style={{ alignItems: "center" }}>
                        <Text style={{ color: "rgba(255,255,255,0.55)", fontSize: 13, fontWeight: "700" }}>{h2hMine}–{h2hTheirs}</Text>
                        <Text style={{ color: "rgba(255,255,255,0.35)", fontSize: 9, fontWeight: "700", marginTop: 2 }}>H2H</Text>
                      </View>
                    )}
                    {(wL > 0 || lL > 0) && debateLoser && (
                      <View style={{ alignItems: "center" }}>
                        <Text style={{ color: "rgba(255,255,255,0.55)", fontSize: 15, fontWeight: "800" }}>{wL}W–{lL}L</Text>
                        <Text style={{ color: "rgba(255,255,255,0.35)", fontSize: 9, fontWeight: "700", marginTop: 2 }}>{debateLoser.name?.toUpperCase()}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={{ color: "rgba(74,222,128,0.5)", fontSize: 9, textAlign: "center", marginTop: 8 }}>TAP SHARE TO BRAG ABOUT IT →</Text>
                </Animated.View>
              );
            })()}

            {/* Parting shot */}
            {(() => {
              const ps = messages.find((m) => m.isPartingShot);
              if (!ps) return null;
              const clipId = `parting-${ps.id}`;
              return (
                <View style={{ marginTop: 14, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: "rgba(255,80,80,0.10)", borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,80,80,0.40)", maxWidth: 320, width: "100%" }}>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 5 }}>
                    <Text style={{ color: "#FF6B6B", fontSize: 10, fontWeight: "900", letterSpacing: 1.5 }}>🔥 PARTING SHOT</Text>
                    {voiceEnabled && (
                      <Pressable
                        onPress={async () => {
                          if (replayingClip === clipId) return;
                          setReplayingClip(clipId);
                          try { await playTTS("/api/persona-speak", { text: ps.text, personaId: ps.speakerId }, { volume: getPersonaVoiceVolume(ps.speakerId) }); } catch { /* ignore */ } finally { setReplayingClip(null); }
                        }}
                        style={{ padding: 3 }}
                      >
                        {replayingClip === clipId
                          ? <ActivityIndicator size={11} color="#FF6B6B" />
                          : <Ionicons name="play-circle" size={16} color="rgba(255,107,107,0.7)" />}
                      </Pressable>
                    )}
                  </View>
                  <Text style={{ color: "rgba(255,255,255,0.92)", fontSize: 12, lineHeight: 18, textAlign: "center", fontStyle: "italic" }}>"{ps.text}"</Text>
                  <Text style={{ color: "rgba(255,107,107,0.65)", fontSize: 10, fontWeight: "700", textAlign: "center", marginTop: 5 }}>— {ps.speakerName}</Text>
                </View>
              );
            })()}

            {/* Reaction card — Trump if he's in the debate, loser otherwise */}
            {(() => {
              const trumpInDebate = interviewerId === "trump" || intervieweeId === "trump";
              const reactorName = trumpInDebate ? "Trump" : (debateLoser?.name ?? "Loser");
              const label = trumpInDebate ? "TRUMP'S REACTION" : `${reactorName.toUpperCase()}'S REACTION`;
              if (debateTrumpRoast) {
                const clipId = "reaction-clip";
                return (
                  <Animated.View entering={FadeIn.delay(200).duration(500)} style={{ marginTop: 14, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: "rgba(255,107,53,0.12)", borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,107,53,0.40)", maxWidth: 320, width: "100%" }}>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 6 }}>
                      <Ionicons name="flame" size={13} color="#FF6B35" />
                      <Text style={{ color: "#FF6B35", fontSize: 10, fontWeight: "900", letterSpacing: 1.5 }}>{label}</Text>
                      <Ionicons name="flame" size={13} color="#FF6B35" />
                      {voiceEnabled && debateTrumpRoastSpeakerId && (
                        <Pressable
                          onPress={async () => {
                            if (replayingClip === clipId) return;
                            setReplayingClip(clipId);
                            try { await playTTS("/api/persona-speak", { text: debateTrumpRoast, personaId: debateTrumpRoastSpeakerId }, { volume: getPersonaVoiceVolume(debateTrumpRoastSpeakerId) }); } catch { /* ignore */ } finally { setReplayingClip(null); }
                          }}
                          style={{ padding: 3 }}
                        >
                          {replayingClip === clipId
                            ? <ActivityIndicator size={11} color="#FF6B35" />
                            : <Ionicons name="play-circle" size={16} color="rgba(255,107,53,0.7)" />}
                        </Pressable>
                      )}
                    </View>
                    <Text style={{ color: "rgba(255,255,255,0.92)", fontSize: 12, lineHeight: 18, textAlign: "center", fontStyle: "italic" }}>"{debateTrumpRoast}"</Text>
                  </Animated.View>
                );
              }
              if (isLoadingDebateRoast) {
                return (
                  <View style={{ marginTop: 14, flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <ActivityIndicator size="small" color="#FF6B35" />
                    <Text style={{ color: "rgba(255,107,53,0.75)", fontSize: 12, fontWeight: "700" }}>{reactorName} is fuming...</Text>
                  </View>
                );
              }
              return null;
            })()}

            {/* Winner's taunt at the loser */}
            {debateWinnerSpeech && debateWinner ? (() => {
              const clipId = "winner-speech-clip";
              return (
                <Animated.View entering={FadeIn.delay(400).duration(500)} style={{ marginTop: 14, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: "rgba(255,215,0,0.08)", borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,215,0,0.35)", maxWidth: 320, width: "100%" }}>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 6 }}>
                    <Text style={{ color: "#FFD700", fontSize: 10, fontWeight: "900", letterSpacing: 1.5 }}>🏆 WINNER'S REBUTTAL</Text>
                    {voiceEnabled && (
                      <Pressable
                        onPress={async () => {
                          if (replayingClip === clipId) return;
                          setReplayingClip(clipId);
                          try { await playTTS("/api/persona-speak", { text: debateWinnerSpeech, personaId: debateWinner.id }, { volume: getPersonaVoiceVolume(debateWinner.id) }); } catch { /* ignore */ } finally { setReplayingClip(null); }
                        }}
                        style={{ padding: 3 }}
                      >
                        {replayingClip === clipId
                          ? <ActivityIndicator size={11} color="#FFD700" />
                          : <Ionicons name="play-circle" size={16} color="rgba(255,215,0,0.7)" />}
                      </Pressable>
                    )}
                  </View>
                  <Text style={{ color: "rgba(255,255,255,0.92)", fontSize: 12, lineHeight: 18, textAlign: "center", fontStyle: "italic" }}>"{debateWinnerSpeech}"</Text>
                  <Text style={{ color: "rgba(255,215,0,0.6)", fontSize: 10, fontWeight: "700", textAlign: "center", marginTop: 5 }}>— {debateWinner.name}</Text>
                </Animated.View>
              );
            })() : null}

            {/* Tokens */}
            {debateTokenWinAmount ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10, paddingHorizontal: 14, paddingVertical: 6, backgroundColor: "rgba(255,215,0,0.12)", borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,215,0,0.35)" }}>
                <Ionicons name="logo-bitcoin" size={14} color="#FFD700" />
                <Text style={{ color: "#FFD700", fontSize: 13, fontWeight: "900" }}>+{debateTokenWinAmount} DC TOKENS</Text>
              </View>
            ) : null}

            <Pressable
              onPress={() => setShowDebateWinner(false)}
              style={{ marginTop: 22, paddingVertical: 13, paddingHorizontal: 32, backgroundColor: "#FFD700", borderRadius: 22 }}
            >
              <Text style={{ color: "#000", fontSize: 15, fontWeight: "900", letterSpacing: 1 }}>CHAMPION! 🏆</Text>
            </Pressable>
          </Animated.View>
          </ScrollView>
        </View>
      </Modal>

      {/* Coin animation on token award */}
      <TokenWinVideo
        visible={debateTokenWinVisible}
        onClose={() => setDebateTokenWinVisible(false)}
        amount={debateTokenWinAmount}
        source="Debate Win"
      />

      {/* Audio connecting overlay — shows until first voice plays */}
      {phase === "live" && !firstAudioPlayed && (
        <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(600)} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.78)", alignItems: "center", justifyContent: "center", zIndex: 200, pointerEvents: "none" }}>
          <ActivityIndicator size="large" color="#FFD700" />
          <Text style={{ color: "#FFD700", fontSize: 15, fontWeight: "900", marginTop: 14, letterSpacing: 1.5 }}>🎙️ AUDIO CONNECTING</Text>
          <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 12, marginTop: 6 }}>Voices loading — stay tuned!</Text>
        </Animated.View>
      )}

      {phase === "ended" && (
        <Animated.View entering={FadeInDown.duration(300)} style={[s.endedBar, { paddingBottom: insets.bottom + webBottom + 12 }]}>
          <Text style={s.endedTitle}>DEBATE COMPLETE</Text>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 8, flexWrap: "wrap", justifyContent: "center" }}>
            <Pressable onPress={() => { setPhase("setup"); setDebateBetPick(null); setDebateBetResult(null); }} style={s.endedBtnSecondary}>
              <Ionicons name="arrow-back" size={14} color="#fff" />
              <Text style={{ color: "#fff", fontSize: 12, fontWeight: "800" }}>NEW BOOKING</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push(savedSessionId ? `/interview-history/${savedSessionId}` : "/interview-history")}
              style={s.endedBtnPrimary}
              testID="view-transcript"
            >
              <Ionicons name="document-text-outline" size={14} color="#000" />
              <Text style={{ color: "#000", fontSize: 12, fontWeight: "900" }}>VIEW TRANSCRIPT</Text>
            </Pressable>
            <ShareAppButton variant="pill" area="arena" />
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setShareTab("viral");
                setShowShareModal(true);
              }}
              style={[s.endedBtnSecondary, { borderColor: "rgba(74,222,128,0.5)", backgroundColor: "rgba(74,222,128,0.1)" }]}
            >
              <Ionicons name="share-social" size={14} color="#4ADE80" />
              <Text style={{ color: "#4ADE80", fontSize: 12, fontWeight: "800" }}>SHARE</Text>
            </Pressable>
            <Pressable onPress={openInterviewPoll} style={[s.endedBtnSecondary, { borderColor: "rgba(255,215,0,0.4)" }]}>
              <Ionicons name="bar-chart" size={14} color="#FFD700" />
              <Text style={{ color: "#FFD700", fontSize: 12, fontWeight: "800" }}>POLL</Text>
            </Pressable>
          </View>
        </Animated.View>
      )}

      {/* Topics panel */}
      <Modal visible={topicsPanelOpen} transparent animationType="slide" onRequestClose={() => setTopicsPanelOpen(false)}>
        <View style={s.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setTopicsPanelOpen(false)} />
          <View style={s.topicsSheet}>
            <View style={s.handle} />
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
              <Text style={{ flex: 1, color: "#fff", fontSize: 18, fontWeight: "900" }}>QUESTION QUEUE</Text>
              <Pressable onPress={() => setTopicsPanelOpen(false)}><Ionicons name="close" size={22} color="#fff" /></Pressable>
            </View>
            <ScrollView style={{ maxHeight: 480 }}>
              {topics.map((t, i) => {
                const isCurrent = i === topicIdx;
                const isDone = completedTopics.has(t.id);
                return (
                  <View key={t.id} style={[s.queueRow, isCurrent && s.queueRowCurrent]}>
                    <View style={[s.queueNum, isDone && { backgroundColor: "rgba(74,222,128,0.25)" }, isCurrent && { backgroundColor: "#FFD700" }]}>
                      {isDone ? (
                        <Ionicons name="checkmark" size={14} color="#4ADE80" />
                      ) : (
                        <Text style={[{ fontSize: 12, fontWeight: "900", color: isCurrent ? "#000" : "#FFD700" }]}>{i + 1}</Text>
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: isCurrent ? "#FFD700" : "#fff", fontSize: 13, fontWeight: "800" }}>{t.title}</Text>
                      <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, marginTop: 2 }}>{t.description}</Text>
                    </View>
                  </View>
                );
              })}
              <View style={{ height: 30 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Lies sheet */}
      <Modal visible={liesSheetOpen} transparent animationType="slide" onRequestClose={() => setLiesSheetOpen(false)}>
        <View style={s.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setLiesSheetOpen(false)} />
          <View style={s.topicsSheet}>
            <View style={s.handle} />
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
              <Ionicons name="flash" size={20} color="#ff4d4d" />
              <Text style={{ flex: 1, color: "#fff", fontSize: 18, fontWeight: "900", marginLeft: 8 }}>LIE DETECTOR · {lies.length}</Text>
              <Pressable onPress={() => setLiesSheetOpen(false)}><Ionicons name="close" size={22} color="#fff" /></Pressable>
            </View>
            <ScrollView style={{ maxHeight: 480 }}>
              {lies.length === 0 ? (
                <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, textAlign: "center", padding: 30 }}>No flagged statements yet. The lightning will strike when something doesn't add up.</Text>
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

      {/* ── Off-screen PersonaStatsCard for image capture ─────────────── */}
      {hofCardData && (
        <View style={{ position: "absolute", left: -9999, top: -9999 }} pointerEvents="none">
          <PersonaStatsCard ref={personaStatsCardRef} data={hofCardData} />
        </View>
      )}

      {/* ── Hall of Fame Modal ──────────────────────────────────────────── */}
      <Modal visible={showHallOfFame} transparent animationType="fade" onRequestClose={() => setShowHallOfFame(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.88)", justifyContent: "flex-end" }}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowHallOfFame(false)} />
          <View style={{ backgroundColor: "#0a0a10", borderTopLeftRadius: 28, borderTopRightRadius: 28, borderTopWidth: 1.5, borderColor: "rgba(255,215,0,0.35)", padding: 20, maxHeight: "88%" }}>
            {/* Handle */}
            <View style={{ alignSelf: "center", width: 44, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.18)", marginBottom: 16 }} />

            {/* Header */}
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 18 }}>
              <Text style={{ fontSize: 22 }}>🏆</Text>
              <View style={{ marginLeft: 10, flex: 1 }}>
                <Text style={{ color: "#FFD700", fontSize: 17, fontWeight: "900", letterSpacing: 0.8 }}>DEBATE HALL OF FAME</Text>
                <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, marginTop: 2 }}>All-time rankings · updated in real time</Text>
              </View>
              <Pressable onPress={handleHofShare} disabled={hofShareLoading} hitSlop={10} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,215,0,0.12)", borderWidth: 1, borderColor: "rgba(255,215,0,0.3)", alignItems: "center", justifyContent: "center", marginRight: 8, opacity: hofShareLoading ? 0.6 : 1 }} accessibilityLabel="Share leaderboard">
                {hofShareLoading
                  ? <ActivityIndicator size="small" color="#FFD700" />
                  : <Ionicons name="share-social" size={17} color="#FFD700" />}
              </Pressable>
              <Pressable onPress={() => setShowHallOfFame(false)}>
                <Ionicons name="close" size={22} color="rgba(255,255,255,0.4)" />
              </Pressable>
            </View>

            {hofLoading ? (
              <View style={{ alignItems: "center", paddingVertical: 40 }}>
                <ActivityIndicator size="large" color="#FFD700" />
                <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, marginTop: 12 }}>Loading leaderboard…</Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Global leaderboard */}
                {hofData && hofData.leaderboard.length > 0 ? (
                  <>
                    <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 10, fontWeight: "900", letterSpacing: 1.2, marginBottom: 10 }}>GLOBAL TOP 10 — WIN %</Text>
                    {hofData.leaderboard.map((entry, idx) => {
                      const portrait = PERSONA_PORTRAITS[entry.personaId];
                      const pName = debaterPool.find(p => p.id === entry.personaId)?.name || entry.personaId;
                      const rivalName = entry.bestRivalId
                        ? (debaterPool.find(p => p.id === entry.bestRivalId)?.name || entry.bestRivalId)
                        : null;
                      const rankColors = ["#FFD700", "#C0C0C0", "#CD7F32"];
                      const rankColor = idx < 3 ? rankColors[idx] : "rgba(255,255,255,0.35)";
                      const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : null;
                      return (
                        <View key={entry.personaId} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)" }}>
                          {/* Rank */}
                          <View style={{ width: 28, alignItems: "center" }}>
                            {medal ? (
                              <Text style={{ fontSize: 18 }}>{medal}</Text>
                            ) : (
                              <Text style={{ color: rankColor, fontSize: 13, fontWeight: "900" }}>#{idx + 1}</Text>
                            )}
                          </View>
                          {/* Portrait */}
                          {portrait ? (
                            <Image source={portrait} style={{ width: 40, height: 40, borderRadius: 20, marginHorizontal: 10, borderWidth: 1.5, borderColor: rankColor }} />
                          ) : (
                            <View style={{ width: 40, height: 40, borderRadius: 20, marginHorizontal: 10, backgroundColor: "rgba(255,215,0,0.15)", alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: rankColor }}>
                              <Text style={{ color: rankColor, fontSize: 14, fontWeight: "900" }}>{pName.charAt(0)}</Text>
                            </View>
                          )}
                          {/* Name + record */}
                          <View style={{ flex: 1 }}>
                            <Text style={{ color: "#fff", fontSize: 14, fontWeight: "800" }} numberOfLines={1}>{pName}</Text>
                            <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, marginTop: 2 }}>
                              {entry.totalWins}W–{entry.totalLosses}L
                              {rivalName ? <Text style={{ color: "rgba(96,165,250,0.75)" }}>  ·  dominates {rivalName.split(" ")[0]} ({entry.bestRivalWins}×)</Text> : null}
                            </Text>
                          </View>
                          {/* Win % badge */}
                          <View style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, backgroundColor: idx < 3 ? "rgba(255,215,0,0.12)" : "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: idx < 3 ? "rgba(255,215,0,0.4)" : "rgba(255,255,255,0.12)" }}>
                            <Text style={{ color: idx < 3 ? "#FFD700" : "rgba(255,255,255,0.7)", fontSize: 15, fontWeight: "900" }}>{entry.winPct}%</Text>
                          </View>
                          {/* Per-persona share button */}
                          <Pressable
                            onPress={() => handlePersonaHofShare(pName, entry.winPct, entry.totalWins, entry.totalLosses, idx + 1, rivalName, entry.bestRivalWins, entry.personaId, portrait)}
                            hitSlop={8}
                            style={{ marginLeft: 8, width: 30, height: 30, borderRadius: 15, backgroundColor: "rgba(255,215,0,0.08)", borderWidth: 1, borderColor: "rgba(255,215,0,0.25)", alignItems: "center", justifyContent: "center" }}
                            accessibilityLabel={`Share ${pName}'s stats`}
                          >
                            <Ionicons name="share-social" size={13} color="#FFD700" />
                          </Pressable>
                        </View>
                      );
                    })}
                  </>
                ) : (
                  <View style={{ alignItems: "center", paddingVertical: 30 }}>
                    <Text style={{ fontSize: 36 }}>🏆</Text>
                    <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 14, fontWeight: "700", marginTop: 12 }}>No data yet</Text>
                    <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 12, marginTop: 6, textAlign: "center" }}>Complete 5+ debates to appear here.</Text>
                  </View>
                )}

                {/* User's personal picks */}
                {hofData && hofData.userPicks.length > 0 && (
                  <>
                    <View style={{ marginTop: 22, marginBottom: 10, flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Ionicons name="person" size={13} color="#60a5fa" />
                      <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 10, fontWeight: "900", letterSpacing: 1.2 }}>YOUR PICKS — WATCHED WIN MOST</Text>
                    </View>
                    {hofData.userPicks.map((pick, idx) => {
                      const portrait = PERSONA_PORTRAITS[pick.personaId];
                      const pName = debaterPool.find(p => p.id === pick.personaId)?.name || pick.personaId;
                      const total = pick.wins + pick.losses;
                      const pct = total > 0 ? Math.round(pick.wins / total * 100) : 0;
                      return (
                        <View key={pick.personaId} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.05)" }}>
                          {portrait ? (
                            <Image source={portrait} style={{ width: 34, height: 34, borderRadius: 17, marginRight: 10, borderWidth: 1, borderColor: "rgba(96,165,250,0.5)" }} />
                          ) : (
                            <View style={{ width: 34, height: 34, borderRadius: 17, marginRight: 10, backgroundColor: "rgba(96,165,250,0.15)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(96,165,250,0.4)" }}>
                              <Text style={{ color: "#60a5fa", fontSize: 13, fontWeight: "900" }}>{pName.charAt(0)}</Text>
                            </View>
                          )}
                          <View style={{ flex: 1 }}>
                            <Text style={{ color: "#fff", fontSize: 13, fontWeight: "700" }} numberOfLines={1}>{pName}</Text>
                            <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, marginTop: 1 }}>{pick.wins}W–{pick.losses}L  ·  {pct}% win rate</Text>
                          </View>
                          <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, backgroundColor: "rgba(96,165,250,0.1)", borderWidth: 1, borderColor: "rgba(96,165,250,0.3)" }}>
                            <Text style={{ color: "#60a5fa", fontSize: 13, fontWeight: "900" }}>{pick.wins} wins</Text>
                          </View>
                          {/* Per-persona share button */}
                          <Pressable
                            onPress={() => handlePersonaHofShare(pName, pct, pick.wins, pick.losses, idx + 1, undefined, undefined, pick.personaId, portrait)}
                            hitSlop={8}
                            style={{ marginLeft: 8, width: 28, height: 28, borderRadius: 14, backgroundColor: "rgba(96,165,250,0.08)", borderWidth: 1, borderColor: "rgba(96,165,250,0.25)", alignItems: "center", justifyContent: "center" }}
                            accessibilityLabel={`Share ${pName}'s stats`}
                          >
                            <Ionicons name="share-social" size={12} color="#60a5fa" />
                          </Pressable>
                        </View>
                      );
                    })}
                  </>
                )}

                <View style={{ height: 24 }} />
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Interview Poll Modal */}
      <Modal visible={showPollModal} transparent animationType="fade" onRequestClose={() => setShowPollModal(false)}>
        <Pressable style={s.modalOverlay} onPress={() => setShowPollModal(false)}>
          <Pressable style={s.pollCard} onPress={(e) => e.stopPropagation()}>
            <LinearGradient colors={["#1a1a0a", "#0a0a0a"]} style={StyleSheet.absoluteFill} borderRadius={20} />
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#ff4d4d" }} />
                <Text style={{ color: "#fff", fontSize: 12, fontWeight: "900", letterSpacing: 1 }}>LIVE POLL</Text>
              </View>
              <Pressable onPress={() => setShowPollModal(false)}><Ionicons name="close" size={20} color="rgba(255,255,255,0.4)" /></Pressable>
            </View>

            {pollLoading && !pollQuestion ? (
              <View style={{ alignItems: "center", padding: 24 }}>
                <ActivityIndicator color="#FFD700" />
                <Text style={{ color: "#888", fontSize: 12, marginTop: 10 }}>Generating viral poll…</Text>
              </View>
            ) : pollQuestion ? (
              <>
                <Text style={{ color: "#FFD700", fontSize: 16, fontWeight: "900", textAlign: "center", marginBottom: 18, lineHeight: 22 }}>
                  {pollQuestion.question}
                </Text>

                <View style={{ gap: 10, marginBottom: 16 }}>
                  {(["A", "B"] as const).map((side) => {
                    const isA = side === "A";
                    const opt = isA ? pollQuestion.optionA : pollQuestion.optionB;
                    const votes = isA ? pollVoteA : pollVoteB;
                    const total = pollVoteA + pollVoteB;
                    const pct = total > 0 ? Math.round((votes / total) * 100) : 0;
                    const voted = myPollVote === side;
                    const anyVote = myPollVote !== null;
                    return (
                      <Pressable
                        key={side}
                        onPress={() => castInterviewVote(side)}
                        disabled={anyVote}
                        style={{ borderRadius: 12, borderWidth: 1.5, borderColor: voted ? "#FFD700" : "rgba(255,255,255,0.12)", overflow: "hidden" }}
                      >
                        {anyVote && (
                          <View style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${pct}%` as any, backgroundColor: voted ? "rgba(255,215,0,0.2)" : "rgba(255,255,255,0.06)", borderRadius: 10 }} />
                        )}
                        <View style={{ flexDirection: "row", alignItems: "center", padding: 14, gap: 10 }}>
                          <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: voted ? "#FFD700" : "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" }}>
                            <Text style={{ color: voted ? "#000" : "#fff", fontSize: 12, fontWeight: "900" }}>{side}</Text>
                          </View>
                          <Text style={{ flex: 1, color: voted ? "#FFD700" : "#fff", fontSize: 14, fontWeight: "700" }}>{opt}</Text>
                          {anyVote && <Text style={{ color: voted ? "#FFD700" : "rgba(255,255,255,0.5)", fontSize: 13, fontWeight: "900" }}>{pct}%</Text>}
                        </View>
                      </Pressable>
                    );
                  })}
                </View>

                {myPollVote && (
                  <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, textAlign: "center", marginBottom: 12 }}>
                    {pollVoteA + pollVoteB} vote{pollVoteA + pollVoteB !== 1 ? "s" : ""} cast
                  </Text>
                )}

                <View style={{ flexDirection: "row", gap: 10 }}>
                  <Pressable onPress={() => { setPollQuestion(null); openInterviewPoll(); }} style={{ flex: 1, padding: 12, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.06)", alignItems: "center" }}>
                    <Ionicons name="refresh" size={16} color="#888" />
                  </Pressable>
                  <Pressable onPress={shareInterviewPoll} style={{ flex: 3, padding: 12, borderRadius: 10, backgroundColor: "#FFD700", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}>
                    <Ionicons name="share-social" size={16} color="#000" />
                    <Text style={{ color: "#000", fontSize: 13, fontWeight: "900" }}>SHARE POLL</Text>
                  </Pressable>
                </View>

                {pollQuestion.hashtags?.length > 0 && (
                  <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 10, textAlign: "center", marginTop: 10 }}>
                    {pollQuestion.hashtags.map((h: string) => `#${h}`).join(" ")}
                  </Text>
                )}
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>

      {renderPaywall()}

      {/* ── Share / Transcript Modal ─────────────────────────────────────── */}
      <Modal visible={showShareModal} transparent animationType="slide" onRequestClose={closeShareModal}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.82)", justifyContent: "flex-end" }}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeShareModal} />
          <View style={{ backgroundColor: "#0F0F14", borderTopLeftRadius: 26, borderTopRightRadius: 26, borderTopWidth: 1, borderColor: "rgba(74,222,128,0.3)", padding: 18, maxHeight: "88%" }}>
            {/* Handle */}
            <View style={{ alignSelf: "center", width: 44, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.18)", marginBottom: 14 }} />

            {/* Header */}
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 14 }}>
              <Ionicons name="share-social" size={18} color="#4ADE80" />
              <Text style={{ flex: 1, color: "#fff", fontSize: 16, fontWeight: "900", marginLeft: 8, letterSpacing: 0.5 }}>SHARE DEBATE</Text>
              <Pressable onPress={closeShareModal}>
                <Ionicons name="close" size={22} color="rgba(255,255,255,0.5)" />
              </Pressable>
            </View>

            {/* Tab bar */}
            <View style={{ flexDirection: "row", marginBottom: 14, backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 12, padding: 3 }}>
              {(["viral", "transcript"] as const).map((tab) => (
                <Pressable
                  key={tab}
                  onPress={() => setShareTab(tab)}
                  style={{ flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: "center",
                    backgroundColor: shareTab === tab ? "rgba(74,222,128,0.15)" : "transparent",
                    borderWidth: shareTab === tab ? 1 : 0,
                    borderColor: "rgba(74,222,128,0.4)" }}
                >
                  <Text style={{ color: shareTab === tab ? "#4ADE80" : "rgba(255,255,255,0.45)", fontSize: 11, fontWeight: "900", letterSpacing: 0.5 }}>
                    {tab === "viral" ? "🔥 VIRAL POST" : "📋 FULL TRANSCRIPT"}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Content preview */}
            {(() => {
              const { viralText, fullTranscript, aName, bName, topicStr } = generateShareContent();
              const displayText = shareTab === "viral" ? viralText : fullTranscript;

              const doGenerateFightCard = async () => {
                if (fightCardLoading) return;
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setFightCardPreviewUriSafe(null);
                fightCardFileUriRef.current = null;
                setFightCardLoading(true);
                // Snapshot the token so we can detect if the modal was closed
                // (or DISMISS tapped) while this async generation was in flight.
                const myToken = fightCardGenTokenRef.current;
                try {
                  const rec = debateRecordsRef.current;
                  const body = JSON.stringify({
                    personaAId: interviewerId,
                    personaAName: aName,
                    personaAWins: rec?.aWins ?? 0,
                    personaALosses: rec?.aLosses ?? 0,
                    personaBId: intervieweeId,
                    personaBName: bName,
                    personaBWins: rec?.bWins ?? 0,
                    personaBLosses: rec?.bLosses ?? 0,
                    topic: topicStr,
                    h2hAWins: rec?.h2hAWins ?? 0,
                    h2hBWins: rec?.h2hBWins ?? 0,
                  });
                  const apiBase = getApiUrl("");
                  const resp = await fetch(`${apiBase}/api/arena/fight-card`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", ...(deviceId ? { "x-device-id": deviceId } : {}) },
                    body,
                  });
                  if (!resp.ok) throw new Error("Fight card generation failed");

                  if (Platform.OS === "web") {
                    const blob = await resp.blob();
                    const url = URL.createObjectURL(blob);
                    // If the modal was closed while we were fetching, revoke
                    // immediately instead of storing a URL nobody will see.
                    if (fightCardGenTokenRef.current !== myToken) {
                      URL.revokeObjectURL(url);
                      return;
                    }
                    setFightCardPreviewUriSafe(url);
                  } else {
                    const FileSystem = await import("expo-file-system");
                    const blob = await resp.blob();
                    const reader = new FileReader();
                    const base64 = await new Promise<string>((resolve, reject) => {
                      reader.onload = () => {
                        const result = reader.result as string;
                        resolve(result.split(",")[1]);
                      };
                      reader.onerror = reject;
                      reader.readAsDataURL(blob);
                    });
                    const fileUri = `${FileSystem.cacheDirectory}fight-card-${interviewerId}-vs-${intervieweeId}.png`;
                    await FileSystem.writeAsStringAsync(fileUri, base64, { encoding: FileSystem.EncodingType.Base64 });
                    // If the modal was closed while we were generating, delete
                    // the just-written temp file instead of storing its URI.
                    if (fightCardGenTokenRef.current !== myToken) {
                      await FileSystem.deleteAsync(fileUri, { idempotent: true }).catch(() => {});
                      return;
                    }
                    fightCardFileUriRef.current = fileUri;
                    setFightCardPreviewUri(fileUri);
                  }
                } catch (err) {
                  try {
                    await Share.share({ message: viralText, title: `${aName} vs ${bName}` });
                  } catch {}
                } finally {
                  setFightCardLoading(false);
                }
              };

              return (
                <>
                  <ScrollView
                    style={{ maxHeight: 340, backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", marginBottom: 14 }}
                    contentContainerStyle={{ padding: 14 }}
                    showsVerticalScrollIndicator={true}
                  >
                    <Text style={{ color: "rgba(255,255,255,0.88)", fontSize: 13, lineHeight: 20, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" }}>
                      {displayText}
                    </Text>
                  </ScrollView>

                  {/* QR code — shown only on the viral post tab */}
                  {shareTab === "viral" && (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14, backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", padding: 12 }}>
                      <Image
                        source={{ uri: "https://api.qrserver.com/v1/create-qr-code/?size=90x90&color=ffffff&bgcolor=000000&data=https%3A%2F%2Fthearena.rip" }}
                        style={{ width: 90, height: 90, borderRadius: 8 }}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: "#fff", fontSize: 13, fontWeight: "900", marginBottom: 3 }}>Scan to watch live</Text>
                        <Text style={{ color: "rgba(255,255,255,0.55)", fontSize: 12 }}>Point your camera at this code to open The Arena and watch voice-cloned AI personas debate in real time.</Text>
                        <Text style={{ color: "#4ADE80", fontSize: 12, fontWeight: "800", marginTop: 4 }}>thearena.rip</Text>
                      </View>
                    </View>
                  )}

                  {/* Action buttons */}
                  <View style={{ flexDirection: "row", gap: 10 }}>
                    <Pressable
                      onPress={async () => {
                        try {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          const Clipboard = await import("expo-clipboard");
                          await Clipboard.setStringAsync(displayText);
                        } catch {}
                      }}
                      style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingVertical: 13, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.07)", borderWidth: 1, borderColor: "rgba(255,255,255,0.15)" }}
                    >
                      <Ionicons name="copy-outline" size={16} color="#fff" />
                      <Text style={{ color: "#fff", fontSize: 13, fontWeight: "800" }}>COPY</Text>
                    </Pressable>
                    <Pressable
                      onPress={async () => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        try {
                          if (Platform.OS === "web" && navigator.share) {
                            await navigator.share({ title: `${aName} vs ${bName} — AI Debate`, text: displayText, url: "https://thearena.rip" });
                          } else {
                            await Share.share({ message: displayText, title: `${aName} vs ${bName}` });
                          }
                        } catch {}
                      }}
                      style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingVertical: 13, borderRadius: 14, backgroundColor: "rgba(74,222,128,0.15)", borderWidth: 1, borderColor: "rgba(74,222,128,0.45)" }}
                    >
                      <Ionicons name="share-social" size={16} color="#4ADE80" />
                      <Text style={{ color: "#4ADE80", fontSize: 13, fontWeight: "800" }}>SHARE</Text>
                    </Pressable>
                    {Platform.OS === "web" && (
                      <Pressable
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
                            shareTab === "viral" ? viralText.slice(0, 280) : `AI Debate: ${aName} vs ${bName}\n\nthearena.rip\n\n#AIDebate #TheArena`
                          )}`;
                          Linking.openURL(twitterUrl);
                        }}
                        style={{ width: 48, alignItems: "center", justifyContent: "center", paddingVertical: 13, borderRadius: 14, backgroundColor: "rgba(29,155,240,0.12)", borderWidth: 1, borderColor: "rgba(29,155,240,0.4)" }}
                      >
                        <Text style={{ color: "#1D9BF0", fontSize: 16, fontWeight: "900" }}>𝕏</Text>
                      </Pressable>
                    )}
                  </View>

                  {/* Fight Card preview thumbnail */}
                  {(fightCardPreviewUri || fightCardLoading) ? (
                    <View style={{ marginTop: 12, borderRadius: 14, overflow: "hidden", borderWidth: 1.5, borderColor: "rgba(255,215,0,0.5)", backgroundColor: "rgba(0,0,0,0.4)" }}>
                      {fightCardPreviewUri ? (
                        <Animated.View key="fc-image" entering={FadeIn.duration(400)} style={{ width: "100%", aspectRatio: 1.6 }}>
                          <Image
                            source={{ uri: fightCardPreviewUri }}
                            style={{ width: "100%", height: "100%", resizeMode: "contain" }}
                          />
                        </Animated.View>
                      ) : (
                        /* Spinner placeholder while regenerating — keeps layout stable */
                        <Animated.View key="fc-spinner" exiting={FadeOut.duration(200)} style={{ width: "100%", aspectRatio: 1.6, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.3)" }}>
                          <ActivityIndicator size="large" color="#FFD700" />
                          <Text style={{ color: "rgba(255,215,0,0.7)", fontSize: 11, fontWeight: "700", marginTop: 10, letterSpacing: 0.5 }}>GENERATING…</Text>
                        </Animated.View>
                      )}
                      <View style={{ flexDirection: "row", gap: 8, padding: 10 }}>
                        <Pressable
                          disabled={fightCardLoading}
                          onPress={() => {
                            fightCardGenTokenRef.current++;
                            setFightCardPreviewUriSafe(null);
                            const uri = fightCardFileUriRef.current;
                            fightCardFileUriRef.current = null;
                            if (Platform.OS !== "web" && uri) {
                              import("expo-file-system").then((fs) =>
                                fs.deleteAsync(uri, { idempotent: true }).catch(() => {})
                              );
                            }
                          }}
                          style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 11, borderRadius: 10, backgroundColor: fightCardLoading ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.07)", borderWidth: 1, borderColor: fightCardLoading ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.15)", opacity: fightCardLoading ? 0.5 : 1 }}
                        >
                          <Ionicons name="close" size={15} color="rgba(255,255,255,0.7)" />
                          <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: "800" }}>DISMISS</Text>
                        </Pressable>
                        <Pressable
                          disabled={fightCardLoading}
                          onPress={doGenerateFightCard}
                          style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 11, borderRadius: 10, backgroundColor: fightCardLoading ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.09)", borderWidth: 1, borderColor: fightCardLoading ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.25)", opacity: fightCardLoading ? 0.6 : 1 }}
                        >
                          {fightCardLoading
                            ? <ActivityIndicator size="small" color="rgba(255,255,255,0.6)" />
                            : <Ionicons name="refresh" size={15} color="rgba(255,255,255,0.85)" />
                          }
                          <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 12, fontWeight: "800" }}>REGENERATE</Text>
                        </Pressable>
                        {fightCardPreviewUri && (
                          <Pressable
                            onPress={async () => {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                              try {
                                if (Platform.OS === "web") {
                                  const a = document.createElement("a");
                                  a.href = fightCardPreviewUri;
                                  a.download = `fight-card-${interviewerId}-vs-${intervieweeId}.png`;
                                  a.click();
                                } else {
                                  const fileUri = fightCardFileUriRef.current;
                                  if (fileUri) {
                                    const Sharing = await import("expo-sharing");
                                    const canShare = await Sharing.isAvailableAsync();
                                    if (canShare) {
                                      await Sharing.shareAsync(fileUri, { mimeType: "image/png", dialogTitle: `${aName} vs ${bName} Fight Card` });
                                    }
                                  }
                                }
                              } catch {}
                            }}
                            style={{ flex: 2, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingVertical: 11, borderRadius: 10, backgroundColor: "rgba(255,215,0,0.18)", borderWidth: 1, borderColor: "rgba(255,215,0,0.6)" }}
                          >
                            <Ionicons name="download-outline" size={16} color="#FFD700" />
                            <Text style={{ color: "#FFD700", fontSize: 12, fontWeight: "900", letterSpacing: 0.5 }}>
                              {Platform.OS === "web" ? "DOWNLOAD" : "SHARE"}
                            </Text>
                          </Pressable>
                        )}
                      </View>
                    </View>
                  ) : (
                    /* Fight Card generate button */
                    <Pressable
                      disabled={fightCardLoading}
                      onPress={doGenerateFightCard}
                      style={{ marginTop: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 14, backgroundColor: fightCardLoading ? "rgba(255,215,0,0.06)" : "rgba(255,215,0,0.13)", borderWidth: 1, borderColor: fightCardLoading ? "rgba(255,215,0,0.2)" : "rgba(255,215,0,0.55)", opacity: fightCardLoading ? 0.7 : 1 }}
                    >
                      {fightCardLoading
                        ? <ActivityIndicator size="small" color="#FFD700" />
                        : <Ionicons name="image-outline" size={18} color="#FFD700" />
                      }
                      <Text style={{ color: "#FFD700", fontSize: 13, fontWeight: "900", letterSpacing: 0.5 }}>
                        {fightCardLoading ? "GENERATING FIGHT CARD…" : "🥊 PREVIEW FIGHT CARD"}
                      </Text>
                    </Pressable>
                  )}
                </>
              );
            })()}
          </View>
        </View>
      </Modal>
    </View>
  );

  function renderPaywall() {
    return (
      <Modal visible={showPaywall} transparent animationType="fade" onRequestClose={() => setShowPaywall(false)}>
        <View style={s.modalOverlay}>
          <View style={s.paywallCard}>
            {paywallSpeechPaused ? (
              <Animated.View style={[{ marginBottom: 4 }, paywallPulseStyle]}>
                <Ionicons name="volume-high" size={32} color="#FFD700" />
              </Animated.View>
            ) : (
              <Ionicons name="lock-closed" size={32} color="#FFD700" />
            )}
            {paywallSpeechPaused && (
              <Text style={{ color: "#FFD70099", fontSize: 11, marginBottom: 2, textAlign: "center" }}>
                Audio paused — resume when ready
              </Text>
            )}
            <Text style={s.paywallTitle}>Unlock Interview</Text>
            <Text style={s.paywallSub}>1 token per minute. Use a {duration}-minute session?</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 }}>
              <Image source={require("@/assets/images/dc-lightning-token.jpeg")} style={{ width: 14, height: 14, borderRadius: 7 }} />
              <Text style={{ color: "#FFD700", fontSize: 12, fontWeight: "800" }}>{balance?.totalAvailable ?? 0} tokens available</Text>
            </View>
            <Pressable onPress={unlockSession} disabled={isUnlocking} style={[s.paywallBtn, isUnlocking && { opacity: 0.6 }]}>
              {isUnlocking ? <ActivityIndicator color="#000" /> : <Text style={s.paywallBtnText}>Unlock {duration} min for {duration} tokens</Text>}
            </Pressable>
            <Pressable onPress={() => { setShowPaywall(false); router.push("/subscribe"); }} style={s.paywallSecondary}>
              <Text style={s.paywallSecondaryText}>Get more tokens</Text>
            </Pressable>
            <Pressable onPress={() => setShowPaywall(false)}>
              <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginTop: 10 }}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    );
  }
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0a" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  iconBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(255,255,255,0.06)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,215,0,0.2)" },
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle: { color: "#FFD700", fontSize: 14, fontWeight: "900", letterSpacing: 1 },
  headerSub: { color: "rgba(255,255,255,0.5)", fontSize: 10, marginTop: 2 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#ff4d4d" },
  liveText: { color: "#ff4d4d", fontSize: 11, fontWeight: "800" },

  sectionLabel: { color: "#FFD700", fontSize: 11, fontWeight: "800", letterSpacing: 1, marginBottom: 8 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  chipActive: { backgroundColor: "rgba(255,215,0,0.18)", borderColor: "#FFD700" },
  chipActiveGuest: { backgroundColor: "rgba(74,222,128,0.18)", borderColor: "#4ADE80" },
  chipText: { color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: "700" },
  chipTextActive: { color: "#fff" },

  personaCardRow: { flexDirection: "row", gap: 10, paddingVertical: 4 },
  personaCard: { width: 72, alignItems: "center" },
  personaAvatarWrap: { width: 60, height: 60, borderRadius: 30, overflow: "hidden", borderWidth: 2, borderColor: "rgba(255,255,255,0.1)" },
  personaAvatarWrapActive: { borderColor: "#FFD700", borderWidth: 2.5 },
  personaAvatarWrapActiveGuest: { borderColor: "#4ADE80", borderWidth: 2.5 },
  personaAvatar: { width: "100%", height: "100%" },
  personaAvatarFallback: { width: "100%", height: "100%", backgroundColor: "rgba(255,215,0,0.12)", alignItems: "center", justifyContent: "center" },
  personaAvatarInitials: { color: "#FFD700", fontSize: 18, fontWeight: "800" },
  personaCardName: { color: "rgba(255,255,255,0.6)", fontSize: 10, fontWeight: "700", marginTop: 5, textAlign: "center" },
  personaCardNameActive: { color: "#FFD700" },
  personaCardNameActiveGuest: { color: "#4ADE80" },
  personaCardRecord: { color: "rgba(255,215,0,0.75)", fontSize: 9, fontWeight: "700", marginTop: 2, textAlign: "center" },
  personaCardRecordGuest: { color: "rgba(74,222,128,0.75)" },
  personaCardHofRank: { color: "rgba(255,215,0,0.9)", fontSize: 9, fontWeight: "800", marginTop: 2, textAlign: "center" },
  personaCardH2H: { color: "rgba(255,215,0,0.55)", fontSize: 8, fontWeight: "600", marginTop: 1, textAlign: "center" },
  personaCardH2HGuest: { color: "rgba(74,222,128,0.55)" },

  durationRow: { flexDirection: "row", gap: 8 },
  durationCard: { flex: 1, padding: 14, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", alignItems: "center" },
  durationCardActive: { backgroundColor: "rgba(255,215,0,0.18)", borderColor: "#FFD700" },
  durationMins: { color: "#fff", fontSize: 26, fontWeight: "900" },
  durationMinsActive: { color: "#FFD700" },
  durationSub: { color: "rgba(255,255,255,0.5)", fontSize: 10, marginTop: -2 },
  durationSubActive: { color: "#FFD700" },
  durationCost: { color: "rgba(255,255,255,0.5)", fontSize: 10, marginTop: 6 },
  durationCostActive: { color: "rgba(255,215,0,0.85)" },

  mixRow: { flexDirection: "row", gap: 8 },
  mixCard: { flex: 1, padding: 12, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 6 },
  mixCardActive: { backgroundColor: "#FFD700", borderColor: "#FFD700" },
  mixText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  mixTextActive: { color: "#000" },
  styleRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  styleCard: { paddingVertical: 9, paddingHorizontal: 12, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", alignItems: "center", flexDirection: "row", gap: 5 },
  styleCardActive: { backgroundColor: "#FFD700", borderColor: "#FFD700" },
  styleText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  styleTextActive: { color: "#000" },

  topicsCard: { backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 14, padding: 12, borderWidth: 1, borderColor: "rgba(255,215,0,0.15)" },
  topicsHeader: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  topicsTitle: { color: "#FFD700", fontSize: 12, fontWeight: "800", letterSpacing: 1, flex: 1 },
  refreshTopicsBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(255,215,0,0.1)", borderWidth: 1, borderColor: "rgba(255,215,0,0.3)", borderRadius: 16, paddingHorizontal: 10, paddingVertical: 5 },
  refreshTopicsText: { color: "#FFD700", fontSize: 11, fontWeight: "800" },
  topicRow: { flexDirection: "row", alignItems: "flex-start", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.05)" },
  topicRowSelected: { backgroundColor: "rgba(255,215,0,0.06)", borderRadius: 8, borderWidth: 1, borderColor: "rgba(255,215,0,0.3)", marginHorizontal: -4, paddingHorizontal: 4 },
  topicNum: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center", marginRight: 10, marginTop: 2 },
  topicStartBadge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, backgroundColor: "#FFD700", alignSelf: "center", marginLeft: 6 },
  topicStartBadgeText: { color: "#000", fontSize: 9, fontWeight: "900", letterSpacing: 0.5 },
  topicNumText: { fontSize: 12, fontWeight: "900" },
  topicTitle: { color: "#fff", fontSize: 13, fontWeight: "700" },
  topicDesc: { color: "rgba(255,255,255,0.55)", fontSize: 11, marginTop: 2, lineHeight: 15 },
  eraTag: { alignSelf: "flex-start", paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, marginTop: 5 },
  eraTagText: { fontSize: 9, fontWeight: "900", letterSpacing: 0.5 },

  lieTallyStrip: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginHorizontal: 12, marginBottom: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, backgroundColor: "rgba(220,38,38,0.1)", borderWidth: 1, borderColor: "rgba(220,38,38,0.35)" },
  lieTallyMain: { flexDirection: "row", alignItems: "center", gap: 12 },
  lieTallyNum: { color: "#EF4444", fontSize: 38, fontWeight: "900", lineHeight: 42 },
  lieTallyLabel: { color: "#EF4444", fontSize: 9, fontWeight: "900", letterSpacing: 1 },
  lieTallySub: { color: "rgba(255,255,255,0.5)", fontSize: 10, marginTop: 1 },
  lieTallyBiggest: { alignItems: "flex-end" },
  lieTallyBiggestLabel: { color: "rgba(255,255,255,0.4)", fontSize: 8, fontWeight: "900", letterSpacing: 0.8 },
  lieTallyBiggestName: { color: "#fff", fontSize: 12, fontWeight: "800", maxWidth: 100 },
  lieTallyBiggestCount: { color: "#EF4444", fontSize: 10, fontWeight: "700" },

  startBtn: { marginTop: 20, paddingVertical: 16, borderRadius: 16, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8, backgroundColor: "#FFD700" },
  startBtnText: { color: "#000", fontSize: 16, fontWeight: "900", letterSpacing: 1 },
  startSub: { color: "rgba(255,255,255,0.5)", fontSize: 11, textAlign: "center", marginTop: 8 },

  topicStrip: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 10, marginHorizontal: 12, borderRadius: 12, backgroundColor: "rgba(255,215,0,0.08)", borderWidth: 1, borderColor: "rgba(255,215,0,0.25)" },
  topicStripLabel: { color: "rgba(255,215,0,0.7)", fontSize: 9, fontWeight: "900", letterSpacing: 1 },
  topicStripTitle: { color: "#fff", fontSize: 13, fontWeight: "800", marginTop: 2 },
  skipBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.05)" },
  skipText: { fontSize: 11, fontWeight: "800" },

  bubbleRow: { flexDirection: "row", marginVertical: 6 },
  bubble: { maxWidth: "82%", borderRadius: 14, paddingHorizontal: 12, paddingVertical: 9, borderWidth: 1 },
  bubbleInterviewer: { backgroundColor: "rgba(255,215,0,0.12)", borderColor: "rgba(255,215,0,0.35)", borderTopLeftRadius: 4 },
  bubbleInterviewee: { backgroundColor: "rgba(74,222,128,0.12)", borderColor: "rgba(74,222,128,0.35)", borderTopRightRadius: 4 },
  bubbleInterrupt: { borderStyle: "dashed" },
  bubbleName: { fontSize: 10, fontWeight: "900", letterSpacing: 0.5, marginBottom: 3 },
  bubbleText: { color: "#fff", fontSize: 14, lineHeight: 19 },

  endedBar: { position: "absolute", left: 0, right: 0, bottom: 0, padding: 14, backgroundColor: "rgba(20,20,20,0.95)", borderTopWidth: 1, borderTopColor: "rgba(255,215,0,0.3)", alignItems: "center" },
  endedTitle: { color: "#FFD700", fontSize: 13, fontWeight: "900", letterSpacing: 1 },
  endedBtnSecondary: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.15)" },
  endedBtnPrimary: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 16, backgroundColor: "#FFD700" },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "flex-end" },
  topicsSheet: { backgroundColor: "#0F0F12", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18, borderTopWidth: 1, borderColor: "rgba(255,215,0,0.2)" },
  handle: { alignSelf: "center", width: 44, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.2)", marginBottom: 12 },
  queueRow: { flexDirection: "row", alignItems: "flex-start", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.05)" },
  queueRowCurrent: { backgroundColor: "rgba(255,215,0,0.06)", borderRadius: 8, paddingHorizontal: 8 },
  queueNum: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center", marginRight: 10, backgroundColor: "rgba(255,215,0,0.12)" },

  paywallCard: { backgroundColor: "#15151A", margin: 30, padding: 20, borderRadius: 18, alignItems: "center", borderWidth: 1, borderColor: "rgba(255,215,0,0.3)" },
  paywallTitle: { color: "#fff", fontSize: 18, fontWeight: "900", marginTop: 6 },
  paywallSub: { color: "rgba(255,255,255,0.6)", fontSize: 12, marginTop: 4, textAlign: "center" },
  paywallBtn: { marginTop: 14, backgroundColor: "#FFD700", paddingVertical: 12, paddingHorizontal: 24, borderRadius: 14, alignItems: "center", minWidth: 220 },
  paywallBtnText: { color: "#000", fontSize: 13, fontWeight: "900" },
  paywallSecondary: { marginTop: 8, paddingVertical: 8 },
  paywallSecondaryText: { color: "#FFD700", fontSize: 12, fontWeight: "800" },

  iconBtnSm: { width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.06)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,215,0,0.2)" },
  liePill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, height: 28, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  liePillActive: { backgroundColor: "rgba(255,77,77,0.12)", borderColor: "rgba(255,77,77,0.5)" },
  liePillText: { color: "rgba(255,255,255,0.4)", fontSize: 12, fontWeight: "900" },

  lieCompareStrip: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginHorizontal: 12, marginTop: 4, marginBottom: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, backgroundColor: "rgba(0,0,0,0.25)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  lieCompareSide: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  lieCompareSideLeading: { backgroundColor: "rgba(255,77,77,0.1)" },
  lieCompareName: { color: "rgba(255,255,255,0.65)", fontSize: 11, fontWeight: "700", maxWidth: 110 },
  lieCompareNum: { color: "rgba(255,255,255,0.4)", fontSize: 16, fontWeight: "900" },
  lieCompareVs: { paddingHorizontal: 2 },

  stage: { flexDirection: "row", paddingHorizontal: 12, paddingTop: 6, paddingBottom: 8, gap: 10 },
  moderatorOverlay: { position: "absolute", left: 0, right: 0, top: 62, alignItems: "center", justifyContent: "center", zIndex: 12 },
  moderatorPortraitWrap: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  moderatorPortraitImg: { width: 52, height: 52, borderRadius: 26, borderWidth: 2, borderColor: "#FFD700" },
  moderatorPulseDot: { position: "absolute", bottom: -2, right: -2, width: 16, height: 16, borderRadius: 8, backgroundColor: "#FFD700", borderWidth: 2, borderColor: "#000" },
  moderatorName: { color: "#FFD700", fontSize: 11, fontWeight: "900", letterSpacing: 0.5, marginTop: 3 },
  moderatorLine: { color: "rgba(255,255,255,0.85)", fontSize: 10, fontWeight: "600", textAlign: "center", maxWidth: 200, marginTop: 2, backgroundColor: "rgba(0,0,0,0.72)", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  stageCol: { flex: 1, alignItems: "center" },
  portraitWrap: { width: 96, height: 96, borderRadius: 48, alignItems: "center", justifyContent: "center" },
  portraitGlow: { position: "absolute", width: 110, height: 110, borderRadius: 55, borderWidth: 2, shadowOpacity: 0.9, shadowRadius: 18, shadowOffset: { width: 0, height: 0 }, elevation: 8 },
  portraitImg: { width: 92, height: 92, borderRadius: 46, borderWidth: 2, borderColor: "rgba(0,0,0,0.6)" },
  thinkingDot: { position: "absolute", bottom: -2, right: -2, width: 26, height: 26, borderRadius: 13, backgroundColor: "#0a0a0a", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" },
  stageRole: { fontSize: 10, fontWeight: "900", letterSpacing: 1, marginTop: 6 },
  stageName: { color: "#fff", fontSize: 12, fontWeight: "800", marginTop: 1 },
  emoBars: { width: "100%", marginTop: 6, gap: 3 },
  emoBarRow: { height: 10, borderRadius: 5, backgroundColor: "rgba(255,255,255,0.06)", overflow: "hidden", justifyContent: "center" },
  emoBarFill: { position: "absolute", left: 0, top: 0, bottom: 0, opacity: 0.85, borderRadius: 5 },
  emoBarLabel: { color: "rgba(255,255,255,0.85)", fontSize: 8, fontWeight: "900", letterSpacing: 0.6, paddingLeft: 6 },

  bubbleCallIn: { backgroundColor: "rgba(96,165,250,0.12)", borderColor: "rgba(96,165,250,0.45)", borderWidth: 1, maxWidth: "92%" },

  lightning: { ...StyleSheet.absoluteFillObject, backgroundColor: "#ff2a2a" },
  lieFlashOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(255,77,77,0.18)", justifyContent: "center", alignItems: "center", zIndex: 999 },
  lieFlashWord: { color: "#ff4d4d", fontSize: 72, fontWeight: "900", letterSpacing: 8, opacity: 0.85, textShadowColor: "#ff0000", textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 24 },
  timeoutBanner: { position: "absolute", top: 60, left: 20, right: 20, backgroundColor: "rgba(220,38,38,0.92)", borderRadius: 14, paddingVertical: 12, paddingHorizontal: 18, alignItems: "center", zIndex: 5000, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 10, elevation: 20 },
  timeoutBannerText: { color: "#fff", fontWeight: "900" as const, fontSize: 15, letterSpacing: 0.5, textAlign: "center" },

  pollCard: { margin: 24, backgroundColor: "#15151A", borderRadius: 20, padding: 20, borderWidth: 1, borderColor: "rgba(255,215,0,0.3)", overflow: "hidden" as const },

  callinBar: { backgroundColor: "rgba(15,15,18,0.95)", borderTopWidth: 1, borderColor: "rgba(96,165,250,0.25)", paddingHorizontal: 10, paddingTop: 8, gap: 6 },
  callinNameRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 8, height: 28, borderRadius: 14, backgroundColor: "rgba(96,165,250,0.08)", borderWidth: 1, borderColor: "rgba(96,165,250,0.2)" },
  callinNameInput: { flex: 1, color: "#fff", fontSize: 12, padding: 0 },
  callinInputRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  callinInput: { flex: 1, minHeight: 40, maxHeight: 100, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 18, color: "#fff", fontSize: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" },
  callinSend: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#FFD700", alignItems: "center", justifyContent: "center" },
  callinMic: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(96,165,250,0.12)", borderWidth: 1, borderColor: "rgba(96,165,250,0.35)", alignItems: "center", justifyContent: "center" },
  callinMicActive: { backgroundColor: "rgba(255,77,77,0.18)", borderColor: "#ff4d4d" },
  truthMeter: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 8, height: 26, borderRadius: 13, backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" },
  truthLabel: { fontSize: 11, fontWeight: "700" as const, minWidth: 18, textAlign: "right" as const },
  truthTrack: { width: 38, height: 5, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.12)", overflow: "hidden" as const },
  truthFill: { height: "100%", borderRadius: 3 },

  lieRow: { backgroundColor: "rgba(255,77,77,0.06)", borderWidth: 1, borderColor: "rgba(255,77,77,0.25)", borderRadius: 12, padding: 12, marginBottom: 8 },
  lieHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  lieScore: { paddingHorizontal: 8, height: 22, borderRadius: 11, backgroundColor: "rgba(255,77,77,0.18)", alignItems: "center", justifyContent: "center" },
  lieQuote: { color: "#fff", fontSize: 13, fontStyle: "italic", marginTop: 4 },
  lieFact: { color: "#4ADE80", fontSize: 12, fontWeight: "800", marginTop: 6 },
  lieReason: { color: "rgba(255,255,255,0.6)", fontSize: 11, marginTop: 4 },
  voteRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.06)" },
  voteBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  voteBtnUpActive: { backgroundColor: "rgba(74,222,128,0.15)", borderColor: "rgba(74,222,128,0.5)" },
  voteBtnDownActive: { backgroundColor: "rgba(255,77,77,0.15)", borderColor: "rgba(255,77,77,0.5)" },
  voteBtnText: { color: "rgba(255,255,255,0.85)", fontSize: 12, fontWeight: "800" },
  voteTally: { color: "rgba(255,255,255,0.45)", fontSize: 11, fontWeight: "600", flex: 1, textAlign: "right" },

  // ── Room temperature meter ───────────────────────────────────────────────
  roomTempWrap: { flexDirection: "row", alignItems: "center", gap: 7, marginHorizontal: 14, marginVertical: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, backgroundColor: "rgba(255,80,0,0.07)", borderWidth: 1, borderColor: "rgba(255,80,0,0.2)" },
  roomTempLabel: { color: "rgba(255,255,255,0.55)", fontSize: 8, fontWeight: "900", letterSpacing: 0.6, minWidth: 68 },
  roomTempBarOuter: { flex: 1, height: 7, borderRadius: 4, backgroundColor: "rgba(255,80,0,0.14)", overflow: "hidden" },
  roomTempBarFill: { position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: 4 },
  roomTempPct: { color: "rgba(255,140,60,0.85)", fontSize: 10, fontWeight: "900", minWidth: 26, textAlign: "right" },
  roomTempPctHot: { color: "#ff2222" },
  // ─────────────────────────────────────────────────────────────────────────

  // ── Heat meter pill ──────────────────────────────────────────────────────
  heatPillWrap: { width: "100%", marginTop: 5, marginBottom: 1, alignItems: "center" },
  heatBarOuter: { width: "100%", height: 11, borderRadius: 6, backgroundColor: "rgba(255,80,0,0.12)", overflow: "hidden", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,80,0,0.3)" },
  heatBarFill: { position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: 6, backgroundColor: "#ff5500", opacity: 0.85 },
  heatBarLabel: { color: "rgba(255,255,255,0.9)", fontSize: 7, fontWeight: "900", letterSpacing: 0.5, paddingLeft: 5, zIndex: 1 },
  heatFlashPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: "rgba(255,30,30,0.28)", borderWidth: 1, borderColor: "#ff2a2a", alignItems: "center" },
  heatFlashText: { color: "#ff4d4d", fontSize: 9, fontWeight: "900", letterSpacing: 0.6 },
  // ─────────────────────────────────────────────────────────────────────────

  flagBtn: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", marginTop: 6, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  flagBtnDone: { backgroundColor: "rgba(255,77,77,0.12)", borderColor: "rgba(255,77,77,0.4)" },
  flagBtnText: { color: "rgba(255,255,255,0.6)", fontSize: 9, fontWeight: "900", letterSpacing: 0.6 },
  userFlagBadge: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, backgroundColor: "rgba(96,165,250,0.18)", borderWidth: 1, borderColor: "rgba(96,165,250,0.4)" },
  userFlagBadgeText: { color: "#60a5fa", fontSize: 9, fontWeight: "900", letterSpacing: 0.4 },
});
