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
import { getApiUrl } from "@/lib/query-client";
import { useTokens } from "@/lib/token-context";
import Colors from "@/constants/colors";
import { ShareAppButton } from "@/components/ShareAppButton";
import { CashAppDonate } from "@/components/CashAppDonate";
import { playTTS, prefetchTTSAudio, playPrefetchedAudio } from "@/lib/audio-helper";
import { getPersonaVoiceVolume, shouldSkipPersonaVoice } from "@/lib/persona-voice";

type PersonaLite = { id: string; name: string };
type Topic = { id: string; title: string; description: string; era: "current" | "past" };
type Msg = { id: string; speakerId: string; speakerName: string; text: string; ts: number; isInterruption?: boolean; isCallIn?: boolean; callerName?: string; isSystem?: boolean; skipTTS?: boolean };

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
  "Say what?", "Unbelievable.", "Mm.", "Ok sure.", "That's rich.",
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
  shahidbolson: require("@/assets/images/persona-shahid.png"),
  mlk: require("@/assets/images/persona-mlk.jpg"),
  malcolmx: require("@/assets/images/persona-malcolmx.jpg"),
  samjackson: require("@/assets/images/persona-samjackson.jpg"),
  louisfarrakhan: require("@/assets/images/persona-louisfarrakhan.png"),
  carlsagan: require("@/assets/images/persona-carlsagan.png"),
  larrycableguy: require("@/assets/images/persona-larrycableguy.png"),
  jdvance: require("@/assets/images/persona-jdvance.png"),
  kaitlyncollins: require("@/assets/images/persona-kaitlyncollins.png"),
  tedcruz: require("@/assets/images/persona-tedcruz.png"),
  georgewbush: require("@/assets/images/persona-georgewbush.png"),
  gilbertgottfried: require("@/assets/images/persona-gilbertgottfried.jpg"),
};

const FX_KEY = "interview_fx_enabled_v1";
const VOICE_KEY = "interview_voice_enabled_v1";
const BEEP_KEY = "interview_beep_enabled_v1";
const NAME_KEY = "interview_caller_name_v1";

type GuestCategory = "All" | "Political" | "History" | "Science" | "Finance" | "Entertainment";
const GUEST_CATEGORY_LIST: GuestCategory[] = ["All", "Political", "History", "Science", "Finance", "Entertainment"];

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
  jdvance: "Political", tedcruz: "Political", kaitlyncollins: "Political",
  neiltyson: "Science", professorjiang: "Science", carlsagan: "Science",
  elon: "Finance",
  rosie: "Entertainment", ruckus: "Entertainment", samjackson: "Entertainment",
  stephena: "Entertainment", hannity: "Entertainment", megynkelly: "Entertainment",
  shannon: "Entertainment", jesseleepetersen: "Entertainment", joerogan: "Entertainment",
  larrycableguy: "Entertainment", gilbertgottfried: "Entertainment",
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

type InterviewStyleId = "combative" | "informative" | "comedic" | "civil_discourse" | "educational";
const INTERVIEW_STYLES: Array<{ id: InterviewStyleId; label: string; icon: "flame" | "information-circle" | "happy" | "handshake" | "school" }> = [
  { id: "combative",      label: "Combative",       icon: "flame" },
  { id: "informative",    label: "Informative",     icon: "information-circle" },
  { id: "comedic",        label: "Comedic",         icon: "happy" },
  { id: "civil_discourse",label: "Civil Discourse", icon: "handshake" },
  { id: "educational",    label: "Educational",     icon: "school" },
];

const webTop = Platform.OS === "web" ? 67 : 0;
const webBottom = Platform.OS === "web" ? 34 : 0;

