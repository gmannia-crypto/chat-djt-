import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  Platform,
  Image,
  Linking,
  ActivityIndicator,
  Modal,
  Alert,
  BackHandler,
  type ImageSourcePropType,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { Audio } from "expo-av";
import { playTTS, playTrumpTTS, isTrumpCurrentlySpeaking } from "@/lib/audio-helper";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import Colors from "@/constants/colors";
import { getApiUrl } from "@/lib/query-client";
import {
  recordInteraction,
  getHeadToHead,
  generateTrashTalk,
  generateReference,
} from "@/lib/persona-memory";
import { useSoundEffects } from "@/lib/use-sound";
import { SoundToggle } from "@/components/SoundToggle";
import {
  VoiceControlPopover,
  getVoiceSetting,
  usePersonaVoiceSettings,
  type PersonaVoiceSetting,
  type PersonaVoiceSettings,
} from "@/components/VoiceMixer";
import { useSound } from "@/lib/sound-context";
import { useScreenTracker, useTrackEvent } from "@/lib/use-analytics";
import { useLiveActivity } from "@/lib/live-activity-context";
import {
  getTallies,
  makeUniversalPick,
  getUserPicks,
  resolvePick,
  getUserName,
  saveUserName,
  type PersonaTally,
  type UserPick,
} from "@/lib/bet-tally";
import { TextInput } from "react-native";
import { checkGameEndEvents, cleanupBuzzer } from "@/lib/game-buzzer";
import { useTokens } from "@/lib/token-context";
import { LiveTicker } from "@/components/LiveTicker";
import { StatsPanel } from "@/components/StatsPanel";
import { ViralShareCard } from "@/components/ViralShareCard";
import { ShareAppButton } from "@/components/ShareAppButton";
import { shareContent } from "@/lib/track-share";
import { getSportsStats, recordSportsPick, type SportsStats } from "@/lib/viral-stats";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface PlayerLeader {
  category: string;
  player: string;
  value: string;
  headshot?: string;
}

interface TeamStat {
  name: string;
  value: string;
}

interface GolfLeaderboardEntry {
  name: string;
  score: string;
  position: number;
  rounds?: number[];
}

interface Game {
  id: number;
  league: string;
  game: string;
  time: string;
  odds: string;
  status?: string;
  score?: string;
  winner?: string;
  homeScore?: number;
  awayScore?: number;
  final?: boolean;
  homeTeam?: string;
  awayTeam?: string;
  homeLeaders?: PlayerLeader[];
  awayLeaders?: PlayerLeader[];
  homeStats?: TeamStat[];
  awayStats?: TeamStat[];
  startTime?: string;
  displayClock?: string;
  period?: number;
  isGolf?: boolean;
  tournamentName?: string;
  venue?: string;
  course?: string;
  leaderboard?: GolfLeaderboardEntry[];
}

interface PersonaPick {
  pick: string;
  reasoning: string;
  confidence: number;
}

const PERSONA_IMAGES: Record<string, ImageSourcePropType> = {
  trump: require("@/assets/images/persona-trump.png"),
  grandma: require("@/assets/images/persona-grandma.png"),
  loudmouth: require("@/assets/images/persona-loudmouth.png"),
  jordan: require("@/assets/images/persona-jordan.png"),
  bernie: require("@/assets/images/persona-bernie.png"),
  ruckus: require("@/assets/images/persona-ruckus.jpg"),
  maxkellerman: require("@/assets/images/persona-maxkellerman.png"),
  snoop: require("@/assets/images/persona-snoop.png"),
  barkley: require("@/assets/images/persona-barkley.png"),
  rogan: require("@/assets/images/persona-rogan.png"),
  shannon: require("@/assets/images/persona-shannon.png"),
  speedDemon: require("@/assets/images/persona-speedDemon.png"),
  pitBoss: require("@/assets/images/persona-pitBoss.png"),
  driftQueen: require("@/assets/images/persona-driftQueen.png"),
  throttle: require("@/assets/images/persona-throttle.png"),
  revTech: require("@/assets/images/persona-revTech.png"),
  elCapitan: require("@/assets/images/persona-elCapitan.png"),
  sirGodfrey: require("@/assets/images/persona-sirGodfrey.png"),
  mamaFutbol: require("@/assets/images/persona-mamaFutbol.png"),
  phantomZZ: require("@/assets/images/persona-phantomZZ.png"),
  theUltra: require("@/assets/images/persona-theUltra.png"),
  dickyV: require("@/assets/images/persona-dickyV.png"),
  skipbayless: require("@/assets/images/persona-skipbayless.png"),
};

interface PersonaInfo {
  id: string;
  name: string;
  fullName: string;
  color: string;
  image: ImageSourcePropType;
}

const PERSONAS: PersonaInfo[] = [
  { id: "barkley", name: "Chuck", fullName: "Charles Barkley", color: "#FF6F00", image: PERSONA_IMAGES.barkley },
  { id: "shannon", name: "Shannon", fullName: "Shannon Sharpe", color: "#1E88E5", image: PERSONA_IMAGES.shannon },
  { id: "loudmouth", name: "Loudmouth", fullName: "Loudmouth", color: "#E53935", image: PERSONA_IMAGES.loudmouth },
  { id: "jordan", name: "MJ", fullName: "Michael Jordan", color: "#CE1141", image: PERSONA_IMAGES.jordan },
  { id: "trump", name: "Dynamic", fullName: "Donald J. Trump", color: "#ff4d4d", image: PERSONA_IMAGES.trump },
  { id: "snoop", name: "Snoop", fullName: "Snoop Dogg", color: "#4CAF50", image: PERSONA_IMAGES.snoop },
  { id: "rogan", name: "Rogan", fullName: "Joe Rogan", color: "#B71C1C", image: PERSONA_IMAGES.rogan },
  { id: "maxkellerman", name: "Max", fullName: "Max Kellerman", color: "#5C6BC0", image: PERSONA_IMAGES.maxkellerman },
  { id: "bernie", name: "Bernie Mac", fullName: "Bernie Mac", color: "#9B59B6", image: PERSONA_IMAGES.bernie },
  { id: "grandma", name: "Grandma", fullName: "Your Grandma", color: "#ffffff", image: PERSONA_IMAGES.grandma },
  { id: "ruckus", name: "Ruckus", fullName: "Uncle Ruckus", color: "#8B4513", image: PERSONA_IMAGES.ruckus },
  { id: "dickyV", name: "Dicky V", fullName: "Dicky V", color: "#FF6F00", image: PERSONA_IMAGES.dickyV },
  { id: "skipbayless", name: "Skip", fullName: "Skip Bayless", color: "#0077C0", image: PERSONA_IMAGES.skipbayless },
];

const RACING_PERSONAS: PersonaInfo[] = [
  { id: "speedDemon", name: "Speed Demon", fullName: "Speed Demon", color: "#FF3D00", image: PERSONA_IMAGES.speedDemon },
  { id: "pitBoss", name: "Pit Boss", fullName: "Pit Boss", color: "#78909C", image: PERSONA_IMAGES.pitBoss },
  { id: "driftQueen", name: "Drift Queen", fullName: "Drift Queen", color: "#E040FB", image: PERSONA_IMAGES.driftQueen },
  { id: "trump", name: "Dynamic", fullName: "Donald J. Trump", color: "#ff4d4d", image: PERSONA_IMAGES.trump },
  { id: "throttle", name: "Throttle", fullName: "Throttle", color: "#FF6F00", image: PERSONA_IMAGES.throttle },
  { id: "revTech", name: "Rev", fullName: "Rev Tech", color: "#00BCD4", image: PERSONA_IMAGES.revTech },
  { id: "rogan", name: "Rogan", fullName: "Joe Rogan", color: "#B71C1C", image: PERSONA_IMAGES.rogan },
];

const SOCCER_PERSONAS: PersonaInfo[] = [
  { id: "elCapitan", name: "El Capitán", fullName: "El Capitán", color: "#F44336", image: PERSONA_IMAGES.elCapitan },
  { id: "sirGodfrey", name: "Sir Godfrey", fullName: "Sir Godfrey", color: "#5D4037", image: PERSONA_IMAGES.sirGodfrey },
  { id: "mamaFutbol", name: "Mama Fútbol", fullName: "Mama Fútbol", color: "#E91E63", image: PERSONA_IMAGES.mamaFutbol },
  { id: "trump", name: "Dynamic", fullName: "Donald J. Trump", color: "#ff4d4d", image: PERSONA_IMAGES.trump },
  { id: "phantomZZ", name: "Phantom ZZ", fullName: "Phantom ZZ", color: "#7E57C2", image: PERSONA_IMAGES.phantomZZ },
  { id: "theUltra", name: "The Ultra", fullName: "The Ultra", color: "#FF9800", image: PERSONA_IMAGES.theUltra },
];

const LEAGUE_COLORS: Record<string, string> = {
  NFL: "#ff4d4d",
  NBA: "#FF6B00",
  UFC: "#D4A420",
  MLB: "#2E7D32",
  SOCCER: "#1976D2",
  BOXING: "#9C27B0",
  NHL: "#00529B",
  F1: "#E10600",
  NASCAR: "#FFCC00",
  INDYCAR: "#0057B8",
  GOLF: "#006747",
  PGA: "#006747",
  LIV: "#E91E63",
  TENNIS: "#C1E72B",
  NCAAB: "#FF8C00",
  NCAAF: "#8B0000",
};

const RACING_LEAGUES = ["F1", "NASCAR", "INDYCAR"];
const SOCCER_LEAGUES = ["SOCCER"];

const ALL_LEAGUES = ["ALL", "NBA", "NFL", "MLB", "NCAAB", "NCAAF", "UFC", "BOXING", "NHL", "RACING", "SOCCER", "GOLF", "TENNIS"];

const TAG = "trumpbot-20";
const amzUrl = (keywords: string) =>
  `https://www.amazon.com/s?k=${encodeURIComponent(keywords)}&tag=${TAG}`;

const AMAZON_PICKS: Record<string, { quote: string; mainUrl: string; items: { label: string; sub: string; icon: string; url: string }[] }> = {
  jordan: {
    quote: '"You want to be a champion? Look the part. And I took that personally." — MJ',
    mainUrl: amzUrl("Air Jordan shoes apparel"),
    items: [
      { label: "Air Jordans", sub: "Iconic kicks", icon: "shoe-sneaker", url: amzUrl("Air Jordan retro shoes") },
      { label: "Jordan Apparel", sub: "Fly like Mike", icon: "tshirt-crew", url: amzUrl("Jordan brand apparel men") },
      { label: "Jordan Accessories", sub: "Game day gear", icon: "bag-suitcase", url: amzUrl("Jordan brand accessories bag") },
    ],
  },
  trump: {
    quote: '"Only the best gear for the best fans. TREMENDOUS quality. Believe me!" — Trump',
    mainUrl: amzUrl("MAGA sports gear hat"),
    items: [
      { label: "MAGA Hats", sub: "The classic", icon: "hat-fedora", url: amzUrl("MAGA hat red") },
      { label: "Golf Gear", sub: "Play like Trump", icon: "golf", url: amzUrl("golf accessories men premium") },
      { label: "Gold Merch", sub: "Stay golden", icon: "gold", url: amzUrl("gold sports accessories men") },
    ],
  },
  grandma: {
    quote: '"Oh sweetie, get yourself a nice warm blanket for the game. And eat something!" — Grandma',
    mainUrl: amzUrl("cozy game day blanket snacks"),
    items: [
      { label: "Cozy Blankets", sub: "Stay warm, honey", icon: "bed", url: amzUrl("stadium blanket warm sports") },
      { label: "Snack Trays", sub: "Game day bites", icon: "food", url: amzUrl("game day snack tray serving") },
      { label: "Team Mugs", sub: "Hot cocoa time", icon: "coffee", url: amzUrl("sports team coffee mug NFL NBA") },
    ],
  },
  shannon: {
    quote: '"UNDISPUTED! GOAT James got me looking FRESH while I call it like I see it!" — Shannon Sharpe',
    mainUrl: amzUrl("designer men suit luxury"),
    items: [
      { label: "Designer Suits", sub: "Uncle Shay style", icon: "tie", url: amzUrl("designer men slim fit suit luxury") },
      { label: "Hennessy Glass", sub: "Celebration time", icon: "glass-cocktail", url: amzUrl("crystal whiskey glasses luxury set") },
      { label: "Cigars & More", sub: "Victory smoke", icon: "smoking", url: amzUrl("premium cigar accessories humidor") },
    ],
  },
  maxkellerman: {
    quote: '"Here\'s the thing — you need gear that matches your analytical edge." — Max Kellerman',
    mainUrl: amzUrl("boxing analyst sports gear"),
    items: [
      { label: "Boxing Gloves", sub: "Stay sharp", icon: "boxing-glove", url: amzUrl("premium boxing gloves training") },
      { label: "Sports Books", sub: "Study the tape", icon: "book-open-variant", url: amzUrl("sports analysis boxing strategy books") },
      { label: "Dress Shirts", sub: "Debate ready", icon: "tie", url: amzUrl("men slim fit dress shirt professional") },
    ],
  },
  snoop: {
    quote: '"Fo shizzle, nephew — you gotta look smooth while watchin the game, ya dig?" — Snoop Dogg',
    mainUrl: amzUrl("hip hop streetwear men"),
    items: [
      { label: "Steelers Gear", sub: "Black & gold", icon: "football", url: amzUrl("Pittsburgh Steelers jersey apparel") },
      { label: "Gold Chains", sub: "Drip game", icon: "necklace", url: amzUrl("gold chain necklace hip hop men") },
      { label: "Laid Back Fits", sub: "West Coast vibes", icon: "tshirt-crew", url: amzUrl("streetwear men casual hip hop") },
    ],
  },
  barkley: {
    quote: '"That\'s just TURRIBLE gear! Lemme show you what a REAL analyst wears!" — Charles Barkley',
    mainUrl: amzUrl("NBA analyst gear big tall"),
    items: [
      { label: "Golf Gear", sub: "Big man swings", icon: "golf", url: amzUrl("big tall men golf apparel") },
      { label: "NBA Classics", sub: "Throwback jams", icon: "basketball", url: amzUrl("NBA throwback jersey classic") },
      { label: "Snack Pack", sub: "Churros time", icon: "food", url: amzUrl("gourmet snack gift box sports") },
    ],
  },
  rogan: {
    quote: '"That\'s INSANE! Jamie, pull up this gear — it\'s entirely possible this is the best stuff ever." — Joe Rogan',
    mainUrl: amzUrl("MMA UFC gear fitness"),
    items: [
      { label: "UFC Gear", sub: "Combat ready", icon: "karate", url: amzUrl("UFC MMA fight gear shorts gloves") },
      { label: "Kettlebells", sub: "Train like a beast", icon: "dumbbell", url: amzUrl("kettlebell set home gym gorilla") },
      { label: "Elk Jerky", sub: "Fuel up", icon: "food-steak", url: amzUrl("elk jerky premium organic protein") },
    ],
  },
  loudmouth: {
    quote: '"BLASPHEMOUS! Them boys sittin up there in basic fits — you CANNOT tell me this Armani isn\'t FIRST TEAM ALL-DRIP!" — Loudmouth',
    mainUrl: amzUrl("Armani Exchange men suit"),
    items: [
      { label: "Armani Suits", sub: "First Team All-Drip", icon: "tie", url: amzUrl("Armani Exchange men slim fit suit blazer") },
      { label: "Tom Ford Shoes", sub: "Championship kicks", icon: "shoe-formal", url: amzUrl("Tom Ford men dress shoes leather") },
      { label: "Loud Ties", sub: "Stand out on set", icon: "tie", url: amzUrl("bold designer men tie silk statement") },
    ],
  },
  bernie: {
    quote: '"I ain\'t scared of no price tag! Get yourself somethin\' fly, America!" — Bernie Mac',
    mainUrl: amzUrl("funny sports shirts comedy"),
    items: [
      { label: "Funny Tees", sub: "Comedy vibes", icon: "tshirt-crew", url: amzUrl("funny sports t shirts men comedy") },
      { label: "Chi-Town Gear", sub: "South Side rep", icon: "city", url: amzUrl("Chicago sports apparel Bulls Bears") },
      { label: "Party Gear", sub: "Game day lit", icon: "party-popper", url: amzUrl("game day party supplies sports") },
    ],
  },
  ruckus: {
    quote: '"Don\'t waste your dadgum money! But if you must... get somethin\' practical." — Ruckus',
    mainUrl: amzUrl("no nonsense sports gear men"),
    items: [
      { label: "Work Boots", sub: "Real man gear", icon: "shoe-formal", url: amzUrl("men work boots comfortable sports") },
      { label: "Camo Gear", sub: "Stay hidden", icon: "pine-tree", url: amzUrl("camo sports gear hunting outdoor") },
      { label: "BBQ Set", sub: "Tailgate right", icon: "grill", url: amzUrl("BBQ grill set tailgate sports") },
    ],
  },
  speedDemon: {
    quote: '"PEDAL TO THE METAL! Only the FASTEST gear for the fastest fans!" — Speed Demon',
    mainUrl: amzUrl("racing gear helmet gloves"),
    items: [
      { label: "Racing Helmets", sub: "Safety first, speed always", icon: "racing-helmet", url: amzUrl("racing helmet motorsport karting") },
      { label: "Racing Gloves", sub: "Grip the wheel", icon: "hand-back-left", url: amzUrl("racing gloves karting driving") },
      { label: "Sim Racing", sub: "Race at home", icon: "steering", url: amzUrl("sim racing wheel pedals setup") },
    ],
  },
  pitBoss: {
    quote: '"Son, in 40 years I\'ve learned — the right tools win races." — Pit Boss',
    mainUrl: amzUrl("mechanic tools automotive"),
    items: [
      { label: "Tool Sets", sub: "Pit ready", icon: "wrench", url: amzUrl("mechanic tool set automotive professional") },
      { label: "Pit Crew Gear", sub: "Team uniform", icon: "tshirt-crew", url: amzUrl("racing pit crew shirt NASCAR F1") },
      { label: "Stopwatches", sub: "Every second counts", icon: "timer", url: amzUrl("professional stopwatch racing timing") },
    ],
  },
  driftQueen: {
    quote: '"Looking fast IS going fast. Style is non-negotiable." — Drift Queen',
    mainUrl: amzUrl("racing fashion streetwear JDM"),
    items: [
      { label: "JDM Merch", sub: "Import life", icon: "car-sports", url: amzUrl("JDM sticker decal Japanese car culture") },
      { label: "Racing Jackets", sub: "Track style", icon: "jacket", url: amzUrl("racing bomber jacket motorsport") },
      { label: "LED Underglow", sub: "Light it up", icon: "led-strip-variant", url: amzUrl("LED underglow car neon lights") },
    ],
  },
  throttle: {
    quote: '"8,000 HORSEPOWER! Nothing else even comes close!" — Throttle',
    mainUrl: amzUrl("drag racing NHRA muscle car"),
    items: [
      { label: "Muscle Car Parts", sub: "More power", icon: "engine", url: amzUrl("performance car parts muscle car engine") },
      { label: "NHRA Gear", sub: "Drag strip legend", icon: "flag-checkered", url: amzUrl("NHRA drag racing shirt hat gear") },
      { label: "Nitro Tees", sub: "Smell the fuel", icon: "tshirt-crew", url: amzUrl("drag racing t shirt funny nitro") },
    ],
  },
  revTech: {
    quote: '"The data clearly shows — this gear performs at optimal levels." — Rev',
    mainUrl: amzUrl("F1 merchandise Formula 1"),
    items: [
      { label: "F1 Merch", sub: "Official gear", icon: "flag-checkered", url: amzUrl("Formula 1 F1 team merchandise official") },
      { label: "Racing Models", sub: "Desk trophy", icon: "car-sports", url: amzUrl("F1 model car diecast scale racing") },
      { label: "Tech Books", sub: "Engineering reads", icon: "book-open-variant", url: amzUrl("Formula 1 engineering design book racing") },
    ],
  },
  elCapitan: {
    quote: '"GOOOOOOOL! You need the scarf, the jersey, the PASSION!" — El Capitán',
    mainUrl: amzUrl("soccer jersey football scarf"),
    items: [
      { label: "Team Jerseys", sub: "Wear your colors", icon: "tshirt-crew", url: amzUrl("soccer jersey football club official replica") },
      { label: "Scarves", sub: "Wave it proud", icon: "scarf", url: amzUrl("football scarf soccer supporter ultras") },
      { label: "Soccer Balls", sub: "Touch of gold", icon: "soccer", url: amzUrl("official match soccer ball FIFA quality") },
    ],
  },
  sirGodfrey: {
    quote: '"One must look dignified, even whilst watching football." — Sir Godfrey',
    mainUrl: amzUrl("english football memorabilia classic"),
    items: [
      { label: "Retro Kits", sub: "Classic style", icon: "tshirt-crew", url: amzUrl("retro football shirt classic vintage") },
      { label: "Football Books", sub: "Proper reading", icon: "book-open-variant", url: amzUrl("english football history book premier league") },
      { label: "Tea Sets", sub: "For matchday", icon: "coffee", url: amzUrl("english tea set bone china cup saucer") },
    ],
  },
  mamaFutbol: {
    quote: '"MY BOYS need proper gear! And snacks! Always snacks!" — Mama Fútbol',
    mainUrl: amzUrl("soccer mom fan gear snacks"),
    items: [
      { label: "Fan Flags", sub: "Cheer them on", icon: "flag", url: amzUrl("soccer fan flag country team supporter") },
      { label: "Vuvuzelas", sub: "Make some noise", icon: "bugle", url: amzUrl("vuvuzela horn soccer fan noisemaker") },
      { label: "Snack Packs", sub: "Fuel the fans", icon: "food", url: amzUrl("game day snack box soccer football party") },
    ],
  },
  phantomZZ: {
    quote: '"The ball speaks... and it says you need these." — Phantom ZZ',
    mainUrl: amzUrl("football art philosophy soccer"),
    items: [
      { label: "Soccer Art", sub: "The beautiful game", icon: "palette", url: amzUrl("soccer football art print poster wall") },
      { label: "Tactics Boards", sub: "See the patterns", icon: "strategy", url: amzUrl("football tactics board coach strategy") },
      { label: "Zidane Book", sub: "Study the master", icon: "book-open-variant", url: amzUrl("Zidane biography football book") },
    ],
  },
  theUltra: {
    quote: '"WHO\'S THE GREATEST?! WE ARE! Rep the crew!" — The Ultra',
    mainUrl: amzUrl("ultras football supporter gear"),
    items: [
      { label: "Ultras Gear", sub: "Stand culture", icon: "account-group", url: amzUrl("ultras football casual hoodie supporter") },
      { label: "Drum & Flares", sub: "Atmosphere", icon: "drum", url: amzUrl("sports fan drum percussion cheering") },
      { label: "Bandanas", sub: "Rep your crew", icon: "bandage", url: amzUrl("sports bandana face cover football fan") },
    ],
  },
  dickyV: {
    quote: '"IT\'S AWESOME BABY!! Get yourself some DIPSY-DOO DUNKAROO gear, are you SERIOUS?!" — Dicky V',
    mainUrl: amzUrl("college basketball NCAA gear"),
    items: [
      { label: "NCAA Jerseys", sub: "AWESOME BABY!", icon: "basketball", url: amzUrl("college basketball jersey NCAA men") },
      { label: "March Madness", sub: "Tournament time", icon: "trophy", url: amzUrl("March Madness NCAA tournament gear hat") },
      { label: "Hoops Books", sub: "Study the game", icon: "book-open-variant", url: amzUrl("college basketball coaching strategy book") },
    ],
  },
};

