import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  View, Text, Pressable, ScrollView, StyleSheet, Modal, ActivityIndicator,
  Platform, Image, FlatList, TextInput, KeyboardAvoidingView, Alert, Share, Linking,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { fetch } from "expo/fetch";
import Animated, { FadeIn, FadeInDown, FadeInUp, FadeOut, useSharedValue, useAnimatedStyle, withTiming, withRepeat, withSequence, cancelAnimation } from "react-native-reanimated";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Audio } from "expo-av";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { getApiUrl } from "@/lib/query-client";
import { fetchAiTurnWithRetry } from "@/lib/ai-turn-retry";
import { useTokens } from "@/lib/token-context";
import { saveRecording, generateShareText, pickHighlightQuote, type ArenaRecording, type RecordedMessage } from "@/lib/arena-recordings";
import { usePersonaLocks, PREMIUM_PERSONA_CONFIGS } from "@/lib/persona-locks";
import Colors from "@/constants/colors";
import { ShareAppButton } from "@/components/ShareAppButton";
import { CashAppDonate } from "@/components/CashAppDonate";
import { playTTS, prefetchTTSAudio, playPrefetchedAudio, warmupAudio } from "@/lib/audio-helper";
import { getPersonaVoiceVolume, shouldSkipPersonaVoice } from "@/lib/persona-voice";
import { useReactionOverlapEnabled } from "@/lib/reaction-overlap-settings";

type PersonaLite = { id: string; name: string };
type Topic = { id: string; title: string; description: string; era: "current" | "past" };
type Msg = { id: string; speakerId: string; speakerName: string; text: string; ts: number; isInterruption?: boolean; isReaction?: boolean; isCallIn?: boolean; callerName?: string; isSystem?: boolean; skipTTS?: boolean };

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
  shannon:        [{ title: "Shannon Book", url: "https://www.amazon.com/s?k=political+commentary+books&tag=trumpbot-20", icon: "book" }, { title: "Media Anchor Style", url: "https://www.amazon.com/s?k=women+anchor+fashion&tag=trumpbot-20", icon: "shirt" }, { title: "News Mug", url: "https://www.amazon.com/s?k=news+coffee+mug&tag=trumpbot-20", icon: "cafe" }],
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
  "Say what?", "Unbelievable.", "Mm.", "Ok sure.", "Cute story.",
];

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
  // Tucker Carlson — Putin puppet, white nationalist, or propaganda accusations trigger immediate pushback
  tuckercarlson: /\bputin puppet|russian agent|kremlin\b|white nationalist|white supremacist|racist\b|propaganda machine|fox propaganda|fascist\b/i,
  // Charlie Murphy — DEI attacks, racial slurs, dismissive insults, or questioning credibility
  charliemurphy: /\bdei\b|affirmative action hire|diversity hire|quota|thug|boy\b|hood rat|ghetto|monkey|ape|token|you people|your kind|go back|shut up|irrelevant|washed up|who are you/i,
};

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

