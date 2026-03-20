import React, { useState, useCallback, useEffect, useRef, useMemo } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  Platform,
  Image,
  Dimensions,
  Modal,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import Animated, {
  FadeInDown,
  FadeInUp,
  FadeIn,
  SlideInRight,
  SlideOutLeft,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
  withDelay,
  interpolate,
  Easing,
} from "react-native-reanimated";
import Colors from "@/constants/colors";
import { shareContent } from "@/lib/track-share";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

type Industry = "pharma" | "prisons" | "politics" | "healthcare" | "military" | "lobbying" | "welfare" | "tech" | "media" | "energy";

interface Choice {
  text: string;
  profit: number;
  karma: number;
  karmaLabel: string;
  consequence: string;
  industry: Industry;
}

interface Scenario {
  id: string;
  title: string;
  description: string;
  icon: string;
  industry: Industry;
  tier: number;
  choices: Choice[];
}

interface GameState {
  netWorth: number;
  karma: number;
  turn: number;
  empire: string[];
  headlines: string[];
  darkDeals: number;
  politiciansBought: number;
  livesAffected: number;
}

const INDUSTRY_COLORS: Record<Industry, string> = {
  pharma: "#9333EA",
  prisons: "#DC2626",
  politics: "#2563EB",
  healthcare: "#059669",
  military: "#D97706",
  lobbying: "#7C3AED",
  welfare: "#0891B2",
  tech: "#6366F1",
  media: "#EC4899",
  energy: "#84CC16",
};

const INDUSTRY_ICONS: Record<Industry, string> = {
  pharma: "medkit",
  prisons: "lock-closed",
  politics: "flag",
  healthcare: "heart",
  military: "shield",
  lobbying: "cash",
  welfare: "business",
  tech: "hardware-chip",
  media: "tv",
  energy: "flash",
};