const WORLD_CUP_DATE = new Date("2026-06-11T00:00:00-04:00").getTime();

function getCountdown() {
  const now = Date.now();
  const diff = Math.max(0, WORLD_CUP_DATE - now);
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
  return { days, hours, minutes, seconds };
}

function PersonaSelectorItem({
  persona,
  selected,
  onPress,
}: {
  persona: PersonaInfo;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.personaItem, selected && { borderColor: persona.color }]}>
      <Image
        source={persona.image}
        style={[styles.personaThumb, { borderColor: selected ? persona.color : "transparent" }]}
      />
      <Text style={[styles.personaLabel, selected && { color: persona.color }]} numberOfLines={1}>
        {persona.name}
      </Text>
    </Pressable>
  );
}

function useGameCountdown(startTime?: string) {
  const [timeLeft, setTimeLeft] = useState(() => {
    if (!startTime) return null;
    const diff = new Date(startTime).getTime() - Date.now();
    return diff > 0 ? diff : null;
  });

  useEffect(() => {
    if (!startTime) return;
    const update = () => {
      const diff = new Date(startTime).getTime() - Date.now();
      setTimeLeft(diff > 0 ? diff : null);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  if (timeLeft === null) return null;

  const hours = Math.floor(timeLeft / (1000 * 60 * 60));
  const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  }
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function PreGamePickBanner({
  game,
  persona,
  onPickTeam,
  userPick,
  pendingPick,
}: {
  game: Game;
  persona: PersonaInfo;
  onPickTeam: (game: Game, team: string) => void;
  userPick?: string;
  pendingPick?: UserPick;
}) {
  const countdown = useGameCountdown(game.startTime);
  const teams = game.game.split(" vs ").map((t) => t.trim());
  if (teams.length !== 2) return null;

  return (
    <Animated.View entering={FadeInDown.duration(350)} style={preGameStyles.container}>
      {!userPick ? (
        <>
          <View style={preGameStyles.headerRow}>
            <MaterialCommunityIcons name="flag-checkered" size={16} color="#FFD700" />
            <Text style={preGameStyles.headerText}>MAKE YOUR PICK</Text>
          </View>
          {countdown && (
            <View style={preGameStyles.countdownRow}>
              <Ionicons name="time-outline" size={12} color="rgba(255,255,255,0.5)" />
              <Text style={preGameStyles.countdownText}>Starts in {countdown}</Text>
            </View>
          )}
          <View style={preGameStyles.pickButtonsRow}>
            {teams.map((team) => (
              <Pressable
                key={team}
                onPress={() => onPickTeam(game, team)}
                style={({ pressed }) => [
                  preGameStyles.pickButton,
                  { borderColor: persona.color },
                  pressed && { opacity: 0.7, backgroundColor: `${persona.color}30` },
                ]}
              >
                <Text style={[preGameStyles.pickButtonText, { color: persona.color }]}>{team}</Text>
                <Ionicons name="arrow-forward" size={12} color={persona.color} />
              </Pressable>
            ))}
          </View>
        </>
      ) : (
        <>
          <View style={preGameStyles.headerRow}>
            <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
            <Text style={[preGameStyles.headerText, { color: "#4CAF50" }]}>PICK LOCKED IN</Text>
          </View>
          {countdown && (
            <View style={preGameStyles.countdownRow}>
              <Ionicons name="time-outline" size={12} color="rgba(255,255,255,0.5)" />
              <Text style={preGameStyles.countdownText}>Starts in {countdown}</Text>
            </View>
          )}
          <View style={preGameStyles.pendingRow}>
            <View style={[preGameStyles.pendingBadge, { backgroundColor: `${persona.color}20`, borderColor: persona.color }]}>
              <Text style={[preGameStyles.pendingTeamText, { color: persona.color }]}>{userPick}</Text>
              <Ionicons name="checkmark" size={14} color={persona.color} />
            </View>
            <View style={preGameStyles.pendingStatusBadge}>
              <View style={preGameStyles.pendingDot} />
              <Text style={preGameStyles.pendingStatusText}>PENDING</Text>
            </View>
          </View>
          <View style={preGameStyles.changeRow}>
            {teams.filter((t) => t !== userPick).map((team) => (
              <Pressable
                key={team}
                onPress={() => onPickTeam(game, team)}
                style={({ pressed }) => [preGameStyles.changeBtn, pressed && { opacity: 0.6 }]}
              >
                <Ionicons name="swap-horizontal" size={12} color="rgba(255,255,255,0.4)" />
                <Text style={preGameStyles.changeBtnText}>Switch to {team}</Text>
              </Pressable>
            ))}
          </View>
        </>
      )}
    </Animated.View>
  );
}

const preGameStyles = StyleSheet.create({
  container: {
    backgroundColor: "rgba(255,215,0,0.05)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,215,0,0.15)",
    padding: 12,
    marginTop: 10,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  headerText: {
    fontSize: 12,
    fontWeight: "900" as const,
    color: "#FFD700",
    letterSpacing: 1.5,
  },
  countdownRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 10,
    backgroundColor: "rgba(255,255,255,0.04)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: "flex-start",
  },
  countdownText: {
    fontSize: 11,
    fontWeight: "700" as const,
    color: "rgba(255,255,255,0.6)",
    fontVariant: ["tabular-nums"],
  },
  pickButtonsRow: {
    flexDirection: "row",
    gap: 8,
  },
  pickButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  pickButtonText: {
    fontSize: 13,
    fontWeight: "800" as const,
    letterSpacing: 0.5,
  },
  pendingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  pendingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  pendingTeamText: {
    fontSize: 14,
    fontWeight: "800" as const,
  },
  pendingStatusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,165,0,0.15)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  pendingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#FFA500",
  },
  pendingStatusText: {
    fontSize: 9,
    fontWeight: "800" as const,
    color: "#FFA500",
    letterSpacing: 1,
  },
  changeRow: {
    flexDirection: "row",
    justifyContent: "center",
  },
  changeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  changeBtnText: {
    fontSize: 10,
    fontWeight: "600" as const,
    color: "rgba(255,255,255,0.35)",
  },
});

function TeamLeaderCard({ leader, index }: { leader: PlayerLeader; index: number }) {
  return (
    <View style={styles.leaderRow}>
      <View style={styles.leaderRank}>
        <Text style={styles.leaderRankText}>{index + 1}</Text>
      </View>
      {leader.headshot ? (
        <Image source={{ uri: leader.headshot }} style={styles.leaderHeadshot} />
      ) : (
        <View style={[styles.leaderHeadshot, styles.leaderHeadshotPlaceholder]}>
          <Ionicons name="person" size={18} color="rgba(255,255,255,0.3)" />
        </View>
      )}
      <View style={styles.leaderInfo}>
        <Text style={styles.leaderPlayer}>{leader.player}</Text>
        <Text style={styles.leaderCategory}>{leader.category}</Text>
      </View>
      <View style={styles.leaderValueBox}>
        <Text style={styles.leaderValue}>{leader.value}</Text>
      </View>
    </View>
  );
}

function GameStatsPanel({ game }: { game: Game }) {
  const hasLeaders = (game.homeLeaders && game.homeLeaders.length > 0) || (game.awayLeaders && game.awayLeaders.length > 0);
  const hasStats = (game.homeStats && game.homeStats.length > 0) || (game.awayStats && game.awayStats.length > 0);
  if (!hasLeaders && !hasStats) return null;

  return (
    <Animated.View entering={FadeInDown.duration(300)} style={styles.statsContainer}>
      <View style={styles.statsHeaderRow}>
        <Ionicons name="stats-chart" size={14} color={Colors.gold} />
        <Text style={styles.statsHeaderText}>PLAYER & TEAM STATS</Text>
      </View>

      {game.awayLeaders && game.awayLeaders.length > 0 && (
        <View style={styles.teamStatsBlock}>
          <View style={styles.teamStatsHeader}>
            <View style={styles.teamDot} />
            <Text style={styles.teamStatsTitle}>{game.awayTeam || "Away"}</Text>
            <Text style={styles.teamStatsSubtitle}>LEADERS</Text>
          </View>
          {game.awayLeaders.map((leader, i) => (
            <TeamLeaderCard key={`away-${i}`} leader={leader} index={i} />
          ))}
          {game.awayStats && game.awayStats.length > 0 && (
            <View style={styles.teamStatSection}>
              <Text style={styles.teamStatSectionLabel}>TEAM STATS</Text>
              <View style={styles.teamStatRow}>
                {game.awayStats.map((s, i) => (
                  <View key={`as-${i}`} style={styles.statPill}>
                    <Text style={styles.statPillLabel}>{s.name}</Text>
                    <Text style={styles.statPillValue}>{s.value}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
      )}
      {game.homeLeaders && game.homeLeaders.length > 0 && (
        <View style={styles.teamStatsBlock}>
          <View style={styles.teamStatsHeader}>
            <View style={styles.teamDot} />
            <Text style={styles.teamStatsTitle}>{game.homeTeam || "Home"}</Text>
            <Text style={styles.teamStatsSubtitle}>LEADERS</Text>
          </View>
          {game.homeLeaders.map((leader, i) => (
            <TeamLeaderCard key={`home-${i}`} leader={leader} index={i} />
          ))}
          {game.homeStats && game.homeStats.length > 0 && (
            <View style={styles.teamStatSection}>
              <Text style={styles.teamStatSectionLabel}>TEAM STATS</Text>
              <View style={styles.teamStatRow}>
                {game.homeStats.map((s, i) => (
                  <View key={`hs-${i}`} style={styles.statPill}>
                    <Text style={styles.statPillLabel}>{s.name}</Text>
                    <Text style={styles.statPillValue}>{s.value}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
      )}
    </Animated.View>
  );
}

function GolfCard({
  game,
  persona,
  pick,
  pickLoading,
  onSpeak,
  speakingGameId,
  onRefresh,
  onPickTeam,
  userPick,
  pendingUserPick,
  allPersonaPicks,
  allPersonas,
}: {
  game: Game;
  persona: PersonaInfo;
  pick: PersonaPick | null;
  pickLoading: boolean;
  onSpeak: (text: string, personaId: string, gameId: number) => void;
  speakingGameId: number | null;
  onRefresh: (gameId: number) => void;
  onPickTeam?: (game: Game, team: string) => void;
  userPick?: string;
  pendingUserPick?: UserPick;
  allPersonaPicks?: Record<string, PersonaPick>;
  allPersonas?: PersonaInfo[];
}) {
  const leagueColor = game.league === "LIV" ? "#E91E63" : "#4CAF50";
  const isSpeaking = speakingGameId === game.id;
  const isLive = game.status === "in";
  const isPreGame = game.status === "pre" || (!game.status && !game.score && !game.final);
  const leaderboard = game.leaderboard || [];
  const [showFullBoard, setShowFullBoard] = useState(false);
  const displayBoard = showFullBoard ? leaderboard.slice(0, 20) : leaderboard.slice(0, 5);

  return (
    <Animated.View entering={FadeInUp.duration(400).springify()} style={styles.gameCard}>
      <View style={styles.gameHeader}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <View style={[styles.leagueBadge, { backgroundColor: leagueColor }]}>
            <Ionicons name="golf-outline" size={10} color="#FFF" style={{ marginRight: 3 }} />
            <Text style={styles.leagueText}>{game.league}</Text>
          </View>
          {isLive && (
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          )}
          {isPreGame && (
            <View style={styles.upcomingBadge}>
              <Ionicons name="time-outline" size={10} color="#FFA500" />
              <Text style={styles.upcomingText}>UPCOMING</Text>
            </View>
          )}
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Pressable onPress={() => onRefresh(game.id)} style={({ pressed }) => [pressed && { opacity: 0.5 }]}>
            <Ionicons name="refresh" size={14} color="rgba(255,255,255,0.4)" />
          </Pressable>
        </View>
      </View>

      <View style={{ marginVertical: 6 }}>
        <Text style={[styles.gameTitle, { fontSize: 15, marginBottom: 2 }]}>{game.tournamentName || game.game}</Text>
        {game.venue ? <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, fontFamily: "Inter_400Regular" }}>{game.venue}{game.course ? ` — ${game.course}` : ""}</Text> : null}
        <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, fontFamily: "Inter_400Regular", marginTop: 2 }}>{game.time}</Text>
      </View>

      {game.winner ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8, backgroundColor: "rgba(76,175,80,0.15)", padding: 8, borderRadius: 8 }}>
          <Ionicons name="trophy" size={16} color="#FFD700" />
          <Text style={{ color: "#FFD700", fontFamily: "Inter_700Bold", fontSize: 14 }}>WINNER: {game.winner}</Text>
        </View>
      ) : null}

      {leaderboard.length > 0 && (
        <View style={{ marginBottom: 8 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
            <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 1 }}>LEADERBOARD</Text>
            <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, fontFamily: "Inter_400Regular" }}>{leaderboard.length} PLAYERS</Text>
          </View>
          {displayBoard.map((player, idx) => {
            const pickDisabled = !isPreGame;
            return (
            <Pressable
              key={`${player.name}-${idx}`}
              onPress={() => { if (!pickDisabled) onPickTeam?.(game, player.name); }}
              disabled={pickDisabled}
              style={({ pressed }) => [
                {
                  flexDirection: "row",
                  alignItems: "center",
                  paddingVertical: 6,
                  paddingHorizontal: 8,
                  borderRadius: 6,
                  marginBottom: 2,
                  backgroundColor: userPick === player.name ? `${persona.color}20` : idx === 0 ? "rgba(255,215,0,0.08)" : "transparent",
                  borderWidth: userPick === player.name ? 1 : 0,
                  borderColor: userPick === player.name ? persona.color : "transparent",
                  opacity: pickDisabled && userPick !== player.name ? 0.5 : 1,
                },
                pressed && !pickDisabled && { opacity: 0.7 },
              ]}
            >
              <Text style={{ color: idx === 0 ? "#FFD700" : "rgba(255,255,255,0.5)", fontSize: 11, fontFamily: "Inter_600SemiBold", width: 24 }}>
                {player.position || idx + 1}
              </Text>
              <Text style={{ color: "#FFF", fontSize: 13, fontFamily: "Inter_500Medium", flex: 1 }}>{player.name}</Text>
              <Text style={{
                color: player.score.startsWith("-") ? "#4CAF50" : player.score === "E" ? "rgba(255,255,255,0.6)" : "#FF6B6B",
                fontSize: 13,
                fontFamily: "Inter_700Bold",
                minWidth: 35,
                textAlign: "right" as const,
              }}>{player.score}</Text>
              {userPick === player.name && (
                <>
                  <Ionicons name="checkmark-circle" size={14} color={persona.color} style={{ marginLeft: 6 }} />
                  {pickDisabled && <Ionicons name="lock-closed" size={10} color={persona.color} style={{ marginLeft: 3 }} />}
                </>
              )}
            </Pressable>
            );
          })}
          {leaderboard.length > 5 && (
            <Pressable onPress={() => setShowFullBoard(!showFullBoard)} style={({ pressed }) => [{ paddingVertical: 4, alignItems: "center" as const }, pressed && { opacity: 0.7 }]}>
              <Text style={{ color: persona.color, fontSize: 11, fontFamily: "Inter_500Medium" }}>
                {showFullBoard ? "Show Less" : `Show Top 20 ▼`}
              </Text>
            </Pressable>
          )}
        </View>
      )}

      {leaderboard.length === 0 && isPreGame && onPickTeam && (
        <View style={{ marginBottom: 8, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", borderStyle: "dashed" as const }}>
          <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center" as const }}>
            Tournament hasn't started yet — picks coming from {persona.name}!
          </Text>
        </View>
      )}

      {pickLoading ? (
        <View style={styles.pickLoadingBox}>
          <ActivityIndicator size="small" color={persona.color} />
          <Text style={[styles.pickLoadingText, { color: persona.color }]}>
            {persona.name} is scouting the field...
          </Text>
        </View>
      ) : pick ? (
        <>
          <View style={[styles.pickSection, { borderLeftColor: persona.color }]}>
            <View style={styles.pickHeader}>
              <Image source={persona.image} style={[styles.pickAvatar, { borderColor: persona.color }]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.pickName, { color: persona.color }]}>{persona.name}'s Golf Pick</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Ionicons name="golf-outline" size={12} color="#FFF" />
                  <Text style={styles.pickValue}>{pick.pick}</Text>
                </View>
              </View>
              {pick.confidence > 0 && (
                <View style={[styles.confidenceBadge, { backgroundColor: `${persona.color}30` }]}>
                  <Text style={[styles.confidenceText, { color: persona.color }]}>{pick.confidence}%</Text>
                </View>
              )}
            </View>
            <Text style={styles.pickReasoning}>"{pick.reasoning}"</Text>
            <Text style={styles.parodyPickDisclaimer}>PARODY — For entertainment only</Text>
          </View>

          <Pressable
            onPress={() => onSpeak(pick.reasoning, persona.id, game.id)}
            style={({ pressed }) => [styles.listenBtn, { borderColor: persona.color }, pressed && { opacity: 0.7 }]}
          >
            <Ionicons name={isSpeaking ? "stop" : "volume-high"} size={16} color={persona.color} />
            <Text style={[styles.listenBtnText, { color: persona.color }]}>
              {isSpeaking ? "STOP" : "LISTEN"}
            </Text>
          </Pressable>
        </>
      ) : null}

      {allPersonaPicks && allPersonas && Object.keys(allPersonaPicks).length > 1 && (
        <View style={styles.allPicksSection}>
          <Text style={styles.allPicksLabel}>ALL ANALYST PICKS</Text>
          <View style={styles.allPicksGrid}>
            {allPersonas.filter((p) => allPersonaPicks[p.id]).map((p) => {
              const pPick = allPersonaPicks[p.id];
              const isActive = p.id === persona.id;
              return (
                <View key={p.id} style={[styles.allPicksItem, isActive && { borderColor: p.color, borderWidth: 1, backgroundColor: `${p.color}10` }]}>
                  <Image source={p.image} style={[styles.allPicksAvatar, { borderColor: p.color }]} />
                  <Text style={[styles.allPicksName, { color: p.color }]} numberOfLines={1}>{p.name}</Text>
                  <Text style={styles.allPicksPick} numberOfLines={1}>{pPick.pick}</Text>
                  <Text style={[styles.allPicksConf, { color: p.color }]}>{pPick.confidence}%</Text>
                </View>
              );
            })}
          </View>
        </View>
      )}
    </Animated.View>
  );
}

function GameCard({
  game,
  persona,
  pick,
  pickLoading,
  onSpeak,
  speakingGameId,
  onRefresh,
  onPickTeam,
  userPick,
  pendingUserPick,
  allPersonaPicks,
  allPersonas,
}: {
  game: Game;
  persona: PersonaInfo;
  pick: PersonaPick | null;
  pickLoading: boolean;
  onSpeak: (text: string, personaId: string, gameId: number) => void;
  speakingGameId: number | null;
  onRefresh: (gameId: number) => void;
  onPickTeam?: (game: Game, team: string) => void;
  userPick?: string;
  pendingUserPick?: UserPick;
  allPersonaPicks?: Record<string, PersonaPick>;
  allPersonas?: PersonaInfo[];
}) {
  const leagueColor = LEAGUE_COLORS[game.league] || "#D4A420";
  const isSpeaking = speakingGameId === game.id;
  const teams = game.game.split(" vs ").map((t) => t.trim());
  const isLive = game.status === "in";
  const isPreGame = game.status === "pre" || (!game.status && !game.score && !game.final);
  const hasDetails = (game.homeLeaders && game.homeLeaders.length > 0) || (game.awayLeaders && game.awayLeaders.length > 0) || (game.homeStats && game.homeStats.length > 0) || (game.awayStats && game.awayStats.length > 0);

  const [commentary, setCommentary] = useState<string | null>(null);
  const [commentaryLoading, setCommentaryLoading] = useState(false);
  const lastScoreRef = useRef(game.score);

  const commentaryEnabledRef = useRef(false);

  const fetchCommentary = useCallback(async () => {
    setCommentaryLoading(true);
    commentaryEnabledRef.current = true;
    try {
      const resp = await fetch(new URL("/api/sports/commentary", getApiUrl()).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ game, personaId: persona.id }),
      });
      if (!resp.ok) throw new Error(`Commentary request failed: ${resp.status}`);
      const data = await resp.json();
      if (data.commentary) {
        setCommentary(data.commentary);
      }
    } catch (e) {
      console.error("Commentary fetch error:", e);
    } finally {
      setCommentaryLoading(false);
    }
  }, [game.id, game.score, persona.id]);

  useEffect(() => {
    if (isLive && lastScoreRef.current !== game.score && commentaryEnabledRef.current) {
      lastScoreRef.current = game.score;
      fetchCommentary();
    }
  }, [game.score]);

  return (
    <Animated.View entering={FadeInUp.duration(400).springify()} style={styles.gameCard}>
      <View>
        <View style={styles.gameHeader}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View style={[styles.leagueBadge, { backgroundColor: leagueColor }]}>
              <Text style={styles.leagueText}>{game.league}</Text>
            </View>
            {isLive && (
              <View style={styles.liveBadge}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>LIVE</Text>
              </View>
            )}
            {isPreGame && (
              <View style={styles.upcomingBadge}>
                <Ionicons name="time-outline" size={10} color="#FFA500" />
                <Text style={styles.upcomingText}>UPCOMING</Text>
              </View>
            )}
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={styles.gameTime}>{game.time}</Text>
            <Pressable onPress={() => onRefresh(game.id)} style={({ pressed }) => [pressed && { opacity: 0.5 }]}>
              <Ionicons name="refresh" size={14} color="rgba(255,255,255,0.4)" />
            </Pressable>
          </View>
        </View>
        {game.startTime && !isLive && (
          <Text style={{ color: "rgba(255,255,255,0.35)", fontSize: 10, fontWeight: "600" as const, marginTop: 2, letterSpacing: 0.5 }}>
            {new Date(game.startTime).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} {!game.final ? new Date(game.startTime).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : ""}
          </Text>
        )}
        <Text style={styles.gameTitle}>{game.game}</Text>
        {game.score ? (
          <Text style={[styles.gameScore, isLive && { color: "#FF4444" }]}>{game.score}</Text>
        ) : null}
        <Text style={styles.gameOdds}>{game.odds}</Text>
        <Pressable
          onPress={() => {
            const searchQuery = encodeURIComponent(`${game.game} highlights ${new Date().getFullYear()}`);
            Linking.openURL(`https://www.youtube.com/results?search_query=${searchQuery}`);
          }}
          style={({ pressed }) => [{
            flexDirection: "row", alignItems: "center", gap: 5, marginTop: 8,
            paddingVertical: 5, paddingHorizontal: 10, borderRadius: 8,
            backgroundColor: "rgba(255,0,0,0.08)", borderWidth: 1, borderColor: "rgba(255,0,0,0.15)",
            alignSelf: "flex-start",
          }, pressed && { opacity: 0.6 }]}
        >
          <Ionicons name="logo-youtube" size={14} color="#FF0000" />
          <Text style={{ color: "#FF4444", fontSize: 10, fontWeight: "700" as const, letterSpacing: 0.5 }}>HIGHLIGHTS</Text>
        </Pressable>
      </View>

      {hasDetails && <GameStatsPanel game={game} />}

      {isLive && (
        <View style={styles.commentarySection}>
          <Pressable
            onPress={fetchCommentary}
            disabled={commentaryLoading}
            style={({ pressed }) => [
              styles.commentaryBtn,
              { borderColor: persona.color, backgroundColor: `${persona.color}15` },
              pressed && { opacity: 0.7 },
            ]}
          >
            {commentaryLoading ? (
              <ActivityIndicator size="small" color={persona.color} />
            ) : (
              <Ionicons name="mic" size={16} color={persona.color} />
            )}
            <Text style={[styles.commentaryBtnText, { color: persona.color }]}>
              {commentaryLoading ? `${persona.name} is watching...` : commentary ? "REFRESH COMMENTARY" : "LIVE COMMENTARY"}
            </Text>
          </Pressable>

          {commentary && (
            <Animated.View entering={FadeInDown.duration(300)} style={[styles.commentaryBox, { borderLeftColor: persona.color }]}>
              <View style={styles.commentaryHeader}>
                <Image source={persona.image} style={[styles.commentaryAvatar, { borderColor: persona.color }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.commentaryLabel, { color: persona.color }]}>{persona.name}'s Live Take</Text>
                </View>
                <Pressable
                  onPress={() => onSpeak(commentary, persona.id, game.id)}
                  style={({ pressed }) => [styles.commentarySpeakBtn, { borderColor: persona.color }, pressed && { opacity: 0.7 }]}
                >
                  <Ionicons name={isSpeaking ? "stop" : "volume-high"} size={14} color={persona.color} />
                </Pressable>
              </View>
              <Text style={styles.commentaryText}>"{commentary}"</Text>
            </Animated.View>
          )}
        </View>
      )}

      {onPickTeam && teams.length === 2 && isPreGame && (
        <PreGamePickBanner
          game={game}
          persona={persona}
          onPickTeam={onPickTeam}
          userPick={userPick}
          pendingPick={pendingUserPick}
        />
      )}

      {onPickTeam && teams.length === 2 && !isPreGame && (
        <View style={styles.pickTeamRow}>
          <Text style={styles.pickTeamLabel}>
            {userPick ? "YOUR PICK" : "PICKS CLOSED"}:
          </Text>
          {userPick ? (
            <View style={[
              styles.pickTeamBtn,
              { backgroundColor: `${persona.color}30`, borderColor: persona.color, opacity: 0.85 },
            ]}>
              <Ionicons name="lock-closed" size={11} color={persona.color} />
              <Text style={[styles.pickTeamText, { color: persona.color, fontWeight: "800" as const }]}>
                {userPick}
              </Text>
              <Ionicons name="checkmark-circle" size={12} color={persona.color} />
            </View>
          ) : (
            <View style={[styles.pickTeamBtn, { borderColor: "rgba(255,255,255,0.15)", opacity: 0.5 }]}>
              <Ionicons name="lock-closed" size={11} color="rgba(255,255,255,0.4)" />
              <Text style={[styles.pickTeamText, { color: "rgba(255,255,255,0.4)" }]}>
                {isLive ? "Game in progress" : "Game ended"}
              </Text>
            </View>
          )}
        </View>
      )}

      {pickLoading ? (
        <View style={styles.pickLoadingBox}>
          <ActivityIndicator size="small" color={persona.color} />
          <Text style={[styles.pickLoadingText, { color: persona.color }]}>
            {persona.name} is analyzing...
          </Text>
        </View>
      ) : pick ? (
        <>
          <View style={[styles.pickSection, { borderLeftColor: persona.color }]}>
            <View style={styles.pickHeader}>
              <Image source={persona.image} style={[styles.pickAvatar, { borderColor: persona.color }]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.pickName, { color: persona.color }]}>{persona.name}'s Pick</Text>
                <Text style={styles.pickValue}>{pick.pick}</Text>
              </View>
              {pick.confidence > 0 && (
                <View style={[styles.confidenceBadge, { backgroundColor: `${persona.color}30` }]}>
                  <Text style={[styles.confidenceText, { color: persona.color }]}>{pick.confidence}%</Text>
                </View>
              )}
            </View>
            <Text style={styles.pickReasoning}>"{pick.reasoning}"</Text>
            <Text style={styles.parodyPickDisclaimer}>PARODY — For entertainment only</Text>
          </View>

          <Pressable
            onPress={() => onSpeak(pick.reasoning, persona.id, game.id)}
            style={({ pressed }) => [styles.listenBtn, { borderColor: persona.color }, pressed && { opacity: 0.7 }]}
          >
            <Ionicons name={isSpeaking ? "stop" : "volume-high"} size={16} color={persona.color} />
            <Text style={[styles.listenBtnText, { color: persona.color }]}>
              {isSpeaking ? "STOP" : "LISTEN"}
            </Text>
          </Pressable>
        </>
      ) : null}

      {allPersonaPicks && allPersonas && Object.keys(allPersonaPicks).length > 1 && (
        <View style={styles.allPicksSection}>
          <Text style={styles.allPicksLabel}>ALL ANALYST PICKS</Text>
          <View style={styles.allPicksGrid}>
            {allPersonas.filter((p) => allPersonaPicks[p.id]).map((p) => {
              const pPick = allPersonaPicks[p.id];
              const isActive = p.id === persona.id;
              return (
                <View key={p.id} style={[styles.allPicksItem, isActive && { borderColor: p.color, borderWidth: 1, backgroundColor: `${p.color}10` }]}>
                  <Image source={p.image} style={[styles.allPicksAvatar, { borderColor: p.color }]} />
                  <Text style={[styles.allPicksName, { color: p.color }]} numberOfLines={1}>{p.name}</Text>
                  <Text style={styles.allPicksPick} numberOfLines={1}>{pPick.pick}</Text>
                  <Text style={[styles.allPicksConf, { color: p.color }]}>{pPick.confidence}%</Text>
                </View>
              );
            })}
          </View>
        </View>
      )}
    </Animated.View>
  );
}