// ── GENERAL INSULT DETECTION (any guest → the interviewer) ────────────────────
// Mirrors debate-stage.tsx's INSULT_PAT/detectInsult so ANY interviewer persona —
// not just the handful with a bespoke PERSONA_OFFENSE_TRIGGERS entry — gets to
// strike back when a guest blatantly disrespects them, not just go quiet.
const INSULT_PAT = {
  direct: /(go fuck (your|him|her|them)self|fuck you|kiss my (ass|butt)|up yours|drop dead|you'?re (an )?(idiot|a fool|a clown|a fraud|worthless|pathetic|a liar|full of shit|out of (your )?mind)|you make me sick|you disgust me|screw you|get lost|get the hell out)/i,
  profanity: /\b(fuck(ing)?|shit|ass(hole)?|bastard|son of a bitch|bitch(?!es (?:brew|cakes))|cunt|goddamn)\b/i,
  attack: /\b(idiot|moron|stupid|dumb(ass)?|loser|pathetic|incompetent|fraud|liar|coward|scum(bag)?|disgrace|clown|corrupt|criminal|shut up|you never|you always lie|you failed|washed up|irrelevant|nobody believes|laughingstock)\b/i,
  taunt: /\b(you can't win|you'll lose|everyone knows|no one (likes|trusts|believes) you|you're finished|you're done|sit down|get out|go home|you're a joke|what a joke)\b/i,
};
function detectInsult(text: string): number {
  const l = text.toLowerCase();
  let s = 0;
  if (INSULT_PAT.direct.test(l)) s += 3;
  if (INSULT_PAT.profanity.test(l)) s += 2;
  if (INSULT_PAT.attack.test(l)) s += 1;
  if (INSULT_PAT.taunt.test(l)) s += 1;
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
  kwame: require("@/assets/images/persona-kwame.png"),
  coachprime: require("@/assets/images/persona-coachprime.png"),
  ochocinco: require("@/assets/images/persona-ochocinco.png"),
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
  ronaldreagan: require("@/assets/images/persona-ronaldreagan.jpg"),
  samjackson: require("@/assets/images/persona-samjackson.jpg"),
  louisfarrakhan: require("@/assets/images/persona-louisfarrakhan.png"),
  carlsagan: require("@/assets/images/persona-carlsagan.png"),
  larrycableguy: require("@/assets/images/persona-larrycableguy.png"),
  jdvance: require("@/assets/images/persona-jdvance.png"),
  kaitlyncollins: require("@/assets/images/persona-kaitlyncollins.png"),
  tedcruz: require("@/assets/images/persona-tedcruz.png"),
  georgewbush: require("@/assets/images/persona-georgewbush.png"),
  gilbertgottfried: require("@/assets/images/persona-gilbertgottfried.jpg"),
  arikana: require("@/assets/images/persona-arikana.png"),
  alishahrazad: require("@/assets/images/persona-alishahrazad.png"),
  waylonjennnings: require("@/assets/images/persona-waylonjennnings.png"),
  skipbayless: require("@/assets/images/persona-skipbayless.png"),
  cenk: require("@/assets/images/persona-cenk.jpg"),
  howardcosell: require("@/assets/images/persona-howardcosell.jpg"),
  carlin: require("@/assets/images/persona-carlin.jpg"),
  pressley: require("@/assets/images/persona-pressley.png"),
  drbenj: require("@/assets/images/persona-drbenj.jpg"),
  charliemurphy: require("@/assets/images/persona-charliemurphy.jpg"),
  tuckercarlson: require("@/assets/images/persona-tuckercarlson.jpg"),
  jessventura: require("@/assets/images/persona-jessventura.jpg"),
  wandasykes: require("@/assets/images/persona-wandasykes.jpg"),
  trevornoah: require("@/assets/images/persona-trevornoah.jpg"),
  janeelliott: require("@/assets/images/persona-janeelliott.jpg"),
  francescresswelsing: require("@/assets/images/persona-francescresswelsing.jpg"),
  bishopfundme: require("@/assets/images/persona-bishopfundme.png"),
  tlaib:        require("@/assets/images/persona-tlaib.png"),
  donlemon:     require("@/assets/images/persona-donlemon.jpg"),
  professorjiang: require("@/assets/images/persona-professorjiang.png"),
  cornellwest:  require("@/assets/images/persona-cornellwest.jpg"),
  piersmorgan:  require("@/assets/images/persona-piersmorgan.jpg"),
  scottjennings: require("@/assets/images/persona-scottjennings.jpg"),
  mikejohnson: require("@/assets/images/persona-mikejohnson.png"),
  donalds: require("@/assets/images/persona-donalds.png"),
  clarke: require("@/assets/images/persona-clarke.png"),
  muhammadali:   require("@/assets/images/persona-muhammadali.jpg"),
  mikabrzezinski: require("@/assets/images/persona-mikabrzezinski.jpg"),
  joescarborough: require("@/assets/images/persona-joescarborough.jpg"),
  jimlampley:     require("@/assets/images/persona-jimlampley.jpg"),
  floydmayweather: require("@/assets/images/persona-floydmayweather.jpg"),
  georgeforeman:  require("@/assets/images/persona-georgeforeman.jpg"),
  michaelbuffer:  require("@/assets/images/persona-michaelbuffer.jpg"),
  richardwolff: require("@/assets/images/persona-richardwolff.jpg"),
  berniesanders: require("@/assets/images/persona-berniesanders.jpg"),
};

const FX_KEY = "interview_fx_enabled_v1";
const VOICE_KEY = "interview_voice_enabled_v1";
const BEEP_KEY = "interview_beep_enabled_v1";
const NAME_KEY = "interview_caller_name_v1";

type GuestCategory = "All" | "Political" | "History" | "Science" | "Finance" | "Entertainment" | "Sports" | "Philosophy";
const GUEST_CATEGORY_LIST: GuestCategory[] = ["All", "Political", "History", "Science", "Finance", "Entertainment", "Sports", "Philosophy"];

const GUEST_CATEGORIES: Record<string, GuestCategory> = {
  trump: "Political", biden: "Political", obama: "Political", kamala: "Political",
  berniemc: "Political", mcconnell: "Political", schumer: "Political", graham: "Political",
  rfk: "Political", melania: "Political", omar: "Political", mtg: "Political",
  miller: "Political", jimjordan: "Political", pambondi: "Political", erikakirk: "Political",
  loomer: "Political", leavitt: "Political", aoc: "Political", jascrockett: "Political",
  timscott: "Political", ivanka: "Political", billclinton: "Political", hillaryclinton: "Political",
  marcorubio: "Political", desantis: "Political", netanyahu: "Political", malema: "Political",
  shahidbolson: "Political", errol: "Political", galloway: "Political", carville: "Political",
  mlk: "History", malcolmx: "History", ronaldreagan: "History",
  pastormanning: "History", claudeanderson: "History",
  louisfarrakhan: "History", georgewbush: "History",
  arikana: "History", alishahrazad: "History",
  jdvance: "Political", tedcruz: "Political", kaitlyncollins: "Political",
  neiltyson: "Science", professorjiang: "Science", carlsagan: "Science",
  elon: "Finance", richardwolff: "Finance",
  berniesanders: "Political",
  rosie: "Entertainment", ruckus: "Entertainment", samjackson: "Entertainment",
  waylonjennnings: "Entertainment", gilbertgottfried: "Entertainment", larrycableguy: "Entertainment",
  hannity: "Entertainment", megynkelly: "Entertainment",
  jesseleepetersen: "Entertainment", joerogan: "Entertainment",
  stephena: "Sports", shannon: "Sports",
  skipbayless: "Sports", howardcosell: "Sports",
  jimlampley: "Sports", floydmayweather: "Sports", georgeforeman: "Sports", michaelbuffer: "Sports",
  kwame: "Sports", coachprime: "Sports", ochocinco: "Sports",
  mikabrzezinski: "Political", joescarborough: "Political",
  cenk: "Political",
  pressley: "Political",
  drbenj: "History",
  carlin: "Entertainment",
  charliemurphy: "Entertainment",
  tuckercarlson: "Political",
  jessventura: "Political",
  wandasykes: "Entertainment",
  trevornoah: "Entertainment",
  janeelliott: "History",
  francescresswelsing: "History",
  bishopfundme: "Entertainment",
  donlemon: "Political",
  cornellwest: "Philosophy",
  piersmorgan: "Entertainment",
  scottjennings: "Political",
  muhammadali: "Sports",
};

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

type InterviewStyleId = "combative" | "informative" | "comedic" | "civil_discourse" | "educational" | "roast" | "softball" | "unhinged";
const INTERVIEW_STYLES: Array<{ id: InterviewStyleId; label: string; icon: "flame" | "information-circle" | "happy" | "handshake" | "school" | "mic" | "baseball" | "skull-outline" }> = [
  { id: "combative",      label: "Combative",       icon: "flame" },
  { id: "informative",    label: "Informative",     icon: "information-circle" },
  { id: "comedic",        label: "Comedic",         icon: "happy" },
  { id: "civil_discourse",label: "Civil Discourse", icon: "handshake" },
  { id: "educational",    label: "Educational",     icon: "school" },
  { id: "roast",          label: "Comedy Roast",    icon: "mic" },
  { id: "softball",       label: "Softball",        icon: "baseball" },
  { id: "unhinged",       label: "Unhinged",        icon: "skull-outline" },
];

const webTop = Platform.OS === "web" ? 67 : 0;
const webBottom = Platform.OS === "web" ? 34 : 0;

export default function InterviewScreen() {
  const insets = useSafeAreaInsets();
  const { deviceId, balance, refreshBalance } = useTokens();
  const { isLocked, isHidden, unlockWithTokens, isUnlocking: premiumUnlocking, unlockedPremium } = usePersonaLocks();
  const [interviewers, setInterviewers] = useState<PersonaLite[]>([]);
  const [interviewees, setInterviewees] = useState<PersonaLite[]>([]);
  const [interviewerId, setInterviewerId] = useState<string | null>(null);
  const [intervieweeId, setIntervieweeId] = useState<string | null>(null);
  const [duration, setDuration] = useState<5 | 10 | 15>(10);
  const [topicMix, setTopicMix] = useState<"current" | "past" | "mixed">("mixed");
  const [interviewStyle, setInterviewStyle] = useState<InterviewStyleId>("combative");
  const [guestCategory, setGuestCategory] = useState<GuestCategory>("All");

  const [topics, setTopics] = useState<Topic[]>([]);
  const [topicsLoading, setTopicsLoading] = useState(false);
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
  const [aiRetrying, setAiRetrying] = useState(false);
  const firstAudioPlayedRef = useRef(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [isStarting, setIsStarting] = useState(false);
  const [isThinking, setIsThinking] = useState<"interviewer" | "interviewee" | null>(null);
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

  const flatListRef = useRef<FlatList>(null);
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runningRef = useRef(false);
  const isPausedRef = useRef(false);
  const providerUnavailableRef = useRef(false);
  const networkErrorRef = useRef(false);
  const [isPaused, setIsPaused] = useState(false);
  const exchangesOnTopicRef = useRef(0);
  const totalExchangesRef = useRef(0);
  const shopPromoFiredRef = useRef(false);
  // Pre-fetched next question — eliminates dead air between turns
  const nextQPromiseRef = useRef<Promise<any> | null>(null);
  const messagesRef = useRef<Msg[]>([]);
  const topicIdxRef = useRef(0);
  const topicsRef = useRef<Topic[]>([]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  useEffect(() => { topicIdxRef.current = topicIdx; }, [topicIdx]);
  useEffect(() => { topicsRef.current = topics; }, [topics]);

  // Warm up the audio session on mount so the first clip plays without cold-start lag
  useEffect(() => { warmupAudio().catch(() => {}); }, []);

  // ── Pro mode state ───────────────────────────────────────────────────────
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const voiceEnabledRef = useRef(true);
  const { reactionOverlapEnabled, reactionOverlapEnabledRef, toggleReactionOverlap } = useReactionOverlapEnabled();
  const [bleepEnabled, setBleepEnabled] = useState<boolean>(false);
  const bleepEnabledRef = useRef<boolean>(false);
  useEffect(() => { bleepEnabledRef.current = bleepEnabled; }, [bleepEnabled]);
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
  const [fxEnabled, setFxEnabled] = useState(true);
  const fxEnabledRef = useRef(true);
  const [beepEnabled, setBeepEnabled] = useState(true);
  const beepEnabledRef = useRef(true);
  const [activeSpeaker, setActiveSpeaker] = useState<string | null>(null);
  const activeSpeakerRef = useRef<string | null>(null);
  const ttsQueueRef = useRef<Array<{ text: string; personaId: string; msgId?: string; onStart?: () => void; onPlaybackStart?: () => void }>>([]);
  const ttsRunningRef = useRef(false);
  const currentSoundRef = useRef<Audio.Sound | null>(null);
  const prefetchedAudioRef = useRef<{ personaId: string; text: string; audioUri: string } | null>(null);
  const prefetchingRef = useRef(false);
  // Pending slot: if a prefetch is in flight and a new one arrives, it queues here
  // and fires automatically when the current one completes — prevents dropped prefetches.
  const pendingPrefetchRef = useRef<{ text: string; personaId: string } | null>(null);
  // ── Live overlapping reaction cooldown (Comedic/Roast only) ─────────────
  // Counts turns since the last live reaction fired so they feel earned, not
  // constant. Starts at 2 so a reaction can fire on the very first eligible turn.
  const turnsSinceReactionRef = useRef(2);

  const [emoInterviewer, setEmoInterviewer] = useState<Emotions>(ZERO_EMO);
  const [emoInterviewee, setEmoInterviewee] = useState<Emotions>(ZERO_EMO);

  // Stephen A. Smith ("stephena") gets a calm→angry voice switch — same real
  // voice, calm before the anger meter crosses threshold, matching loudmouth.
  const stephenaAngerRef = useRef<number>(10);
  useEffect(() => {
    if (interviewerId === "stephena") {
      stephenaAngerRef.current = emoInterviewer.anger;
    } else if (intervieweeId === "stephena") {
      stephenaAngerRef.current = emoInterviewee.anger;
    }
  }, [interviewerId, intervieweeId, emoInterviewer.anger, emoInterviewee.anger]);

  // Uncle Ruckus ("ruckus") — calm voice before his animated voice kicks in.
  const ruckusAngerRef = useRef<number>(10);
  useEffect(() => {
    if (interviewerId === "ruckus") {
      ruckusAngerRef.current = emoInterviewer.anger;
    } else if (intervieweeId === "ruckus") {
      ruckusAngerRef.current = emoInterviewee.anger;
    }
  }, [interviewerId, intervieweeId, emoInterviewer.anger, emoInterviewee.anger]);

  const [lieTally, setLieTally] = useState<{ totalLies: number; totalSessions: number; bestSession: number; topLiarName: string | null; topLiarCount: number } | null>(null);

  const [lieCount, setLieCount] = useState(0);
  const [lies, setLies] = useState<LieEntry[]>([]);
  const [liesSheetOpen, setLiesSheetOpen] = useState(false);
  const [lieFlashOn, setLieFlashOn] = useState(false);
  const [lieVotes, setLieVotes] = useState<Record<string, { up: number; down: number; myVote: number }>>({});
  const lieVotesPendingRef = useRef<Set<string>>(new Set());
  const [flaggedMsgIds, setFlaggedMsgIds] = useState<Set<string>>(new Set());
  const flagPendingRef = useRef<Set<string>>(new Set());
  const [hofData, setHofData] = useState<{ leaderboard: Array<{ personaId: string; winPct: number }> } | null>(null);

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

  // Keep screen and audio active during live interview sessions.
  // Only run when phase IS "live" — the cleanup handles deactivation when
  // the phase changes away, so there is no need (and it would crash) to
  // call deactivateKeepAwake from the non-live branch.
  useEffect(() => {
    if (phase !== "live") return;
    activateKeepAwakeAsync("interview").catch(() => {});
    return () => { deactivateKeepAwake("interview"); };
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

  // Fetch HoF leaderboard once on mount to show rank badges in INTERVIEWER picker
  useEffect(() => {
    fetch(new URL("/api/arena/hall-of-fame", getApiUrl()).toString())
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.leaderboard) setHofData(data); })
      .catch(() => {});
  }, []);

  const hofRankMap = useMemo<Record<string, { rank: number; winPct: number }>>(() => {
    if (!hofData?.leaderboard) return {};
    const map: Record<string, { rank: number; winPct: number }> = {};
    hofData.leaderboard.forEach((e: { personaId: string; winPct: number }, i: number) => {
      map[e.personaId] = { rank: i + 1, winPct: e.winPct };
    });
    return map;
  }, [hofData]);

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
      // Queue it — will auto-fire when current prefetch finishes
      pendingPrefetchRef.current = item;
      return;
    }
    prefetchingRef.current = true;
    prefetchTTSAudio("/api/persona-speak", { text: item.text, personaId: item.personaId, bleepEnabled: bleepEnabledRef.current, ...(item.personaId === "stephena" ? { angerLevel: stephenaAngerRef.current } : {}), ...(item.personaId === "ruckus" ? { angerLevel: ruckusAngerRef.current } : {}) })
      .then((audioUri) => {
        prefetchedAudioRef.current = { personaId: item.personaId, text: item.text, audioUri };
        prefetchingRef.current = false;
        // Auto-fire the pending prefetch if one arrived while we were busy
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
        // Must call onStart + onComplete so callers relying on queue-start timing
        // (and enqueueTTSAndWait) don't hang or silently never fire when a
        // persona's voice is configured off. Do NOT call onPlaybackStart: that's
        // reserved for callers (live reactions) that must never schedule without
        // actual audio to overlap/duck against.
        item.onStart?.();
        item.onComplete?.();
        continue;
      }
      setActiveSpeaker(item.personaId);
      activeSpeakerRef.current = item.personaId;
      // onStart: fires when this item reaches the front of the queue (call/queue
      // time), regardless of whether audio actually plays. NOT used for reaction
      // scheduling — see onPlaybackStart below.
      item.onStart?.();
      try {
        // If a prefetch is in flight for this item, wait up to 6 s for it to land.
        // 6 s covers worst-case Fish Audio latency; the prefetch was started early
        // (during the previous clip) so it has usually finished well before this.
        if (prefetchingRef.current) {
          const prefetchDeadline = Date.now() + 6000;
          while (prefetchingRef.current && Date.now() < prefetchDeadline) {
            await new Promise<void>((r) => setTimeout(r, 40));
          }
        }
        // Use prefetched audio if it matches this item — eliminates fetch latency gap
        const cached = prefetchedAudioRef.current;
        let sound: Audio.Sound;
        if (cached && cached.text === item.text && cached.personaId === item.personaId) {
          prefetchedAudioRef.current = null;
          sound = await playPrefetchedAudio(cached.audioUri, { volume: getPersonaVoiceVolume(item.personaId) });
        } else {
          sound = await playTTS("/api/persona-speak", { text: item.text, personaId: item.personaId, bleepEnabled: bleepEnabledRef.current, ...(item.personaId === "stephena" ? { angerLevel: stephenaAngerRef.current } : {}), ...(item.personaId === "ruckus" ? { angerLevel: ruckusAngerRef.current } : {}) }, { volume: getPersonaVoiceVolume(item.personaId) });
        }
        currentSoundRef.current = sound;
        if (!firstAudioPlayedRef.current) { firstAudioPlayedRef.current = true; setFirstAudioPlayed(true); }
        // 1s overlap: next speaker starts 1 second before current clip ends — conversational handoff
        const OVERLAP_MS = 1000;
        let prefetchStarted = false;
        await new Promise<void>((resolve) => {
          let resolved = false;
          let earlyResolved = false;
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
            // Always fire onComplete regardless of exit path (didJustFinish, error,
            // OR safety-timeout). Without this, enqueueTTSAndWait hangs forever
            // when audio finishes — blocking the entire runLoop.
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
            if (status.didJustFinish || status.error) {
              clearTimeout(safetyTimer);
              finish();
              return;
            }
            if (status.isPlaying && status.durationMillis && status.positionMillis) {
              // Switch to a duration-aware cap the first time we see playback
              if (!playbackStarted) {
                playbackStarted = true;
                // onPlaybackStart fires on the FIRST confirmed isPlaying status —
                // i.e. once this clip has actually started producing audio, not
                // merely reached the front of the queue. Used exclusively by live
                // reactions so their overlap/duck timing keys off the real
                // playback clock and can never fire with no audio to react
                // against (distinct from onStart above, which fires even for
                // skipped voices).
                item.onPlaybackStart?.();
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
              const nextQueued = ttsQueueRef.current[0];
              const nextIsDifferentSpeaker = nextQueued && nextQueued.personaId !== item.personaId;
              if (!earlyResolved && nextIsDifferentSpeaker && remaining <= OVERLAP_MS && remaining > 0) {
                // Duck outgoing speaker during overlap window for a natural conversational handoff
                try { sound.setVolumeAsync(0.28).catch(() => {}); } catch {}
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
    // Safety: reset prefetchingRef in case a failed prefetch left it stuck at true
    prefetchingRef.current = false;
    pendingPrefetchRef.current = null;
    // If the session ended while processing, clear any leftover queued items so
    // waitForQueueDrain can resolve promptly instead of hanging for 25 s.
    if (!runningRef.current && ttsQueueRef.current.length > 0) {
      ttsQueueRef.current = [];
    }
    if (ttsQueueRef.current.length === 0) {
      setActiveSpeaker(null);
      activeSpeakerRef.current = null;
    }
  }, [startPrefetch]);

  const enqueueTTS = useCallback((text: string, personaId: string, msgId?: string, opts?: { onStart?: () => void; onPlaybackStart?: () => void }) => {
    if (!voiceEnabledRef.current) return;
    ttsQueueRef.current.push({ text, personaId, msgId, onStart: opts?.onStart, onPlaybackStart: opts?.onPlaybackStart });
    processQueue();
  }, [processQueue]);

  /** Enqueue a TTS item and return a promise that resolves when that clip finishes playing.
   *  Mirrors debate-stage's enqueueTTSAndWait — enables Promise.all(fetch, speak) pipelining
   *  so the next speaker's text is fetched while the current speaker's audio is still playing. */
  const enqueueTTSAndWait = useCallback((text: string, personaId: string, msgId?: string): Promise<void> => {
    return new Promise<void>((resolve) => {
      if (!voiceEnabledRef.current) { resolve(); return; }
      ttsQueueRef.current.push({ text, personaId, msgId, onComplete: resolve });
      processQueue();
    });
  }, [processQueue]);

  /** Wait for the TTS queue to fully drain before continuing.
   *  Audio-aware pacing: replaces fixed text-timing delays so turns are driven
   *  by actual playback length rather than character-count estimates.
   *  Safety cap: resolves after 25 s regardless so the interview can't freeze. */
  const waitForQueueDrain = useCallback((): Promise<void> => new Promise((resolve) => {
    const maxWait = setTimeout(resolve, 25000);
    // Small initial delay so processQueue() can set ttsRunningRef before first check
    const tick = () => {
      // Resolve immediately if the session ended — processQueue exits without draining
      // the queue when runningRef.current is false, so length > 0 would hang forever.
      if (!ttsRunningRef.current && (ttsQueueRef.current.length === 0 || !runningRef.current)) {
        clearTimeout(maxWait);
        resolve();
      } else {
        setTimeout(tick, 80);
      }
    };
    setTimeout(tick, 60);
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

  // Fire-and-forget fact-check on each non-trivial interviewee statement
  const runFactCheck = useCallback((msg: Msg) => {
    if (!intervieweeId || msg.speakerId !== intervieweeId) return;
    if (msg.text.length < 25) return;
    if (!deviceId) return;
    fetch(new URL("/api/arena/interview-factcheck", getApiUrl()).toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-device-id": deviceId },
      body: JSON.stringify({ intervieweeId, text: msg.text, topic: currentTopicRef.current }),
    })
      .then((r) => r.ok ? r.json() : null)
      .then((data: any) => {
        if (!data) return;
        const score = Math.max(0, Math.min(100, Number(data.score) || 70));
        setLatestTruthScore(score);
        if (score < 40 || data.isLie) {
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
          triggerLightning();
          playLieAlert();
          setLieFlashOn(true);
          setTimeout(() => setLieFlashOn(false), 450);
        }
      })
      .catch(() => {});
  }, [intervieweeId, deviceId, triggerLightning, playLieAlert]);

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

  // Wrap addMessage to also drive emotions, TTS, fact-check
  const enrichAndAddMessage = useCallback((m: Msg, opts?: { onStart?: () => void; onPlaybackStart?: () => void }) => {
    setMessages((prev) => [...prev, m]);
    if (!m.skipTTS) enqueueTTS(m.text, m.speakerId, m.id, opts);
    else opts?.onStart?.();
    const delta = computeEmotionDelta(m.text);
    if (interviewerId && m.speakerId === interviewerId) setEmoInterviewer((p) => applyEmotionDelta(p, delta));
    else if (intervieweeId && m.speakerId === intervieweeId) setEmoInterviewee((p) => applyEmotionDelta(p, delta));
    if (intervieweeId && m.speakerId === intervieweeId && !m.isInterruption) runFactCheck(m);
  }, [enqueueTTS, interviewerId, intervieweeId, runFactCheck]);

  /** Arena-style interruption audio: ducks the current speaker to 10%, plays the
   *  interrupt at full persona volume, then restores the main speaker to 100%.
   *  Does NOT go through the TTS queue — fires concurrently with whatever is playing. */
  const playInterruptionAudio = useCallback(async (text: string, personaId: string) => {
    if (!voiceEnabledRef.current) return;
    if (shouldSkipPersonaVoice(personaId)) return;
    // A persona can never interrupt/overlap their own currently-playing voice.
    if (personaId === activeSpeakerRef.current) return;
    const mainSound = currentSoundRef.current;
    if (mainSound) { try { mainSound.setVolumeAsync(0.10).catch(() => {}); } catch {} }
    setActiveSpeaker(personaId);
    activeSpeakerRef.current = personaId;
    try {
      const sound = await playTTS("/api/persona-speak", { text, personaId, bleepEnabled: bleepEnabledRef.current, ...(personaId === "stephena" ? { angerLevel: stephenaAngerRef.current } : {}), ...(personaId === "ruckus" ? { angerLevel: ruckusAngerRef.current } : {}) }, { volume: getPersonaVoiceVolume(personaId) });
      let cleaned = false;
      const cleanup = () => {
        if (cleaned) return; cleaned = true;
        sound.setOnPlaybackStatusUpdate(null);
        sound.getStatusAsync().then((st: any) => { if (st.isLoaded) sound.stopAsync().then(() => sound.unloadAsync()).catch(() => {}); }).catch(() => {});
        const ms = currentSoundRef.current;
        if (ms) { try { ms.setVolumeAsync(1.0).catch(() => {}); } catch {} }
        setActiveSpeaker(activeSpeakerRef.current);
      };
      sound.setOnPlaybackStatusUpdate((status: any) => { if (status.didJustFinish || status.error) cleanup(); });
      setTimeout(cleanup, 8000);
    } catch {
      const ms = currentSoundRef.current;
      if (ms) { try { ms.setVolumeAsync(1.0).catch(() => {}); } catch {} }
    }
  }, []);

  /** Live comedic reaction: plays a reaction line that was synthesized in PARALLEL
   *  with the main line (via the audioUriPromise, started the moment the server
   *  response arrived) so it's ready to overlap the tail of the statement instead
   *  of waiting for cold TTS latency. Same ducking pattern as playInterruptionAudio,
   *  but consumes prefetched audio instead of fetching fresh — and, unlike a plain
   *  copy of playInterruptionAudio, captures the speaker that was active before the
   *  reaction fired and restores it (not whatever is active at the moment cleanup
   *  runs) so the UI doesn't stay pinned on the reactor after the overlap ends. */
  const playReactionOverlap = useCallback(async (audioUriPromise: Promise<string>, personaId: string) => {
    if (!voiceEnabledRef.current) return;
    if (!reactionOverlapEnabledRef.current) return;
    if (shouldSkipPersonaVoice(personaId)) return;
    if (personaId === activeSpeakerRef.current) return;
    const prevSpeaker = activeSpeakerRef.current;
    // Duck the main line the instant the overlap window begins — before the
    // reaction audio itself is ready — so the softening reads as reacting to
    // the tail of the statement, not to the reaction clip finishing synthesis.
    const mainSound = currentSoundRef.current;
    if (mainSound) { try { mainSound.setVolumeAsync(0.10).catch(() => {}); } catch {} }
    setActiveSpeaker(personaId);
    activeSpeakerRef.current = personaId;
    // Restores the main line's volume and hands the active-speaker back to
    // whoever it was before — but only if nothing newer has already taken over
    // (e.g. the next queued speaker started while the reaction was in flight).
    const restore = () => {
      const ms = currentSoundRef.current;
      if (ms) { try { ms.setVolumeAsync(1.0).catch(() => {}); } catch {} }
      if (activeSpeakerRef.current === personaId) {
        setActiveSpeaker(prevSpeaker);
        activeSpeakerRef.current = prevSpeaker;
      }
    };
    try {
      const audioUri = await audioUriPromise;
      const sound = await playPrefetchedAudio(audioUri, { volume: getPersonaVoiceVolume(personaId) });
      let cleaned = false;
      const cleanup = () => {
        if (cleaned) return; cleaned = true;
        sound.setOnPlaybackStatusUpdate(null);
        sound.getStatusAsync().then((st: any) => { if (st.isLoaded) sound.stopAsync().then(() => sound.unloadAsync()).catch(() => {}); }).catch(() => {});
        restore();
      };
      sound.setOnPlaybackStatusUpdate((status: any) => { if (status.didJustFinish || status.error) cleanup(); });
      setTimeout(cleanup, 8000);
    } catch {
      restore();
    }
  }, []);

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

  const interviewer = useMemo(() => interviewers.find((p) => p.id === interviewerId) || null, [interviewers, interviewerId]);
  const interviewee = useMemo(() => interviewees.find((p) => p.id === intervieweeId) || null, [interviewees, intervieweeId]);
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

  const shareTranscript = useCallback(async () => {
    const msgs = messagesRef.current.filter((m) => !m.isSystem);
    if (msgs.length === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const iName = interviewers.find((p) => p.id === interviewerId)?.name ?? interviewerId;
    const eName = interviewees.find((p) => p.id === intervieweeId)?.name ?? intervieweeId;
    const startedAt = sessionStartedAtRef.current || msgs[0]?.ts || Date.now();
    const durationSec = Math.round((Date.now() - startedAt) / 1000);
    const mins = Math.floor(durationSec / 60);
    const highlight = pickHighlightQuote(msgs.map((m): RecordedMessage => ({
      id: m.id, speakerId: m.speakerId, speakerName: m.speakerName,
      text: m.text, timestamp: m.ts, relativeTime: 0,
    })));
    const interruptions = msgs.filter((m) => m.isInterruption).length;
    let text = `🎙️ "${iName} vs ${eName}" — The Arena\n`;
    if (highlight) text += `\n💬 "${highlight}"\n`;
    if (interruptions > 0) text += `⚡ ${interruptions} interruption${interruptions > 1 ? "s" : ""}!\n`;
    text += `\n${msgs.length} exchanges · ${mins}m\n`;
    text += `#TheArena #AIDebate #${iName.replace(/\s+/g, "")} #${eName.replace(/\s+/g, "")}\n`;
    text += `\n🏛️ Watch live debates on The Arena\nhttps://thearena.rip`;
    try {
      if (Platform.OS === "web" && navigator.share) await navigator.share({ title: `${iName} vs ${eName}`, text });
      else await Share.share({ message: text, title: `${iName} vs ${eName}` });
    } catch {}
  }, [interviewerId, intervieweeId, interviewers, interviewees]);

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

  const generateTopics = useCallback(async () => {
    if (!interviewerId || !intervieweeId) return;
    setTopicsLoading(true);
    setTopics([]);
    setTopicIdx(0);
    setSelectedTopicId(null);
    setCompletedTopics(new Set());
    try {
      const res = await fetch(new URL("/api/arena/interview-topics", getApiUrl()).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interviewerId, intervieweeId, topicMix, durationMinutes: duration, interviewStyle }),
      });
      if (res.ok) {
        const data = await res.json();
        setTopics(data.topics || []);
      }
    } catch {} finally {
      setTopicsLoading(false);
    }
  }, [interviewerId, intervieweeId, topicMix, duration, interviewStyle]);

  // Auto-generate when pairing/duration/style changes
  useEffect(() => {
    if (interviewerId && intervieweeId && phase === "setup") {
      generateTopics();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interviewerId, intervieweeId, topicMix, duration, interviewStyle]);

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

  const stopForAiUnavailable = useCallback(() => {
    if (providerUnavailableRef.current) return;
    providerUnavailableRef.current = true;
    setAiRetrying(false);
    runningRef.current = false;
    setIsThinking(null);
    stopAllAudio();
    addMessage({
      id: `sys-unavail-${Date.now()}`,
      speakerId: "system",
      speakerName: "System",
      text: "AI service temporarily unavailable — the interview has been paused. Please try again in a few minutes.",
      ts: Date.now(),
      isSystem: true,
    });
    setPhase("ended");
  }, [addMessage, stopAllAudio]);

  const stopForNetworkError = useCallback(() => {
    if (networkErrorRef.current) return;
    networkErrorRef.current = true;
    setAiRetrying(false);
    runningRef.current = false;
    setIsThinking(null);
    stopAllAudio();
    addMessage({
      id: `sys-network-${Date.now()}`,
      speakerId: "system",
      speakerName: "System",
      text: "Network connection lost — the interview has been paused. Please check your connection and try again.",
      ts: Date.now(),
      isSystem: true,
    });
    setPhase("ended");
  }, [addMessage, stopAllAudio]);

  // The API returns 503/ai_unavailable when a bounded AI turn times out. Give
  // the provider one quick retry before ending the interview visibly.
  const fetchTurnWithRetry = useCallback((makeRequest: () => Promise<any>) => (
    fetchAiTurnWithRetry(makeRequest, {
      onRetrying: setAiRetrying,
      onUnavailable: stopForAiUnavailable,
      onNetworkError: stopForNetworkError,
    })
  ), [stopForAiUnavailable, stopForNetworkError]);

  const fetchQuestion = useCallback(async (opts: { isFollowUp?: boolean; isTransition?: boolean; previousTopicTitle?: string; isInterruption?: boolean; currentTopicArg?: Topic | null }) => {
    if (!deviceId || !interviewerId || !intervieweeId) return null;
    const topicArg = opts.currentTopicArg !== undefined ? opts.currentTopicArg : currentTopic;
    try {
      const res = await fetchTurnWithRetry(() => fetch(new URL("/api/arena/interview-question", getApiUrl()).toString(), {
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
        }),
      }));
      if (!res) return null;
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
  }, [deviceId, interviewerId, intervieweeId, currentTopic, fetchTurnWithRetry, interviewStyle]);

  const fetchAnswer = useCallback(async (lastQuestion: string, opts: { wasInterrupted?: boolean; interruptionText?: string; isInterruption?: boolean } = {}) => {
    if (!deviceId || !interviewerId || !intervieweeId) return null;
    try {
      // Live overlapping reaction: only ask for one in Comedic/Roast, and only
      // once the cooldown has passed + a coin flip, so it feels earned rather
      // than constant. The server still decides per-line whether it's warranted.
      const comedicTone = interviewStyle === "comedic" || interviewStyle === "roast";
      const requestReaction = !opts.isInterruption && comedicTone && turnsSinceReactionRef.current >= 2 && Math.random() < 0.6;
      const res = await fetchTurnWithRetry(() => fetch(new URL("/api/arena/interview-answer", getApiUrl()).toString(), {
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
          interviewStyle,
          requestReaction,
        }),
      }));
      if (!res) return null;
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
  }, [deviceId, interviewerId, intervieweeId, currentTopic, interviewStyle, fetchTurnWithRetry]);

  // Main turn loop
  const runLoop = useCallback(async () => {
    // ── 4-beat debate-style pacing (mirrors debate-stage.tsx runLoop) ────────────
    // Each round covers one full topic with four clean beats:
    //   Beat 1: Interviewer opens   → guest answer fetched IN PARALLEL with Q audio
    //   Beat 2: Guest answers       → interviewer challenge fetched IN PARALLEL with A audio
    //   Beat 3: Interviewer presses → guest rebuttal fetched IN PARALLEL with challenge audio
    //   Beat 4: Guest rebuts        → next topic's opening fetched for zero dead air
    // Advance topic every round (no per-topic exchange counter needed).
    //
    // Technique: enqueueTTSAndWait(speaker) blocks until that clip finishes,
    // so Promise.all([fetch.then(enqueue), enqueueTTSAndWait(prev)]) lets the
    // fetch race the audio and enqueue the moment text arrives — OVERLAP_MS
    // (1 s) in processQueue then fires a natural conversational handoff.
    while (runningRef.current && Date.now() < sessionEndsAtRef.current) {
      if (isPausedRef.current) { await new Promise((r) => setTimeout(r, 400)); continue; }
      if (!runningRef.current) break;

      const liveTopics = topicsRef.current;
      if (liveTopics.length === 0) { await new Promise((r) => setTimeout(r, 800)); continue; }

      const rawIdx = topicIdxRef.current;
      const idx = rawIdx < liveTopics.length ? rawIdx : 0;
      if (idx !== rawIdx) { topicIdxRef.current = 0; setTopicIdx(0); }
      const topic = liveTopics[idx];

      // ── BEAT 1: Interviewer opens + fetch guest answer in parallel ────────────
      setIsThinking("interviewer");
      const q = await (nextQPromiseRef.current || fetchQuestion({
        isFollowUp: false,
        isTransition: false,
        currentTopicArg: topic,
      }));
      nextQPromiseRef.current = null;
      setIsThinking(null);
      if (!runningRef.current) break;
      if (!q) { await new Promise((r) => setTimeout(r, 600)); continue; }

      // Show question in chat without auto-TTS so we control timing via enqueueTTSAndWait
      const qId = `q-${Date.now()}-${Math.random()}`;
      enrichAndAddMessage({ id: qId, speakerId: q.speakerId, speakerName: q.speakerName, text: q.text, ts: Date.now(), skipTTS: true });
      const qDone = enqueueTTSAndWait(q.text, q.speakerId, qId);

      // Kick off answer AND follow-up fetches immediately — both race against Q+A audio.
      // As soon as the follow-up text arrives, also prefetch its TTS audio so it's
      // ready to play the moment waitForQueueDrain() resolves — eliminates the
      // 1-2 s dead-air gap between the guest answer and the next interviewer question.
      const answerPromise = fetchAnswer(q.text, { wasInterrupted: false });
      const followUpPromise = fetchQuestion({ isFollowUp: true, isTransition: false, currentTopicArg: topic })
        .then((fq) => {
          if (fq?.text && voiceEnabledRef.current) startPrefetch({ text: fq.text, personaId: fq.speakerId });
          return fq;
        });

      // ── BEAT 2: Guest answers (while Q plays, answer is fetched & enqueued) ────
      setIsThinking("interviewee");
      let guestAnswer: { speakerId: string; speakerName: string; text: string } | null = null;
      await Promise.all([
        answerPromise.then((ans) => {
          guestAnswer = ans;
          setIsThinking(null);
          if (ans?.text && runningRef.current) {
            // ── Live comedic reaction (Comedic/Roast only) ──────────────────────
            // Server already gated this to comedic/roast tone + a genuinely
            // hyperbolic/absurd line + our own cooldown. Takes priority over the
            // generic anger/insult reactions below since it's rarer and more specific.
            // Computed BEFORE enrichAndAddMessage so it can be wired into that
            // message's TTS-queue onStart — firing from actual playback start
            // (once this answer reaches the front of the queue) rather than from
            // fetch completion, since the queue may still be draining the
            // interviewer's question when the answer text arrives.
            const liveReaction = ans.reaction && ans.reaction.text ? ans.reaction : null;
            if (liveReaction) turnsSinceReactionRef.current = 0;
            else turnsSinceReactionRef.current += 1;
            enrichAndAddMessage(
              { id: `a-${Date.now()}-${Math.random()}`, speakerId: ans.speakerId, speakerName: ans.speakerName, text: ans.text, ts: Date.now() },
              liveReaction ? {
                onPlaybackStart: () => {
                  // Kick off synthesis for the reaction line the instant playback
                  // starts, in parallel with the main answer's own audio — by the
                  // time we want to overlap it near the tail of the statement,
                  // it's usually already ready.
                  const reactionAudioPromise = prefetchTTSAudio("/api/persona-speak", { text: liveReaction.text, personaId: liveReaction.speakerId, bleepEnabled: bleepEnabledRef.current, ...(liveReaction.speakerId === "stephena" ? { angerLevel: stephenaAngerRef.current } : {}), ...(liveReaction.speakerId === "ruckus" ? { angerLevel: ruckusAngerRef.current } : {}) });
                  const estMs = Math.max(2500, (ans.text.length / 14) * 1000);
                  const overlapDelay = Math.max(600, estMs - 900);
                  setTimeout(() => {
                    if (!runningRef.current) return;
                    setMessages((prev) => [...prev, {
                      id: `react-${Date.now()}-${Math.random()}`,
                      speakerId: liveReaction.speakerId,
                      speakerName: liveReaction.speakerName,
                      text: liveReaction.text,
                      ts: Date.now(),
                      isReaction: true,
                      skipTTS: true,
                    }]);
                    playReactionOverlap(reactionAudioPromise, liveReaction.speakerId);
                  }, overlapDelay);
                },
              } : undefined,
            );
            if (voiceEnabledRef.current) startPrefetch({ text: ans.text, personaId: ans.speakerId });
            // Anger-scaled interruption + moderator pushback when guest is hostile
            const lower = ans.text.toLowerCase();
            const angerKeywords = ["fake", "liar", "idiot", "stupid", "pathetic", "traitor", "moron", "coward", "disgusting", "fraud"];
            const angerHits = angerKeywords.reduce((c, w) => c + (lower.includes(w) ? 1 : 0), 0);
            const offended = detectOffense(ans.text, interviewerId, ans.speakerId);
            // Blatant insult aimed at the interviewer — fire back with a quick, witty
            // put-down immediately, then follow with an AI-personalized comeback in the
            // interviewer's own voice for the more severe cases. Generalized (not tied
            // to the small PERSONA_OFFENSE_TRIGGERS list) so every interviewer gets to
            // defend themselves, not just sit there and take it.
            const insultSeverity = detectInsult(ans.text);
            if (offended || insultSeverity >= 2) {
              const retaliations = offended
                ? ["I'm going to stop you right there.", "That's not how this works. Answer the question.", "You don't talk to me like that.", "We're not doing that here.", "That tells me everything I need to know about your answer."]
                : ["Careful now — that mouth is writing checks your answers can't cash.", "Cute. Now try answering the actual question.", "That's the best you've got? Sit with that for a second.", "I've heard better comebacks from a heckler in the cheap seats. Answer the question.", "Keep talking — you're only making my job easier."];
              const txt = retaliations[Math.floor(Math.random() * retaliations.length)];
              if (!liveReaction && Math.random() < (offended ? 0.85 : 0.85)) {
                setTimeout(() => { if (runningRef.current) playInterruptionAudio(txt, interviewerId); }, 350);
              }
              if (insultSeverity >= 2 && interviewerId) {
                const interviewerName = interviewers.find((p) => p.id === interviewerId)?.name || "The interviewer";
                fetch(new URL("/api/arena/moderator-retort", getApiUrl()).toString(), {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ provocation: ans.text, moderatorName: interviewerName, severity: insultSeverity, personaName: ans.speakerName }),
                }).then(async (r) => {
                  if (!r.ok || !runningRef.current) return;
                  const data = await r.json();
                  if (!data.retort || !runningRef.current) return;
                  const retortId = `mret-${Date.now()}-${Math.random()}`;
                  enrichAndAddMessage({ id: retortId, speakerId: interviewerId, speakerName: interviewerName, text: data.retort, ts: Date.now(), skipTTS: true });
                  enqueueTTS(data.retort, interviewerId, retortId);
                }).catch(() => {});
              }
            } else if (!liveReaction && angerHits >= 1 && Math.random() < 0.45) {
              const reaction = MICRO_REACTIONS[Math.floor(Math.random() * MICRO_REACTIONS.length)];
              setTimeout(() => { if (runningRef.current) playInterruptionAudio(reaction, interviewerId); }, 600);
            } else if (!liveReaction) {
              // Base-rate passive listener reaction — fires ~40% of the time even on calm
              // answers so the interviewer sounds engaged throughout, not just on hostile answers.
              // Delay is timed to hit 40-65% through the estimated audio clip.
              if (interviewerId && Math.random() < 0.40) {
                const estMs = Math.max(2500, (ans.text.length / 14) * 1000);
                const delay = estMs * (0.40 + Math.random() * 0.25);
                const reaction = MICRO_REACTIONS[Math.floor(Math.random() * MICRO_REACTIONS.length)];
                setTimeout(() => { if (runningRef.current) playInterruptionAudio(reaction, interviewerId); }, delay);
              }
            }
          }
        }),
        qDone, // resolves when interviewer clip finishes → answer starts (OVERLAP_MS)
      ]);
      if (!runningRef.current) break;

      // Drain: wait for guest answer clip to finish before interviewer speaks again
      await waitForQueueDrain();
      if (!runningRef.current) break;
      setIsThinking(null);

      // ── BEAT 3: Interviewer challenges + fetch guest rebuttal in parallel ────
      // followUpPromise was fired during Q+A playback — likely already resolved
      setIsThinking("interviewer");
      const followUp = await followUpPromise;
      setIsThinking(null);
      if (!runningRef.current) break;

      if (followUp?.text) {
        const fuId = `fu-${Date.now()}-${Math.random()}`;
        enrichAndAddMessage({ id: fuId, speakerId: followUp.speakerId, speakerName: followUp.speakerName, text: followUp.text, ts: Date.now(), skipTTS: true });
        const fuDone = enqueueTTSAndWait(followUp.text, followUp.speakerId, fuId);

        // ── BEAT 4: Guest rebuts (while follow-up plays, rebuttal is fetched & enqueued) ─
        setIsThinking("interviewee");
        const rebuttalPromise = guestAnswer?.text
          ? fetchAnswer(followUp.text, { wasInterrupted: false })
          : Promise.resolve(null);

        let guestRebuttal: { speakerId: string; speakerName: string; text: string } | null = null;
        await Promise.all([
          rebuttalPromise.then((rb) => {
            guestRebuttal = rb;
            setIsThinking(null);
            if (rb?.text && runningRef.current) {
              enrichAndAddMessage({ id: `rb-${Date.now()}-${Math.random()}`, speakerId: rb.speakerId, speakerName: rb.speakerName, text: rb.text, ts: Date.now() });
              if (voiceEnabledRef.current) startPrefetch({ text: rb.text, personaId: rb.speakerId });
            }
          }),
          fuDone, // resolves when challenge clip finishes → rebuttal starts (OVERLAP_MS)
        ]);
        if (!runningRef.current) break;

        // Drain: wait for guest rebuttal clip to finish before topic advances
        await waitForQueueDrain();
        if (!runningRef.current) break;
        setIsThinking(null);
      }

      // ── ADVANCE TOPIC ─────────────────────────────────────────────────────────
      totalExchangesRef.current += 1;

      // One-time shop promo after exchange 4
      if (totalExchangesRef.current === 4 && !shopPromoFiredRef.current && runningRef.current) {
        shopPromoFiredRef.current = true;
        enrichAndAddMessage({
          id: `shop-promo-${Date.now()}`,
          speakerId: interviewerId || "host",
          speakerName: interviewer?.name || "Host",
          text: "Check out the exclusive product links below my photo — deals picked just for you.",
          ts: Date.now(),
          isSystem: true,
        });
      }

      setCompletedTopics((prev) => new Set(prev).add(topic.id));
      const latestTopics = topicsRef.current;
      const nextIdx = idx + 1 < latestTopics.length ? idx + 1 : 0;
      const nextTopic = latestTopics[nextIdx];
      setTopicIdx(nextIdx);
      topicIdxRef.current = nextIdx;
      exchangesOnTopicRef.current = 0;

      // Pre-fetch next topic's opening question while session continues —
      // uses transition phrasing so the hand-off to the new topic sounds natural.
      if (runningRef.current && Date.now() < sessionEndsAtRef.current) {
        nextQPromiseRef.current = fetchQuestion({
          isFollowUp: false,
          isTransition: true,
          previousTopicTitle: topic.title,
          currentTopicArg: nextTopic,
        }).then((nq) => {
          if (nq?.text && voiceEnabledRef.current) startPrefetch({ text: nq.text, personaId: nq.speakerId });
          return nq;
        });
      }
    }
    runningRef.current = false;
    // Always transition to ended when the loop terminates — whether the client
    // timer expired, the server returned 403, or the null guard fired.
    setPhase("ended");
  }, [topics, fetchQuestion, fetchAnswer, enrichAndAddMessage, waitForQueueDrain, enqueueTTSAndWait]);

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
    setLies([]);
    setFlaggedMsgIds(new Set());
    setLatestTruthScore(null);
    savedSessionRef.current = false;
    setSavedSessionId(null);
    ttsQueueRef.current = [];
    firstAudioPlayedRef.current = false;
    setFirstAudioPlayed(false);
    setPhase("live");
    runningRef.current = true;
    providerUnavailableRef.current = false;
    networkErrorRef.current = false;
    setAiRetrying(false);
    isPausedRef.current = false;
    setIsPaused(false);
    setIsStarting(false);
    // Fetch greeting in parallel, show it, then start the main loop
    (async () => {
      try {
        // ── Sponsor/date intro ─────────────────────────────────────────────
        // Announce the date and "brought to you by Dynamic Creations" before
        // the interview greeting, mirroring the debate-stage welcome.
        const _now = new Date();
        const _months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
        const _d = _now.getDate();
        const _sfx = _d === 1 || _d === 21 || _d === 31 ? "st" : _d === 2 || _d === 22 ? "nd" : _d === 3 || _d === 23 ? "rd" : "th";
        const _dateStr = `${_months[_now.getMonth()]} ${_d}${_sfx}, ${_now.getFullYear()}`;
        // TTS-safe name map — avoids Roman-numeral misreads (e.g. "Malcolm X" → "the tenth")
        const TTS_NAME_OVERRIDES: Record<string, string> = { malcolmx: "Brother Malcolm" };
        const _ivName = (interviewerId && TTS_NAME_OVERRIDES[interviewerId]) || interviewer?.name || "Your host";
        const introText = `Today is ${_dateStr}. This exclusive interview is brought to you by Dynamic Creations. I'm ${_ivName}, and we're getting started.`;
        // Run intro TTS and API greeting fetch concurrently — the greeting API
        // call resolves while the intro is still speaking, eliminating the
        // 1-3 s silence gap that previously existed between intro and greeting.
        let _gData: any = null;
        if (runningRef.current && interviewerId) {
          enrichAndAddMessage({ id: `intro-${Date.now()}`, speakerId: interviewerId, speakerName: _ivName, text: introText, ts: Date.now() });
          [, _gData] = await Promise.all([
            waitForQueueDrain(),
            fetch(new URL("/api/arena/interview-greeting", getApiUrl()).toString(), {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ interviewerId, intervieweeId }),
            }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
          ]);
        }
        // ── API greeting ───────────────────────────────────────────────────
        if (_gData?.interviewer?.text && runningRef.current) {
          enrichAndAddMessage({ id: `greet-iv-${Date.now()}`, speakerId: _gData.interviewer.speakerId, speakerName: _gData.interviewer.speakerName, text: _gData.interviewer.text, ts: Date.now() });
          // Pre-fetch the first question while the greeting TTS plays — eliminates
          // the cold-start dead air gap at the top of the first runLoop beat.
          nextQPromiseRef.current = fetchQuestion({
            isFollowUp: false,
            isTransition: false,
            currentTopicArg: topicsRef.current[topicIdxRef.current] ?? null,
          });
          await waitForQueueDrain();
        }
        if (_gData?.interviewee?.text && runningRef.current) {
          enrichAndAddMessage({ id: `greet-ivee-${Date.now()}`, speakerId: _gData.interviewee.speakerId, speakerName: _gData.interviewee.speakerName, text: _gData.interviewee.text, ts: Date.now() });
          await waitForQueueDrain();
        }
      } catch {}
      if (runningRef.current) {
        // Reset the timer to start NOW — after the intro — so the user gets the
        // full chosen duration of actual interview content, not interview + intro time.
        sessionEndsAtRef.current = Date.now() + duration * 60 * 1000;
        setSecondsLeft(duration * 60);
        runLoop();
      }
    })();
  }, [deviceId, interviewerId, intervieweeId, topics, isStarting, duration, runLoop, enrichAndAddMessage, selectedTopicId, interviewer, waitForQueueDrain]);

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
        const startIdx2 = selectedTopicId ? Math.max(0, topics.findIndex(t => t.id === selectedTopicId)) : 0;
        setTopicIdx(startIdx2);
        topicIdxRef.current = startIdx2;
        exchangesOnTopicRef.current = 0;
        setCompletedTopics(new Set());
        setEmoInterviewer(ZERO_EMO);
        setEmoInterviewee(ZERO_EMO);
        setLieCount(0);
        setLies([]);
        setFlaggedMsgIds(new Set());
        setLatestTruthScore(null);
        savedSessionRef.current = false;
        setSavedSessionId(null);
        ttsQueueRef.current = [];
        firstAudioPlayedRef.current = false;
        setFirstAudioPlayed(false);
        setPhase("live");
        runningRef.current = true;
        providerUnavailableRef.current = false;
        networkErrorRef.current = false;
        isPausedRef.current = false;
        setIsPaused(false);
        (async () => {
          try {
            const gRes = await fetch(new URL("/api/arena/interview-greeting", getApiUrl()).toString(), {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ interviewerId, intervieweeId }),
            });
            if (gRes.ok && runningRef.current) {
              const gData = await gRes.json();
              if (gData?.interviewer?.text) {
                enrichAndAddMessage({ id: `greet-iv-${Date.now()}`, speakerId: gData.interviewer.speakerId, speakerName: gData.interviewer.speakerName, text: gData.interviewer.text, ts: Date.now() });
                await waitForQueueDrain();
              }
              if (gData?.interviewee?.text && runningRef.current) {
                enrichAndAddMessage({ id: `greet-ivee-${Date.now()}`, speakerId: gData.interviewee.speakerId, speakerName: gData.interviewee.speakerName, text: gData.interviewee.text, ts: Date.now() });
                await waitForQueueDrain();
              }
            }
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
  }, [deviceId, duration, isUnlocking, refreshBalance, runLoop, interviewerId, intervieweeId, enrichAndAddMessage, selectedTopicId, topics, waitForQueueDrain]);

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
    // Save to local recordings for offline playback + social sharing
    const localRecording: ArenaRecording = {
      id: `iv-${startedAt}`,
      topic: msgs.find((m) => !m.isSystem)?.speakerName
        ? `${interviewers.find((p) => p.id === interviewerId)?.name ?? interviewerId} × ${interviewees.find((p) => p.id === intervieweeId)?.name ?? intervieweeId}`
        : "Interview",
      startTime: startedAt,
      duration: Math.round((Date.now() - startedAt) / 1000),
      personas: [interviewerId, intervieweeId].filter(Boolean) as string[],
      messages: msgs.map((m, i): RecordedMessage => ({
        id: m.id, speakerId: m.speakerId, speakerName: m.speakerName,
        text: m.text, timestamp: m.ts, relativeTime: m.ts - startedAt,
        isSystem: m.isSystem, isInterruption: m.isInterruption,
      })),
      messageCount: msgs.filter((m) => !m.isSystem).length,
      highlightQuote: pickHighlightQuote(msgs.map((m): RecordedMessage => ({
        id: m.id, speakerId: m.speakerId, speakerName: m.speakerName,
        text: m.text, timestamp: m.ts, relativeTime: 0,
      }))),
    };
    saveRecording(localRecording).catch(() => {});

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
      // Live comedic reaction: only ask for one in Comedic/Roast, same gating
      // as fetchAnswer above — cooldown + coin flip so it feels earned. The
      // server still decides per-answer whether it's warranted.
      const comedicTone = interviewStyle === "comedic" || interviewStyle === "roast";
      const requestReaction = comedicTone && turnsSinceReactionRef.current >= 2 && Math.random() < 0.6;
      const res = await fetch(new URL("/api/arena/interview-callin", getApiUrl()).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-device-id": deviceId },
        body: JSON.stringify({
          interviewerId, intervieweeId, userQuestion: q, userName: callerName.trim(),
          conversationHistory: messagesRef.current.filter((m) => !m.isSystem).slice(-4), topic: currentTopic,
          interviewStyle,
          requestReaction,
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
          const liveReaction = data.reaction && data.reaction.text ? data.reaction : null;
          if (liveReaction) turnsSinceReactionRef.current = 0;
          else turnsSinceReactionRef.current += 1;
          enrichAndAddMessage(
            {
              id: `ca-${Date.now()}-${Math.random()}`,
              speakerId: data.interviewee.speakerId,
              speakerName: data.interviewee.speakerName,
              text: data.interviewee.text,
              ts: Date.now(),
            },
            liveReaction ? {
              onPlaybackStart: () => {
                // Same overlap-timing pattern as fetchAnswer's reaction: kick off
                // synthesis immediately, then overlap it near the tail of the answer.
                const reactionAudioPromise = prefetchTTSAudio("/api/persona-speak", { text: liveReaction.text, personaId: liveReaction.speakerId, bleepEnabled: bleepEnabledRef.current, ...(liveReaction.speakerId === "stephena" ? { angerLevel: stephenaAngerRef.current } : {}), ...(liveReaction.speakerId === "ruckus" ? { angerLevel: ruckusAngerRef.current } : {}) });
                const estMs = Math.max(2500, (data.interviewee.text.length / 14) * 1000);
                const overlapDelay = Math.max(600, estMs - 900);
                setTimeout(() => {
                  if (!runningRef.current) return;
                  setMessages((prev) => [...prev, {
                    id: `react-${Date.now()}-${Math.random()}`,
                    speakerId: liveReaction.speakerId,
                    speakerName: liveReaction.speakerName,
                    text: liveReaction.text,
                    ts: Date.now(),
                    isReaction: true,
                    skipTTS: true,
                  }]);
                  playReactionOverlap(reactionAudioPromise, liveReaction.speakerId);
                }, overlapDelay);
              },
            } : undefined,
          );
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
  }, [callinText, deviceId, interviewerId, intervieweeId, callerName, currentTopic, isCallinSending, enrichAndAddMessage, waitForQueueDrain, playInterruptionAudio, interviewStyle, playReactionOverlap]);

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
            <Text style={s.headerTitle}>1-ON-1 INTERVIEWS</Text>
            <Text style={s.headerSub}>Provocative · Live · Unscripted</Text>
          </View>
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
          <Text style={s.sectionLabel}>INTERVIEWER</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.personaCardRow}>
            {interviewers.filter(p => p.id !== intervieweeId).map((p) => {
              const portrait = PERSONA_PORTRAITS[p.id];
              const isSelected = interviewerId === p.id;
              const initials = p.name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
              const hofEntry = hofRankMap[p.id];
              const hofMedal = hofEntry ? (hofEntry.rank === 1 ? "🥇" : hofEntry.rank === 2 ? "🥈" : hofEntry.rank === 3 ? "🥉" : null) : null;
              const hofLabel = hofEntry ? (hofMedal ? `${hofMedal} #${hofEntry.rank}` : `#${hofEntry.rank} · ${Math.round(hofEntry.winPct)}%`) : null;
              return (
                <Pressable key={p.id} onPress={() => { Haptics.selectionAsync(); setInterviewerId(p.id); }}
                  style={s.personaCard} testID={`interviewer-${p.id}`}>
                  <View style={[s.personaAvatarWrap, isSelected && s.personaAvatarWrapActive]}>
                    {portrait
                      ? <Image source={portrait} style={s.personaAvatar} />
                      : <View style={s.personaAvatarFallback}><Text style={s.personaAvatarInitials}>{initials}</Text></View>
                    }
                  </View>
                  <Text style={[s.personaCardName, isSelected && s.personaCardNameActive]} numberOfLines={1}>{p.name}</Text>
                  {hofLabel && (
                    <Text style={s.personaCardHofRank}>{hofLabel}</Text>
                  )}
                </Pressable>
              );
            })}
          </ScrollView>

          <Text style={[s.sectionLabel, { marginTop: 16 }]}>GUEST CATEGORY</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }} contentContainerStyle={{ paddingHorizontal: 0, gap: 6, flexDirection: "row" }}>
            {GUEST_CATEGORY_LIST.map((c) => (
              <Pressable key={c} onPress={() => { Haptics.selectionAsync(); setGuestCategory(c); }}
                style={[s.mixCard, guestCategory === c && s.mixCardActive]} testID={`guest-cat-${c}`}>
                <Text style={[s.mixText, guestCategory === c && s.mixTextActive]}>{c}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <Text style={[s.sectionLabel, { marginTop: 4 }]}>GUEST</Text>
          <View style={s.guestCardGrid}>
            {interviewees
              .filter(p => p.id !== interviewerId)
              .filter(p => guestCategory === "All" || (GUEST_CATEGORIES[p.id] ?? "Political") === guestCategory)
              .map((p) => {
                const portrait = PERSONA_PORTRAITS[p.id];
                const isSelected = intervieweeId === p.id;
                const initials = p.name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
                const locked = isLocked(p.id);
                const cfg = PREMIUM_PERSONA_CONFIGS[p.id];
                return (
                  <Pressable key={p.id}
                    onPress={() => {
                      if (locked && cfg && deviceId) {
                        unlockWithTokens(p.id, deviceId, refreshBalance);
                        return;
                      }
                      Haptics.selectionAsync();
                      setIntervieweeId(p.id);
                    }}
                    style={s.guestCard} testID={`interviewee-${p.id}`}>
                    <View style={[s.personaAvatarWrap, isSelected && s.personaAvatarWrapActiveGuest, locked && { opacity: 0.55 }]}>
                      {portrait
                        ? <Image source={portrait} style={s.personaAvatar} />
                        : <View style={s.personaAvatarFallback}><Text style={s.personaAvatarInitials}>{initials}</Text></View>
                      }
                      {locked && (
                        <View style={{ position: "absolute", bottom: 0, right: 0, backgroundColor: cfg?.badgeColor || "#FFD700", borderRadius: 8, padding: 2 }}>
                          {premiumUnlocking === p.id
                            ? <ActivityIndicator size={10} color="#000" />
                            : <Ionicons name="lock-closed" size={10} color="#000" />
                          }
                        </View>
                      )}
                    </View>
                    <Text style={[s.personaCardName, isSelected && s.guestCardNameActive, locked && { color: "rgba(255,255,255,0.4)" }]} numberOfLines={1}>
                      {p.name}{locked && cfg ? ` ${cfg.tokenPrice}🪙` : ""}
                    </Text>
                  </Pressable>
                );
              })}
          </View>

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

          <Pressable
            onPress={startInterview}
            disabled={isStarting || !interviewerId || !intervieweeId || interviewerId === intervieweeId || topics.length === 0}
            style={[s.startBtn, (isStarting || !interviewerId || !intervieweeId || interviewerId === intervieweeId || topics.length === 0) && { opacity: 0.4 }]}
            testID="start-interview"
          >
            <Ionicons name="mic" size={18} color="#000" />
            <Text style={s.startBtnText}>
              {isStarting ? "STARTING…" : !deviceId ? "CONNECTING…" : `START ${duration}-MIN INTERVIEW`}
            </Text>
          </Pressable>
          <Text style={s.startSub}>
            {interviewer?.name || "—"} grills {interviewee?.name || "—"} · {selectedTopicId ? `starting on "${topics.find(t => t.id === selectedTopicId)?.title}"` : `${topics.length} topic${topics.length === 1 ? "" : "s"}`}
          </Text>

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

      {phase === "live" && aiRetrying && (
        <Animated.View
          entering={FadeInDown.duration(180)}
          exiting={FadeOut.duration(180)}
          pointerEvents="none"
          style={{
            position: "absolute",
            top: insets.top + webTop + 58,
            alignSelf: "center",
            zIndex: 300,
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            paddingHorizontal: 14,
            paddingVertical: 9,
            borderRadius: 18,
            backgroundColor: "rgba(24,24,27,0.96)",
            borderWidth: 1,
            borderColor: "rgba(251,191,36,0.7)",
          }}
        >
          <ActivityIndicator size="small" color="#FBBF24" />
          <Text style={{ color: "#FDE68A", fontSize: 12, fontWeight: "800" }}>Connection hiccup — retrying…</Text>
        </Animated.View>
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
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setBleepEnabled((p) => !p); }}
          style={[s.iconBtnSm, bleepEnabled && { borderColor: "#60A5FA", backgroundColor: "rgba(96,165,250,0.15)" }]}
          testID="toggle-bleep"
        >
          <Ionicons name={bleepEnabled ? "shield-checkmark" : "shield-outline"} size={16} color={bleepEnabled ? "#60A5FA" : "rgba(255,255,255,0.4)"} />
        </Pressable>
        <Pressable onPress={toggleFx} style={s.iconBtnSm} testID="toggle-fx">
          <Ionicons name={fxEnabled ? "flash" : "flash-off"} size={16} color={fxEnabled ? "#FFD700" : "rgba(255,255,255,0.4)"} />
        </Pressable>
        <Pressable
          onPress={toggleReactionOverlap}
          style={[s.iconBtnSm, reactionOverlapEnabled && { borderColor: "#34D399", backgroundColor: "rgba(52,211,153,0.15)" }]}
          testID="toggle-reaction-overlap"
        >
          <Ionicons name={reactionOverlapEnabled ? "happy" : "happy-outline"} size={16} color={reactionOverlapEnabled ? "#34D399" : "rgba(255,255,255,0.4)"} />
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
      </View>

      {/* Portrait stage with mood meters */}
      <View style={s.stage}>
        {/* QR code — centered between the two portraits, screen-recording visible */}
        <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, alignItems: "center", justifyContent: "center", zIndex: 10 }}>
          <View style={{ backgroundColor: "rgba(0,0,0,0.72)", borderRadius: 8, padding: 5, borderWidth: 1, borderColor: "rgba(255,215,0,0.45)" }}>
            <Image source={require("../assets/images/qr-download.jpg")} style={{ width: 56, height: 56, borderRadius: 5 }} resizeMode="contain" />
            <Text style={{ color: "#FFD700", fontSize: 7, fontWeight: "700", textAlign: "center", marginTop: 2, letterSpacing: 0.5 }}>SCAN TO TRY</Text>
          </View>
        </View>
        {[
          { id: interviewerId, name: interviewer?.name, portrait: interviewerPortrait, glow: interviewerGlowStyle, emo: emoInterviewer, role: "INTERVIEWER", color: "#FFD700" },
          { id: intervieweeId, name: interviewee?.name, portrait: intervieweePortrait, glow: intervieweeGlowStyle, emo: emoInterviewee, role: "GUEST", color: "#4ADE80" },
        ].map((p, idx) => (
          <View key={`${p.id}-${idx}`} style={s.stageCol}>
            <View style={s.portraitWrap}>
              <Animated.View style={[s.portraitGlow, { shadowColor: p.color, borderColor: p.color }, p.glow]} />
              {p.portrait ? (
                <Image source={p.portrait} style={[s.portraitImg, CARTOON_FILTER]} />
              ) : (
                <View style={[s.portraitImg, { backgroundColor: "#222", alignItems: "center", justifyContent: "center" }]}>
                  <Ionicons name="person" size={42} color="#666" />
                </View>
              )}
              {isThinking === (idx === 0 ? "interviewer" : "interviewee") && (
                <View style={s.thinkingDot}>
                  <ActivityIndicator size="small" color={p.color} />
                </View>
              )}
            </View>
            <Text style={[s.stageRole, { color: p.color }]} numberOfLines={1}>{p.role}</Text>
            <Text style={s.stageName} numberOfLines={1}>{p.name || "—"}</Text>
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
            const canFlag = !isInterviewer && !isCallIn && intervieweeId && item.speakerId === intervieweeId;
            const alreadyFlagged = flaggedMsgIds.has(item.id);
            return (
              <Animated.View entering={FadeInUp.duration(300)} style={[s.bubbleRow, isCallIn ? { justifyContent: "center" } : isInterviewer ? { justifyContent: "flex-start" } : { justifyContent: "flex-end" }]}>
                <View style={[
                  s.bubble,
                  isCallIn ? s.bubbleCallIn : isInterviewer ? s.bubbleInterviewer : s.bubbleInterviewee,
                  item.isInterruption && s.bubbleInterrupt,
                  item.isReaction && s.bubbleReaction,
                ]}>
                  <Text style={[s.bubbleName, { color: isCallIn ? "#60a5fa" : isInterviewer ? "#FFD700" : "#4ADE80" }]}>
                    {item.speakerName}{item.isReaction ? " · REACTS" : item.isInterruption ? " · INTERRUPTS" : ""}{isCallIn ? " · CALL-IN" : ""}
                  </Text>
                  <Text style={[s.bubbleText, item.isReaction && s.bubbleTextReaction]}>{applyBleep(item.text)}</Text>
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
            ) : null
          }
          scrollEnabled={messages.length > 0}
        />
        <Animated.View pointerEvents="none" style={[s.lightning, flashStyle]} />
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
          <Text style={s.endedTitle}>{networkErrorRef.current ? "INTERVIEW PAUSED" : "INTERVIEW COMPLETE"}</Text>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 8, flexWrap: "wrap", justifyContent: "center" }}>
            <Pressable onPress={() => setPhase("setup")} style={s.endedBtnSecondary}>
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
            <Pressable onPress={shareTranscript} style={[s.endedBtnSecondary, { borderColor: "rgba(74,222,128,0.5)", backgroundColor: "rgba(74,222,128,0.1)" }]}>
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
  guestCardGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 4 },
  guestCard: { width: 72, alignItems: "center" },
  personaAvatarWrapActiveGuest: { borderColor: "#4ADE80", borderWidth: 2.5 },
  guestCardNameActive: { color: "#4ADE80" },
  chipTextActive: { color: "#fff" },

  personaCardRow: { flexDirection: "row", gap: 10, paddingVertical: 4 },
  personaCard: { width: 72, alignItems: "center" },
  personaAvatarWrap: { width: 60, height: 60, borderRadius: 30, overflow: "hidden", borderWidth: 2, borderColor: "rgba(255,255,255,0.1)" },
  personaAvatarWrapActive: { borderColor: "#FFD700", borderWidth: 2.5 },
  personaAvatar: { width: "100%", height: "100%" },
  personaAvatarFallback: { width: "100%", height: "100%", backgroundColor: "rgba(255,215,0,0.12)", alignItems: "center", justifyContent: "center" },
  personaAvatarInitials: { color: "#FFD700", fontSize: 18, fontWeight: "800" },
  personaCardName: { color: "rgba(255,255,255,0.6)", fontSize: 10, fontWeight: "700", marginTop: 5, textAlign: "center" },
  personaCardNameActive: { color: "#FFD700" },
  personaCardHofRank: { color: "#FFD700", fontSize: 9, fontWeight: "700", marginTop: 2, textAlign: "center" },

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
  bubbleReaction: { borderStyle: "dashed", backgroundColor: "rgba(255,255,255,0.05)", paddingVertical: 6, borderColor: "rgba(255,255,255,0.25)" },
  bubbleName: { fontSize: 10, fontWeight: "900", letterSpacing: 0.5, marginBottom: 3 },
  bubbleText: { color: "#fff", fontSize: 14, lineHeight: 19 },
  bubbleTextReaction: { fontStyle: "italic", fontSize: 13, color: "#ddd" },

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

  stage: { flexDirection: "row", paddingHorizontal: 12, paddingTop: 6, paddingBottom: 8, gap: 10 },
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

  flagBtn: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", marginTop: 6, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  flagBtnDone: { backgroundColor: "rgba(255,77,77,0.12)", borderColor: "rgba(255,77,77,0.4)" },
  flagBtnText: { color: "rgba(255,255,255,0.6)", fontSize: 9, fontWeight: "900", letterSpacing: 0.6 },
  userFlagBadge: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, backgroundColor: "rgba(96,165,250,0.18)", borderWidth: 1, borderColor: "rgba(96,165,250,0.4)" },
  userFlagBadgeText: { color: "#60a5fa", fontSize: 9, fontWeight: "900", letterSpacing: 0.4 },
});