function formatMoney(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const SCENARIOS: Scenario[] = [
  {
    id: "pharma1", title: "DRUG PRICING POWER", icon: "💊",
    description: "Your pharma startup owns the patent to a life-saving medication. Insurance won't cover it for most patients. You can set any price you want.",
    industry: "pharma", tier: 1,
    choices: [
      { text: "Price it at 50x production cost — patients will pay anything to live", profit: 15_000_000, karma: -25, karmaLabel: "PREDATORY", consequence: "Families go bankrupt paying for your drug. Profits soar. Congressional hearings loom but your lobbyists keep them at bay.", industry: "pharma" },
      { text: "Price reasonably with a patient assistance program", profit: 3_000_000, karma: 10, karmaLabel: "ETHICAL", consequence: "Patients can afford treatment. Your margins are modest but your reputation brings in new investors who trust your brand.", industry: "pharma" },
      { text: "Create a tiered system — gouge insurance, discount for uninsured", profit: 8_000_000, karma: -8, karmaLabel: "CALCULATED", consequence: "Insurance premiums rise across the board. You profit handsomely while maintaining plausible deniability about the human cost.", industry: "pharma" },
    ],
  },
  {
    id: "prison1", title: "PRIVATE PRISON CONTRACT", icon: "⛓️",
    description: "A state government offers you a contract to build and operate private prisons. The deal guarantees 90% occupancy rates — meaning the state promises to keep your prisons full.",
    industry: "prisons", tier: 1,
    choices: [
      { text: "Sign the contract — guaranteed revenue per inmate per day", profit: 20_000_000, karma: -30, karmaLabel: "RUTHLESS", consequence: "Your prisons profit from mass incarceration. You lobby for harsher sentencing laws to keep beds full. Families are torn apart.", industry: "prisons" },
      { text: "Decline — this business model profits from human suffering", profit: 0, karma: 20, karmaLabel: "PRINCIPLED", consequence: "You walk away from millions. Some call you a fool. But you sleep at night knowing you didn't profit from caging humans.", industry: "prisons" },
      { text: "Accept but invest in rehabilitation programs to reduce recidivism", profit: 12_000_000, karma: -5, karmaLabel: "COMPROMISE", consequence: "Your rehab programs are underfunded for PR. The occupancy clause still incentivizes incarceration. But it's better than nothing... right?", industry: "prisons" },
    ],
  },
  {
    id: "politics1", title: "BUYING A POLITICIAN", icon: "🏛️",
    description: "A key senator is up for re-election. A large 'donation' could secure favorable regulations for your businesses. The senator has hinted they'd be very 'appreciative.'",
    industry: "politics", tier: 1,
    choices: [
      { text: "Max out donations through PACs and dark money channels", profit: 25_000_000, karma: -20, karmaLabel: "CORRUPT", consequence: "The senator wins and passes regulations that crush your competitors. Democracy takes another hit. Your wealth grows exponentially.", industry: "politics" },
      { text: "Donate the legal maximum and nothing more", profit: 5_000_000, karma: 5, karmaLabel: "LAWFUL", consequence: "Your donation is public record. The senator helps where they can, but you don't own them. Fair play in a rigged game.", industry: "politics" },
      { text: "Fund a Super PAC that 'independently' supports the senator", profit: 18_000_000, karma: -15, karmaLabel: "SHADOWY", consequence: "Technically legal. Totally corrupt. The senator knows who butters their bread. Your industries get favorable treatment for years.", industry: "politics" },
    ],
  },
  {
    id: "health1", title: "HEALTHCARE PROFITEERING", icon: "🏥",
    description: "You've acquired a chain of hospitals in underserved communities. These are the only hospitals within 100 miles for many patients. You can restructure for profit.",
    industry: "healthcare", tier: 2,
    choices: [
      { text: "Close unprofitable ERs and focus on elective surgeries for the wealthy", profit: 35_000_000, karma: -35, karmaLabel: "HEARTLESS", consequence: "People die waiting for ambulances that now drive 100+ miles. Your surgical centers cater to medical tourists. Pure profit.", industry: "healthcare" },
      { text: "Keep all services running and apply for government subsidies", profit: 8_000_000, karma: 15, karmaLabel: "COMPASSIONATE", consequence: "The community keeps its hospital. Government subsidies cover most costs. You earn less but save lives daily.", industry: "healthcare" },
      { text: "Reduce services, keep the ER, charge facility fees on everything", profit: 22_000_000, karma: -18, karmaLabel: "EXPLOITATIVE", consequence: "Patients get surprise $5,000 bills for using 'your' ER. Collections agencies hound the poorest patients. Legal? Yes. Moral? You decide.", industry: "healthcare" },
    ],
  },
  {
    id: "military1", title: "DEFENSE CONTRACT BONANZA", icon: "🛡️",
    description: "The Pentagon wants a new weapons system. Your company can bid. The catch: you know the system doesn't work as advertised, but the contract is worth billions.",
    industry: "military", tier: 2,
    choices: [
      { text: "Bid aggressively — oversell capabilities, deal with problems later", profit: 50_000_000, karma: -28, karmaLabel: "WAR PROFITEER", consequence: "You win the contract. The system fails in testing but you've already been paid. Cost overruns are someone else's problem. Soldiers trust equipment that doesn't work.", industry: "military" },
      { text: "Bid honestly with realistic capabilities and timelines", profit: 15_000_000, karma: 12, karmaLabel: "HONEST", consequence: "You lose the big contract but win smaller ones on merit. Your reputation for reliability grows. Slower path but sustainable.", industry: "military" },
      { text: "Bid the contract, use profits to actually fix the technology", profit: 30_000_000, karma: -5, karmaLabel: "PRAGMATIC", consequence: "You oversell initially but pour resources into making it work. Eventually. Cost overruns hit taxpayers but the final product is decent.", industry: "military" },
    ],
  },
  {
    id: "lobby1", title: "THE LOBBYING MACHINE", icon: "💰",
    description: "Environmental regulations threaten your manufacturing plants. Compliance would cost $200M. Or you could spend $20M on lobbyists to gut the regulations entirely.",
    industry: "lobbying", tier: 2,
    choices: [
      { text: "Hire an army of lobbyists to kill the regulations", profit: 40_000_000, karma: -22, karmaLabel: "POLLUTER", consequence: "Regulations gutted. Your factories dump toxins freely. Cancer rates in nearby towns spike. You saved $180M. The EPA is defanged.", industry: "lobbying" },
      { text: "Invest in clean technology and comply with regulations", profit: -5_000_000, karma: 25, karmaLabel: "GREEN", consequence: "Expensive but your clean tech becomes a selling point. Environmental groups praise you. Long-term brand value increases.", industry: "lobbying" },
      { text: "Lobby for weaker regulations while making minimal compliance efforts", profit: 20_000_000, karma: -12, karmaLabel: "GREENWASHER", consequence: "You spend on PR campaigns about being 'green' while lobbying to weaken standards. The public is fooled. Pollution continues, just below the new weak limits.", industry: "lobbying" },
    ],
  },
  {
    id: "welfare1", title: "CORPORATE WELFARE KING", icon: "🏢",
    description: "Your company qualifies for massive tax breaks and government subsidies. You could structure deals to pay zero federal taxes while collecting billions in government contracts.",
    industry: "welfare", tier: 3,
    choices: [
      { text: "Exploit every loophole — hire the best tax lawyers", profit: 60_000_000, karma: -20, karmaLabel: "TAX DODGER", consequence: "Your effective tax rate: 0%. Schools and roads crumble. Your shareholders celebrate. A leaked report shows your janitors pay higher tax rates than your corporation.", industry: "welfare" },
      { text: "Pay a fair tax rate and reinvest in communities where you operate", profit: 10_000_000, karma: 20, karmaLabel: "CITIZEN", consequence: "You pay taxes like everyone else. Communities thrive. Your employees are loyal. But competitors who dodge taxes grow faster.", industry: "welfare" },
      { text: "Use tax havens offshore but fund a charitable foundation for optics", profit: 40_000_000, karma: -10, karmaLabel: "PHILANTHROPATH", consequence: "Billions sheltered in the Cayman Islands. Your foundation gets good press but donates a fraction of what you'd owe in taxes. The classic billionaire playbook.", industry: "welfare" },
    ],
  },
  {
    id: "pharma2", title: "OPIOID EMPIRE", icon: "💉",
    description: "Your pharmaceutical company has developed a highly addictive painkiller. Doctors are prescribing it widely. Reports of addiction are mounting but sales are astronomical.",
    industry: "pharma", tier: 3,
    choices: [
      { text: "Push doctors to prescribe more aggressively — fund 'pain awareness' campaigns", profit: 80_000_000, karma: -40, karmaLabel: "DEALER", consequence: "Addiction rates skyrocket. Entire communities are destroyed. Your sales reps earn bonuses per prescription. The bodies pile up while profits soar.", industry: "pharma" },
      { text: "Pull the drug and fund addiction treatment centers", profit: -20_000_000, karma: 30, karmaLabel: "REDEEMER", consequence: "You lose billions in revenue but save thousands of lives. The treatment centers you fund become models for the nation. History remembers you differently.", industry: "pharma" },
      { text: "Reformulate to be less addictive while maintaining sales", profit: 30_000_000, karma: -8, karmaLabel: "TOO LITTLE", consequence: "The reformulation helps somewhat but millions are already addicted to the original formula. You shift blame to 'street drugs' while collecting profits.", industry: "pharma" },
    ],
  },
  {
    id: "prison2", title: "IMMIGRANT DETENTION CENTERS", icon: "🚧",
    description: "The government needs facilities to detain immigrants. Your private prison company can build them fast. The conditions? That's up to your budget allocation.",
    industry: "prisons", tier: 3,
    choices: [
      { text: "Build bare-minimum facilities — maximize profit per detainee", profit: 45_000_000, karma: -35, karmaLabel: "INHUMANE", consequence: "Overcrowded facilities with inadequate food, medical care, and sanitation. Children separated from parents. You bill the government $750/person/day.", industry: "prisons" },
      { text: "Refuse the contract — detention for profit crosses a line", profit: 0, karma: 25, karmaLabel: "MORAL LINE", consequence: "You decline tens of millions. Your board is furious. Some investors leave. But you refused to profit from detaining families.", industry: "prisons" },
      { text: "Build decent facilities with proper oversight and transparency", profit: 20_000_000, karma: 0, karmaLabel: "LESSER EVIL", consequence: "Your facilities are better than most. Still, you profit from a system that detains people for seeking a better life. The moral math doesn't quite work out.", industry: "prisons" },
    ],
  },
  {
    id: "politics2", title: "SUPREME COURT SHOPPING", icon: "⚖️",
    description: "A Supreme Court vacancy opens up. You have connections to fund the campaign that will influence who gets nominated. The right justice could protect your business interests for decades.",
    industry: "politics", tier: 4,
    choices: [
      { text: "Pour $50M into dark money groups pushing your preferred nominee", profit: 100_000_000, karma: -30, karmaLabel: "KINGMAKER", consequence: "Your justice gets confirmed. For the next 30 years, the court rules in favor of corporations. Citizens United looks quaint compared to what comes next.", industry: "politics" },
      { text: "Stay out of judicial politics — it's a bridge too far", profit: 0, karma: 15, karmaLabel: "RESTRAINED", consequence: "You let the process play out without your thumb on the scale. The court may not favor you, but at least you didn't buy a justice.", industry: "politics" },
    ],
  },
  {
    id: "health2", title: "INSULIN PRICE CRISIS", icon: "💸",
    description: "Your company controls 40% of the insulin market. Diabetics will die without it. There's no generic alternative because you've patented incremental changes to block competitors.",
    industry: "healthcare", tier: 4,
    choices: [
      { text: "Raise prices 1,200% — they have no choice but to pay", profit: 120_000_000, karma: -45, karmaLabel: "LETHAL GREED", consequence: "People ration insulin and die. Others go bankrupt. Your stock price hits an all-time high. Congressional hearings produce outrage but no action — your lobbyists made sure.", industry: "healthcare" },
      { text: "Cap prices at $35/month and allow generic competition", profit: 5_000_000, karma: 30, karmaLabel: "LIFE SAVER", consequence: "Millions can afford their insulin. Your profits drop dramatically. Competitors flood the market. But no one dies because they couldn't afford your product.", industry: "healthcare" },
      { text: "Create a 'patient assistance' program while keeping prices high for insurers", profit: 70_000_000, karma: -20, karmaLabel: "SMOKE SCREEN", consequence: "The assistance program helps 5% of patients. The other 95% still pay inflated prices through insurance, which raises premiums for everyone. Great PR though.", industry: "healthcare" },
    ],
  },
  {
    id: "military2", title: "ARMS EXPORTS", icon: "✈️",
    description: "A foreign government with a questionable human rights record wants to buy your advanced weapons systems. The State Department hasn't blocked the sale... yet.",
    industry: "military", tier: 4,
    choices: [
      { text: "Sell everything — their human rights record isn't your problem", profit: 90_000_000, karma: -35, karmaLabel: "ARMS DEALER", consequence: "Your weapons are used in a conflict that kills thousands of civilians. Leaked cables show you knew. The profits are already banked.", industry: "military" },
      { text: "Decline the sale — some money isn't worth the blood", profit: 0, karma: 25, karmaLabel: "CONSCIENCE", consequence: "You lose a massive contract. Competitors fill the void. But your hands are clean. Your employees respect the decision.", industry: "military" },
      { text: "Sell 'defensive' systems only — no offensive weapons", profit: 40_000_000, karma: -10, karmaLabel: "GRAY AREA", consequence: "You sell radar and missile defense but not strike weapons. The distinction matters legally. Morally? The regime uses your 'defensive' tech to enable offensive operations.", industry: "military" },
    ],
  },
  {
    id: "tech1", title: "SURVEILLANCE CAPITALISM", icon: "👁️",
    description: "Your social media platform has 500 million users. You can sell their data to advertisers, political campaigns, and even foreign governments. They clicked 'agree' on the terms of service.",
    industry: "tech", tier: 2,
    choices: [
      { text: "Sell everything — browsing history, location data, private messages", profit: 55_000_000, karma: -25, karmaLabel: "BIG BROTHER", consequence: "Your data helps political campaigns micro-target vulnerable voters. Foreign intelligence services buy user data for pennies. Privacy is dead and you killed it.", industry: "tech" },
      { text: "Protect user data and build a privacy-first business model", profit: 8_000_000, karma: 20, karmaLabel: "PROTECTOR", consequence: "Users trust your platform. Growth is slower but organic. You can't sell data, so you innovate in other ways. A rare Silicon Valley unicorn with ethics.", industry: "tech" },
      { text: "Anonymize data before selling — technically protects individuals", profit: 35_000_000, karma: -10, karmaLabel: "TECHNICAL", consequence: "The 'anonymized' data is easily re-identified by sophisticated buyers. You know this but the legal fiction protects you. For now.", industry: "tech" },
    ],
  },
  {
    id: "energy1", title: "FOSSIL FUEL COVER-UP", icon: "🛢️",
    description: "Your energy company's own scientists confirmed that your products accelerate climate change 30 years ago. You buried the research. Now a journalist is asking questions.",
    industry: "energy", tier: 3,
    choices: [
      { text: "Fund climate denial think tanks and discredit the journalist", profit: 70_000_000, karma: -35, karmaLabel: "DENIER", consequence: "The cover-up holds for another decade. Billions more tons of CO2. Island nations start disappearing. Your stock price remains strong.", industry: "energy" },
      { text: "Come clean and pivot to renewable energy", profit: -10_000_000, karma: 30, karmaLabel: "TRUTH TELLER", consequence: "The admission costs billions in lawsuits. But your pivot to renewables positions you as a leader in the energy transition. History's verdict softens.", industry: "energy" },
      { text: "Acknowledge 'some concerns' while continuing fossil fuel operations", profit: 40_000_000, karma: -15, karmaLabel: "HALF-TRUTH", consequence: "You admit climate change is real but argue the transition should be 'gradual.' Your fossil fuel profits continue for decades. The planet doesn't have decades.", industry: "energy" },
    ],
  },
  {
    id: "media1", title: "MEDIA MANIPULATION", icon: "📺",
    description: "You've acquired a major news network. You can use it to shape public opinion on your other business interests. Truth is whatever you decide to broadcast.",
    industry: "media", tier: 4,
    choices: [
      { text: "Turn it into a propaganda machine for your business empire", profit: 85_000_000, karma: -30, karmaLabel: "PROPAGANDIST", consequence: "Your network attacks regulations that affect your businesses. Politicians who oppose you get smeared. Public discourse is poisoned. But your other companies thrive.", industry: "media" },
      { text: "Maintain editorial independence — a free press is sacred", profit: 5_000_000, karma: 25, karmaLabel: "GUARDIAN", consequence: "Your journalists investigate corruption — including in your own companies. It costs you, but democracy is a little healthier for it.", industry: "media" },
      { text: "Subtly bias coverage while maintaining an appearance of objectivity", profit: 50_000_000, karma: -18, karmaLabel: "PUPPET MASTER", consequence: "Viewers don't realize they're being manipulated. Your network 'accidentally' ignores stories that hurt your interests. The most dangerous propaganda looks like news.", industry: "media" },
    ],
  },
  {
    id: "lobby2", title: "WATER PRIVATIZATION", icon: "💧",
    description: "A drought-stricken region offers you rights to their water supply. You'd control the price of water for 3 million people.",
    industry: "lobbying", tier: 5,
    choices: [
      { text: "Buy the rights and charge market rates — water is a commodity", profit: 100_000_000, karma: -40, karmaLabel: "WATER BARON", consequence: "Poor families can't afford clean water. Disease outbreaks follow. Your shareholders celebrate record profits while people drink from contaminated sources.", industry: "lobbying" },
      { text: "Decline — water is a human right, not a business opportunity", profit: 0, karma: 30, karmaLabel: "HUMANITARIAN", consequence: "The region finds a public solution. It's not perfect but water remains accessible. You miss a fortune. Your humanity is intact.", industry: "lobbying" },
      { text: "Buy the rights but cap prices for low-income households", profit: 50_000_000, karma: -10, karmaLabel: "GATEKEEPER", consequence: "You control water for millions. The price caps help the poorest but everyone else pays premium. You've still commodified a basic human need.", industry: "lobbying" },
    ],
  },
  {
    id: "welfare2", title: "WORKER EXPLOITATION", icon: "🏭",
    description: "Your warehouses can save $500M/year by classifying workers as independent contractors. No benefits, no overtime, no protections. But they need the work.",
    industry: "welfare", tier: 5,
    choices: [
      { text: "Reclassify everyone — gig economy baby!", profit: 80_000_000, karma: -30, karmaLabel: "EXPLOITER", consequence: "Workers lose healthcare, retirement, and job security. Several die from overwork. Your stock hits record highs. The 'future of work' means no worker protections.", industry: "welfare" },
      { text: "Keep workers as employees with full benefits", profit: 5_000_000, karma: 20, karmaLabel: "FAIR EMPLOYER", consequence: "Your costs are higher but turnover drops. Workers are healthier and more productive. Competitors undercut you with exploited labor.", industry: "welfare" },
      { text: "Create a hybrid model — some 'flexibility' with minimal benefits", profit: 45_000_000, karma: -15, karmaLabel: "LOOPHOLER", consequence: "Your workers get the worst of both worlds — no security AND limited benefits. Lawyers designed it to be technically legal. Workers are trapped.", industry: "welfare" },
    ],
  },
  {
    id: "pharma3", title: "GENE THERAPY MONOPOLY", icon: "🧬",
    description: "Your biotech company has the only cure for a rare genetic disease. 50,000 children are affected worldwide. Treatment costs $10,000 to produce.",
    industry: "pharma", tier: 5,
    choices: [
      { text: "Price it at $2.1 million per treatment — they'll find the money", profit: 150_000_000, karma: -40, karmaLabel: "MONSTROUS", consequence: "Only children of the ultra-wealthy survive. Insurance companies refuse to cover it. GoFundMe pages appear for dying children. Your quarterly earnings beat expectations.", industry: "pharma" },
      { text: "Price at $50,000 and work with governments on universal access", profit: 10_000_000, karma: 30, karmaLabel: "HEALER", consequence: "Most children get treated. Your margins are thin but your company saves 40,000+ lives. The Nobel committee takes notice.", industry: "pharma" },
      { text: "Price at $500,000 with a lottery for free treatments to look charitable", profit: 80_000_000, karma: -20, karmaLabel: "SELECTIVE MERCY", consequence: "The 'lottery' treats 500 children per year. 49,500 others wait and hope. Your PR team wins awards for the charity program. The math doesn't add up.", industry: "pharma" },
    ],
  },
];

const TRUMP_REACTIONS = {
  dark: [
    "Now THAT'S how you make a billion! Morals are for losers!",
    "Beautiful. Ruthless. I would've done the SAME thing. Probably worse!",
    "Ethics? The only ethic I know is the W-I-N ethic!",
    "You remind me of a young... well, a young ME. And I'm TREMENDOUS.",
    "Cold-blooded deal. Very presidential. Very Trump.",
    "Some people say that's wrong. Those people are BROKE.",
  ],
  ethical: [
    "You walked away from MONEY? Are you FEELING okay?",
    "That was very... noble. Also very POOR. But noble!",
    "I respect it. I wouldn't DO it. But I respect it.",
    "Interesting strategy. Let me know when you can afford a gold toilet.",
    "Compassion is nice but have you tried WINNING instead?",
    "You're playing the long game. Very long. Might be TOO long.",
  ],
  neutral: [
    "Not bad, not bad. You're playing both sides. I invented that!",
    "A calculated move. Like when I said I'd release my taxes. Calculated!",
    "Smart but not BRILLIANT. Brilliant would be MY choice.",
    "You're hedging. I never hedge. Except in real estate. And politics. And golf.",
  ],
  billionaire: [
    "A BILLION DOLLARS! Welcome to MY club! Population: ME and now YOU!",
    "TREMENDOUS! You did it! Through deals that would make a senator blush!",
    "From nothing to EVERYTHING! That's the American dream, baby!",
    "You're officially too rich for consequences! Laws are for the POOR now!",
  ],
};

function getKarmaRating(karma: number): { label: string; color: string; icon: string } {
  if (karma >= 50) return { label: "SAINT", color: "#22C55E", icon: "heart" };
  if (karma >= 20) return { label: "DECENT HUMAN", color: "#4ADE80", icon: "happy" };
  if (karma >= 0) return { label: "MORALLY GRAY", color: "#F59E0B", icon: "help-circle" };
  if (karma >= -30) return { label: "ETHICALLY BANKRUPT", color: "#F97316", icon: "warning" };
  if (karma >= -60) return { label: "CORPORATE VILLAIN", color: "#EF4444", icon: "skull" };
  return { label: "BOND VILLAIN", color: "#DC2626", icon: "flame" };
}

function getTitle(netWorth: number): { label: string; emoji: string } {
  if (netWorth >= 1_000_000_000) return { label: "BILLIONAIRE", emoji: "👑" };
  if (netWorth >= 500_000_000) return { label: "HALF-BILLIONAIRE", emoji: "💎" };
  if (netWorth >= 100_000_000) return { label: "CENTIMILLIONAIRE", emoji: "🏰" };
  if (netWorth >= 50_000_000) return { label: "MEGA MOGUL", emoji: "🏗️" };
  if (netWorth >= 10_000_000) return { label: "MOGUL", emoji: "💰" };
  if (netWorth >= 5_000_000) return { label: "MILLIONAIRE", emoji: "📈" };
  return { label: "HUSTLER", emoji: "🎯" };
}

export default function GameScreen() {
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const webBottomInset = Platform.OS === "web" ? 34 : 0;
  const scrollRef = useRef<ScrollView>(null);

  const [gameState, setGameState] = useState<GameState>({
    netWorth: 1_000_000,
    karma: 0,
    turn: 0,
    empire: [],
    headlines: [],
    darkDeals: 0,
    politiciansBought: 0,
    livesAffected: 0,
  });

  const [currentScenario, setCurrentScenario] = useState<Scenario | null>(null);
  const [showConsequence, setShowConsequence] = useState(false);
  const [lastChoice, setLastChoice] = useState<Choice | null>(null);
  const [trumpQuote, setTrumpQuote] = useState("Welcome to TRUMP BILLIONAIRES! You start with $1M. Every choice has a PRICE. The question is: what are you willing to PAY?");
  const [gameWon, setGameWon] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [usedScenarios, setUsedScenarios] = useState<string[]>([]);
  const [choiceHistory, setChoiceHistory] = useState<{ scenario: string; choice: string; profit: number; karma: number }[]>([]);

  const karmaRating = getKarmaRating(gameState.karma);
  const titleInfo = getTitle(gameState.netWorth);
  const progress = Math.min(100, (gameState.netWorth / 1_000_000_000) * 100);

  const pulseAnim = useSharedValue(1);
  const glowAnim = useSharedValue(0);
  const rotateAnim = useSharedValue(0);

  useEffect(() => {
    pulseAnim.value = withRepeat(
      withSequence(withTiming(1.03, { duration: 1200 }), withTiming(1, { duration: 1200 })),
      -1, true
    );
    glowAnim.value = withRepeat(
      withSequence(withTiming(1, { duration: 2000 }), withTiming(0, { duration: 2000 })),
      -1, true
    );
    rotateAnim.value = withRepeat(
      withTiming(360, { duration: 20000, easing: Easing.linear }),
      -1, false
    );
  }, []);

  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulseAnim.value }] }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: interpolate(glowAnim.value, [0, 1], [0.3, 0.8]) }));
  const orbStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotateAnim.value}deg` }] }));

  const getNextScenario = useCallback(() => {
    const tier = gameState.netWorth < 5_000_000 ? 1
      : gameState.netWorth < 20_000_000 ? 2
      : gameState.netWorth < 100_000_000 ? 3
      : gameState.netWorth < 500_000_000 ? 4 : 5;

    const available = SCENARIOS.filter(s => !usedScenarios.includes(s.id) && s.tier <= tier + 1);
    if (available.length === 0) {
      setUsedScenarios([]);
      return pickRandom(SCENARIOS.filter(s => s.tier <= tier + 1));
    }
    const weighted = available.filter(s => s.tier === tier);
    return weighted.length > 0 ? pickRandom(weighted) : pickRandom(available);
  }, [gameState.netWorth, usedScenarios]);

  const startNextTurn = useCallback(() => {
    const scenario = getNextScenario();
    setCurrentScenario(scenario);
    setShowConsequence(false);
    setLastChoice(null);
    setUsedScenarios(prev => [...prev, scenario.id]);
    setGameState(prev => ({ ...prev, turn: prev.turn + 1 }));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setTimeout(() => scrollRef.current?.scrollTo({ y: 0, animated: true }), 100);
  }, [getNextScenario]);

  const makeChoice = useCallback((choice: Choice) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setLastChoice(choice);
    setShowConsequence(true);

    const newNetWorth = Math.max(0, gameState.netWorth + choice.profit);
    const reactionType = choice.karma <= -15 ? "dark" : choice.karma >= 10 ? "ethical" : "neutral";
    setTrumpQuote(pickRandom(TRUMP_REACTIONS[reactionType]));

    setGameState(prev => ({
      ...prev,
      netWorth: Math.max(0, prev.netWorth + choice.profit),
      karma: prev.karma + choice.karma,
      empire: choice.profit > 0 ? [...prev.empire, choice.industry] : prev.empire,
      headlines: [...prev.headlines, choice.consequence.substring(0, 60) + "..."],
      darkDeals: choice.karma < -10 ? prev.darkDeals + 1 : prev.darkDeals,
      politiciansBought: choice.industry === "politics" && choice.karma < 0 ? prev.politiciansBought + 1 : prev.politiciansBought,
      livesAffected: prev.livesAffected + Math.abs(choice.karma) * 1000,
    }));

    setChoiceHistory(prev => [...prev, {
      scenario: currentScenario?.title || "",
      choice: choice.text,
      profit: choice.profit,
      karma: choice.karma,
    }]);

    if (newNetWorth >= 1_000_000_000) {
      setTimeout(() => {
        setGameWon(true);
        setTrumpQuote(pickRandom(TRUMP_REACTIONS.billionaire));
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }, 2000);
    }
  }, [gameState, currentScenario]);

  const handleReset = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setGameState({ netWorth: 1_000_000, karma: 0, turn: 0, empire: [], headlines: [], darkDeals: 0, politiciansBought: 0, livesAffected: 0 });
    setCurrentScenario(null);
    setShowConsequence(false);
    setLastChoice(null);
    setUsedScenarios([]);
    setChoiceHistory([]);
    setTrumpQuote("NEW GAME! Fresh start. $1M. Will you sell your SOUL this time?");
    setGameWon(false);
    setShowSummary(false);
  }, []);

  const handleShare = useCallback(() => {
    const darkPercent = choiceHistory.length > 0 ? Math.round((choiceHistory.filter(c => c.karma < -10).length / choiceHistory.length) * 100) : 0;
    const shareText = `🎮 TRUMP BILLIONAIRES\n\n${titleInfo.emoji} ${titleInfo.label}\n💰 Net Worth: ${formatMoney(gameState.netWorth)}\n${karmaRating.icon === "heart" ? "❤️" : karmaRating.icon === "skull" ? "💀" : "⚡"} Moral Rating: ${karmaRating.label}\n🎭 Dark Deals: ${gameState.darkDeals}\n🏛️ Politicians Bought: ${gameState.politiciansBought}\n👥 Lives Affected: ${gameState.livesAffected.toLocaleString()}\n📊 ${darkPercent}% ruthless choices\n\n${gameWon ? "I reached $1 BILLION! 👑" : `Turn ${gameState.turn} — still climbing!`}\n\n👉 Play at chat-djt.replit.app`;
    shareContent({ text: shareText, feature: "game" });
  }, [gameState, titleInfo, karmaRating, choiceHistory, gameWon]);

  const industryBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    gameState.empire.forEach(i => { counts[i] = (counts[i] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [gameState.empire]);

  if (!currentScenario && !gameWon) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
        <LinearGradient colors={["#0a0a14", "#000", "#140a0a"]} style={StyleSheet.absoluteFillObject} />
        <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + webBottomInset + 30 }]} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Pressable onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={22} color={Colors.gold} />
            </Pressable>
            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle}>TRUMP BILLIONAIRES</Text>
            </View>
            <Pressable onPress={handleShare} style={styles.shareBtn}>
              <Ionicons name="share-outline" size={20} color={Colors.gold} />
            </Pressable>
          </View>

          <Animated.View entering={FadeInDown.duration(600)} style={styles.introCard}>
            <LinearGradient colors={["#1a1408", "#0a0a04"]} style={StyleSheet.absoluteFillObject} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
            <View style={{ position: "absolute", top: -30, right: -30, width: 120, height: 120, borderRadius: 60, backgroundColor: "rgba(212,164,32,0.06)" }} />
            <View style={{ position: "absolute", bottom: -20, left: -20, width: 80, height: 80, borderRadius: 40, backgroundColor: "rgba(255,77,77,0.05)" }} />

            <Animated.View style={[orbStyle, { position: "absolute", top: 10, right: 10, width: 60, height: 60 }]}>
              <Text style={{ fontSize: 40 }}>💰</Text>
            </Animated.View>

            <Text style={{ fontSize: 48, textAlign: "center", marginBottom: 8 }}>🏛️</Text>
            <Text style={{ color: Colors.gold, fontSize: 22, fontWeight: "900", textAlign: "center", letterSpacing: 2 }}>THE PATH TO $1 BILLION</Text>
            <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, textAlign: "center", marginTop: 8, lineHeight: 19, paddingHorizontal: 10 }}>
              Every billionaire has secrets. Every fortune has a cost.{"\n"}How far will YOU go?
            </Text>

            <View style={{ marginTop: 20, gap: 8 }}>
              {[
                { icon: "💊", label: "Pharmaceutical exploitation" },
                { icon: "⛓️", label: "Private prison profiteering" },
                { icon: "🏛️", label: "Buying politicians" },
                { icon: "🏥", label: "Healthcare manipulation" },
                { icon: "🛡️", label: "Military-industrial complex" },
                { icon: "💰", label: "Corporate lobbying" },
                { icon: "🏭", label: "Worker exploitation" },
              ].map((item, i) => (
                <Animated.View key={i} entering={FadeInDown.delay(200 + i * 80).duration(300)} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <Text style={{ fontSize: 18 }}>{item.icon}</Text>
                  <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 13 }}>{item.label}</Text>
                </Animated.View>
              ))}
            </View>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(600).duration(400)}>
            <View style={styles.trumpQuoteCard}>
              <Image source={require("@/assets/images/trump-avatar.jpg")} style={styles.trumpAvatar} />
              <View style={{ flex: 1 }}>
                <Text style={styles.trumpQuoteText}>"{trumpQuote}"</Text>
              </View>
            </View>
          </Animated.View>

          {gameState.turn > 0 && (
            <Animated.View entering={FadeInDown.delay(300).duration(400)}>
              <View style={styles.statsCard}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{formatMoney(gameState.netWorth)}</Text>
                  <Text style={styles.statLabel}>NET WORTH</Text>
                </View>
                <View style={[styles.statDivider]} />
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: karmaRating.color }]}>{gameState.karma}</Text>
                  <Text style={styles.statLabel}>KARMA</Text>
                </View>
                <View style={[styles.statDivider]} />
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{gameState.turn}</Text>
                  <Text style={styles.statLabel}>DEALS</Text>
                </View>
              </View>
            </Animated.View>
          )}

          <Animated.View entering={FadeInDown.delay(800).duration(400)}>
            <Pressable onPress={startNextTurn} style={({ pressed }) => [styles.startBtn, pressed && { transform: [{ scale: 0.97 }], opacity: 0.8 }]}>
              <LinearGradient colors={[Colors.gold, Colors.goldDark || "#B8860B"]} style={styles.startBtnGradient}>
                <Text style={styles.startBtnText}>{gameState.turn === 0 ? "BEGIN YOUR RISE" : "NEXT DEAL"}</Text>
                <Text style={{ color: "rgba(0,0,0,0.5)", fontSize: 11, fontWeight: "700", marginTop: 2 }}>
                  {gameState.turn === 0 ? "Start with $1M — reach $1B" : `Turn ${gameState.turn + 1} — ${formatMoney(1_000_000_000 - gameState.netWorth)} to go`}
                </Text>
              </LinearGradient>
            </Pressable>
          </Animated.View>

          {gameState.turn > 0 && (
            <Pressable onPress={handleReset} style={{ alignSelf: "center", marginTop: 16, padding: 10 }}>
              <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 12 }}>Reset Game</Text>
            </Pressable>
          )}
        </ScrollView>
      </View>
    );
  }

  if (gameWon) {
    const darkPercent = choiceHistory.length > 0 ? Math.round((choiceHistory.filter(c => c.karma < -10).length / choiceHistory.length) * 100) : 0;
    return (
      <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
        <LinearGradient colors={["#1a1408", "#000", "#0a1408"]} style={StyleSheet.absoluteFillObject} />
        <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + webBottomInset + 30 }]} showsVerticalScrollIndicator={false}>
          <Animated.View entering={FadeInDown.duration(800)}>
            <View style={{ alignItems: "center", paddingTop: 30, paddingBottom: 20 }}>
              <Text style={{ fontSize: 64 }}>👑</Text>
              <Text style={{ color: Colors.gold, fontSize: 32, fontWeight: "900", letterSpacing: 3, marginTop: 10 }}>BILLIONAIRE</Text>
              <Animated.Text style={[{ color: "#fff", fontSize: 42, fontWeight: "900", marginTop: 8 }, pulseStyle]}>
                {formatMoney(gameState.netWorth)}
              </Animated.Text>
            </View>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(300).duration(600)}>
            <View style={styles.trumpQuoteCard}>
              <Image source={require("@/assets/images/trump-avatar.jpg")} style={styles.trumpAvatar} />
              <View style={{ flex: 1 }}>
                <Text style={styles.trumpQuoteText}>"{trumpQuote}"</Text>
              </View>
            </View>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(500).duration(600)}>
            <LinearGradient colors={["rgba(255,255,255,0.05)", "rgba(255,255,255,0.02)"]} style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>YOUR BILLIONAIRE PROFILE</Text>

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Moral Rating</Text>
                <Text style={[styles.summaryValue, { color: karmaRating.color }]}>{karmaRating.label}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Karma Score</Text>
                <Text style={[styles.summaryValue, { color: gameState.karma >= 0 ? "#22C55E" : "#EF4444" }]}>{gameState.karma}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Deals Made</Text>
                <Text style={styles.summaryValue}>{gameState.turn}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Dark Deals</Text>
                <Text style={[styles.summaryValue, { color: "#EF4444" }]}>{gameState.darkDeals}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Politicians Bought</Text>
                <Text style={[styles.summaryValue, { color: "#7C3AED" }]}>{gameState.politiciansBought}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Lives Affected</Text>
                <Text style={styles.summaryValue}>{gameState.livesAffected.toLocaleString()}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Ruthless Choices</Text>
                <Text style={[styles.summaryValue, { color: "#F97316" }]}>{darkPercent}%</Text>
              </View>

              {industryBreakdown.length > 0 && (
                <View style={{ marginTop: 16 }}>
                  <Text style={[styles.summaryTitle, { fontSize: 12, marginBottom: 8 }]}>EMPIRE BREAKDOWN</Text>
                  {industryBreakdown.map(([ind, count]) => (
                    <View key={ind} style={{ flexDirection: "row", alignItems: "center", marginBottom: 6, gap: 8 }}>
                      <Ionicons name={(INDUSTRY_ICONS[ind as Industry] || "business") as any} size={14} color={INDUSTRY_COLORS[ind as Industry] || "#888"} />
                      <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, flex: 1, textTransform: "capitalize" }}>{ind}</Text>
                      <View style={{ backgroundColor: (INDUSTRY_COLORS[ind as Industry] || "#888") + "30", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 }}>
                        <Text style={{ color: INDUSTRY_COLORS[ind as Industry] || "#888", fontSize: 11, fontWeight: "800" }}>{count}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </LinearGradient>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(700).duration(400)} style={{ gap: 10 }}>
            <Pressable onPress={handleShare} style={({ pressed }) => [styles.startBtn, pressed && { opacity: 0.8 }]}>
              <LinearGradient colors={[Colors.gold, Colors.goldDark || "#B8860B"]} style={styles.startBtnGradient}>
                <Text style={styles.startBtnText}>SHARE YOUR EMPIRE</Text>
              </LinearGradient>
            </Pressable>
            <Pressable onPress={handleReset} style={({ pressed }) => [styles.resetBtn, pressed && { opacity: 0.7 }]}>
              <Text style={styles.resetBtnText}>PLAY AGAIN — DIFFERENT CHOICES</Text>
            </Pressable>
          </Animated.View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <LinearGradient colors={["#0a0a14", "#000"]} style={StyleSheet.absoluteFillObject} />

      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.gold} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>DEAL #{gameState.turn}</Text>
          <Text style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", fontWeight: "600" as const }}>
            {formatMoney(gameState.netWorth)} • {karmaRating.label}
          </Text>
        </View>
        <Pressable onPress={handleShare} style={styles.shareBtn}>
          <Ionicons name="share-outline" size={20} color={Colors.gold} />
        </Pressable>
      </View>

      <View style={styles.progressContainer}>
        <View style={styles.progressBg}>
          <LinearGradient
            colors={gameState.karma >= 0 ? ["#22C55E", Colors.gold] : ["#EF4444", "#D97706"]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={[styles.progressFill, { width: `${progress}%` as any }]}
          />
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
          <Text style={{ fontSize: 9, color: "rgba(255,255,255,0.3)" }}>{formatMoney(gameState.netWorth)}</Text>
          <Text style={{ fontSize: 9, color: "rgba(255,255,255,0.3)" }}>$1B GOAL</Text>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + webBottomInset + 30 }]}
        showsVerticalScrollIndicator={false}
      >
        {currentScenario && !showConsequence && (
          <Animated.View entering={SlideInRight.duration(400)}>
            <LinearGradient
              colors={[INDUSTRY_COLORS[currentScenario.industry] + "15", "rgba(0,0,0,0)"]}
              style={styles.scenarioCard}
            >
              <View style={{ position: "absolute", top: -1, left: 20, right: 20, height: 3, borderRadius: 2, backgroundColor: INDUSTRY_COLORS[currentScenario.industry] + "60" }} />

              <View style={styles.scenarioHeader}>
                <Text style={{ fontSize: 36 }}>{currentScenario.icon}</Text>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Text style={[styles.scenarioTitle, { color: INDUSTRY_COLORS[currentScenario.industry] }]}>{currentScenario.title}</Text>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
                    <Ionicons name={(INDUSTRY_ICONS[currentScenario.industry]) as any} size={12} color={INDUSTRY_COLORS[currentScenario.industry]} />
                    <Text style={{ fontSize: 10, color: INDUSTRY_COLORS[currentScenario.industry], fontWeight: "700", textTransform: "uppercase", letterSpacing: 1 }}>{currentScenario.industry}</Text>
                  </View>
                </View>
              </View>

              <Text style={styles.scenarioDesc}>{currentScenario.description}</Text>

              <View style={{ marginTop: 20, gap: 12 }}>
                {currentScenario.choices.map((choice, i) => {
                  const isProfit = choice.profit > 0;
                  const isDark = choice.karma <= -15;
                  const isGood = choice.karma >= 10;
                  const borderColor = isDark ? "#EF4444" : isGood ? "#22C55E" : "#F59E0B";
                  return (
                    <Animated.View key={i} entering={FadeInDown.delay(200 + i * 150).duration(300)}>
                      <Pressable
                        onPress={() => makeChoice(choice)}
                        style={({ pressed }) => [
                          styles.choiceBtn,
                          { borderColor: borderColor + "40", backgroundColor: borderColor + "08" },
                          pressed && { transform: [{ scale: 0.98 }], borderColor: borderColor + "80" },
                        ]}
                      >
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
                          <View style={[styles.karmaBadge, { backgroundColor: borderColor + "20", borderColor: borderColor + "40" }]}>
                            <Text style={[styles.karmaBadgeText, { color: borderColor }]}>{choice.karmaLabel}</Text>
                          </View>
                          {isProfit && (
                            <Text style={{ fontSize: 11, color: "#22C55E", fontWeight: "800" }}>+{formatMoney(choice.profit)}</Text>
                          )}
                          {choice.profit === 0 && (
                            <Text style={{ fontSize: 11, color: "#888", fontWeight: "800" }}>$0</Text>
                          )}
                          {choice.profit < 0 && (
                            <Text style={{ fontSize: 11, color: "#EF4444", fontWeight: "800" }}>{formatMoney(choice.profit)}</Text>
                          )}
                        </View>
                        <Text style={styles.choiceText}>{choice.text}</Text>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 }}>
                          <Ionicons name={choice.karma < 0 ? "arrow-down" : "arrow-up"} size={10} color={choice.karma < 0 ? "#EF4444" : "#22C55E"} />
                          <Text style={{ fontSize: 10, color: choice.karma < 0 ? "#EF4444" : "#22C55E", fontWeight: "700" }}>
                            {choice.karma > 0 ? "+" : ""}{choice.karma} karma
                          </Text>
                        </View>
                      </Pressable>
                    </Animated.View>
                  );
                })}
              </View>
            </LinearGradient>
          </Animated.View>
        )}

        {showConsequence && lastChoice && (
          <Animated.View entering={FadeIn.duration(500)}>
            <LinearGradient
              colors={lastChoice.karma < -10 ? ["rgba(239,68,68,0.12)", "rgba(0,0,0,0)"] : lastChoice.karma > 5 ? ["rgba(34,197,94,0.12)", "rgba(0,0,0,0)"] : ["rgba(245,158,11,0.12)", "rgba(0,0,0,0)"]}
              style={styles.consequenceCard}
            >
              <View style={styles.consequenceHeader}>
                <Text style={{ fontSize: 28 }}>{lastChoice.karma <= -15 ? "😈" : lastChoice.karma >= 10 ? "😇" : "🤔"}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.consequenceLabel, { color: lastChoice.karma <= -15 ? "#EF4444" : lastChoice.karma >= 10 ? "#22C55E" : "#F59E0B" }]}>
                    {lastChoice.karmaLabel}
                  </Text>
                  <View style={{ flexDirection: "row", gap: 12, marginTop: 4 }}>
                    <Text style={{ fontSize: 12, color: lastChoice.profit >= 0 ? "#22C55E" : "#EF4444", fontWeight: "800" }}>
                      {lastChoice.profit >= 0 ? "+" : ""}{formatMoney(lastChoice.profit)}
                    </Text>
                    <Text style={{ fontSize: 12, color: lastChoice.karma >= 0 ? "#22C55E" : "#EF4444", fontWeight: "800" }}>
                      {lastChoice.karma > 0 ? "+" : ""}{lastChoice.karma} karma
                    </Text>
                  </View>
                </View>
              </View>

              <Text style={styles.consequenceText}>{lastChoice.consequence}</Text>

              <View style={styles.trumpQuoteCard}>
                <Image source={require("@/assets/images/trump-avatar.jpg")} style={[styles.trumpAvatar, { width: 32, height: 32 }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.trumpQuoteText, { fontSize: 12 }]}>"{trumpQuote}"</Text>
                </View>
              </View>

              <View style={{ flexDirection: "row", gap: 12, marginTop: 16 }}>
                <View style={styles.miniStat}>
                  <Text style={styles.miniStatValue}>{formatMoney(gameState.netWorth)}</Text>
                  <Text style={styles.miniStatLabel}>NET WORTH</Text>
                </View>
                <View style={styles.miniStat}>
                  <Text style={[styles.miniStatValue, { color: karmaRating.color }]}>{gameState.karma}</Text>
                  <Text style={styles.miniStatLabel}>KARMA</Text>
                </View>
                <View style={styles.miniStat}>
                  <Text style={styles.miniStatValue}>{gameState.darkDeals}</Text>
                  <Text style={styles.miniStatLabel}>DARK DEALS</Text>
                </View>
              </View>

              <Pressable onPress={startNextTurn} style={({ pressed }) => [styles.startBtn, { marginTop: 20 }, pressed && { opacity: 0.8, transform: [{ scale: 0.97 }] }]}>
                <LinearGradient colors={[Colors.gold, Colors.goldDark || "#B8860B"]} style={styles.startBtnGradient}>
                  <Text style={styles.startBtnText}>NEXT DEAL</Text>
                  <Text style={{ color: "rgba(0,0,0,0.4)", fontSize: 10, fontWeight: "700" }}>
                    {formatMoney(1_000_000_000 - gameState.netWorth)} to go
                  </Text>
                </LinearGradient>
              </Pressable>
            </LinearGradient>
          </Animated.View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0a0a",
    ...Platform.select({
      web: { height: "100vh" as any, maxHeight: "100vh" as any, overflow: "hidden" as any },
    }),
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "rgba(212,164,32,0.12)",
    alignItems: "center", justifyContent: "center",
  },
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle: {
    fontSize: 18, fontWeight: "900" as const, color: Colors.gold, letterSpacing: 2,
  },
  shareBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "rgba(212,164,32,0.12)",
    alignItems: "center", justifyContent: "center",
  },
  scrollContent: {
    paddingHorizontal: 16,
    ...Platform.select({
      web: { maxWidth: 600, alignSelf: "center" as any, width: "100%" as any },
    }),
  },
  progressContainer: { paddingHorizontal: 16, marginBottom: 8 },
  progressBg: {
    height: 5, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.08)", overflow: "hidden",
  },
  progressFill: { height: "100%", borderRadius: 3 },
  introCard: {
    borderRadius: 20, padding: 24, marginBottom: 16,
    borderWidth: 1, borderColor: "rgba(212,164,32,0.2)",
    overflow: "hidden",
  },
  trumpQuoteCard: {
    flexDirection: "row", alignItems: "flex-start", gap: 10,
    marginBottom: 12, padding: 12,
    backgroundColor: "rgba(212,164,32,0.06)",
    borderRadius: 14, borderLeftWidth: 3, borderLeftColor: Colors.gold,
  },
  trumpAvatar: {
    width: 40, height: 40, borderRadius: 20,
    borderWidth: 2, borderColor: Colors.gold,
  },
  trumpQuoteText: {
    fontSize: 13, color: "#fff", fontStyle: "italic", lineHeight: 19,
  },
  statsCard: {
    flexDirection: "row", justifyContent: "space-around", alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 14,
    padding: 14, marginBottom: 16,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.06)",
  },
  statItem: { alignItems: "center", flex: 1 },
  statValue: {
    fontSize: 18, fontWeight: "900" as const, color: Colors.gold,
  },
  statLabel: {
    fontSize: 9, color: "rgba(255,255,255,0.4)", fontWeight: "700" as const,
    letterSpacing: 1, marginTop: 2,
  },
  statDivider: {
    width: 1, height: 30, backgroundColor: "rgba(255,255,255,0.08)",
  },
  startBtn: { borderRadius: 14, overflow: "hidden" },
  startBtnGradient: {
    paddingVertical: 16, alignItems: "center", justifyContent: "center", borderRadius: 14,
  },
  startBtnText: {
    fontSize: 16, fontWeight: "900" as const, color: "#000", letterSpacing: 1,
  },
  resetBtn: {
    paddingVertical: 14, alignItems: "center", borderRadius: 14,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
  },
  resetBtnText: {
    fontSize: 13, fontWeight: "800" as const, color: "rgba(255,255,255,0.4)", letterSpacing: 0.5,
  },
  scenarioCard: {
    borderRadius: 20, padding: 20, marginBottom: 16,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },
  scenarioHeader: {
    flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 14,
  },
  scenarioTitle: {
    fontSize: 16, fontWeight: "900" as const, letterSpacing: 0.5,
  },
  scenarioDesc: {
    fontSize: 14, color: "rgba(255,255,255,0.7)", lineHeight: 21,
  },
  choiceBtn: {
    borderRadius: 14, padding: 14, borderWidth: 1.5,
  },
  choiceText: {
    fontSize: 13, color: "#fff", lineHeight: 19, fontWeight: "600" as const,
  },
  karmaBadge: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1,
  },
  karmaBadgeText: {
    fontSize: 9, fontWeight: "900" as const, letterSpacing: 1,
  },
  consequenceCard: {
    borderRadius: 20, padding: 20, marginBottom: 16,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  consequenceHeader: {
    flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14,
  },
  consequenceLabel: {
    fontSize: 14, fontWeight: "900" as const, letterSpacing: 1,
  },
  consequenceText: {
    fontSize: 13, color: "rgba(255,255,255,0.7)", lineHeight: 20, marginBottom: 14,
  },
  miniStat: {
    flex: 1, alignItems: "center", backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 10, padding: 10,
  },
  miniStatValue: {
    fontSize: 14, fontWeight: "900" as const, color: Colors.gold,
  },
  miniStatLabel: {
    fontSize: 8, color: "rgba(255,255,255,0.3)", fontWeight: "700" as const,
    letterSpacing: 0.5, marginTop: 2,
  },
  summaryCard: {
    borderRadius: 16, padding: 20, marginBottom: 16,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  summaryTitle: {
    fontSize: 14, fontWeight: "900" as const, color: Colors.gold,
    letterSpacing: 1, marginBottom: 14,
  },
  summaryRow: {
    flexDirection: "row", justifyContent: "space-between",
    paddingVertical: 8, borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.04)",
  },
  summaryLabel: {
    fontSize: 13, color: "rgba(255,255,255,0.5)", fontWeight: "600" as const,
  },
  summaryValue: {
    fontSize: 13, fontWeight: "800" as const, color: "#fff",
  },
});