function QuestionOfTheDay() {
  const [qotd, setQotd] = useState<{ sport: string; question: string; options: string[]; answer: string; explanation: string; difficulty: string } | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(new URL("/api/sports/question-of-day", getApiUrl()).toString());
        if (res.ok) setQotd(await res.json());
      } catch {}
    })();
  }, []);

  if (!qotd) return null;

  const sportIcons: Record<string, string> = { basketball: "basketball", boxing: "fitness", golf: "golf", football: "american-football" };
  const sportColors: Record<string, string> = { basketball: "#FF6B00", boxing: "#FF4D4D", golf: "#2E7D32", football: "#8B4513" };
  const color = sportColors[qotd.sport] || Colors.gold;

  return (
    <Animated.View entering={FadeInDown.delay(200).duration(400)} style={{
      marginHorizontal: 16, marginBottom: 14, padding: 14, borderRadius: 14,
      backgroundColor: `${color}08`, borderWidth: 1, borderColor: `${color}20`,
    }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
        <Ionicons name={(sportIcons[qotd.sport] || "help-circle") as any} size={16} color={color} />
        <Text style={{ color, fontSize: 11, fontWeight: "900" as const, letterSpacing: 1 }}>QUESTION OF THE DAY</Text>
        <View style={{ marginLeft: "auto", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: `${color}15` }}>
          <Text style={{ color, fontSize: 9, fontWeight: "700" as const }}>{qotd.difficulty?.toUpperCase()}</Text>
        </View>
      </View>
      <Text style={{ color: "#fff", fontSize: 14, fontWeight: "700" as const, lineHeight: 20, marginBottom: 10 }}>{qotd.question}</Text>
      {qotd.options.map((opt, i) => {
        const letter = opt.charAt(0).toUpperCase();
        const isCorrect = letter === qotd.answer.charAt(0).toUpperCase();
        const isSelected = selected === letter;
        const showResult = revealed;
        return (
          <Pressable
            key={i}
            onPress={() => {
              if (revealed) return;
              setSelected(letter);
              setRevealed(true);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            style={({ pressed }) => [{
              paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, marginBottom: 6,
              borderWidth: 1,
              borderColor: showResult ? (isCorrect ? "#4CAF50" : isSelected ? "#FF4D4D" : "rgba(255,255,255,0.06)") : "rgba(255,255,255,0.08)",
              backgroundColor: showResult ? (isCorrect ? "rgba(76,175,80,0.1)" : isSelected ? "rgba(255,77,77,0.1)" : "rgba(255,255,255,0.02)") : "rgba(255,255,255,0.03)",
            }, pressed && !revealed && { opacity: 0.7 }]}
          >
            <Text style={{ color: showResult ? (isCorrect ? "#4CAF50" : isSelected ? "#FF4D4D" : "rgba(255,255,255,0.5)") : "rgba(255,255,255,0.8)", fontSize: 12, fontWeight: "600" as const }}>{opt}</Text>
          </Pressable>
        );
      })}
      {revealed && (
        <Animated.View entering={FadeInDown.duration(300)} style={{ marginTop: 6, padding: 10, borderRadius: 8, backgroundColor: "rgba(76,175,80,0.08)" }}>
          <Text style={{ color: "#4CAF50", fontSize: 11, fontWeight: "700" as const }}>{selected === qotd.answer ? "Correct!" : `Answer: ${qotd.answer}`}</Text>
          <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 11, marginTop: 4 }}>{qotd.explanation}</Text>
        </Animated.View>
      )}
    </Animated.View>
  );
}

function PlayerStatsLookup() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<any>(null);
  const [playerStats, setPlayerStats] = useState<any>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statLeague, setStatLeague] = useState("nba");
  const [searchError, setSearchError] = useState("");
  const [statsError, setStatsError] = useState("");

  const searchPlayers = async () => {
    if (!searchQuery.trim()) return;
    setSearchLoading(true);
    setSearchResults([]);
    setSearchError("");
    try {
      const sport = statLeague === "nba" ? "basketball" : statLeague === "nfl" ? "football" : statLeague === "mlb" ? "baseball" : "hockey";
      const res = await fetch(new URL(`/api/sports/player-search?q=${encodeURIComponent(searchQuery)}&sport=${sport}&league=${statLeague}`, getApiUrl()).toString());
      if (res.ok) {
        const data = await res.json();
        const results = data.results || [];
        setSearchResults(results);
        if (results.length === 0) setSearchError("No players found. Try a different name.");
      } else {
        setSearchError("Search failed. Try again.");
      }
    } catch {
      setSearchError("Network error. Check connection.");
    }
    setSearchLoading(false);
  };

  const loadPlayerStats = async (player: any) => {
    setSelectedPlayer(player);
    setStatsLoading(true);
    setPlayerStats(null);
    setSearchResults([]);
    setStatsError("");
    try {
      const sport = statLeague === "nba" ? "basketball" : statLeague === "nfl" ? "football" : statLeague === "mlb" ? "baseball" : "hockey";
      const res = await fetch(new URL(`/api/sports/player-stats?athlete=${player.id}&sport=${sport}&league=${statLeague}`, getApiUrl()).toString());
      if (res.ok) {
        setPlayerStats(await res.json());
      } else {
        setStatsError("Stats unavailable for this player.");
      }
    } catch {
      setStatsError("Failed to load stats. Try again.");
    }
    setStatsLoading(false);
  };

  return (
    <View style={{ marginTop: 20 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <Ionicons name="stats-chart" size={18} color={Colors.gold} />
        <Text style={{ color: "#fff", fontSize: 16, fontWeight: "900" as const, letterSpacing: 1 }}>PLAYER STATS</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginBottom: 10 }}>
        {[
          { key: "nba", label: "NBA" }, { key: "nfl", label: "NFL" },
          { key: "mlb", label: "MLB" }, { key: "nhl", label: "NHL" },
        ].map((l) => (
          <Pressable key={l.key} onPress={() => { setStatLeague(l.key); setSelectedPlayer(null); setPlayerStats(null); setSearchResults([]); }}
            style={[dcStyles.standingsTab, statLeague === l.key && { backgroundColor: "rgba(212,164,32,0.2)", borderColor: Colors.gold }]}>
            <Text style={[dcStyles.standingsTabText, statLeague === l.key && { color: Colors.gold }]}>{l.label}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 10 }}>
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search player name..."
          placeholderTextColor="#555"
          onSubmitEditing={searchPlayers}
          style={{ flex: 1, backgroundColor: "#1a1a2e", color: "#fff", fontSize: 13, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: "rgba(212,164,32,0.2)" }}
        />
        <Pressable onPress={searchPlayers} disabled={searchLoading}
          style={({ pressed }) => [{ backgroundColor: Colors.gold, paddingHorizontal: 14, borderRadius: 10, justifyContent: "center" as const }, pressed && { opacity: 0.7 }]}>
          {searchLoading ? <ActivityIndicator size="small" color="#0a0a0a" /> : <Ionicons name="search" size={16} color="#0a0a0a" />}
        </Pressable>
      </View>
      {searchError ? (
        <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, textAlign: "center" as const, marginBottom: 10, fontStyle: "italic" as const }}>{searchError}</Text>
      ) : null}
      {searchResults.length > 0 && (
        <View style={{ backgroundColor: "rgba(255,255,255,0.03)", borderRadius: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)", marginBottom: 10 }}>
          {searchResults.map((p, i) => (
            <Pressable key={p.id || i} onPress={() => loadPlayerStats(p)}
              style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", gap: 10, padding: 10, borderBottomWidth: i < searchResults.length - 1 ? 1 : 0, borderBottomColor: "rgba(255,255,255,0.04)" }, pressed && { backgroundColor: "rgba(212,164,32,0.05)" }]}>
              {p.headshot ? <Image source={{ uri: p.headshot }} style={{ width: 28, height: 28, borderRadius: 14 }} /> : <Ionicons name="person-circle" size={28} color="#555" />}
              <View style={{ flex: 1 }}>
                <Text style={{ color: "#fff", fontSize: 13, fontWeight: "700" as const }}>{p.name}</Text>
                {p.team ? <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 10 }}>{p.team}</Text> : null}
              </View>
              <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.3)" />
            </Pressable>
          ))}
        </View>
      )}
      {statsLoading && <ActivityIndicator color={Colors.gold} style={{ marginVertical: 16 }} />}
      {statsError ? (
        <Text style={{ color: "#FF4D4D", fontSize: 12, textAlign: "center" as const, marginBottom: 10 }}>{statsError}</Text>
      ) : null}
      {selectedPlayer && playerStats && (
        <Animated.View entering={FadeInDown.duration(300)} style={{ backgroundColor: "rgba(212,164,32,0.05)", borderRadius: 14, borderWidth: 1, borderColor: "rgba(212,164,32,0.12)", padding: 14, marginBottom: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 }}>
            {playerStats.headshot ? <Image source={{ uri: playerStats.headshot }} style={{ width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: Colors.gold }} /> : null}
            <View style={{ flex: 1 }}>
              <Text style={{ color: "#fff", fontSize: 16, fontWeight: "800" as const }}>{playerStats.name || selectedPlayer.name}</Text>
              <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }}>{playerStats.position} {playerStats.team ? `• ${playerStats.team}` : ""}</Text>
            </View>
            <Pressable onPress={() => { setSelectedPlayer(null); setPlayerStats(null); }}>
              <Ionicons name="close-circle" size={22} color="rgba(255,255,255,0.3)" />
            </Pressable>
          </View>
          {playerStats.stats ? Object.entries(playerStats.stats).map(([catName, catData]: [string, any]) => (
            <View key={catName} style={{ marginBottom: 12 }}>
              <Text style={{ color: Colors.gold, fontSize: 11, fontWeight: "800" as const, letterSpacing: 1, marginBottom: 6 }}>{catName.toUpperCase()}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View>
                  <View style={{ flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.08)", paddingBottom: 4, marginBottom: 4 }}>
                    <Text style={{ width: 70, color: "rgba(255,255,255,0.4)", fontSize: 9, fontWeight: "700" as const }}>SEASON</Text>
                    {(catData.labels || []).slice(0, 8).map((label: string, li: number) => (
                      <Text key={li} style={{ width: 50, color: "rgba(255,255,255,0.4)", fontSize: 9, fontWeight: "700" as const, textAlign: "center" as const }}>{label}</Text>
                    ))}
                  </View>
                  {(catData.entries || []).slice(0, 6).map((entry: any, ei: number) => (
                    <View key={ei} style={{ flexDirection: "row", paddingVertical: 3, backgroundColor: ei % 2 === 0 ? "rgba(255,255,255,0.02)" : "transparent" }}>
                      <Text style={{ width: 70, color: "rgba(255,255,255,0.6)", fontSize: 10, fontWeight: "600" as const }} numberOfLines={1}>{entry.season}</Text>
                      {(catData.labels || []).slice(0, 8).map((label: string, li: number) => (
                        <Text key={li} style={{ width: 50, color: entry.season === "Career" ? Colors.gold : "rgba(255,255,255,0.7)", fontSize: 10, fontWeight: entry.season === "Career" ? "700" as const : "500" as const, textAlign: "center" as const }}>{entry[label] || "-"}</Text>
                      ))}
                    </View>
                  ))}
                </View>
              </ScrollView>
            </View>
          )) : <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 12, textAlign: "center" as const }}>No stats available for this player</Text>}
        </Animated.View>
      )}
    </View>
  );
}