export default function InterviewScreen() {
  const insets = useSafeAreaInsets();
  const { deviceId, balance, refreshBalance } = useTokens();

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

  // ── Pro mode state ───────────────────────────────────────────────────────
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const voiceEnabledRef = useRef(true);
  const [fxEnabled, setFxEnabled] = useState(true);
  const fxEnabledRef = useRef(true);
  const [beepEnabled, setBeepEnabled] = useState(true);
  const beepEnabledRef = useRef(true);
  const [activeSpeaker, setActiveSpeaker] = useState<string | null>(null);
  const activeSpeakerRef = useRef<string | null>(null);
  const ttsQueueRef = useRef<Array<{ text: string; personaId: string; msgId?: string }>>([]);
  const ttsRunningRef = useRef(false);
  const currentSoundRef = useRef<Audio.Sound | null>(null);
  const prefetchedAudioRef = useRef<{ personaId: string; text: string; audioUri: string } | null>(null);
  const prefetchingRef = useRef(false);

  const [emoInterviewer, setEmoInterviewer] = useState<Emotions>(ZERO_EMO);
  const [emoInterviewee, setEmoInterviewee] = useState<Emotions>(ZERO_EMO);

  const [lieTally, setLieTally] = useState<{ totalLies: number; totalSessions: number; bestSession: number; topLiarName: string | null; topLiarCount: number } | null>(null);

  const [lieCount, setLieCount] = useState(0);
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
  const startPrefetch = useCallback((item: { text: string; personaId: string }) => {
    if (prefetchingRef.current) return;
    if (shouldSkipPersonaVoice(item.personaId)) return;
    const cached = prefetchedAudioRef.current;
    if (cached && cached.text === item.text && cached.personaId === item.personaId) return;
    prefetchingRef.current = true;
    prefetchTTSAudio("/api/persona-speak", { text: item.text, personaId: item.personaId })
      .then((audioUri) => {
        prefetchedAudioRef.current = { personaId: item.personaId, text: item.text, audioUri };
        prefetchingRef.current = false;
      })
      .catch(() => { prefetchingRef.current = false; });
  }, []);

  // ── TTS queue: sequential playback with 1s overlap + audio prefetch ────────
  const processQueue = useCallback(async () => {
    if (ttsRunningRef.current) return;
    ttsRunningRef.current = true;
    while (ttsQueueRef.current.length > 0 && voiceEnabledRef.current && runningRef.current) {
      const item = ttsQueueRef.current.shift();
      if (!item) break;
      if (shouldSkipPersonaVoice(item.personaId)) {
        continue;
      }
      setActiveSpeaker(item.personaId);
      activeSpeakerRef.current = item.personaId;
      try {
        // If a prefetch is in flight for this item, wait up to 1.5 s for it to land
        // before falling back to a fresh playTTS call — eliminates the dead-air gap
        // that occurred when startPrefetch was called early but processQueue didn't wait.
        if (prefetchingRef.current) {
          const prefetchDeadline = Date.now() + 1500;
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
          sound = await playTTS("/api/persona-speak", { text: item.text, personaId: item.personaId }, { volume: getPersonaVoiceVolume(item.personaId) });
        }
        currentSoundRef.current = sound;
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
                earlyResolve();
              }
            }
          });
        });
      } catch (e) {
        // ignore TTS error and continue
      }
    }
    ttsRunningRef.current = false;
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

  const enqueueTTS = useCallback((text: string, personaId: string, msgId?: string) => {
    if (!voiceEnabledRef.current) return;
    ttsQueueRef.current.push({ text, personaId, msgId });
    processQueue();
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
  const enrichAndAddMessage = useCallback((m: Msg) => {
    setMessages((prev) => [...prev, m]);
    if (!m.skipTTS) enqueueTTS(m.text, m.speakerId, m.id);
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
    const mainSound = currentSoundRef.current;
    if (mainSound) { try { mainSound.setVolumeAsync(0.10).catch(() => {}); } catch {} }
    setActiveSpeaker(personaId);
    activeSpeakerRef.current = personaId;
    try {
      const sound = await playTTS("/api/persona-speak", { text, personaId }, { volume: getPersonaVoiceVolume(personaId) });
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

  const shareInterviewPoll = useCallback(async () => {
    if (!pollQuestion) return;
    const totalVotes = pollVoteA + pollVoteB;
    const pctA = totalVotes > 0 ? Math.round((pollVoteA / totalVotes) * 100) : 50;
    const pctB = 100 - pctA;
    const tags = pollQuestion.hashtags?.map((h: string) => `#${h}`).join(" ") || "#ChatDJT #Poll";
    const msg = `🗳️ LIVE POLL — Chat DJT\n\n"${pollQuestion.question}"\n\n🅰️ ${pollQuestion.optionA} — ${pctA}%\n🅱️ ${pollQuestion.optionB} — ${pctB}%\n\n${tags}\n\nVote live on Chat DJT 👇\nchatdjt.com`;
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
          interviewStyle,
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
  }, [deviceId, interviewerId, intervieweeId, currentTopic, interviewStyle]);

  // Main turn loop
  const runLoop = useCallback(async () => {
    while (runningRef.current && Date.now() < sessionEndsAtRef.current) {
      if (isPausedRef.current) { await new Promise((r) => setTimeout(r, 400)); continue; }
      if (!runningRef.current) break;

      // Always read from the ref so we see the latest topic list even if it was
      // fetched after runLoop started. If the list is empty, wait and retry.
      const liveTopics = topicsRef.current;
      if (liveTopics.length === 0) { await new Promise((r) => setTimeout(r, 800)); continue; }

      // Clamp idx in case the topic list shrank (shouldn't happen, but safe).
      const rawIdx = topicIdxRef.current;
      const idx = rawIdx < liveTopics.length ? rawIdx : 0;
      if (idx !== rawIdx) { topicIdxRef.current = 0; setTopicIdx(0); }
      const topic = liveTopics[idx];

      const isFirstQuestionOnTopic = exchangesOnTopicRef.current === 0;
      const isFollowUp = !isFirstQuestionOnTopic;

      // Use pre-fetched question if available (eliminates dead air between turns)
      setIsThinking("interviewer");
      const q = await (nextQPromiseRef.current || fetchQuestion({
        isFollowUp,
        isTransition: false,
        currentTopicArg: topic,
      }));
      nextQPromiseRef.current = null;
      setIsThinking(null);
      if (!runningRef.current) break;
      if (!q) { await new Promise((r) => setTimeout(r, 600)); continue; }
      enrichAndAddMessage({ id: `q-${Date.now()}-${Math.random()}`, speakerId: q.speakerId, speakerName: q.speakerName, text: q.text, ts: Date.now() });

      // Offense check: does the question offend the interviewee? (guaranteed interrupt, no self-interrupt)
      const qOffendsInterviewee = intervieweeId ? detectOffense(q.text, intervieweeId, q.speakerId) : false;
      // Decide up-front whether to interrupt — offense = always; otherwise 20% random
      const willInterrupt = qOffendsInterviewee || Math.random() < 0.20;

      // PIPELINE: kick off the answer fetch immediately in parallel with question TTS.
      // When interrupting, pre-fetch BOTH the jab AND the full answer in parallel so
      // there's no dead air after the interruption.
      const answerPromise: Promise<{ speakerId: string; speakerName: string; text: string } | null> =
        fetchAnswer(q.text, { wasInterrupted: willInterrupt });
      const interruptPromise: Promise<{ speakerId: string; speakerName: string; text: string } | null> | null =
        willInterrupt ? fetchAnswer(q.text, { isInterruption: true }) : null;

      // ── Pipeline: while question audio plays, race to enqueue the response. ──
      // No waitForQueueDrain here — we let the interrupt/answer enqueue while question
      // is still playing so OVERLAP_MS (1000 ms) fires and creates true conversational overlap.

      // Interruption from interviewee (offense = guaranteed; otherwise random 20%)
      // Uses arena-style playInterruptionAudio: ducks the question audio to 10%,
      // plays the jab at full volume, then restores the question audio to 100%.
      let interruptionText: string | undefined;
      if (willInterrupt && interruptPromise) {
        const intr = await interruptPromise;
        if (intr && intr.text && runningRef.current) {
          interruptionText = intr.text;
          // Show in chat (skipTTS so it doesn't also go into the regular queue)
          enrichAndAddMessage({ id: `intr-${Date.now()}-${Math.random()}`, speakerId: intr.speakerId, speakerName: intr.speakerName, text: intr.text, ts: Date.now(), isInterruption: true, skipTTS: true });
          // Fire concurrently with whatever is playing — ducks main speaker
          playInterruptionAudio(intr.text, intr.speakerId);
        }
      }
      if (!runningRef.current) break;

      setIsThinking("interviewee");
      const a = await answerPromise;
      setIsThinking(null);
      if (!runningRef.current) break;
      if (!a) { await waitForQueueDrain(); continue; }

      // Pre-fetch TTS audio immediately when text arrives — starts downloading while
      // question/interrupt audio may still be playing → audio ready when answer is dequeued.
      if (voiceEnabledRef.current) startPrefetch({ text: a.text, personaId: a.speakerId });

      // ── Micro-reaction by the INTERVIEWEE while the question is still ringing —
      // a short spontaneous reaction (no API call) that lands just before the answer.
      if (Math.random() < 0.30 && !willInterrupt) {
        const micro = MICRO_REACTIONS[Math.floor(Math.random() * MICRO_REACTIONS.length)];
        enrichAndAddMessage({ id: `micro-q-${Date.now()}`, speakerId: a.speakerId, speakerName: a.speakerName, text: micro, ts: Date.now(), isInterruption: true });
      }

      enrichAndAddMessage({ id: `a-${Date.now()}-${Math.random()}`, speakerId: a.speakerId, speakerName: a.speakerName, text: a.text, ts: Date.now() });

      // Offense check: does the answer offend the interviewer? (now that we have a.text)
      const aOffendsInterviewer = interviewerId ? detectOffense(a.text, interviewerId, a.speakerId) : false;
      // Decide cut-in immediately and PRE-FETCH in parallel with the answer TTS.
      const willCutIn = aOffendsInterviewer || Math.random() < 0.18;
      const cutInPromise: Promise<{ speakerId: string; speakerName: string; text: string } | null> | null =
        willCutIn ? fetchQuestion({ isInterruption: true, currentTopicArg: topic }) : null;

      // ── Arena-style interviewer cut-in: fire as background race so it can duck
      // the ANSWER audio mid-sentence if the text arrives while the answer is still playing.
      let cutFired = false;
      if (cutInPromise) {
        cutInPromise.then((cut) => {
          if (!cutFired && cut && cut.text && runningRef.current && cut.speakerId !== a.speakerId) {
            cutFired = true;
            enrichAndAddMessage({ id: `cut-${Date.now()}-${Math.random()}`, speakerId: cut.speakerId, speakerName: cut.speakerName, text: cut.text, ts: Date.now(), isInterruption: true, skipTTS: true });
            playInterruptionAudio(cut.text, cut.speakerId);
          }
        });
      }

      // Predict whether the NEXT exchange will need a topic transition so we can
      // pre-fetch the right question type in parallel with the answer TTS — no blocking wait.
      exchangesOnTopicRef.current += 1;
      totalExchangesRef.current += 1;
      const exchangesPerTopic = duration <= 5 ? 2 : duration <= 10 ? 3 : 3;
      const shouldAdvance = exchangesOnTopicRef.current >= exchangesPerTopic;
      const latestTopicsNow = topicsRef.current;
      const nextIdxNow = idx + 1 < latestTopicsNow.length ? idx + 1 : 0;
      const nextTopicNow = latestTopicsNow[nextIdxNow];

      if (runningRef.current && Date.now() < sessionEndsAtRef.current) {
        // Pre-fetch the CORRECT next question type while answer TTS plays —
        // transition if we're about to change topics, follow-up if staying on topic.
        nextQPromiseRef.current = shouldAdvance
          ? fetchQuestion({ isTransition: true, previousTopicTitle: topic.title, currentTopicArg: nextTopicNow })
          : fetchQuestion({ isFollowUp: true, isTransition: false, currentTopicArg: topic });
      }

      // Seal off the cut-in promise — any late-arriving cut from the server
      // must not bleed into the next turn and talk over the interviewer's own question.
      cutFired = true;
      // Wait for the answer TTS to finish playing (audio-driven pacing).
      await waitForQueueDrain();
      if (!runningRef.current) break;

      // ── Micro-reaction by the INTERVIEWER while the answer plays —
      // skip if cut-in already fired or is pending (avoid double-reaction).
      if (Math.random() < 0.28 && !willCutIn) {
        const micro = MICRO_REACTIONS[Math.floor(Math.random() * MICRO_REACTIONS.length)];
        enrichAndAddMessage({ id: `micro-a-${Date.now()}`, speakerId: q.speakerId, speakerName: q.speakerName, text: micro, ts: Date.now(), isInterruption: true });
      }

      // One-time shop promo injection mid-interview (after exchange 4)
      // Note: enrichAndAddMessage() below already enqueues TTS for this message via
      // enqueueTTS() internally — do NOT also push to ttsQueueRef here, or the promo
      // line gets read aloud twice back-to-back and throws off the next turn's timing.
      if (totalExchangesRef.current === 4 && !shopPromoFiredRef.current && runningRef.current) {
        shopPromoFiredRef.current = true;
        const promoSpeakerId = interviewerId || "host";
        const promoSpeakerName = interviewer?.name || promoSpeakerId;
        const promoText = `Check out the exclusive product links below my photo — deals picked just for you.`;
        enrichAndAddMessage({
          id: `shop-promo-${Date.now()}`,
          speakerId: promoSpeakerId,
          speakerName: promoSpeakerName,
          text: promoText,
          ts: Date.now(),
          isSystem: true,
        });
      }

      if (shouldAdvance) {
        setCompletedTopics((prev) => new Set(prev).add(topic.id));
        const nextIdx = nextIdxNow;
        const nextTopic = nextTopicNow;
        // Use the pre-fetched transition question (started in parallel with answer TTS above).
        // If it's not ready yet, await it now — still faster than starting fresh here.
        setIsThinking("interviewer");
        const trans = await (nextQPromiseRef.current || fetchQuestion({
          isTransition: true,
          previousTopicTitle: topic.title,
          currentTopicArg: nextTopic,
        }));
        nextQPromiseRef.current = null;
        setIsThinking(null);
        if (trans && trans.text && runningRef.current) {
          enrichAndAddMessage({ id: `trans-${Date.now()}-${Math.random()}`, speakerId: trans.speakerId, speakerName: trans.speakerName, text: trans.text, ts: Date.now() });
        }
        setTopicIdx(nextIdx);
        topicIdxRef.current = nextIdx;
        exchangesOnTopicRef.current = 1; // transition counts as first question
        // Pre-fetch the first follow-up for the new topic while transition TTS plays.
        if (runningRef.current && Date.now() < sessionEndsAtRef.current) {
          nextQPromiseRef.current = fetchQuestion({ isFollowUp: true, isTransition: false, currentTopicArg: nextTopic });
        }
      }
      // nextQPromiseRef already holds the pre-fetched follow-up for the non-transition case.
    }
    runningRef.current = false;
    if (Date.now() >= sessionEndsAtRef.current) setPhase("ended");
  }, [topics, fetchQuestion, fetchAnswer, enrichAndAddMessage, duration, waitForQueueDrain, playInterruptionAudio]);

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

    // Only reuse server's expiresAt if it covers at least 80% of the selected
    // duration — an old session with little time left would make the interview
    // end immediately. Otherwise use the full selected duration; the backend
    // grace period + graceful 403 handler ensures a clean end if server-side
    // access expires first.
    const selectedMs = duration * 60 * 1000;
    const serverRemaining = serverExpiresAt ? serverExpiresAt - Date.now() : 0;
    const endsAt = serverRemaining >= selectedMs * 0.80
      ? serverExpiresAt!
      : Date.now() + selectedMs;
    sessionStartedAtRef.current = Date.now();
    sessionEndsAtRef.current = endsAt;
    setSecondsLeft(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)));
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
    setPhase("live");
    runningRef.current = true;
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
        if (runningRef.current && interviewerId) {
          enrichAndAddMessage({ id: `intro-${Date.now()}`, speakerId: interviewerId, speakerName: _ivName, text: introText, ts: Date.now() });
          // Wait for intro TTS to finish before the API greeting begins
          await waitForQueueDrain();
        }
        // ── API greeting ───────────────────────────────────────────────────
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
      if (runningRef.current) runLoop();
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
        setPhase("live");
        runningRef.current = true;
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
          if (runningRef.current) runLoop();
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
          <View style={s.chipRow}>
            {interviewers.filter(p => p.id !== intervieweeId).map((p) => (
              <Pressable key={p.id} onPress={() => { Haptics.selectionAsync(); setInterviewerId(p.id); }}
                style={[s.chip, interviewerId === p.id && s.chipActive]} testID={`interviewer-${p.id}`}>
                <Text style={[s.chipText, interviewerId === p.id && s.chipTextActive]}>{p.name}</Text>
              </Pressable>
            ))}
          </View>

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
          <View style={s.chipRow}>
            {interviewees
              .filter(p => p.id !== interviewerId)
              .filter(p => guestCategory === "All" || (GUEST_CATEGORIES[p.id] ?? "Political") === guestCategory)
              .map((p) => (
                <Pressable key={p.id} onPress={() => { Haptics.selectionAsync(); setIntervieweeId(p.id); }}
                  style={[s.chip, intervieweeId === p.id && s.chipActiveGuest]} testID={`interviewee-${p.id}`}>
                  <Text style={[s.chipText, intervieweeId === p.id && s.chipTextActive]}>{p.name}</Text>
                </Pressable>
              ))}
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

      {phase === "ended" && (
        <Animated.View entering={FadeInDown.duration(300)} style={[s.endedBar, { paddingBottom: insets.bottom + webBottom + 12 }]}>
          <Text style={s.endedTitle}>INTERVIEW COMPLETE</Text>
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
  chipTextActive: { color: "#fff" },

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