const DC_ROYAL_STORAGE = "dc-royal-crowns";
const DC_ROYAL_OVERLAP_STORAGE = "dc-royal-overlap";
type OverlapMode = "none" | "subtle" | "chaotic";
const OVERLAP_MS: Record<OverlapMode, number> = { none: 0, subtle: 1500, chaotic: 2500 };
const SPORT_CATEGORIES = ["NBA", "NFL", "MLB", "NHL", "SOCCER", "UFC"];

interface DCRoyalWinner {
  personaId: string;
  category: string;
  wins: number;
  record: string;
  crowns: number;
}

function DCRoyalTab({
  personas,
  personaImages,
  completedGames,
  tallies,
  deviceId,
  playClick,
  onSpeak,
  refreshBalance,
  voiceSettings,
  onUpdateVoiceSetting,
}: {
  personas: PersonaInfo[];
  personaImages: Record<string, ImageSourcePropType>;
  completedGames: Game[];
  tallies: Record<string, PersonaTally>;
  deviceId: string | null;
  playClick: () => void;
  onSpeak: (text: string, personaId: string, gameId: number) => Promise<Audio.Sound | null> | void;
  refreshBalance: () => void;
  voiceSettings: PersonaVoiceSettings;
  onUpdateVoiceSetting: (personaId: string, update: Partial<PersonaVoiceSetting>) => void;
}) {
  const [voicePopoverPersonaId, setVoicePopoverPersonaId] = useState<string | null>(null);
  const [crawlItems, setCrawlItems] = useState<{ emoji: string; text: string }[]>([]);
  const [standings, setStandings] = useState<any[]>([]);
  const [standingsLeague, setStandingsLeague] = useState("nba");
  const [standingsLoading, setStandingsLoading] = useState(false);
  const [crowns, setCrowns] = useState<Record<string, number>>({});
  const [discussion, setDiscussion] = useState<{ personaId: string; text: string }[]>([]);
  const [discussionLoading, setDiscussionLoading] = useState(false);
  const [winners, setWinners] = useState<DCRoyalWinner[]>([]);
  const crawlRef = useRef<ScrollView>(null);

  const [debateDuration, setDebateDuration] = useState<5 | 10 | 15>(5);
  const [debateOverlap, setDebateOverlapState] = useState<OverlapMode>("subtle");
  const debateOverlapRef = useRef<OverlapMode>("subtle");
  const [debateActive, setDebateActive] = useState(false);
  const [debateExpiresAt, setDebateExpiresAt] = useState(0);
  const [debateSeconds, setDebateSeconds] = useState(0);
  const [debateMessages, setDebateMessages] = useState<{ personaId: string; text: string }[]>([]);
  const [debateLoading, setDebateLoading] = useState(false);
  const [debateStarting, setDebateStarting] = useState(false);
  const [debateEnded, setDebateEnded] = useState(false);
  const debateTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const debateScrollRef = useRef<ScrollView>(null);
  const debateRunningRef = useRef(false);
  const debateMountedRef = useRef(true);

  useEffect(() => {
    debateMountedRef.current = true;
    return () => { debateMountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (debateActive && debateSeconds > 0) {
      debateTimerRef.current = setInterval(() => {
        if (!debateMountedRef.current) return;
        setDebateSeconds(prev => {
          if (prev <= 1) {
            if (debateTimerRef.current) clearInterval(debateTimerRef.current);
            setDebateActive(false);
            setDebateEnded(true);
            debateRunningRef.current = false;
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => { if (debateTimerRef.current) clearInterval(debateTimerRef.current); };
    }
  }, [debateActive]);

  const startDebate = async () => {
    if (!deviceId || winners.length < 2) return;
    setDebateStarting(true);
    playClick();
    try {
      const res = await fetch(new URL("/api/sports/dc-royal/start-debate", getApiUrl()).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-device-id": deviceId },
        body: JSON.stringify({ duration: debateDuration, winners: winners.map(w => ({ ...w, crowns: crowns[w.personaId] || 0 })) }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (err.error === "insufficient_tokens") {
          refreshBalance();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        }
        setDebateStarting(false);
        return;
      }
      const data = await res.json();
      refreshBalance();
      setDebateExpiresAt(data.expiresAt);
      setDebateSeconds(debateDuration * 60);
      setDebateMessages([]);
      setDebateActive(true);
      setDebateEnded(false);
      debateRunningRef.current = true;
      awardCrowns();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      runDebateLoop(data.expiresAt);
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
    setDebateStarting(false);
  };

  const runDebateLoop = async (expiresAt: number) => {
    const history: { personaId: string; text: string; isInterruption?: boolean }[] = [];
    type Msg = { personaId: string; text: string; isInterruption?: boolean };

    const fetchNext = (responderId: string, hist: Msg[], opts?: { isInterruption?: boolean; interruptTarget?: string }): Promise<Msg | null> => {
      return fetch(new URL("/api/sports/dc-royal/respond", getApiUrl()).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-device-id": deviceId || "" },
        body: JSON.stringify({
          responderId,
          winners: winners.map(w => ({ ...w, crowns: crowns[w.personaId] || 0 })),
          conversationHistory: hist.slice(-8),
          expiresAt,
          isInterruption: !!opts?.isInterruption,
          interruptTarget: opts?.interruptTarget,
        }),
      }).then(r => r.ok ? r.json() : null).catch(() => null);
    };

    let turnIndex = 0;
    const getResponder = (idx: number) => winners[idx % winners.length];
    let pending: Promise<Msg | null> = fetchNext(getResponder(turnIndex).personaId, history);

    while (debateMountedRef.current && debateRunningRef.current && Date.now() < expiresAt) {
      const msg = await pending;
      if (!msg || !debateMountedRef.current || !debateRunningRef.current) break;
      history.push(msg);
      setDebateMessages(prev => [...prev, msg]);
      setTimeout(() => debateScrollRef.current?.scrollToEnd({ animated: true }), 200);

      const speakResult = onSpeak(msg.text, msg.personaId, 80000 + turnIndex);

      // Pre-fetch the next regular response in parallel with TTS playback
      turnIndex++;
      const nextResponder = getResponder(turnIndex);
      pending = fetchNext(nextResponder.personaId, [...history]);

      const sound = speakResult && typeof (speakResult as Promise<Audio.Sound | null>).then === "function"
        ? await (speakResult as Promise<Audio.Sound | null>).catch(() => null)
        : null;

      const overlapMs = OVERLAP_MS[debateOverlapRef.current] ?? 1500;
      const fallbackMs = Math.max(2200, msg.text.length * 55);
      let durationMs: number | null = null;
      if (sound) {
        for (let i = 0; i < 4 && durationMs === null; i++) {
          try {
            const status = await sound.getStatusAsync();
            if (status.isLoaded && typeof status.durationMillis === "number" && status.durationMillis > 0) {
              durationMs = status.durationMillis;
              break;
            }
          } catch {}
          await new Promise(r => setTimeout(r, 50));
        }
      }
      const speechMs = durationMs ?? fallbackMs;
      const wait = debateOverlapRef.current === "none"
        ? Math.max(400, speechMs - overlapMs)
        : Math.max(250, speechMs - overlapMs);
      await new Promise(r => setTimeout(r, wait));

      // ~18% chance of interruption — a different persona cuts in with a jab
      if (winners.length > 1 && Math.random() < 0.18 && debateMountedRef.current && debateRunningRef.current && Date.now() < expiresAt) {
        const others = winners.filter(w => w.personaId !== msg.personaId);
        const intruder = others[Math.floor(Math.random() * others.length)];
        if (intruder) {
          const intrMsg = await fetchNext(intruder.personaId, [...history], { isInterruption: true, interruptTarget: msg.personaId }).catch(() => null);
          if (intrMsg?.text && debateMountedRef.current && debateRunningRef.current) {
            const intrWithFlag: Msg = { ...intrMsg, isInterruption: true };
            history.push(intrWithFlag);
            setDebateMessages(prev => [...prev, intrWithFlag]);
            setTimeout(() => debateScrollRef.current?.scrollToEnd({ animated: true }), 150);
            onSpeak(intrMsg.text, intrMsg.personaId, 80000 + turnIndex + 1000);
            // Brief pause after interrupt before main turn continues
            await new Promise(r => setTimeout(r, Math.min(3500, Math.max(1200, intrMsg.text.length * 45))));
          }
        }
      }
    }
  };

  const formatDebateTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  useEffect(() => {
    loadCrowns();
    fetchCrawl();
    fetchStandings("nba");
  }, []);

  useEffect(() => {
    const topPersonas = Object.entries(tallies)
      .filter(([_, t]) => t.wins > 0)
      .sort((a, b) => b[1].wins - a[1].wins);

    const seen = new Set<string>();
    const computed: DCRoyalWinner[] = [];
    for (const [pid, t] of topPersonas) {
      if (seen.has(pid)) continue;
      seen.add(pid);
      computed.push({
        personaId: pid,
        category: "ALL",
        wins: t.wins,
        record: `${t.wins}-${t.losses}`,
        crowns: crowns[pid] || 0,
      });
      if (computed.length >= 5) break;
    }
    setWinners(computed);
  }, [tallies, crowns, personas]);

  const loadCrowns = async () => {
    try {
      const saved = await AsyncStorage.getItem(DC_ROYAL_STORAGE);
      if (saved) setCrowns(JSON.parse(saved));
    } catch {}
  };

  const saveCrowns = async (c: Record<string, number>) => {
    setCrowns(c);
    try { await AsyncStorage.setItem(DC_ROYAL_STORAGE, JSON.stringify(c)); } catch {}
  };

  const setDebateOverlap = (mode: OverlapMode) => {
    debateOverlapRef.current = mode;
    setDebateOverlapState(mode);
    AsyncStorage.setItem(DC_ROYAL_OVERLAP_STORAGE, mode).catch(() => {});
  };

  useEffect(() => {
    AsyncStorage.getItem(DC_ROYAL_OVERLAP_STORAGE).then(saved => {
      if (saved === "none" || saved === "subtle" || saved === "chaotic") {
        debateOverlapRef.current = saved;
        setDebateOverlapState(saved);
      }
    }).catch(() => {});
  }, []);

  const fetchCrawl = async () => {
    try {
      const res = await fetch(new URL("/api/sports/crawl", getApiUrl()).toString());
      if (res.ok) {
        const data = await res.json();
        setCrawlItems(data.headlines || []);
      }
    } catch {}
  };

  const fetchStandings = async (league: string) => {
    setStandingsLoading(true);
    setStandingsLeague(league);
    try {
      const res = await fetch(new URL(`/api/sports/standings?league=${league}`, getApiUrl()).toString());
      if (res.ok) {
        const data = await res.json();
        setStandings(data.standings || []);
      }
    } catch {}
    setStandingsLoading(false);
  };

  const awardCrowns = async () => {
    const updated = { ...crowns };
    const seen = new Set<string>();
    for (const w of winners) {
      if (seen.has(w.personaId)) continue;
      seen.add(w.personaId);
      updated[w.personaId] = (updated[w.personaId] || 0) + 1;
    }
    await saveCrowns(updated);
  };

  const startDiscussion = async () => {
    if (!deviceId || winners.length < 2) return;
    setDiscussionLoading(true);
    playClick();
    try {
      const res = await fetch(new URL("/api/sports/dc-royal/discussion", getApiUrl()).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-device-id": deviceId },
        body: JSON.stringify({
          winners: winners.map(w => ({ ...w, crowns: crowns[w.personaId] || 0 })),
          deviceId,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setDiscussion(data.dialogue || []);
        awardCrowns();
      }
    } catch {}
    setDiscussionLoading(false);
  };

  useEffect(() => {
    if (crawlItems.length === 0) return;
    const interval = setInterval(() => {
      crawlRef.current?.scrollTo({ x: 0, animated: false });
    }, 30000);
    return () => clearInterval(interval);
  }, [crawlItems]);

  const sortedCrowns = Object.entries(crowns)
    .filter(([_, c]) => c > 0)
    .sort((a, b) => b[1] - a[1]);

  return (
    <Animated.View entering={FadeInDown.delay(100).duration(400)} style={{ paddingHorizontal: 16, paddingTop: 8 }}>
      <View style={dcStyles.crawlContainer}>
        <View style={dcStyles.crawlLabel}>
          <Ionicons name="radio" size={12} color="#FF4D4D" />
          <Text style={dcStyles.crawlLabelText}>SPORTS CRAWL</Text>
        </View>
        <ScrollView ref={crawlRef} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 24, paddingHorizontal: 8 }}>
          {crawlItems.length > 0 ? crawlItems.map((item, i) => (
            <View key={i} style={dcStyles.crawlItem}>
              <Text style={dcStyles.crawlEmoji}>{item.emoji}</Text>
              <Text style={dcStyles.crawlText} numberOfLines={1}>{item.text}</Text>
            </View>
          )) : (
            <Text style={dcStyles.crawlText}>Loading sports headlines...</Text>
          )}
        </ScrollView>
      </View>

      <View style={dcStyles.crownHeader}>
        <MaterialCommunityIcons name="crown" size={22} color="#FFD700" />
        <Text style={dcStyles.crownTitle}>DC ROYAL CROWN</Text>
        <MaterialCommunityIcons name="crown" size={22} color="#FFD700" />
      </View>
      <Text style={dcStyles.crownSubtitle}>Yesterday's top analysts earn the coveted DC Royal chip crown</Text>

      {winners.length > 0 ? (
        <View style={dcStyles.winnersGrid}>
          {winners.map((w, i) => {
            const p = personas.find(pp => pp.id === w.personaId);
            if (!p) return null;
            const setting = getVoiceSetting(voiceSettings, w.personaId);
            return (
              <Animated.View key={`${w.personaId}-${w.category}`} entering={FadeInDown.delay(150 + i * 80).duration(400)} style={dcStyles.winnerCard}>
                <View style={[dcStyles.winnerBadge, { backgroundColor: `${p.color}20`, borderColor: p.color }]}>
                  <Text style={[dcStyles.winnerCategory, { color: p.color }]}>{w.category}</Text>
                </View>
                <Pressable
                  testID={`winner-avatar-${w.personaId}`}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setVoicePopoverPersonaId(w.personaId);
                  }}
                  style={({ pressed }) => [{ position: "relative" }, pressed && { opacity: 0.7 }]}
                >
                  <Image source={p.image} style={[dcStyles.winnerAvatar, { borderColor: p.color }]} />
                  {setting.muted && (
                    <View style={dcStyles.mutedBadge}>
                      <Ionicons name="volume-mute" size={11} color="#fff" />
                    </View>
                  )}
                </Pressable>
                <Text style={dcStyles.winnerName}>{p.name}</Text>
                <Text style={[dcStyles.winnerRecord, { color: p.color }]}>{w.record}</Text>
                <View style={dcStyles.crownChipRow}>
                  <MaterialCommunityIcons name="crown" size={14} color="#FFD700" />
                  <Text style={dcStyles.crownCount}>{crowns[w.personaId] || 0}</Text>
                </View>
              </Animated.View>
            );
          })}
        </View>
      ) : (
        <View style={dcStyles.emptyWinners}>
          <MaterialCommunityIcons name="crown-outline" size={32} color="rgba(255,255,255,0.15)" />
          <Text style={dcStyles.emptyText}>Make picks and check back to see who earns the DC Royal crown!</Text>
        </View>
      )}

      {winners.length >= 2 && !debateActive && !debateEnded && (
        <Animated.View entering={FadeInDown.delay(300).duration(400)} style={{ marginTop: 14 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <Ionicons name="mic" size={16} color={Colors.gold} />
            <Text style={{ color: "#fff", fontSize: 13, fontWeight: "900" as const, letterSpacing: 1 }}>DC ROYAL DEBATE</Text>
          </View>
          <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, marginBottom: 10 }}>Live timed debate between the winning analysts — they speak!</Text>
          <Text style={{ color: "rgba(255,255,255,0.35)", fontSize: 10, fontWeight: "700" as const, letterSpacing: 1, marginBottom: 6 }}>CROSSTALK</Text>
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
            {(["none", "subtle", "chaotic"] as const).map(mode => {
              const active = debateOverlap === mode;
              const label = mode === "none" ? "POLITE" : mode === "subtle" ? "SUBTLE" : "CHAOTIC";
              const sub = mode === "none" ? "no overlap" : mode === "subtle" ? "~1.5s overlap" : "~2.5s overlap";
              return (
                <Pressable key={mode} onPress={() => setDebateOverlap(mode)}
                  testID={`overlap-${mode}`}
                  style={[dcStyles.standingsTab, { flex: 1, alignItems: "center" as const, paddingVertical: 8 },
                    active && { backgroundColor: "rgba(212,164,32,0.2)", borderColor: Colors.gold }]}>
                  <Text style={{ color: active ? Colors.gold : "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: "900" as const, letterSpacing: 0.5 }}>{label}</Text>
                  <Text style={{ color: active ? Colors.gold : "rgba(255,255,255,0.3)", fontSize: 9, marginTop: 2 }}>{sub}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={{ color: "rgba(255,255,255,0.35)", fontSize: 10, fontWeight: "700" as const, letterSpacing: 1, marginBottom: 6 }}>DURATION</Text>
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 10 }}>
            {([5, 10, 15] as const).map(mins => (
              <Pressable key={mins} onPress={() => setDebateDuration(mins)}
                style={[dcStyles.standingsTab, { flex: 1, alignItems: "center" as const, paddingVertical: 10 },
                  debateDuration === mins && { backgroundColor: "rgba(212,164,32,0.2)", borderColor: Colors.gold }]}>
                <Text style={{ color: debateDuration === mins ? Colors.gold : "rgba(255,255,255,0.5)", fontSize: 16, fontWeight: "800" as const }}>{mins}</Text>
                <Text style={{ color: debateDuration === mins ? Colors.gold : "rgba(255,255,255,0.3)", fontSize: 9, fontWeight: "600" as const }}>MIN</Text>
                <Text style={{ color: debateDuration === mins ? Colors.gold : "rgba(255,255,255,0.2)", fontSize: 9, marginTop: 2 }}>{mins} tokens</Text>
              </Pressable>
            ))}
          </View>
          <Pressable onPress={startDebate} disabled={debateStarting}
            style={({ pressed }) => [dcStyles.discussionBtn, pressed && { opacity: 0.8 }]}>
            {debateStarting ? (
              <ActivityIndicator size="small" color="#0a0a0a" />
            ) : (
              <>
                <Ionicons name="mic" size={18} color="#0a0a0a" />
                <Text style={dcStyles.discussionBtnText}>START {debateDuration} MIN DEBATE</Text>
                <View style={dcStyles.tokenCost}>
                  <Text style={dcStyles.tokenCostText}>{debateDuration} TOKENS</Text>
                </View>
              </>
            )}
          </Pressable>
        </Animated.View>
      )}

      {(debateActive || debateEnded) && (
        <Animated.View entering={FadeInDown.delay(100).duration(400)} style={dcStyles.discussionContainer}>
          <View style={dcStyles.discussionHeader}>
            <MaterialCommunityIcons name="microphone-variant" size={18} color="#FFD700" />
            <Text style={dcStyles.discussionTitle}>DC ROYAL DEBATE</Text>
            <View style={{ marginLeft: "auto", flexDirection: "row", alignItems: "center", gap: 6 }}>
              {debateActive && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(255,77,77,0.15)", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#FF4D4D" }} />
                  <Text style={{ color: "#FF4D4D", fontSize: 11, fontWeight: "800" as const }}>{formatDebateTime(debateSeconds)}</Text>
                </View>
              )}
              {debateEnded && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(255,215,0,0.12)", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
                  <Ionicons name="checkmark-circle" size={12} color="#FFD700" />
                  <Text style={{ color: "#FFD700", fontSize: 11, fontWeight: "800" as const }}>DEBATE OVER</Text>
                </View>
              )}
            </View>
          </View>
          <ScrollView ref={debateScrollRef} style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false}>
            {debateMessages.map((msg, i) => {
              const p = personas.find(pp => pp.id === msg.personaId);
              const isIntr = !!(msg as any).isInterruption;
              return (
                <Animated.View key={i} entering={FadeInDown.delay(50).duration(300)}
                  style={[dcStyles.msgRow, isIntr && { marginLeft: 24, opacity: 0.9 }]}>
                  <Pressable onPress={() => onSpeak(msg.text, msg.personaId, 80000 + i)}>
                    <Image source={p?.image || personaImages.trump}
                      style={[dcStyles.msgAvatar, { borderColor: p?.color || "#ff4d4d" }, isIntr && { width: 32, height: 32 }]} />
                  </Pressable>
                  <View style={[dcStyles.msgBubble, isIntr && { backgroundColor: "rgba(255,100,0,0.08)", borderLeftWidth: 2, borderLeftColor: p?.color || "#ff4d4d", paddingLeft: 8 }]}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Text style={[dcStyles.msgName, { color: p?.color || "#ff4d4d" }]}>{p?.name || "???"}</Text>
                      {isIntr && <Text style={{ color: "#ff8c00", fontSize: 9, fontWeight: "800" }}>⚡ CUT IN</Text>}
                    </View>
                    <Text style={dcStyles.msgText}>{msg.text}</Text>
                  </View>
                </Animated.View>
              );
            })}
            {debateActive && debateMessages.length === 0 && (
              <View style={{ alignItems: "center", paddingVertical: 20 }}>
                <ActivityIndicator color={Colors.gold} />
                <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, marginTop: 8 }}>Debate starting...</Text>
              </View>
            )}
          </ScrollView>
          {debateEnded && (
            <Pressable onPress={() => { setDebateEnded(false); setDebateMessages([]); }}
              style={({ pressed }) => [{ marginTop: 10, paddingVertical: 8, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.06)", alignItems: "center" as const }, pressed && { opacity: 0.7 }]}>
              <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: "600" as const }}>CLOSE DEBATE</Text>
            </Pressable>
          )}
        </Animated.View>
      )}

      {sortedCrowns.length > 0 && (
        <Animated.View entering={FadeInDown.delay(200).duration(400)} style={dcStyles.leaderboardContainer}>
          <View style={dcStyles.leaderboardHeader}>
            <MaterialCommunityIcons name="podium-gold" size={18} color="#FFD700" />
            <Text style={dcStyles.leaderboardTitle}>ALL-TIME DC ROYAL LEADERBOARD</Text>
          </View>
          {sortedCrowns.map(([pid, count], i) => {
            const p = personas.find(pp => pp.id === pid) || { name: pid, color: "#888" };
            return (
              <View key={pid} style={dcStyles.leaderRow}>
                <Text style={[dcStyles.leaderRank, i === 0 && { color: "#FFD700" }, i === 1 && { color: "#C0C0C0" }, i === 2 && { color: "#CD7F32" }]}>#{i + 1}</Text>
                <Text style={[dcStyles.leaderName, { color: p.color }]}>{p.name}</Text>
                <View style={dcStyles.crownChipRow}>
                  <MaterialCommunityIcons name="crown" size={14} color="#FFD700" />
                  <Text style={dcStyles.crownCount}>{count}</Text>
                </View>
              </View>
            );
          })}
        </Animated.View>
      )}

      <PlayerStatsLookup />

      <View style={dcStyles.standingsSection}>
        <Text style={dcStyles.standingsTitle}>LEAGUE STANDINGS</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginBottom: 12 }}>
          {[
            { key: "nba", label: "NBA", color: "#FF6B00" },
            { key: "nfl", label: "NFL", color: "#ff4d4d" },
            { key: "mlb", label: "MLB", color: "#2E7D32" },
            { key: "nhl", label: "NHL", color: "#00529B" },
            { key: "epl", label: "EPL", color: "#1976D2" },
            { key: "mls", label: "MLS", color: "#4CAF50" },
          ].map((l) => (
            <Pressable
              key={l.key}
              onPress={() => fetchStandings(l.key)}
              style={[dcStyles.standingsTab, standingsLeague === l.key && { backgroundColor: `${l.color}30`, borderColor: l.color }]}
            >
              <Text style={[dcStyles.standingsTabText, standingsLeague === l.key && { color: l.color }]}>{l.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
        {standingsLoading ? (
          <ActivityIndicator color={Colors.gold} style={{ marginTop: 16 }} />
        ) : standings.length > 0 ? (
          <View style={dcStyles.standingsTable}>
            <View style={dcStyles.standingsHeaderRow}>
              <Text style={[dcStyles.standingsCell, { flex: 3, color: "rgba(255,255,255,0.4)" }]}>TEAM</Text>
              <Text style={[dcStyles.standingsCell, { color: "rgba(255,255,255,0.4)" }]}>W</Text>
              <Text style={[dcStyles.standingsCell, { color: "rgba(255,255,255,0.4)" }]}>L</Text>
              <Text style={[dcStyles.standingsCell, { color: "rgba(255,255,255,0.4)" }]}>PCT</Text>
              <Text style={[dcStyles.standingsCell, { color: "rgba(255,255,255,0.4)" }]}>GB</Text>
            </View>
            {standings.slice(0, 15).map((s, i) => (
              <View key={i} style={[dcStyles.standingsRow, i % 2 === 0 && { backgroundColor: "rgba(255,255,255,0.02)" }]}>
                <View style={[dcStyles.standingsCell, { flex: 3, flexDirection: "row", alignItems: "center", gap: 6 }]}>
                  {s.logo ? <Image source={{ uri: s.logo }} style={{ width: 16, height: 16 }} /> : null}
                  <Text style={dcStyles.standingsTeam} numberOfLines={1}>{s.team}</Text>
                </View>
                <Text style={dcStyles.standingsVal}>{s.wins}</Text>
                <Text style={dcStyles.standingsVal}>{s.losses}</Text>
                <Text style={[dcStyles.standingsVal, { color: Colors.gold }]}>{s.pct}</Text>
                <Text style={dcStyles.standingsVal}>{s.gb}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={dcStyles.emptyText}>No standings data available</Text>
        )}
      </View>

      <VoiceControlPopover
        personaId={voicePopoverPersonaId}
        persona={voicePopoverPersonaId ? personas.find(pp => pp.id === voicePopoverPersonaId) : undefined}
        setting={voicePopoverPersonaId ? getVoiceSetting(voiceSettings, voicePopoverPersonaId) : null}
        onClose={() => setVoicePopoverPersonaId(null)}
        onUpdate={(update) => {
          if (voicePopoverPersonaId) onUpdateVoiceSetting(voicePopoverPersonaId, update);
        }}
      />
    </Animated.View>
  );
}

const dcStyles = StyleSheet.create({
  crawlContainer: {
    backgroundColor: "rgba(255,77,77,0.08)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,77,77,0.2)",
    padding: 10,
    marginBottom: 16,
  },
  crawlLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 6,
  },
  crawlLabelText: {
    color: "#FF4D4D",
    fontSize: 10,
    fontWeight: "800" as const,
    letterSpacing: 1,
  },
  crawlItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minWidth: 250,
  },
  crawlEmoji: { fontSize: 14 },
  crawlText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    fontWeight: "500" as const,
  },
  crownHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 4,
  },
  crownTitle: {
    color: "#FFD700",
    fontSize: 20,
    fontWeight: "900" as const,
    letterSpacing: 2,
  },
  crownSubtitle: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 11,
    textAlign: "center",
    marginBottom: 16,
  },
  winnersGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "center",
    marginBottom: 16,
  },
  winnerCard: {
    backgroundColor: "rgba(255,215,0,0.06)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,215,0,0.15)",
    padding: 12,
    alignItems: "center",
    width: 100,
  },
  winnerBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  winnerCategory: {
    fontSize: 9,
    fontWeight: "800" as const,
    letterSpacing: 0.5,
  },
  winnerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    marginBottom: 6,
  },
  winnerName: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700" as const,
  },
  winnerRecord: {
    fontSize: 11,
    fontWeight: "800" as const,
    marginTop: 2,
  },
  crownChipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 4,
  },
  crownCount: {
    color: "#FFD700",
    fontSize: 12,
    fontWeight: "800" as const,
  },
  emptyWinners: {
    alignItems: "center",
    paddingVertical: 24,
    gap: 8,
  },
  emptyText: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 12,
    textAlign: "center",
  },
  discussionBtn: {
    backgroundColor: "#FFD700",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 16,
  },
  discussionBtnText: {
    color: "#0a0a0a",
    fontSize: 14,
    fontWeight: "900" as const,
    letterSpacing: 1,
  },
  tokenCost: {
    backgroundColor: "rgba(0,0,0,0.15)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  tokenCostText: {
    color: "rgba(0,0,0,0.6)",
    fontSize: 10,
    fontWeight: "700" as const,
  },
  discussionContainer: {
    backgroundColor: "rgba(255,215,0,0.05)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,215,0,0.12)",
    padding: 14,
    marginBottom: 16,
  },
  discussionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
  },
  discussionTitle: {
    color: "#FFD700",
    fontSize: 14,
    fontWeight: "900" as const,
    letterSpacing: 1,
  },
  msgRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  msgAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  msgBubble: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 10,
    padding: 10,
  },
  msgName: {
    fontSize: 11,
    fontWeight: "800" as const,
    marginBottom: 3,
  },
  msgText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 12,
    lineHeight: 17,
  },
  leaderboardContainer: {
    backgroundColor: "rgba(255,215,0,0.05)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,215,0,0.12)",
    padding: 14,
    marginBottom: 16,
  },
  leaderboardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  leaderboardTitle: {
    color: "#FFD700",
    fontSize: 12,
    fontWeight: "900" as const,
    letterSpacing: 1,
  },
  leaderRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.04)",
  },
  leaderRank: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 13,
    fontWeight: "800" as const,
    width: 32,
  },
  leaderName: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700" as const,
  },
  standingsSection: {
    marginTop: 8,
    marginBottom: 16,
  },
  standingsTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "900" as const,
    letterSpacing: 1,
    marginBottom: 12,
  },
  standingsTab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  standingsTabText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
    fontWeight: "700" as const,
  },
  standingsTable: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    overflow: "hidden" as const,
  },
  standingsHeaderRow: {
    flexDirection: "row",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  standingsRow: {
    flexDirection: "row",
    paddingVertical: 7,
    paddingHorizontal: 10,
    alignItems: "center",
  },
  standingsCell: {
    flex: 1,
    fontSize: 10,
    fontWeight: "700" as const,
    textAlign: "center" as const,
  },
  standingsTeam: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600" as const,
  },
  standingsVal: {
    flex: 1,
    color: "rgba(255,255,255,0.6)",
    fontSize: 11,
    fontWeight: "600" as const,
    textAlign: "center" as const,
  },
  mutedBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    backgroundColor: "#FF4D4D",
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#0a0a0a",
  },
});

export default function SportsScreen() {
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const webBottomInset = Platform.OS === "web" ? 34 : 0;
  const { soundEnabled } = useSound();
  const { logEvent } = useLiveActivity();
  useScreenTracker("sports");
  const trackEvent = useTrackEvent();

  React.useEffect(() => { logEvent("sports_view"); }, []);

  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPersona, setSelectedPersona] = useState("trump");
  const [speakingGameId, setSpeakingGameId] = useState<number | null>(null);
  const soundRef = React.useRef<Audio.Sound | null>(null);
  const [countdown, setCountdown] = useState(getCountdown());
  const [picks, setPicks] = useState<Record<string, PersonaPick>>({});
  const [loadingPicks, setLoadingPicks] = useState<Record<string, boolean>>({});

  const [debateP1, setDebateP1] = useState("loudmouth");
  const [debateP2, setDebateP2] = useState("shannon");
  const [trashTalk1, setTrashTalk1] = useState("");
  const [trashTalk2, setTrashTalk2] = useState("");
  const [ref1, setRef1] = useState("");
  const [ref2, setRef2] = useState("");
  const [h2h, setH2h] = useState({ wins: 0, losses: 0, total: 0 });
  const [debateVoted, setDebateVoted] = useState(false);
  const [debateWinner, setDebateWinner] = useState<string | null>(null);
  const [debatePick1, setDebatePick1] = useState<PersonaPick | null>(null);
  const [debatePick2, setDebatePick2] = useState<PersonaPick | null>(null);
  const [debatePicksLoading, setDebatePicksLoading] = useState(false);
  const [selectedLeague, setSelectedLeague] = useState("ALL");
  const [sportsTab, setSportsTab] = useState<"games" | "analysis" | "debate" | "dc-royal" | "shop">("games");
  const [roundtableDialogue, setRoundtableDialogue] = useState<{ personaId: string; text: string }[]>([]);
  const [roundtableLoading, setRoundtableLoading] = useState(false);
  const [roundtableGame, setRoundtableGame] = useState<Game | null>(null);
  const [musicPlaying, setMusicPlaying] = useState(false);
  const musicRef = useRef<Audio.Sound | null>(null);
  const {
    settings: personaVoiceSettings,
    settingsRef: personaVoiceSettingsRef,
    updateSetting: updatePersonaVoiceSetting,
  } = usePersonaVoiceSettings();

  const mountedRef = useRef(true);
  const abortRef = useRef<AbortController | null>(null);

  const [completedGames, setCompletedGames] = useState<Game[]>([]);
  const [userPicks, setUserPicks] = useState<UserPick[]>([]);
  const [tallies, setTallies] = useState<Record<string, PersonaTally>>({});
  const previousGamesRef = useRef<Game[]>([]);
  const [trashTalkLine, setTrashTalkLine] = useState("");
  const [trashTalkLoading, setTrashTalkLoading] = useState(false);
  const [userName, setUserName] = useState("");
  const [nameEditing, setNameEditing] = useState(false);
  const { playClick, playTransition } = useSoundEffects();
  const { deviceId, balance, refreshBalance } = useTokens();
  const [allTimeStats, setAllTimeStats] = useState<{ persona_id: string; total_wins: number; total_losses: number; best_streak: number; players: number }[]>([]);
  const [showAllTimeBoard, setShowAllTimeBoard] = useState(false);
  const [recapText, setRecapText] = useState<string | null>(null);
  const [recapLoading, setRecapLoading] = useState(false);
  const [viralStats, setViralStats] = useState<SportsStats>({ picks: [], totalPicks: 0 });
  const [viralShareVisible, setViralShareVisible] = useState(false);
  const [viralShareData, setViralShareData] = useState({ headline: "", quote: "" });
  const [ageVerified, setAgeVerified] = useState<boolean | null>(null);

  const syncRecordsToDb = useCallback(async (t: Record<string, PersonaTally>) => {
    if (!deviceId) return;
    const records = Object.values(t).filter(r => (r.wins + r.losses) > 0);
    if (records.length === 0) return;
    try {
      await fetch(new URL("/api/sports/record/save", getApiUrl()).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-device-id": deviceId },
        body: JSON.stringify({ records }),
      });
    } catch {}
  }, [deviceId]);

  const fetchAllTimeLeaderboard = useCallback(async () => {
    try {
      const res = await fetch(new URL("/api/sports/record/leaderboard", getApiUrl()).toString());
      if (res.ok) {
        const data = await res.json();
        setAllTimeStats(data.leaderboard || []);
      }
    } catch {}
  }, []);

  const isRacingMode = selectedLeague === "RACING" || RACING_LEAGUES.includes(selectedLeague);
  const isSoccerMode = selectedLeague === "SOCCER";
  const activePersonaList = isRacingMode ? RACING_PERSONAS : isSoccerMode ? SOCCER_PERSONAS : PERSONAS;
  const activePersona = activePersonaList.find((p) => p.id === selectedPersona) || activePersonaList[0];
  const featuredGame = games.length > 0 ? games[0] : null;
  const filteredGames = selectedLeague === "ALL"
    ? games
    : selectedLeague === "RACING"
    ? games.filter((g) => RACING_LEAGUES.includes(g.league))
    : selectedLeague === "GOLF"
    ? games.filter((g) => g.league === "GOLF" || g.league === "PGA" || g.league === "LIV" || g.isGolf)
    : games.filter((g) => g.league === selectedLeague);
  const currentTally = tallies[selectedPersona];

  const hasLiveGames = games.some((g) => g.status === "in");

  useEffect(() => {
    mountedRef.current = true;
    AsyncStorage.getItem("sportsbook_age_verified").then((val) => {
      if (mountedRef.current) {
        if (val === "true") {
          setAgeVerified(true);
        } else {
          setAgeVerified(false);
        }
      }
    }).catch(() => { if (mountedRef.current) setAgeVerified(false); });
    fetchGames();
    loadTallyData();
    fetchAllTimeLeaderboard();
    getUserName().then((n) => { if (mountedRef.current) setUserName(n); });
    getSportsStats().then((s) => { if (mountedRef.current) setViralStats(s); });
    const timer = setInterval(() => {
      if (mountedRef.current) setCountdown(getCountdown());
    }, 1000);
    return () => {
      mountedRef.current = false;
      clearInterval(timer);
      cleanupBuzzer();
      if (soundRef.current && !isTrumpCurrentlySpeaking()) {
        soundRef.current.stopAsync().catch(() => {});
        soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
      }
      musicPlayingRef.current = false;
      if (musicRef.current) {
        musicRef.current.stopAsync().catch(() => {});
        musicRef.current.unloadAsync().catch(() => {});
        musicRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!hasLiveGames) return;
    const pollInterval = setInterval(() => {
      if (mountedRef.current) fetchGames();
    }, 30000);
    return () => clearInterval(pollInterval);
  }, [hasLiveGames]);

  useEffect(() => {
    if (games.length > 0) {
      fetchAllPicks(selectedPersona);
      for (const p of activePersonaList) {
        if (p.id !== selectedPersona) {
          fetchAllPicks(p.id, true);
        }
      }
    }
    const t = tallies[selectedPersona];
    if (t && (t.wins + t.losses) > 0) {
      fetchTrashTalk(selectedPersona, t);
    } else {
      setTrashTalkLine("");
    }
  }, [selectedPersona, games]);

  useEffect(() => {
    loadDebateData();
  }, [debateP1, debateP2, games]);

  const fetchAIPick = async (game: Game, personaId: string): Promise<PersonaPick> => {
    const baseUrl = getApiUrl().replace(/\/$/, "");
    const res = await fetch(`${baseUrl}/api/sports/picks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ game, personaId }),
    });
    if (!res.ok) throw new Error("Failed to fetch pick");
    return res.json();
  };

  const fetchAllPicks = async (personaId: string, background = false) => {
    if (!background) {
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;
    }

    const newLoadingState: Record<string, boolean> = {};
    const toFetch: Game[] = [];

    for (const game of games) {
      const key = `${game.id}_${personaId}`;
      if (!picks[key]) {
        if (!background) newLoadingState[key] = true;
        toFetch.push(game);
      }
    }

    if (toFetch.length === 0) return;
    if (!background) setLoadingPicks((prev) => ({ ...prev, ...newLoadingState }));

    const batchSize = background ? 2 : toFetch.length;
    for (let i = 0; i < toFetch.length; i += batchSize) {
      const batch = toFetch.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map((game) => fetchAIPick(game, personaId))
      );

      if (!mountedRef.current) return;

      const newPicks: Record<string, PersonaPick> = {};
      const clearLoading: Record<string, boolean> = {};
      results.forEach((result, j) => {
        const key = `${batch[j].id}_${personaId}`;
        clearLoading[key] = false;
        if (result.status === "fulfilled") {
          newPicks[key] = result.value;
        }
      });

      setPicks((prev) => ({ ...prev, ...newPicks }));
      if (!background) setLoadingPicks((prev) => ({ ...prev, ...clearLoading }));
    }
  };

  const refreshPick = async (gameId: number) => {
    const key = `${gameId}_${selectedPersona}`;
    const game = games.find((g) => g.id === gameId);
    if (!game) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPicks((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setLoadingPicks((prev) => ({ ...prev, [key]: true }));

    try {
      const baseUrl = getApiUrl().replace(/\/$/, "");
      const res = await fetch(`${baseUrl}/api/sports/picks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ game, personaId: selectedPersona, fresh: true }),
      });
      if (!res.ok) throw new Error("Failed");
      const pick = await res.json();
      if (mountedRef.current) {
        setPicks((prev) => ({ ...prev, [key]: pick }));
      }
    } catch {
    } finally {
      if (mountedRef.current) setLoadingPicks((prev) => ({ ...prev, [key]: false }));
    }
  };

  const fetchGames = async () => {
    setLoading(true);
    try {
      const baseUrl = getApiUrl().replace(/\/$/, "");
      const res = await fetch(`${baseUrl}/api/sports/upcoming`);
      if (!res.ok) throw new Error("Failed to fetch games");
      const data = await res.json();
      if (mountedRef.current) {
        const newGames: Game[] = data.games || [];
        const newResults: Game[] = data.results || [];
        const allCurrent = [...newGames, ...newResults];
        if (previousGamesRef.current.length > 0) {
          try {
            await checkGameEndEvents(
              allCurrent.map((g) => ({ id: g.id, league: g.league, status: g.status || "", displayClock: g.displayClock || "", period: g.period || 0, game: g.game, score: g.score })),
              previousGamesRef.current.map((g) => ({ id: g.id, league: g.league, status: g.status || "", displayClock: g.displayClock || "", period: g.period || 0, game: g.game, score: g.score }))
            );
          } catch (e) {
            console.error("Game buzzer check error:", e);
          }
        }
        previousGamesRef.current = allCurrent;
        setGames(newGames);
        setCompletedGames(newResults);
        resolveCompletedPicks(newResults);
      }
    } catch (err) {
      console.warn("Sports fetch error:", err);
      if (mountedRef.current) setGames([]);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  const resolveCompletedPicks = async (results: Game[]) => {
    if (!results.length) return;
    const allPicks = await getUserPicks();
    let resolved = false;
    for (const result of results) {
      if (!result.winner) continue;
      const unresolvedForGame = allPicks.filter(
        (p) => p.gameId === result.id && !p.resolved
      );
      for (const pick of unresolvedForGame) {
        await resolvePick(result.id, pick.personaId, result.winner);
        resolved = true;
      }
    }
    if (resolved) {
      await loadTallyData(true);
    }
  };

  const loadTallyData = async (triggerTrashTalk = false) => {
    const [t, p] = await Promise.all([getTallies(), getUserPicks()]);
    if (mountedRef.current) {
      setTallies(t);
      setUserPicks(p);
      if (triggerTrashTalk) {
        syncRecordsToDb(t);
        const tally = t[selectedPersona];
        if (tally && (tally.wins + tally.losses) > 0) {
          fetchTrashTalk(selectedPersona, tally);
        }
      }
    }
  };

  const handleUserPick = async (game: Game, team: string) => {
    const isGameLocked = game.status === "in" || game.status === "post" || !!game.final;
    if (isGameLocked) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Picks Locked", "This game has already started. You can't change your pick once a game is in progress.");
      return;
    }
    playClick();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const allPersonaSets = [...PERSONAS, ...RACING_PERSONAS, ...SOCCER_PERSONAS];
    const uniqueIds = Array.from(new Set(allPersonaSets.map((p) => p.id)));
    const personaPicks: Record<string, string> = {};
    for (const pid of uniqueIds) {
      const pk = `${game.id}_${pid}`;
      if (picks[pk]?.pick) personaPicks[pid] = picks[pk].pick;
    }
    await makeUniversalPick(game.id, team, uniqueIds, personaPicks);
    await loadTallyData();
  };

  const fetchTrashTalk = async (personaId: string, tally: PersonaTally) => {
    setTrashTalkLoading(true);
    try {
      const baseUrl = getApiUrl().replace(/\/$/, "");
      const res = await fetch(`${baseUrl}/api/sports/trash-talk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personaId, wins: tally.wins, losses: tally.losses, streak: tally.streak, userName: userName || undefined }),
      });
      if (res.ok) {
        const data = await res.json();
        if (mountedRef.current) setTrashTalkLine(data.text || "");
      }
    } catch {}
    finally { if (mountedRef.current) setTrashTalkLoading(false); }
  };

  const fetchRecap = async () => {
    if (completedGames.length === 0) return;
    setRecapLoading(true);
    setRecapText(null);
    try {
      const baseUrl = getApiUrl().replace(/\/$/, "");
      const res = await fetch(`${baseUrl}/api/sports/recap`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(deviceId ? { "x-device-id": deviceId } : {}) },
        body: JSON.stringify({ personaId: selectedPersona, completedGames }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.error === "no_tokens") {
          Alert.alert("Not Enough Tokens", "Recap costs 2 tokens. Get more tokens to continue!", [
            { text: "Get Tokens", onPress: () => router.push("/subscribe") },
            { text: "Cancel", style: "cancel" },
          ]);
          return;
        }
        throw new Error("Failed");
      }
      const data = await res.json();
      if (mountedRef.current) {
        setRecapText(data.recap || null);
        refreshBalance();
      }
    } catch (e) {
      console.error("Recap error:", e);
    } finally {
      if (mountedRef.current) setRecapLoading(false);
    }
  };

  const loadDebateData = async () => {
    if (!featuredGame) return;
    try {
      setDebatePicksLoading(true);
      const [tt1, tt2, r1, r2, record, pick1, pick2] = await Promise.all([
        generateTrashTalk(debateP1, debateP2),
        generateTrashTalk(debateP2, debateP1),
        generateReference(debateP1, debateP2, "sports"),
        generateReference(debateP2, debateP1, "sports"),
        getHeadToHead(debateP1, debateP2),
        fetchAIPick(featuredGame, debateP1).catch(() => null),
        fetchAIPick(featuredGame, debateP2).catch(() => null),
      ]);
      if (!mountedRef.current) return;
      setTrashTalk1(tt1);
      setTrashTalk2(tt2);
      setRef1(r1);
      setRef2(r2);
      setH2h(record);
      setDebatePick1(pick1);
      setDebatePick2(pick2);
      setDebateVoted(false);
      setDebateWinner(null);
    } catch (err) {
      console.error("Debate data error:", err);
    } finally {
      if (mountedRef.current) setDebatePicksLoading(false);
    }
  };

  const handleVoteDebate = async (winnerId: string) => {
    if (debateVoted) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setDebateVoted(true);
    setDebateWinner(winnerId);

    const loserId = winnerId === debateP1 ? debateP2 : debateP1;
    const gameName = featuredGame?.game || "Sports Debate";
    await recordInteraction(winnerId, loserId, "sports", gameName, "win");
    loadDebateData();
  };

  const handleSpeak = async (text: string, personaId: string, gameId: number): Promise<Audio.Sound | null> => {
    if (isTrumpCurrentlySpeaking() && personaId !== "trump") return null;
    if (speakingGameId !== null) {
      if (soundRef.current && !isTrumpCurrentlySpeaking()) {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
      setSpeakingGameId(null);
      if (speakingGameId === gameId) return null;
    }

    if (!soundEnabled) return null;
    const voiceSetting = getVoiceSetting(personaVoiceSettingsRef.current, personaId);
    if (voiceSetting.muted || voiceSetting.volume <= 0) return null;
    const clampedVolume = Math.max(0, Math.min(1, voiceSetting.volume));
    setSpeakingGameId(gameId);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      const sound = personaId === "trump"
        ? await playTrumpTTS("/api/persona-speak", { text, personaId }, { volume: clampedVolume })
        : await playTTS("/api/persona-speak", { text, personaId }, { volume: clampedVolume });
      soundRef.current = sound;
      sound.setOnPlaybackStatusUpdate((status: any) => {
        if (status.didJustFinish) {
          if (mountedRef.current) setSpeakingGameId(null);
          sound.unloadAsync().catch(() => {});
          soundRef.current = null;
        }
      });
      return sound;
    } catch {
      if (mountedRef.current) setSpeakingGameId(null);
      return null;
    }
  };

  const handleAffiliate = (url: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Linking.openURL(url).catch(() => {});
  };

  const musicTrackNames = ["prowling-dragon.mp3", "zdragon.mp3"];
  const musicTrackIndexRef = useRef(0);
  const musicPlayingRef = useRef(false);

  const playNextTrack = async () => {
    if (!musicPlayingRef.current || !mountedRef.current) return;
    try {
      const idx = musicTrackIndexRef.current;
      const trackUrl = new URL(`/public/${musicTrackNames[idx]}`, getApiUrl()).toString();
      const { sound } = await Audio.Sound.createAsync(
        { uri: trackUrl },
        { shouldPlay: true, isLooping: false, volume: 0.4 }
      );
      musicRef.current = sound;
      sound.setOnPlaybackStatusUpdate((status: any) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync().catch(() => {});
          musicTrackIndexRef.current = (musicTrackIndexRef.current + 1) % musicTrackNames.length;
          if (mountedRef.current && musicPlayingRef.current) playNextTrack();
        }
      });
    } catch (e) {
      console.error("Music playback error:", e);
      if (mountedRef.current) setMusicPlaying(false);
      musicPlayingRef.current = false;
    }
  };

  const toggleMusic = async () => {
    if (musicPlaying && musicRef.current) {
      musicPlayingRef.current = false;
      await musicRef.current.stopAsync().catch(() => {});
      await musicRef.current.unloadAsync().catch(() => {});
      musicRef.current = null;
      setMusicPlaying(false);
    } else {
      try {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: false, shouldDuckAndroid: true });
        musicTrackIndexRef.current = 0;
        musicPlayingRef.current = true;
        setMusicPlaying(true);
        await playNextTrack();
      } catch {
        musicPlayingRef.current = false;
        setMusicPlaying(false);
      }
    }
  };

  const fetchRoundtable = async (game: Game) => {
    setRoundtableLoading(true);
    setRoundtableGame(game);
    setRoundtableDialogue([]);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    try {
      const baseUrl = getApiUrl().replace(/\/$/, "");
      const allPersonaIds = activePersonaList.map((p) => p.id);
      const res = await fetch(`${baseUrl}/api/sports/roundtable`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(deviceId ? { "x-device-id": deviceId } : {}) },
        body: JSON.stringify({ game, personas: allPersonaIds }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (err.error === "no_tokens") {
          router.push("/subscribe" as any);
          return;
        }
        throw new Error("Failed");
      }
      const data = await res.json();
      if (mountedRef.current) setRoundtableDialogue(data.dialogue || []);
    } catch {
    } finally {
      if (mountedRef.current) setRoundtableLoading(false);
    }
  };

  const p1Info = PERSONAS.find((p) => p.id === debateP1) || PERSONAS[0];
  const p2Info = PERSONAS.find((p) => p.id === debateP2) || PERSONAS[1];

  return (
    <View style={[styles.container, Platform.OS === "web" && { maxHeight: "100vh" as any, overflow: "auto" as any }]}>
      <LinearGradient colors={["#0a0a0a", "#1a0f00", "#0a0a0a"]} style={StyleSheet.absoluteFillObject} />
      <Image
        source={require("@/assets/images/dynamic-creations.jpg")}
        style={styles.bgLogo}
        resizeMode="contain"
      />

      <Modal visible={ageVerified === false} transparent animationType="fade" onRequestClose={() => { router.back(); }}>
        <View style={ageGateStyles.overlay}>
          <Animated.View entering={FadeInUp.duration(400)} style={ageGateStyles.card}>
            <Text style={ageGateStyles.icon}>🏈</Text>
            <Text style={ageGateStyles.title}>Age Verification Required</Text>
            <Text style={ageGateStyles.message}>
              The Sports Book section contains mature entertainment content.
            </Text>
            <Text style={ageGateStyles.ageWarning}>You must be 18+ to enter.</Text>
            <View style={ageGateStyles.buttons}>
              <Pressable
                onPress={() => {
                  AsyncStorage.setItem("sportsbook_age_verified", "true").catch(() => {});
                  setAgeVerified(true);
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                }}
                style={({ pressed }) => [ageGateStyles.btn, ageGateStyles.confirmBtn, pressed && { opacity: 0.8 }]}
              >
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
                <Text style={ageGateStyles.btnText}>I am 18 or older</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                  router.back();
                }}
                style={({ pressed }) => [ageGateStyles.btn, ageGateStyles.denyBtn, pressed && { opacity: 0.8 }]}
              >
                <Ionicons name="close-circle" size={20} color="#ff4d4d" />
                <Text style={[ageGateStyles.btnText, { color: "#ff4d4d" }]}>I am under 18</Text>
              </Pressable>
            </View>
            <Text style={ageGateStyles.disclaimer}>
              For entertainment purposes only. All predictions and analysis are AI-generated.
            </Text>
            <Pressable onPress={() => Linking.openURL("/privacy.html")} style={{ marginTop: 10 }}>
              <Text style={{ color: "#888", fontSize: 12, textDecorationLine: "underline" }}>Privacy Policy</Text>
            </Pressable>
          </Animated.View>
        </View>
      </Modal>

      <View style={[styles.header, { paddingTop: insets.top + webTopInset + 8 }]}>
        <Pressable onPress={() => { playTransition(); router.back(); }} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.gold} />
        </Pressable>
        <View style={styles.headerCenter}>
          <MaterialCommunityIcons name="football" size={20} color={Colors.gold} />
          <Text style={styles.headerTitle}>DYNAMIC SPORTS BOOK</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Pressable
            onPress={toggleMusic}
            style={({ pressed }) => [styles.musicToggle, musicPlaying && styles.musicToggleActive, pressed && { opacity: 0.7 }]}
          >
            <Ionicons name={musicPlaying ? "musical-notes" : "musical-notes-outline"} size={16} color={musicPlaying ? "#0a0a0a" : Colors.gold} />
          </Pressable>
          {balance && (
            <Pressable onPress={() => router.push("/subscribe")} style={styles.tokenBadge}>
              <Image source={require("@/assets/images/dc-lightning-token.jpeg")} style={{ width: 14, height: 14, borderRadius: 7 }} />
              <Text style={styles.tokenBadgeText}>{balance.totalAvailable}</Text>
            </Pressable>
          )}
          <ShareAppButton variant="icon" area="sports" />
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: insets.bottom + webBottomInset + 24 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.parodyBanner}>
          <Ionicons name="information-circle" size={14} color="rgba(255,255,255,0.5)" />
          <Text style={styles.parodyText}>PARODY &amp; ENTERTAINMENT ONLY — All personas are fictional parodies. Not real advice.</Text>
        </View>

        <LiveTicker
          items={
            games.filter(g => g.status === "in").length > 0
              ? games.filter(g => g.status === "in").map(g => ({
                  emoji: g.league === "NBA" ? "\uD83C\uDFC0" : g.league === "NFL" ? "\uD83C\uDFC8" : g.league === "MLB" ? "\u26BE" : g.league === "NHL" ? "\uD83C\uDFD2" : g.league === "SOCCER" ? "\u26BD" : g.league === "UFC" ? "\uD83E\uDD4A" : "\uD83C\uDFC6",
                  text: `LIVE: ${g.game}${g.score ? ` ${g.score}` : ""}`,
                }))
              : [
                  { emoji: "\uD83C\uDFC8", text: "NFL: Dynamic picks are HEATING UP" },
                  { emoji: "\uD83C\uDFC0", text: "NBA: Who has the best picks tonight?" },
                  { emoji: "\u26BD", text: "SOCCER: World Cup 2026 is coming!" },
                  { emoji: "\uD83C\uDFC6", text: `${viralStats.totalPicks} total picks made` },
                ]
          }
        />

        <View style={styles.sportsTabBar}>
          {([
            { key: "games" as const, label: "GAMES", icon: "football" as const },
            { key: "dc-royal" as const, label: "DC ROYAL", icon: "trophy" as const },
            { key: "analysis" as const, label: "ANALYSIS", icon: "analytics" as const },
            { key: "debate" as const, label: "DEBATE", icon: "people" as const },
            { key: "shop" as const, label: "SHOP", icon: "cart" as const },
          ]).map((tab) => (
            <Pressable
              key={tab.key}
              onPress={() => { playClick(); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSportsTab(tab.key); }}
              style={[styles.sportsTabItem, sportsTab === tab.key && styles.sportsTabItemActive]}
            >
              <Ionicons name={tab.icon} size={16} color={sportsTab === tab.key ? Colors.gold : "rgba(255,255,255,0.4)"} />
              <Text style={[styles.sportsTabLabel, sportsTab === tab.key && styles.sportsTabLabelActive]}>{tab.label}</Text>
            </Pressable>
          ))}
        </View>

        <QuestionOfTheDay />

        {sportsTab === "games" && viralStats.totalPicks > 0 && (
          <StatsPanel
            title="YOUR PICKS"
            emoji="\uD83C\uDFC6"
            stats={[
              { label: "Total Picks", value: viralStats.totalPicks },
              { label: "Recent", value: viralStats.picks.length > 0 ? viralStats.picks[viralStats.picks.length - 1].pick : "---" },
            ]}
            accentColor="#ffaa00"
            onShare={() => {
              setViralShareData({
                headline: `${viralStats.totalPicks} Sports Picks`,
                quote: `I've made ${viralStats.totalPicks} picks on Dynamic Sports Book! ${viralStats.picks.length > 0 ? `Latest: ${viralStats.picks[viralStats.picks.length - 1].pick}` : ""} Think you can beat me?`,
              });
              setViralShareVisible(true);
            }}
            onChallenge={() => {
              shareContent({
                text: `I've made ${viralStats.totalPicks} picks on Dynamic Sports Book! Think you know sports better than me? Challenge accepted! \uD83C\uDFC8\n\nGet yours at trumpbot.rip`,
                feature: "sports_challenge",
              });
            }}
          />
        )}

        {sportsTab === "games" && <Animated.View entering={FadeInDown.delay(50).duration(400)} style={styles.worldCupCard}>
          <LinearGradient
            colors={["#0d3b0d", "#1a0f00", "#0d3b0d"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={styles.wcHeader}>
            <MaterialCommunityIcons name="soccer" size={24} color="#4CAF50" />
            <Text style={styles.wcTitle}>FIFA WORLD CUP 2026</Text>
            <MaterialCommunityIcons name="soccer" size={24} color="#4CAF50" />
          </View>
          <Text style={styles.wcSubtitle}>USA • MEXICO • CANADA</Text>
          <View style={styles.wcCountdownRow}>
            <View style={styles.wcCountdownUnit}>
              <Text style={styles.wcCountdownNum}>{countdown.days}</Text>
              <Text style={styles.wcCountdownLabel}>DAYS</Text>
            </View>
            <Text style={styles.wcCountdownSep}>:</Text>
            <View style={styles.wcCountdownUnit}>
              <Text style={styles.wcCountdownNum}>{String(countdown.hours).padStart(2, "0")}</Text>
              <Text style={styles.wcCountdownLabel}>HRS</Text>
            </View>
            <Text style={styles.wcCountdownSep}>:</Text>
            <View style={styles.wcCountdownUnit}>
              <Text style={styles.wcCountdownNum}>{String(countdown.minutes).padStart(2, "0")}</Text>
              <Text style={styles.wcCountdownLabel}>MIN</Text>
            </View>
            <Text style={styles.wcCountdownSep}>:</Text>
            <View style={styles.wcCountdownUnit}>
              <Text style={styles.wcCountdownNum}>{String(countdown.seconds).padStart(2, "0")}</Text>
              <Text style={styles.wcCountdownLabel}>SEC</Text>
            </View>
          </View>
          <Text style={styles.wcTrumpQuote}>
            "We're gonna have the GREATEST World Cup in history. Believe me, nobody does soccer like America!"
          </Text>
        </Animated.View>}

        <Animated.View entering={FadeInDown.delay(100).duration(400)} style={styles.personaSelector}>
          <Text style={styles.sectionLabel}>CHOOSE YOUR ANALYST</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.personaRow}>
            {activePersonaList.map((p) => (
              <PersonaSelectorItem
                key={p.id}
                persona={p}
                selected={selectedPersona === p.id}
                onPress={() => {
                  playClick();
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setSelectedPersona(p.id);
                }}
              />
            ))}
          </ScrollView>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.nameInputSection}>
          <View style={styles.nameInputCard}>
            <View style={styles.nameInputRow}>
              <Ionicons name="person" size={16} color={Colors.gold} />
              <TextInput
                style={styles.nameInput}
                placeholder="Enter your name for trash talk..."
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={userName}
                onChangeText={(t) => setUserName(t)}
                onBlur={() => {
                  saveUserName(userName);
                  const t = tallies[selectedPersona];
                  if (t && (t.wins + t.losses) > 0) fetchTrashTalk(selectedPersona, t);
                }}
                onSubmitEditing={() => {
                  saveUserName(userName);
                  const t = tallies[selectedPersona];
                  if (t && (t.wins + t.losses) > 0) fetchTrashTalk(selectedPersona, t);
                }}
                returnKeyType="done"
                maxLength={30}
              />
              {userName.length > 0 && (
                <Pressable onPress={() => { setUserName(""); saveUserName(""); }} style={{ padding: 4 }}>
                  <Ionicons name="close-circle" size={16} color="rgba(255,255,255,0.3)" />
                </Pressable>
              )}
            </View>
            {userName.length > 0 && (
              <Text style={styles.nameConfirmText}>Personas will trash talk you as "{userName}"</Text>
            )}
          </View>
        </Animated.View>

        {currentTally && (currentTally.wins + currentTally.losses) > 0 && (
          <Animated.View entering={FadeInDown.delay(220).duration(400)} style={styles.tallySection}>
            <View style={styles.tallyCard}>
              <LinearGradient
                colors={[`${activePersona.color}15`, "rgba(0,0,0,0.4)", `${activePersona.color}15`]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFillObject}
              />
              <View style={styles.tallyHeader}>
                <Image source={activePersona.image} style={[styles.tallyAvatar, { borderColor: activePersona.color }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.tallyTitle}>{userName ? userName.toUpperCase() : "YOU"} vs {activePersona.name.toUpperCase()}</Text>
                  <View style={styles.tallyScoreRow}>
                    <Text style={[styles.tallyScore, { color: currentTally.wins >= currentTally.losses ? "#4CAF50" : "#FF5252" }]}>
                      {currentTally.wins}W - {currentTally.losses}L
                    </Text>
                    {currentTally.streak !== 0 && (
                      <View style={[styles.streakBadge, { backgroundColor: currentTally.streak > 0 ? "rgba(76,175,80,0.2)" : "rgba(255,82,82,0.2)" }]}>
                        <Text style={{ color: currentTally.streak > 0 ? "#4CAF50" : "#FF5252", fontSize: 10, fontWeight: "800" as const }}>
                          {currentTally.streak > 0 ? `${currentTally.streak}W` : `${Math.abs(currentTally.streak)}L`} STREAK
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
              {trashTalkLoading ? (
                <ActivityIndicator size="small" color={activePersona.color} style={{ marginTop: 8 }} />
              ) : trashTalkLine ? (
                <View style={styles.trashTalkRow}>
                  <Text style={[styles.trashTalkText, { borderLeftColor: activePersona.color }]}>"{trashTalkLine}"</Text>
                  <Pressable
                    onPress={() => handleSpeak(trashTalkLine, selectedPersona, 88888)}
                    style={({ pressed }) => [{ padding: 6 }, pressed && { opacity: 0.5 }]}
                  >
                    <Ionicons name="volume-high" size={16} color={activePersona.color} />
                  </Pressable>
                </View>
              ) : null}
            </View>
          </Animated.View>
        )}

        {sportsTab === "games" && <Animated.View entering={FadeInDown.delay(230).duration(400)} style={{ paddingHorizontal: 16, paddingTop: 4 }}>
          <Pressable
            onPress={() => { fetchAllTimeLeaderboard(); setShowAllTimeBoard(true); playClick(); }}
            style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 10, borderWidth: 1, borderColor: "#FFD700", backgroundColor: pressed ? "rgba(255,215,0,0.15)" : "rgba(255,215,0,0.05)" }]}
          >
            <Ionicons name="trophy" size={16} color="#FFD700" />
            <Text style={{ color: "#FFD700", fontSize: 12, fontWeight: "800" as const, letterSpacing: 1 }}>ALL-TIME LEADERBOARD</Text>
          </Pressable>
        </Animated.View>}

        {sportsTab === "games" && <Animated.View entering={FadeInDown.delay(250).duration(400)} style={{ paddingHorizontal: 16, paddingTop: 8 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingRight: 16 }}>
            {ALL_LEAGUES.map((league) => {
              const isActive = selectedLeague === league;
              const color = league === "ALL" ? Colors.gold : league === "RACING" ? "#E10600" : (LEAGUE_COLORS[league] || "#D4A420");
              return (
                <Pressable
                  key={league}
                  onPress={() => {
                    playClick();
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSelectedLeague(league);
                    const willBeRacing = league === "RACING" || RACING_LEAGUES.includes(league);
                    const willBeSoccer = league === "SOCCER";
                    if (willBeRacing && !isRacingMode) {
                      setSelectedPersona(RACING_PERSONAS[0].id);
                    } else if (willBeSoccer && !isSoccerMode) {
                      setSelectedPersona(SOCCER_PERSONAS[0].id);
                    } else if (!willBeRacing && !willBeSoccer && (isRacingMode || isSoccerMode)) {
                      setSelectedPersona("trump");
                    }
                  }}
                  style={[styles.leagueTab, isActive && { backgroundColor: `${color}30`, borderColor: color }]}
                >
                  <Text style={[styles.leagueTabText, isActive && { color }]}>{league}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </Animated.View>}

        {sportsTab === "games" && <Animated.View entering={FadeInDown.delay(300).duration(400)} style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionLabel}>TODAY'S GAMES</Text>
            <View style={styles.aiBadge}>
              <View style={styles.aiDot} />
              <Text style={styles.aiBadgeText}>AI LIVE</Text>
            </View>
          </View>
          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color={Colors.gold} />
              <Text style={styles.loadingText}>Loading games...</Text>
            </View>
          ) : filteredGames.length === 0 ? (
            <View style={styles.emptyBox}>
              <MaterialCommunityIcons name="emoticon-sad-outline" size={40} color="rgba(255,255,255,0.2)" />
              <Text style={styles.emptyText}>No {selectedLeague === "ALL" ? "" : selectedLeague + " "}games available right now</Text>
            </View>
          ) : (
            filteredGames.map((game) => {
              const pickForGame = userPicks.find((p) => p.gameId === game.id && p.personaId === selectedPersona) || userPicks.find((p) => p.gameId === game.id);
              const CardComponent = game.isGolf ? GolfCard : GameCard;
              const gameAllPicks: Record<string, PersonaPick> = {};
              for (const p of activePersonaList) {
                const pk = picks[`${game.id}_${p.id}`];
                if (pk) gameAllPicks[p.id] = pk;
              }
              return (
                <CardComponent
                  key={game.id}
                  game={game}
                  persona={activePersona}
                  pick={picks[`${game.id}_${selectedPersona}`] || null}
                  pickLoading={!!loadingPicks[`${game.id}_${selectedPersona}`]}
                  onSpeak={handleSpeak}
                  speakingGameId={speakingGameId}
                  onRefresh={refreshPick}
                  onPickTeam={handleUserPick}
                  userPick={pickForGame?.team}
                  pendingUserPick={pickForGame && !pickForGame.resolved ? pickForGame : undefined}
                  allPersonaPicks={gameAllPicks}
                  allPersonas={activePersonaList}
                />
              );
            })
          )}
        </Animated.View>}

        {sportsTab === "analysis" && completedGames.length > 0 && (
          <Animated.View entering={FadeInDown.delay(350).duration(400)} style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionLabel}>LAST NIGHT'S RECAP</Text>
              <View style={[styles.aiBadge, { backgroundColor: "rgba(255,152,0,0.15)" }]}>
                <Ionicons name="newspaper" size={12} color="#FF9800" />
                <Text style={[styles.aiBadgeText, { color: "#FF9800" }]}>2 TOKENS</Text>
              </View>
            </View>
            <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, marginBottom: 12 }}>
              Get {activePersona.name}'s recap of last night's games — hot takes, highlights, and who choked!
            </Text>
            <Pressable
              onPress={() => { playClick(); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); fetchRecap(); }}
              disabled={recapLoading}
              style={({ pressed }) => [styles.recapBtn, { borderColor: activePersona.color, backgroundColor: `${activePersona.color}15` }, pressed && { opacity: 0.7 }]}
            >
              {recapLoading ? (
                <ActivityIndicator size="small" color={activePersona.color} />
              ) : (
                <Ionicons name="newspaper-outline" size={18} color={activePersona.color} />
              )}
              <Text style={[styles.recapBtnText, { color: activePersona.color }]}>
                {recapLoading ? `${activePersona.name} is reviewing the tape...` : recapText ? "REFRESH RECAP" : `GET ${activePersona.name.toUpperCase()}'S RECAP`}
              </Text>
            </Pressable>
            {recapText && !recapLoading && (
              <Animated.View entering={FadeInDown.duration(300)} style={[styles.recapBox, { borderLeftColor: activePersona.color }]}>
                <View style={styles.recapHeader}>
                  <Image source={activePersona.image} style={[styles.commentaryAvatar, { borderColor: activePersona.color }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.commentaryLabel, { color: activePersona.color }]}>{activePersona.name}'s Recap</Text>
                  </View>
                  <Pressable
                    onPress={() => handleSpeak(recapText, selectedPersona, 77777)}
                    style={({ pressed }) => [styles.commentarySpeakBtn, { borderColor: activePersona.color }, pressed && { opacity: 0.7 }]}
                  >
                    <Ionicons name={speakingGameId === 77777 ? "stop" : "volume-high"} size={14} color={activePersona.color} />
                  </Pressable>
                </View>
                <Text style={styles.commentaryText}>"{recapText}"</Text>
              </Animated.View>
            )}
          </Animated.View>
        )}

        {sportsTab === "games" && completedGames.length > 0 && (
          <Animated.View entering={FadeInDown.delay(400).duration(400)} style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionLabel}>TODAY'S RESULTS</Text>
              <View style={[styles.aiBadge, { backgroundColor: "rgba(76,175,80,0.15)" }]}>
                <Ionicons name="checkmark-circle" size={12} color="#4CAF50" />
                <Text style={[styles.aiBadgeText, { color: "#4CAF50" }]}>FINAL</Text>
              </View>
            </View>
            {completedGames.map((game) => {
              const leagueColor = LEAGUE_COLORS[game.league] || "#D4A420";
              const hasDetails = (game.homeLeaders && game.homeLeaders.length > 0) || (game.awayLeaders && game.awayLeaders.length > 0) || (game.homeStats && game.homeStats.length > 0) || (game.awayStats && game.awayStats.length > 0);
              return (
                <View
                  key={`result-${game.id}`}
                  style={styles.resultCard}
                >
                  <View style={styles.gameHeader}>
                    <View style={[styles.leagueBadge, { backgroundColor: leagueColor }]}>
                      <Text style={styles.leagueText}>{game.league}</Text>
                    </View>
                    <View style={{ flexDirection: "row" as const, alignItems: "center" as const, gap: 6 }}>
                      <Text style={{ color: "#4CAF50", fontSize: 10, fontWeight: "700" as const }}>FINAL</Text>
                    </View>
                  </View>
                  <Text style={styles.gameTitle}>{game.game}</Text>
                  <Text style={styles.resultScore}>{game.score}</Text>
                  {game.winner && (
                    <View style={styles.winnerRow}>
                      <Ionicons name="trophy" size={14} color="#FFD700" />
                      <Text style={styles.winnerText}>{game.winner} WINS</Text>
                    </View>
                  )}
                  {hasDetails && <GameStatsPanel game={game} />}
                </View>
              );
            })}
          </Animated.View>
        )}

        {sportsTab === "debate" && featuredGame && (
          <Animated.View entering={FadeInDown.delay(500).duration(400)} style={styles.section}>
            <Text style={styles.sectionLabel}>TODAY'S DEBATE</Text>
            <View style={styles.debateCard}>
              <LinearGradient
                colors={[`${p1Info.color}20`, "#0a0a0a", `${p2Info.color}20`]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.debateGradient}
              />
              <Text style={styles.debateGame}>{featuredGame.game}</Text>

              <View style={styles.h2hRow}>
                <Text style={styles.h2hLabel}>HEAD-TO-HEAD</Text>
                <Text style={styles.h2hRecord}>
                  {h2h.total > 0
                    ? `${p1Info.name} ${h2h.wins} - ${h2h.losses} ${p2Info.name}`
                    : "First matchup!"}
                </Text>
              </View>

              <View style={styles.debateContenders}>
                <View style={[styles.debateContender, debateWinner === debateP1 && { borderColor: p1Info.color, borderWidth: 2 }]}>
                  <Image source={p1Info.image} style={[styles.debateAvatar, { borderColor: p1Info.color }]} />
                  <Text style={[styles.debateName, { color: p1Info.color }]}>{p1Info.name}</Text>
                  {debatePicksLoading ? (
                    <ActivityIndicator size="small" color={p1Info.color} style={{ marginVertical: 8 }} />
                  ) : debatePick1 ? (
                    <Text style={styles.debatePickText} numberOfLines={3}>
                      Picks: {debatePick1.pick} ({debatePick1.confidence}%)
                    </Text>
                  ) : null}
                  {ref1 ? <Text style={styles.debateRef} numberOfLines={3}>"{ref1}"</Text> : null}
                  {trashTalk1 ? <Text style={styles.debateTrash} numberOfLines={2}>{trashTalk1}</Text> : null}
                  {!debateVoted ? (
                    <Pressable
                      onPress={() => handleVoteDebate(debateP1)}
                      style={({ pressed }) => [styles.debateVoteBtn, { backgroundColor: p1Info.color }, pressed && { opacity: 0.8 }]}
                    >
                      <Text style={styles.debateVoteBtnText}>VOTE</Text>
                    </Pressable>
                  ) : (
                    <View style={[styles.debateVoteBtn, { backgroundColor: debateWinner === debateP1 ? p1Info.color : "rgba(255,255,255,0.1)" }]}>
                      <Text style={styles.debateVoteBtnText}>{debateWinner === debateP1 ? "WINNER" : ""}</Text>
                    </View>
                  )}
                </View>

                <View style={styles.vsContainer}>
                  <LinearGradient colors={["#FFD700", "#D4A420"]} style={styles.vsBadge}>
                    <Text style={styles.vsText}>VS</Text>
                  </LinearGradient>
                </View>

                <View style={[styles.debateContender, debateWinner === debateP2 && { borderColor: p2Info.color, borderWidth: 2 }]}>
                  <Image source={p2Info.image} style={[styles.debateAvatar, { borderColor: p2Info.color }]} />
                  <Text style={[styles.debateName, { color: p2Info.color }]}>{p2Info.name}</Text>
                  {debatePicksLoading ? (
                    <ActivityIndicator size="small" color={p2Info.color} style={{ marginVertical: 8 }} />
                  ) : debatePick2 ? (
                    <Text style={styles.debatePickText} numberOfLines={3}>
                      Picks: {debatePick2.pick} ({debatePick2.confidence}%)
                    </Text>
                  ) : null}
                  {ref2 ? <Text style={styles.debateRef} numberOfLines={3}>"{ref2}"</Text> : null}
                  {trashTalk2 ? <Text style={styles.debateTrash} numberOfLines={2}>{trashTalk2}</Text> : null}
                  {!debateVoted ? (
                    <Pressable
                      onPress={() => handleVoteDebate(debateP2)}
                      style={({ pressed }) => [styles.debateVoteBtn, { backgroundColor: p2Info.color }, pressed && { opacity: 0.8 }]}
                    >
                      <Text style={styles.debateVoteBtnText}>VOTE</Text>
                    </Pressable>
                  ) : (
                    <View style={[styles.debateVoteBtn, { backgroundColor: debateWinner === debateP2 ? p2Info.color : "rgba(255,255,255,0.1)" }]}>
                      <Text style={styles.debateVoteBtnText}>{debateWinner === debateP2 ? "WINNER" : ""}</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          </Animated.View>
        )}

        {sportsTab === "analysis" && <Animated.View entering={FadeInDown.delay(600).duration(400)} style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionLabel}>SPORTS ROUNDTABLE</Text>
            <View style={[styles.aiBadge, { backgroundColor: "rgba(212,164,32,0.15)" }]}>
              <MaterialCommunityIcons name="account-group" size={12} color={Colors.gold} />
              <Text style={[styles.aiBadgeText, { color: Colors.gold }]}>1 TOKEN</Text>
            </View>
          </View>
          <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, marginBottom: 12 }}>
            Watch all analysts debate a game — they argue, chastise, and praise each other LIVE!
          </Text>

          {filteredGames.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 16 }}>
              {filteredGames.slice(0, 5).map((game) => (
                <Pressable
                  key={`rt-${game.id}`}
                  onPress={() => fetchRoundtable(game)}
                  style={({ pressed }) => [styles.roundtableGameBtn, roundtableGame?.id === game.id && { borderColor: Colors.gold, backgroundColor: "rgba(212,164,32,0.1)" }, pressed && { opacity: 0.7 }]}
                >
                  <View style={[styles.leagueBadge, { backgroundColor: LEAGUE_COLORS[game.league] || "#D4A420", marginBottom: 4, alignSelf: "flex-start" }]}>
                    <Text style={styles.leagueText}>{game.league}</Text>
                  </View>
                  <Text style={styles.roundtableGameText} numberOfLines={2}>{game.game}</Text>
                </Pressable>
              ))}
            </ScrollView>
          )}

          {roundtableLoading && (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color={Colors.gold} />
              <Text style={styles.loadingText}>The roundtable is heating up...</Text>
            </View>
          )}

          {roundtableDialogue.length > 0 && !roundtableLoading && (
            <View style={styles.roundtableBox}>
              <Text style={{ color: Colors.gold, fontSize: 12, fontWeight: "700" as const, letterSpacing: 1, marginBottom: 12 }}>
                {roundtableGame?.game}
              </Text>
              {roundtableDialogue.map((line, idx) => {
                const allPersonas = [...PERSONAS, ...RACING_PERSONAS, ...SOCCER_PERSONAS];
                const persona = allPersonas.find((p) => p.id === line.personaId);
                const color = persona?.color || "#D4A420";
                return (
                  <View key={idx} style={styles.roundtableLine}>
                    {persona && (
                      <Image source={persona.image} style={[styles.roundtableAvatar, { borderColor: color }]} />
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.roundtableName, { color }]}>{persona?.name || line.personaId}</Text>
                      <Text style={styles.roundtableText}>{line.text}</Text>
                    </View>
                    {persona && (
                      <Pressable
                        onPress={() => handleSpeak(line.text, line.personaId, 99000 + idx)}
                        style={({ pressed }) => [{ padding: 4 }, pressed && { opacity: 0.5 }]}
                      >
                        <Ionicons name="volume-high" size={14} color={color} />
                      </Pressable>
                    )}
                  </View>
                );
              })}
              <Pressable
                onPress={() => roundtableGame && fetchRoundtable(roundtableGame)}
                style={({ pressed }) => [styles.roundtableRefreshBtn, pressed && { opacity: 0.7 }]}
              >
                <Ionicons name="refresh" size={14} color={Colors.gold} />
                <Text style={{ color: Colors.gold, fontSize: 11, fontWeight: "700" as const }}>NEW ROUND (1 TOKEN)</Text>
              </Pressable>
            </View>
          )}
        </Animated.View>}

        {sportsTab === "dc-royal" && (
          <DCRoyalTab
            personas={activePersonaList}
            personaImages={PERSONA_IMAGES}
            completedGames={completedGames}
            tallies={tallies}
            deviceId={deviceId}
            playClick={playClick}
            onSpeak={handleSpeak}
            refreshBalance={refreshBalance}
            voiceSettings={personaVoiceSettings}
            onUpdateVoiceSetting={updatePersonaVoiceSetting}
          />
        )}

        {sportsTab === "shop" && <Animated.View entering={FadeInDown.delay(700).duration(400)} style={styles.section}>
          <Text style={styles.sectionLabel}>GEAR UP</Text>
          <Text style={styles.shopQuote}>
            {AMAZON_PICKS[selectedPersona]?.quote || AMAZON_PICKS.trump.quote}
          </Text>
          <View style={styles.amazonGrid}>
            {(AMAZON_PICKS[selectedPersona]?.items || AMAZON_PICKS.trump.items).map((item, idx) => (
              <Pressable
                key={idx}
                onPress={() => handleAffiliate(item.url)}
                style={({ pressed }) => [styles.amazonCard, pressed && { opacity: 0.8 }]}
              >
                <MaterialCommunityIcons name={item.icon as any} size={24} color={activePersona.color} />
                <Text style={styles.amazonCardTitle}>{item.label}</Text>
                <Text style={styles.amazonCardSub}>{item.sub}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable
            onPress={() => handleAffiliate(AMAZON_PICKS[selectedPersona]?.mainUrl || AMAZON_PICKS.trump.mainUrl)}
            style={({ pressed }) => [styles.amazonMainBtn, pressed && { opacity: 0.8 }]}
          >
            <MaterialCommunityIcons name="shopping" size={18} color="#000" />
            <Text style={styles.amazonMainBtnText}>
              Shop {activePersona.name}'s Picks on Amazon
            </Text>
          </Pressable>
        </Animated.View>}

        {sportsTab === "debate" && !featuredGame && (
          <View style={[styles.emptyBox, { marginTop: 20, marginHorizontal: 16 }]}>
            <MaterialCommunityIcons name="emoticon-sad-outline" size={40} color="rgba(255,255,255,0.2)" />
            <Text style={styles.emptyText}>No debates available right now. Check back when games are live!</Text>
          </View>
        )}
      </ScrollView>

      <Modal visible={showAllTimeBoard} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.85)", justifyContent: "center", alignItems: "center", padding: 20 }}>
          <View style={{ backgroundColor: "#1a1a2e", borderRadius: 16, padding: 20, width: "100%", maxWidth: 400, maxHeight: "70%", borderWidth: 1, borderColor: "#FFD700" }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 16 }}>
              <Ionicons name="trophy" size={24} color="#FFD700" />
              <Text style={{ color: "#FFD700", fontSize: 18, fontWeight: "900" as const, letterSpacing: 1 }}>ALL-TIME RECORDS</Text>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {allTimeStats.length === 0 ? (
                <Text style={{ color: "#888", textAlign: "center", fontSize: 14, marginVertical: 20 }}>No records yet. Start picking winners!</Text>
              ) : (
                allTimeStats.map((stat, idx) => {
                  const persona = [...PERSONAS, ...RACING_PERSONAS, ...SOCCER_PERSONAS].find(p => p.id === stat.persona_id);
                  const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : "";
                  return (
                    <View key={stat.persona_id} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.08)", gap: 10 }}>
                      <Text style={{ color: "#FFD700", fontSize: 14, fontWeight: "800" as const, width: 28 }}>{medal || `#${idx + 1}`}</Text>
                      {persona?.image && <Image source={persona.image} style={{ width: 32, height: 32, borderRadius: 16 }} />}
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: "#fff", fontSize: 14, fontWeight: "700" as const }}>{persona?.name || stat.persona_id}</Text>
                        <Text style={{ color: "#aaa", fontSize: 11 }}>{stat.players || 0} player{Number(stat.players) !== 1 ? "s" : ""}</Text>
                      </View>
                      <View style={{ alignItems: "flex-end" }}>
                        <Text style={{ color: Number(stat.total_wins) >= Number(stat.total_losses) ? "#4CAF50" : "#FF5252", fontSize: 14, fontWeight: "800" as const }}>
                          {stat.total_wins}W - {stat.total_losses}L
                        </Text>
                        {Number(stat.best_streak) > 0 && (
                          <Text style={{ color: "#FFD700", fontSize: 10, fontWeight: "700" as const }}>Best: {stat.best_streak}W streak</Text>
                        )}
                      </View>
                    </View>
                  );
                })
              )}
            </ScrollView>
            <Pressable
              onPress={() => setShowAllTimeBoard(false)}
              style={({ pressed }) => [{ marginTop: 16, paddingVertical: 10, borderRadius: 8, backgroundColor: pressed ? "rgba(255,215,0,0.2)" : "transparent", borderWidth: 1, borderColor: "#FFD700", alignItems: "center" }]}
            >
              <Text style={{ color: "#FFD700", fontWeight: "700" as const, fontSize: 14 }}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
      <SoundToggle />
      <ViralShareCard
        visible={viralShareVisible}
        onClose={() => setViralShareVisible(false)}
        category="sports"
        headline={viralShareData.headline}
        quote={viralShareData.quote}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0a0a",
  },
  sportsTabBar: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    padding: 3,
  },
  sportsTabItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 10,
    borderRadius: 10,
  },
  sportsTabItemActive: {
    backgroundColor: "rgba(212,164,32,0.2)",
    borderWidth: 1,
    borderColor: "rgba(212,164,32,0.4)",
  },
  sportsTabLabel: {
    fontSize: 10,
    fontWeight: "800" as const,
    color: "rgba(255,255,255,0.4)",
    letterSpacing: 0.5,
  },
  sportsTabLabelActive: {
    color: Colors.gold,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(212,164,32,0.15)",
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  musicToggle: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  musicToggleActive: {
    backgroundColor: "rgba(212,164,32,0.15)",
    borderColor: "rgba(212,164,32,0.3)",
  },
  musicToggleText: {
    fontSize: 9,
    fontWeight: "800" as const,
    color: "rgba(255,255,255,0.4)",
    letterSpacing: 0.5,
  },
  headerCenter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "800" as const,
    color: "#FFD700",
    letterSpacing: 1.5,
  },
  scrollView: {
    flex: 1,
  },
  worldCupCard: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(76,175,80,0.3)",
    padding: 16,
    alignItems: "center",
  },
  wcHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 4,
  },
  wcTitle: {
    fontSize: 18,
    fontWeight: "900" as const,
    color: "#FFD700",
    letterSpacing: 2,
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
  },
  wcSubtitle: {
    fontSize: 11,
    fontWeight: "600" as const,
    color: "rgba(255,255,255,0.6)",
    letterSpacing: 3,
    marginBottom: 12,
  },
  wcCountdownRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 12,
  },
  wcCountdownUnit: {
    alignItems: "center",
    backgroundColor: "rgba(76,175,80,0.15)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 50,
  },
  wcCountdownNum: {
    fontSize: 22,
    fontWeight: "900" as const,
    color: "#4CAF50",
  },
  wcCountdownLabel: {
    fontSize: 8,
    fontWeight: "700" as const,
    color: "rgba(255,255,255,0.4)",
    letterSpacing: 1,
    marginTop: 2,
  },
  wcCountdownSep: {
    fontSize: 20,
    fontWeight: "900" as const,
    color: "rgba(255,255,255,0.3)",
  },
  wcTrumpQuote: {
    fontSize: 11,
    color: "rgba(255,215,0,0.6)",
    textAlign: "center",
    fontStyle: "italic",
    lineHeight: 16,
  },
  personaSelector: {
    paddingTop: 16,
    paddingHorizontal: 16,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700" as const,
    color: "#D4A420",
    letterSpacing: 2,
    marginBottom: 12,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  aiBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(76,175,80,0.15)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  aiDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#4CAF50",
  },
  aiBadgeText: {
    fontSize: 9,
    fontWeight: "800" as const,
    color: "#4CAF50",
    letterSpacing: 1,
  },
  personaRow: {
    gap: 10,
    paddingRight: 16,
  },
  personaItem: {
    alignItems: "center",
    width: 64,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    paddingVertical: 8,
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  personaThumb: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2,
    marginBottom: 4,
  },
  personaLabel: {
    fontSize: 10,
    fontWeight: "600" as const,
    color: "rgba(255,255,255,0.6)",
    textAlign: "center",
  },
  section: {
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  loadingBox: {
    alignItems: "center",
    paddingVertical: 40,
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: "rgba(255,255,255,0.4)",
  },
  emptyBox: {
    alignItems: "center",
    paddingVertical: 40,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    color: "rgba(255,255,255,0.4)",
  },
  gameCard: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  gameHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  leagueBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
  },
  leagueText: {
    fontSize: 11,
    fontWeight: "800" as const,
    color: "#fff",
    letterSpacing: 1,
  },
  gameTime: {
    fontSize: 12,
    color: "rgba(255,255,255,0.5)",
    fontWeight: "500" as const,
  },
  gameTitle: {
    fontSize: 18,
    fontWeight: "700" as const,
    color: "#fff",
    marginBottom: 4,
  },
  gameScore: {
    fontSize: 14,
    fontWeight: "700" as const,
    color: "#4CAF50",
    marginBottom: 4,
  },
  gameOdds: {
    fontSize: 12,
    color: "rgba(255,255,255,0.4)",
    marginBottom: 14,
    fontWeight: "500" as const,
  },
  pickLoadingBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 16,
    justifyContent: "center",
  },
  pickLoadingText: {
    fontSize: 13,
    fontWeight: "600" as const,
    fontStyle: "italic",
  },
  pickSection: {
    borderLeftWidth: 3,
    paddingLeft: 12,
    marginBottom: 12,
  },
  pickHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  pickAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  pickName: {
    fontSize: 12,
    fontWeight: "700" as const,
    letterSpacing: 0.5,
  },
  pickValue: {
    fontSize: 15,
    fontWeight: "800" as const,
    color: "#FFD700",
    marginTop: 1,
  },
  confidenceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  confidenceText: {
    fontSize: 12,
    fontWeight: "800" as const,
  },
  pickReasoning: {
    fontSize: 13,
    color: "rgba(255,255,255,0.7)",
    lineHeight: 19,
    fontStyle: "italic",
  },
  listenBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  listenBtnText: {
    fontSize: 12,
    fontWeight: "700" as const,
    letterSpacing: 1,
  },
  liveBadge: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 4,
    backgroundColor: "rgba(255,68,68,0.2)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,68,68,0.4)",
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#FF4444",
  },
  liveText: {
    fontSize: 10,
    fontWeight: "800" as const,
    color: "#FF4444",
    letterSpacing: 1,
  },
  upcomingBadge: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 3,
    backgroundColor: "rgba(255,165,0,0.15)",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,165,0,0.3)",
  },
  upcomingText: {
    fontSize: 9,
    fontWeight: "800" as const,
    color: "#FFA500",
    letterSpacing: 0.5,
  },
  commentarySection: {
    marginTop: 10,
    gap: 8,
  },
  commentaryBtn: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: 8,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  commentaryBtnText: {
    fontSize: 12,
    fontWeight: "700" as const,
    letterSpacing: 1,
  },
  commentaryBox: {
    backgroundColor: "rgba(0,0,0,0.4)",
    borderRadius: 10,
    padding: 12,
    borderLeftWidth: 3,
  },
  commentaryHeader: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 8,
    marginBottom: 8,
  },
  commentaryAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
  },
  commentaryLabel: {
    fontSize: 11,
    fontWeight: "700" as const,
    letterSpacing: 0.5,
  },
  commentarySpeakBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  commentaryText: {
    fontSize: 13,
    color: "rgba(255,255,255,0.85)",
    lineHeight: 19,
    fontStyle: "italic" as const,
  },
  debateCard: {
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(212,164,32,0.2)",
    padding: 16,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  debateGradient: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
  },
  debateGame: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: "#FFD700",
    textAlign: "center",
    marginBottom: 10,
  },
  debatePickText: {
    fontSize: 11,
    fontWeight: "700" as const,
    color: "#FFD700",
    textAlign: "center",
    marginBottom: 6,
  },
  h2hRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 16,
    paddingVertical: 6,
    backgroundColor: "rgba(212,164,32,0.1)",
    borderRadius: 8,
  },
  h2hLabel: {
    fontSize: 10,
    fontWeight: "700" as const,
    color: "#D4A420",
    letterSpacing: 1,
  },
  h2hRecord: {
    fontSize: 12,
    fontWeight: "600" as const,
    color: "rgba(255,255,255,0.7)",
  },
  debateContenders: {
    flexDirection: "row",
    gap: 8,
  },
  debateContender: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  debateAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    marginBottom: 8,
  },
  debateName: {
    fontSize: 14,
    fontWeight: "700" as const,
    marginBottom: 6,
  },
  debateRef: {
    fontSize: 11,
    color: "rgba(255,255,255,0.6)",
    textAlign: "center",
    lineHeight: 15,
    marginBottom: 6,
    fontStyle: "italic",
  },
  debateTrash: {
    fontSize: 10,
    color: "rgba(255,255,255,0.45)",
    textAlign: "center",
    lineHeight: 14,
    marginBottom: 8,
  },
  debateVoteBtn: {
    width: "100%",
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 34,
  },
  debateVoteBtnText: {
    fontSize: 12,
    fontWeight: "800" as const,
    color: "#fff",
    letterSpacing: 1,
  },
  vsContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  vsBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  vsText: {
    fontSize: 13,
    fontWeight: "900" as const,
    color: "#000",
  },
  affiliateDisclaimer: {
    fontSize: 10,
    color: "rgba(255,255,255,0.3)",
    marginBottom: 12,
  },
  affiliateRow: {
    flexDirection: "row",
    gap: 12,
  },
  affiliateBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  affiliateBtnText: {
    fontSize: 15,
    fontWeight: "800" as const,
    color: "#000",
    letterSpacing: 0.5,
  },
  shopQuote: {
    fontSize: 12,
    color: "rgba(255,215,0,0.6)",
    fontStyle: "italic",
    marginBottom: 14,
    lineHeight: 18,
  },
  amazonGrid: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  amazonCard: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    gap: 6,
  },
  amazonCardTitle: {
    fontSize: 11,
    fontWeight: "700" as const,
    color: "#fff",
    textAlign: "center",
  },
  amazonCardSub: {
    fontSize: 9,
    color: "rgba(255,255,255,0.4)",
    textAlign: "center",
  },
  amazonMainBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: "#FF9900",
  },
  amazonMainBtnText: {
    fontSize: 14,
    fontWeight: "800" as const,
    color: "#000",
    letterSpacing: 0.5,
  },
  leagueTab: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  leagueTabText: {
    fontSize: 10,
    fontWeight: "700" as const,
    color: "rgba(255,255,255,0.4)",
    letterSpacing: 1,
  },
  roundtableGameBtn: {
    width: 140,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  roundtableGameText: {
    fontSize: 11,
    fontWeight: "600" as const,
    color: "rgba(255,255,255,0.8)",
  },
  roundtableBox: {
    marginTop: 12,
    padding: 16,
    borderRadius: 12,
    backgroundColor: "rgba(212,164,32,0.05)",
    borderWidth: 1,
    borderColor: "rgba(212,164,32,0.15)",
  },
  roundtableLine: {
    flexDirection: "row" as const,
    alignItems: "flex-start" as const,
    gap: 8,
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  roundtableAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  roundtableName: {
    fontSize: 11,
    fontWeight: "800" as const,
    letterSpacing: 0.5,
  },
  roundtableText: {
    fontSize: 12,
    color: "rgba(255,255,255,0.75)",
    lineHeight: 17,
    marginTop: 2,
  },
  roundtableRefreshBtn: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(212,164,32,0.3)",
    marginTop: 4,
  },
  tallySection: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  tallyCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    padding: 14,
    overflow: "hidden" as const,
  },
  tallyHeader: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 12,
  },
  tallyAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
  },
  tallyTitle: {
    fontSize: 11,
    fontWeight: "900" as const,
    color: "#fff",
    letterSpacing: 1.5,
  },
  tallyScoreRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 8,
    marginTop: 2,
  },
  tallyScore: {
    fontSize: 20,
    fontWeight: "900" as const,
    letterSpacing: 1,
  },
  streakBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  trashTalkRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 8,
    marginTop: 10,
  },
  trashTalkText: {
    flex: 1,
    fontSize: 13,
    color: "rgba(255,255,255,0.85)",
    fontStyle: "italic" as const,
    borderLeftWidth: 3,
    paddingLeft: 10,
    lineHeight: 18,
  },
  pickTeamRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 6,
    marginTop: 8,
    marginBottom: 4,
  },
  pickTeamLabel: {
    fontSize: 9,
    fontWeight: "800" as const,
    color: "rgba(255,255,255,0.5)",
    letterSpacing: 1,
  },
  pickTeamBtn: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: 4,
  },
  pickTeamText: {
    fontSize: 10,
    fontWeight: "600" as const,
    color: "rgba(255,255,255,0.6)",
    textAlign: "center" as const,
  },
  resultCard: {
    backgroundColor: "rgba(76,175,80,0.05)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(76,175,80,0.15)",
    padding: 14,
    marginBottom: 8,
  },
  resultScore: {
    fontSize: 16,
    fontWeight: "800" as const,
    color: "#fff",
    marginTop: 4,
    letterSpacing: 0.5,
  },
  winnerRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 6,
    marginTop: 6,
  },
  winnerText: {
    fontSize: 12,
    fontWeight: "800" as const,
    color: "#FFD700",
    letterSpacing: 0.5,
  },
  statsContainer: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(212,164,32,0.2)",
    paddingTop: 12,
    gap: 12,
  },
  statsHeaderRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 6,
    marginBottom: 4,
  },
  statsHeaderText: {
    fontSize: 11,
    fontWeight: "900" as const,
    color: Colors.gold,
    letterSpacing: 1.5,
  },
  teamStatsBlock: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  teamStatsHeader: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 8,
    marginBottom: 10,
  },
  teamDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.gold,
  },
  teamStatsTitle: {
    fontSize: 13,
    fontWeight: "900" as const,
    color: "#fff",
    letterSpacing: 1,
    textTransform: "uppercase" as const,
    flex: 1,
  },
  teamStatsSubtitle: {
    fontSize: 9,
    fontWeight: "700" as const,
    color: "rgba(212,164,32,0.6)",
    letterSpacing: 1,
  },
  leaderRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
    gap: 10,
  },
  leaderRank: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(212,164,32,0.15)",
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  leaderRankText: {
    fontSize: 10,
    fontWeight: "800" as const,
    color: Colors.gold,
  },
  leaderHeadshot: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 2,
    borderColor: "rgba(212,164,32,0.2)",
  },
  leaderHeadshotPlaceholder: {
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  leaderInfo: {
    flex: 1,
    gap: 2,
  },
  leaderCategory: {
    fontSize: 10,
    fontWeight: "700" as const,
    color: "rgba(212,164,32,0.7)",
    letterSpacing: 0.5,
    textTransform: "uppercase" as const,
  },
  leaderPlayer: {
    fontSize: 14,
    fontWeight: "800" as const,
    color: "#fff",
  },
  leaderValueBox: {
    backgroundColor: "rgba(212,164,32,0.12)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    minWidth: 44,
    alignItems: "center" as const,
  },
  leaderValue: {
    fontSize: 16,
    fontWeight: "900" as const,
    color: Colors.gold,
    textAlign: "center" as const,
  },
  teamStatSection: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
    paddingTop: 8,
  },
  teamStatSectionLabel: {
    fontSize: 9,
    fontWeight: "800" as const,
    color: "rgba(255,255,255,0.4)",
    letterSpacing: 1,
    marginBottom: 6,
  },
  teamStatRow: {
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
    gap: 6,
  },
  statPill: {
    backgroundColor: "rgba(212,164,32,0.1)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: "center" as const,
    borderWidth: 1,
    borderColor: "rgba(212,164,32,0.12)",
    minWidth: 52,
  },
  statPillLabel: {
    fontSize: 9,
    fontWeight: "700" as const,
    color: "rgba(255,255,255,0.45)",
    letterSpacing: 0.5,
    textTransform: "uppercase" as const,
  },
  statPillValue: {
    fontSize: 13,
    fontWeight: "900" as const,
    color: "#fff",
    marginTop: 2,
  },
  parodyBanner: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  parodyText: {
    fontSize: 10,
    fontWeight: "600" as const,
    color: "rgba(255,255,255,0.5)",
    flex: 1,
    letterSpacing: 0.3,
  },
  parodyPickDisclaimer: {
    fontSize: 9,
    fontWeight: "700" as const,
    color: "rgba(255,255,255,0.3)",
    letterSpacing: 0.5,
    marginTop: 6,
    textAlign: "center" as const,
    fontStyle: "italic" as const,
  },
  allPicksSection: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
  },
  allPicksLabel: {
    fontSize: 10,
    fontWeight: "800" as const,
    color: "rgba(255,255,255,0.4)",
    letterSpacing: 1.5,
    marginBottom: 8,
    textAlign: "center" as const,
  },
  allPicksGrid: {
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
    gap: 6,
    justifyContent: "center" as const,
  },
  allPicksItem: {
    alignItems: "center" as const,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 8,
    minWidth: 70,
    maxWidth: 90,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  allPicksAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    marginBottom: 3,
  },
  allPicksName: {
    fontSize: 9,
    fontWeight: "700" as const,
    marginBottom: 2,
  },
  allPicksPick: {
    fontSize: 10,
    fontWeight: "800" as const,
    color: "#fff",
    textAlign: "center" as const,
  },
  allPicksConf: {
    fontSize: 9,
    fontWeight: "700" as const,
    marginTop: 1,
  },
  nameInputSection: {
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  nameInputCard: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(212,164,32,0.15)",
    padding: 10,
  },
  nameInputRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 8,
  },
  nameInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600" as const,
    color: "#fff",
    paddingVertical: 4,
  },
  nameConfirmText: {
    fontSize: 10,
    fontWeight: "600" as const,
    color: "rgba(212,164,32,0.6)",
    marginTop: 4,
    fontStyle: "italic" as const,
  },
  bgLogo: {
    position: "absolute" as const,
    width: "80%" as any,
    height: "80%" as any,
    top: "10%" as any,
    left: "10%" as any,
    opacity: 0.04,
  },
  tokenBadge: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 3,
    backgroundColor: "rgba(212,164,32,0.15)",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "rgba(212,164,32,0.3)",
  },
  tokenBadgeText: {
    fontSize: 11,
    fontWeight: "800" as const,
    color: Colors.gold,
  },
  recapBtn: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  recapBtnText: {
    fontSize: 13,
    fontWeight: "700" as const,
    letterSpacing: 0.5,
  },
  recapBox: {
    backgroundColor: "rgba(0,0,0,0.3)",
    borderRadius: 10,
    padding: 14,
    marginTop: 12,
    borderLeftWidth: 3,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  recapHeader: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 10,
    marginBottom: 10,
  },
});

const ageGateStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.95)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  card: {
    backgroundColor: "#1a1a1a",
    borderWidth: 3,
    borderColor: "#ff4d4d",
    borderRadius: 20,
    padding: 30,
    maxWidth: 400,
    width: "100%",
    alignItems: "center",
  },
  icon: {
    fontSize: 64,
    marginBottom: 15,
  },
  title: {
    color: "#ff4d4d",
    fontSize: 26,
    fontWeight: "800" as const,
    marginBottom: 15,
    textAlign: "center",
  },
  message: {
    color: "#ccc",
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 10,
  },
  ageWarning: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700" as const,
    textAlign: "center",
    marginBottom: 25,
  },
  buttons: {
    width: "100%",
    gap: 12,
  },
  btn: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 50,
  },
  confirmBtn: {
    backgroundColor: "#ff4d4d",
  },
  denyBtn: {
    backgroundColor: "#333",
    borderWidth: 1,
    borderColor: "#ff4d4d",
  },
  btnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700" as const,
  },
  disclaimer: {
    fontSize: 11,
    color: "#888",
    textAlign: "center",
    marginTop: 20,
    lineHeight: 16,
  },
});
