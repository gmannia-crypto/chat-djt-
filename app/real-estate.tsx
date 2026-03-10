import React, { useState, useCallback, useEffect, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Platform,
  ScrollView,
  ActivityIndicator,
  Share,
  TextInput,
  Image,
  Dimensions,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { Audio } from "expo-av";
import { playTTS } from "@/lib/audio-helper";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  SlideInRight,
} from "react-native-reanimated";
import Colors from "@/constants/colors";
import { getApiUrl } from "@/lib/query-client";

interface Zone {
  id: string;
  name: string;
  score: number;
  category: string;
  color: string;
  occupancy: number;
  nightlyRate: number;
  revenueGrowth: number;
  seasonality: number;
  listings: number;
  avgRating: number;
}

interface TourMessage {
  id: string;
  role: "guide" | "user";
  text: string;
  guideName?: string;
}

interface PersonaComment {
  comment: string;
  rating: number;
}

interface Property {
  id: string | null;
  price: number;
  beds: number;
  baths: number;
  sqft: number;
  city: string;
  state: string;
  street: string;
  zip: string;
  img: string | null;
  status: string;
  url: string | null;
  yearBuilt: number | null;
  lotSize: number | null;
  pricePerSqFt: number | null;
  propertyType: string;
  dom: number | null;
  lat: number | null;
  lng: number | null;
  trumpComment: string;
  trumpRating: number;
  personaComments?: Record<string, PersonaComment>;
}

const ADVISOR_IMAGES: Record<string, any> = {
  trump: require("@/assets/images/persona-trump.png"),
  buffett: require("@/assets/images/persona-buffett.png"),
  suze: require("@/assets/images/persona-suze.png"),
  grandma: require("@/assets/images/persona-grandma.png"),
  musk: require("@/assets/images/persona-musk.png"),
  dave: require("@/assets/images/persona-dave.png"),
  mansa: require("@/assets/images/persona-mansa.png"),
  jordan: require("@/assets/images/persona-jordan.png"),
  bernie: require("@/assets/images/persona-bernie.png"),
  genie: require("@/assets/images/persona-genie.png"),
  ruckus: require("@/assets/images/persona-ruckus.png"),
};

const REAL_ESTATE_ADVISORS = [
  { id: "trump", name: "Trump", emoji: "\uD83D\uDDE3\uFE0F", color: "#ff4d4d", title: "45th & 47th President", stampLabel: "TRUMP APPROVED", image: ADVISOR_IMAGES.trump },
  { id: "buffett", name: "Buffett", emoji: "\uD83D\uDC74", color: "#4d4dff", title: "Oracle of Omaha", stampLabel: "BUFFETT ANALYZED", image: ADVISOR_IMAGES.buffett },
  { id: "suze", name: "Suze", emoji: "\uD83D\uDC69", color: "#ff99cc", title: "Personal Finance Expert", stampLabel: "SUZE REVIEWED", image: ADVISOR_IMAGES.suze },
  { id: "grandma", name: "Grandma", emoji: "\uD83D\uDC75", color: "#ffffff", title: "Voice of Experience", stampLabel: "GRANDMA APPROVED", image: ADVISOR_IMAGES.grandma },
  { id: "musk", name: "Elon", emoji: "\uD83D\uDE80", color: "#00ccff", title: "CEO of Tesla & SpaceX", stampLabel: "ELON RATED", image: ADVISOR_IMAGES.musk },
  { id: "dave", name: "Dave", emoji: "\uD83D\uDCFB", color: "#ffaa00", title: "Financial Peace", stampLabel: "DAVE GRADED", image: ADVISOR_IMAGES.dave },
  { id: "ruckus", name: "Ruckus", emoji: "\uD83D\uDE24", color: "#8B4513", title: "Contrarian Expert", stampLabel: "RUCKUS REJECTED", image: ADVISOR_IMAGES.ruckus },
];

const TOUR_GUIDES = [
  { id: "victor", name: "Victor Sterling", title: "The Dealmaker", emoji: "\uD83D\uDCBC", color: "#FFD700" },
  { id: "maya", name: "Dr. Maya Chen", title: "The Analyst", emoji: "\uD83D\uDCCA", color: "#00ccff" },
  { id: "tommy", name: "Tommy O'Brien", title: "The Local", emoji: "\uD83C\uDFD8\uFE0F", color: "#4ADE80" },
  { id: "sofia", name: "Sofia Rivera", title: "Airbnb Guru", emoji: "\uD83C\uDFE0", color: "#ff6b9d" },
  { id: "patricia", name: "Patricia Williams", title: "Family Advisor", emoji: "\uD83D\uDC6A", color: "#C084FC" },
];

const ZONE_LEGEND = [
  { label: "HOT ZONE (90-100%)", color: "#ff4d4d" },
  { label: "WARM ZONE (75-89%)", color: "#ffaa00" },
  { label: "STABLE ZONE (60-74%)", color: "#ffff00" },
  { label: "DEVELOPING (40-59%)", color: "#4d4dff" },
  { label: "AVOID (0-39%)", color: "#888888" },
];

const LENDERS = [
  { id: "quicken", name: "Quicken Loans", rate: "3.2% APR", perk: "$0 closing costs", btnText: "GET PRE-APPROVED", icon: "cash" as const, url: "https://www.quickenloans.com/" },
  { id: "better", name: "Better Mortgage", rate: "3.4% APR", perk: "$500 closing credit", btnText: "CHECK RATES", icon: "trending-up" as const, url: "https://better.com/" },
  { id: "rocket", name: "Rocket Mortgage", rate: "3.5% APR", perk: "5 min pre-approval", btnText: "GET STARTED", icon: "rocket" as const, url: "https://www.rocketmortgage.com/" },
];

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function RealEstateScreen() {
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const webBottomInset = Platform.OS === "web" ? 34 : 0;

  const [activeTab, setActiveTab] = useState<"zones" | "properties" | "tour">("zones");
  const [mapLocation, setMapLocation] = useState("Miami, FL");
  const [zones, setZones] = useState<Zone[]>([]);
  const [zonesLoading, setZonesLoading] = useState(false);
  const [selectedZone, setSelectedZone] = useState<Zone | null>(null);
  const [filters, setFilters] = useState<Record<string, boolean>>({ airbnb: true, nightly: false, seasonal: false, growth: false });
  const [dataLive, setDataLive] = useState(false);

  const [selectedGuide, setSelectedGuide] = useState("sofia");
  const [tourUserName, setTourUserName] = useState("");
  const [tourMessages, setTourMessages] = useState<TourMessage[]>([]);
  const [tourInput, setTourInput] = useState("");
  const [tourLoading, setTourLoading] = useState(false);
  const [tourSpeaking, setTourSpeaking] = useState(false);
  const tourSoundRef = useRef<Audio.Sound | null>(null);

  const [location, setLocation] = useState("");
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalResults, setTotalResults] = useState(0);
  const [searched, setSearched] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [selectedAdvisor, setSelectedAdvisor] = useState("trump");
  const [aiComments, setAiComments] = useState<Record<string, { comment: string; rating: number }>>({});
  const [aiLoading, setAiLoading] = useState<Record<string, boolean>>({});
  const soundRef = useRef<Audio.Sound | null>(null);

  const [calcOpen, setCalcOpen] = useState(false);
  const [homePrice, setHomePrice] = useState("300000");
  const [downPayment, setDownPayment] = useState("60000");
  const [interestRate, setInterestRate] = useState("6.5");
  const [loanTerm, setLoanTerm] = useState("30");
  const [calcResult, setCalcResult] = useState<{ monthly: number; total: number; interest: number; trumpComment: string } | null>(null);

  const activeAdvisor = REAL_ESTATE_ADVISORS.find((a) => a.id === selectedAdvisor) || REAL_ESTATE_ADVISORS[0];
  const activeGuide = TOUR_GUIDES.find((g) => g.id === selectedGuide) || TOUR_GUIDES[3];

  useEffect(() => {
    fetchZones();
  }, []);

  const fetchZones = useCallback(async (loc?: string) => {
    setZonesLoading(true);
    try {
      const activeFilters = Object.entries(filters).filter(([, v]) => v).map(([k]) => k).join(",");
      const baseUrl = getApiUrl().replace(/\/$/, "");
      const res = await fetch(`${baseUrl}/api/realty/zones?location=${encodeURIComponent(loc || mapLocation)}&filters=${activeFilters}`);
      if (res.ok) {
        const data = await res.json();
        setZones(data.zones || []);
      }
    } catch (err) {
      console.error("Zones fetch error:", err);
    } finally {
      setZonesLoading(false);
    }
  }, [mapLocation, filters]);

  const applyFilters = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    fetchZones();
  }, [fetchZones]);

  const updateMapLocation = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    fetchZones(mapLocation);
  }, [mapLocation, fetchZones]);

  const sendTourMessage = useCallback(async (msg?: string) => {
    const text = msg || tourInput.trim();
    if (!text) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTourInput("");
    const userMsg: TourMessage = { id: `user-${Date.now()}`, role: "user", text };
    setTourMessages((prev) => [...prev, userMsg]);
    setTourLoading(true);
    try {
      const baseUrl = getApiUrl().replace(/\/$/, "");
      const res = await fetch(`${baseUrl}/api/realty/tour`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guideId: selectedGuide, message: text, location: mapLocation, userName: tourUserName || "friend" }),
      });
      if (res.ok) {
        const data = await res.json();
        setTourMessages((prev) => [...prev, { id: `guide-${Date.now()}`, role: "guide", text: data.response, guideName: data.guideName }]);
      }
    } catch {}
    setTourLoading(false);
  }, [tourInput, selectedGuide, mapLocation, tourUserName]);

  const startTour = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setTourMessages([]);
    sendTourMessage(`Hi! I'm interested in real estate in ${mapLocation}. What should I know about investing here?`);
  }, [mapLocation, sendTourMessage]);

  const calculateMortgage = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const price = Math.max(0, parseFloat(homePrice) || 0);
    const down = Math.max(0, Math.min(price, parseFloat(downPayment) || 0));
    const rate = Math.max(0, Math.min(30, parseFloat(interestRate) || 6.5));
    const years = loanTerm === "15" ? 15 : 30;
    if (price <= 0) {
      setCalcResult({ monthly: 0, total: 0, interest: 0, trumpComment: "You gotta enter a home price! Even a tiny house costs SOMETHING." });
      return;
    }
    const loan = price - down;
    if (loan <= 0) {
      setCalcResult({ monthly: 0, total: 0, interest: 0, trumpComment: "You're paying CASH? Now THAT'S the art of the deal!" });
      return;
    }
    const monthlyRate = rate / 100 / 12;
    const numPayments = years * 12;
    const monthly = monthlyRate > 0
      ? (loan * monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / (Math.pow(1 + monthlyRate, numPayments) - 1)
      : loan / numPayments;
    const total = monthly * numPayments;
    const interest = total - loan;
    if (!Number.isFinite(monthly) || !Number.isFinite(total)) {
      setCalcResult({ monthly: 0, total: 0, interest: 0, trumpComment: "Those numbers don't add up! Try something more realistic." });
      return;
    }
    let trumpComment = "";
    const downPercent = price > 0 ? (down / price) * 100 : 0;
    if (monthly > 5000) trumpComment = "FIVE THOUSAND a month?! But winners pay big. I pay more for my HAIR.";
    else if (monthly > 2000) trumpComment = "Two grand a month? HIGH! But you can afford it. Great investment!";
    else if (monthly > 1000) trumpComment = "Around a thousand? REASONABLE. You're thinking like a winner.";
    else trumpComment = "LOW payment! The BEST payment! Lock that rate in and NEVER look back!";
    if (downPercent < 10) trumpComment += " But that down payment? WEAK. PMI is for LOSERS.";
    else if (downPercent >= 20) trumpComment += " And that down payment? STRONG. You negotiate like a TRUMP.";
    setCalcResult({ monthly: Math.round(monthly), total: Math.round(total), interest: Math.round(interest), trumpComment });
  }, [homePrice, downPayment, interestRate, loanTerm]);

  const getAiKey = useCallback((property: Property) => {
    const propId = property.id || `${property.price}_${property.city}_${property.street}`;
    return `${selectedAdvisor}_${propId}`;
  }, [selectedAdvisor]);

  const getPropertyComment = useCallback((property: Property): string => {
    const aiKey = getAiKey(property);
    if (aiComments[aiKey]) return aiComments[aiKey].comment;
    if (property.personaComments && property.personaComments[selectedAdvisor]) return property.personaComments[selectedAdvisor].comment;
    return property.trumpComment;
  }, [selectedAdvisor, aiComments, getAiKey]);

  const getPropertyRating = useCallback((property: Property): number => {
    const aiKey = getAiKey(property);
    if (aiComments[aiKey]) return aiComments[aiKey].rating;
    if (property.personaComments && property.personaComments[selectedAdvisor]) return property.personaComments[selectedAdvisor].rating;
    return property.trumpRating;
  }, [selectedAdvisor, aiComments, getAiKey]);

  const fetchAiAnalysis = useCallback(async (property: Property) => {
    const aiKey = getAiKey(property);
    if (aiComments[aiKey] || aiLoading[aiKey]) return;
    setAiLoading((prev) => ({ ...prev, [aiKey]: true }));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const baseUrl = getApiUrl().replace(/\/$/, "");
      const res = await fetch(`${baseUrl}/api/property-analysis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          property: { price: property.price, beds: property.beds, baths: property.baths, sqft: property.sqft, city: property.city, state: property.state, street: property.street, propertyType: property.propertyType, yearBuilt: property.yearBuilt, pricePerSqFt: property.pricePerSqFt, lotSize: property.lotSize, dom: property.dom },
          personaId: selectedAdvisor,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.comment) {
          setAiComments((prev) => ({ ...prev, [aiKey]: { comment: data.comment, rating: data.rating } }));
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      }
    } catch {} finally {
      setAiLoading((prev) => ({ ...prev, [aiKey]: false }));
    }
  }, [selectedAdvisor, aiComments, aiLoading, getAiKey]);

  const handleSearch = async () => {
    if (!location.trim() || location.trim().length < 2) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setLoading(true);
    setSearched(true);
    try {
      const baseUrl = getApiUrl();
      const res = await fetch(`${baseUrl}api/properties?location=${encodeURIComponent(location.trim())}`);
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      setProperties(data.properties || []);
      setTotalResults(data.totalResults || 0);
    } catch {
      setProperties([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSpeak = async (text: string, propId: string) => {
    if (speaking) {
      if (soundRef.current) { await soundRef.current.stopAsync(); await soundRef.current.unloadAsync(); soundRef.current = null; }
      setSpeaking(false);
      setSpeakingId(null);
      return;
    }
    setSpeaking(true);
    setSpeakingId(propId);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      const sound = await playTTS("/api/persona-speak", { text, personaId: selectedAdvisor });
      soundRef.current = sound;
      sound.setOnPlaybackStatusUpdate((status: any) => {
        if (status.didJustFinish) { setSpeaking(false); setSpeakingId(null); sound.unloadAsync(); soundRef.current = null; }
      });
    } catch { setSpeaking(false); setSpeakingId(null); }
  };

  const formatPrice = (price: number) => {
    if (price >= 1000000) return `$${(price / 1000000).toFixed(1)}M`;
    if (price >= 1000) return `$${(price / 1000).toFixed(0)}K`;
    return `$${price}`;
  };

  const handleViewListing = (url: string | null) => {
    if (!url) return;
    if (Platform.OS === "web") window.open(url, "_blank");
    else import("expo-linking").then((Linking) => Linking.openURL(url));
  };

  return (
    <View style={[s.container, Platform.OS === "web" && { maxHeight: "100vh" as any, overflow: "hidden" as any }]}>
      <LinearGradient colors={["#0a0a0a", "#1a0f00", "#0a0a0a"]} style={StyleSheet.absoluteFillObject} />

      <Animated.View entering={FadeInUp.duration(400)} style={[s.header, { paddingTop: insets.top + webTopInset + 8 }]}>
        <Pressable onPress={() => router.back()} style={s.backBtn} testID="back-button">
          <Ionicons name="arrow-back" size={22} color={Colors.gold} />
        </Pressable>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>TRUMP REALITY</Text>
          <Text style={s.headerSub}>AI-powered property intelligence</Text>
        </View>
        <View style={[s.liveBadge, dataLive && s.liveBadgeActive]}>
          <View style={[s.liveDot, { backgroundColor: dataLive ? "#4ADE80" : "#ff4d4d" }]} />
          <Text style={s.liveBadgeText}>{dataLive ? "LIVE" : "SAMPLE"}</Text>
        </View>
      </Animated.View>

      <View style={s.tabRow}>
        {(["zones", "properties", "tour"] as const).map((tab) => (
          <Pressable
            key={tab}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setActiveTab(tab); }}
            style={[s.tab, activeTab === tab && s.tabActive]}
          >
            <Ionicons
              name={tab === "zones" ? "analytics" : tab === "properties" ? "home" : "people"}
              size={16}
              color={activeTab === tab ? Colors.gold : "rgba(255,255,255,0.4)"}
            />
            <Text style={[s.tabText, activeTab === tab && s.tabTextActive]}>
              {tab === "zones" ? "HOT ZONES" : tab === "properties" ? "LISTINGS" : "TOUR GUIDE"}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView
        style={s.scrollBody}
        contentContainerStyle={{ paddingBottom: insets.bottom + webBottomInset + 30 }}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === "zones" && (
          <>
            <View style={s.mapSection}>
              <View style={s.legendBox}>
                {ZONE_LEGEND.map((z) => (
                  <View key={z.label} style={s.legendRow}>
                    <View style={[s.legendDot, { backgroundColor: z.color }]} />
                    <Text style={s.legendText}>{z.label}</Text>
                  </View>
                ))}
              </View>

              {Platform.OS === "web" && (
                <View style={s.mapFrame}>
                  <iframe
                    key={`map-${mapLocation}`}
                    width="100%"
                    height="250"
                    frameBorder="0"
                    style={{ border: 0, borderRadius: 12 } as any}
                    srcDoc={`<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"><\/script><style>body{margin:0}#map{width:100%;height:250px}</style></head><body><div id="map"></div><script>var map=L.map('map').setView([39.83,-98.58],4);L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'OSM'}).addTo(map);fetch('https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(mapLocation)}').then(function(r){return r.json()}).then(function(d){if(d&&d[0]){map.setView([parseFloat(d[0].lat),parseFloat(d[0].lon)],12);L.marker([parseFloat(d[0].lat),parseFloat(d[0].lon)]).addTo(map).bindPopup('${mapLocation.replace(/'/g, "\\'")}');}});<\/script></body></html>`}
                  />
                </View>
              )}
              {Platform.OS !== "web" && (
                <View style={s.mapPlaceholder}>
                  <Ionicons name="map" size={40} color="rgba(212,164,32,0.3)" />
                  <Text style={s.mapPlaceholderText}>Map view available on web</Text>
                </View>
              )}

              <View style={s.mapControls}>
                <TextInput
                  style={s.mapInput}
                  value={mapLocation}
                  onChangeText={setMapLocation}
                  placeholder="Enter city, state or zip"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  onSubmitEditing={updateMapLocation}
                  returnKeyType="search"
                />
                <Pressable onPress={updateMapLocation} style={({ pressed }) => [s.mapUpdateBtn, pressed && { opacity: 0.7 }]}>
                  <View style={s.mapUpdateGrad}>
                    <Ionicons name="location" size={16} color="#fff" />
                    <Text style={s.mapUpdateText}>UPDATE</Text>
                  </View>
                </Pressable>
              </View>
            </View>

            <View style={s.dashSection}>
              <View style={s.dashHeader}>
                <Ionicons name="analytics" size={18} color={Colors.gold} />
                <Text style={s.dashTitle}>AIRBNB HOT ZONES</Text>
                <Text style={s.dashNote}>(sample data)</Text>
              </View>

              {zonesLoading ? (
                <ActivityIndicator size="large" color={Colors.gold} style={{ marginVertical: 20 }} />
              ) : zones.length === 0 ? (
                <Text style={s.noZonesText}>No zones match your filters. Try adjusting.</Text>
              ) : (
                zones.map((zone, idx) => (
                  <Pressable
                    key={zone.id}
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSelectedZone(selectedZone?.id === zone.id ? null : zone); }}
                  >
                    <Animated.View entering={FadeInDown.delay(idx * 60).duration(300)} style={s.zoneCard}>
                      <View style={s.zoneHeader}>
                        <View style={[s.zoneScoreBadge, { backgroundColor: zone.color }]}>
                          <Text style={s.zoneScoreText}>{zone.score}</Text>
                        </View>
                        <View style={s.zoneNameCol}>
                          <Text style={s.zoneName}>{zone.name}</Text>
                          <Text style={[s.zoneCat, { color: zone.color }]}>{zone.category.toUpperCase()} ZONE</Text>
                        </View>
                        <Ionicons name={selectedZone?.id === zone.id ? "chevron-up" : "chevron-down"} size={16} color="rgba(255,255,255,0.4)" />
                      </View>
                      <View style={s.zoneStats}>
                        <View style={s.zoneStat}>
                          <Text style={s.zoneStatLabel}>OCCUPANCY</Text>
                          <Text style={[s.zoneStatVal, zone.occupancy > 70 && { color: "#4ADE80" }]}>{zone.occupancy}%</Text>
                        </View>
                        <View style={s.zoneStat}>
                          <Text style={s.zoneStatLabel}>AVG/NIGHT</Text>
                          <Text style={s.zoneStatVal}>${zone.nightlyRate}</Text>
                        </View>
                        <View style={s.zoneStat}>
                          <Text style={s.zoneStatLabel}>GROWTH</Text>
                          <Text style={[s.zoneStatVal, zone.revenueGrowth > 0 ? { color: "#4ADE80" } : { color: "#F87171" }]}>
                            {zone.revenueGrowth > 0 ? "+" : ""}{zone.revenueGrowth}%
                          </Text>
                        </View>
                        <View style={s.zoneStat}>
                          <Text style={s.zoneStatLabel}>LISTINGS</Text>
                          <Text style={s.zoneStatVal}>{zone.listings}</Text>
                        </View>
                      </View>
                      {selectedZone?.id === zone.id && (
                        <Animated.View entering={FadeIn.duration(200)} style={s.zoneDetail}>
                          <View style={s.zoneDetailRow}>
                            <Text style={s.zoneDetailLabel}>Seasonality Score</Text>
                            <Text style={s.zoneDetailVal}>{zone.seasonality}%</Text>
                          </View>
                          <View style={s.zoneDetailRow}>
                            <Text style={s.zoneDetailLabel}>Average Guest Rating</Text>
                            <Text style={s.zoneDetailVal}>{zone.avgRating} / 5.0</Text>
                          </View>
                          <View style={s.zoneDetailRow}>
                            <Text style={s.zoneDetailLabel}>Investment Score</Text>
                            <Text style={[s.zoneDetailVal, { color: zone.color, fontWeight: "900" as const }]}>{zone.score}/100</Text>
                          </View>
                        </Animated.View>
                      )}
                    </Animated.View>
                  </Pressable>
                ))
              )}
            </View>

            <View style={s.filterSection}>
              <Text style={s.filterTitle}>FILTER ZONES BY</Text>
              {([
                ["airbnb", "Airbnb Occupancy (>70%)"],
                ["nightly", "High Nightly Rate (>$200)"],
                ["seasonal", "Strong Seasonality"],
                ["growth", "Revenue Growth (+10% YoY)"],
              ] as const).map(([key, label]) => (
                <Pressable
                  key={key}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setFilters((p) => ({ ...p, [key]: !p[key] })); }}
                  style={s.filterRow}
                >
                  <View style={[s.checkbox, filters[key] && s.checkboxActive]}>
                    {filters[key] && <Ionicons name="checkmark" size={12} color="#000" />}
                  </View>
                  <Text style={s.filterLabel}>{label}</Text>
                </Pressable>
              ))}
              <Pressable onPress={applyFilters} style={({ pressed }) => [s.applyBtn, pressed && { opacity: 0.7 }]}>
                <View style={s.applyGrad}>
                  <Text style={s.applyText}>APPLY FILTERS</Text>
                </View>
              </Pressable>
            </View>

            <View style={s.lenderSection}>
              <View style={s.sectionHeader}>
                <Ionicons name="business" size={18} color={Colors.gold} />
                <Text style={s.sectionTitle}>LOCAL LENDERS</Text>
                <Text style={s.sectionNote}>(Affiliate Partners)</Text>
              </View>
              {LENDERS.map((lender) => (
                <View key={lender.id} style={s.lenderCard}>
                  <View style={s.lenderInfo}>
                    <Text style={s.lenderName}>{lender.name}</Text>
                    <Text style={s.lenderRate}>{lender.rate} {"\u2022"} {lender.perk}</Text>
                  </View>
                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      if (Platform.OS === "web") window.open(lender.url, "_blank");
                      else import("expo-linking").then((Linking) => Linking.openURL(lender.url));
                    }}
                    style={({ pressed }) => [s.lenderBtn, pressed && { opacity: 0.7 }]}
                  >
                    <View style={s.lenderBtnGrad}>
                      <Ionicons name={lender.icon} size={14} color="#fff" />
                      <Text style={s.lenderBtnText}>{lender.btnText}</Text>
                    </View>
                  </Pressable>
                </View>
              ))}
            </View>

            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setCalcOpen(!calcOpen);
              }}
              style={({ pressed }) => [s.calcToggleBtn, pressed && { opacity: 0.7 }]}
            >
              <MaterialCommunityIcons name="calculator-variant" size={18} color={Colors.gold} />
              <Text style={s.calcToggleText}>MORTGAGE CALCULATOR</Text>
              <Ionicons name={calcOpen ? "chevron-up" : "chevron-down"} size={16} color={Colors.gold} />
            </Pressable>

            {calcOpen && (
              <Animated.View entering={FadeInDown.duration(300)} style={s.calcSection}>
                <View style={s.calcRow}>
                  <View style={s.calcInputGroup}>
                    <Text style={s.calcLabel}>HOME PRICE</Text>
                    <View style={s.calcInputWrap}>
                      <Text style={s.calcDollar}>$</Text>
                      <TextInput style={s.calcInput} value={homePrice} onChangeText={setHomePrice} keyboardType="numeric" placeholder="300000" placeholderTextColor="rgba(255,255,255,0.2)" />
                    </View>
                  </View>
                  <View style={s.calcInputGroup}>
                    <Text style={s.calcLabel}>DOWN PAYMENT</Text>
                    <View style={s.calcInputWrap}>
                      <Text style={s.calcDollar}>$</Text>
                      <TextInput style={s.calcInput} value={downPayment} onChangeText={setDownPayment} keyboardType="numeric" placeholder="60000" placeholderTextColor="rgba(255,255,255,0.2)" />
                    </View>
                  </View>
                </View>
                <View style={s.calcRow}>
                  <View style={s.calcInputGroup}>
                    <Text style={s.calcLabel}>RATE %</Text>
                    <View style={s.calcInputWrap}>
                      <TextInput style={s.calcInput} value={interestRate} onChangeText={setInterestRate} keyboardType="decimal-pad" placeholder="6.5" placeholderTextColor="rgba(255,255,255,0.2)" />
                      <Text style={s.calcPercent}>%</Text>
                    </View>
                  </View>
                  <View style={s.calcInputGroup}>
                    <Text style={s.calcLabel}>TERM</Text>
                    <View style={s.calcTermRow}>
                      {["15", "30"].map((t) => (
                        <Pressable key={t} onPress={() => setLoanTerm(t)} style={[s.calcTermBtn, loanTerm === t && s.calcTermBtnActive]}>
                          <Text style={[s.calcTermText, loanTerm === t && s.calcTermTextActive]}>{t}yr</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                </View>
                <Pressable onPress={calculateMortgage} style={({ pressed }) => [s.calcButton, pressed && { opacity: 0.7 }]}>
                  <View style={s.calcBtnGrad}>
                    <MaterialCommunityIcons name="cash-multiple" size={18} color="#fff" />
                    <Text style={s.calcBtnText}>CALCULATE</Text>
                  </View>
                </Pressable>
                {calcResult && (
                  <Animated.View entering={FadeIn.duration(300)} style={s.calcResults}>
                    <View style={s.calcResultRow}>
                      <View style={s.calcResultItem}><Text style={s.calcResultLabel}>MONTHLY</Text><Text style={s.calcResultVal}>${calcResult.monthly.toLocaleString()}</Text></View>
                      <View style={s.calcResultItem}><Text style={s.calcResultLabel}>TOTAL</Text><Text style={s.calcResultValSm}>${calcResult.total.toLocaleString()}</Text></View>
                      <View style={s.calcResultItem}><Text style={s.calcResultLabel}>INTEREST</Text><Text style={[s.calcResultValSm, { color: "#F87171" }]}>${calcResult.interest.toLocaleString()}</Text></View>
                    </View>
                    <View style={s.calcQuote}>
                      <MaterialCommunityIcons name="format-quote-open" size={14} color={Colors.gold} />
                      <Text style={s.calcQuoteText}>{calcResult.trumpComment}</Text>
                    </View>
                  </Animated.View>
                )}
              </Animated.View>
            )}

            <View style={s.disclaimer}>
              <Text style={s.disclaimerText}>Sample data for demonstration. We may earn commissions from affiliate links. For entertainment purposes.</Text>
            </View>
          </>
        )}

        {activeTab === "properties" && (
          <>
            <Animated.View entering={FadeInDown.duration(400)} style={s.searchSection}>
              <View style={s.searchRow}>
                <TextInput
                  style={s.searchInput}
                  placeholder="Enter zip code or city..."
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  value={location}
                  onChangeText={setLocation}
                  onSubmitEditing={handleSearch}
                  returnKeyType="search"
                />
                <Pressable onPress={handleSearch} disabled={loading || !location.trim()} style={({ pressed }) => [s.searchBtn, pressed && { opacity: 0.7 }, (!location.trim() || loading) && { opacity: 0.4 }]}>
                  <View style={s.searchBtnGrad}>
                    {loading ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="search" size={20} color="#fff" />}
                  </View>
                </Pressable>
              </View>
              <Text style={s.searchHint}>Search by zip code (e.g. 90210) or city name</Text>
            </Animated.View>

            <View style={s.advisorSection}>
              <Text style={s.advisorLabel}>YOUR ADVISOR</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.advisorScroll}>
                {REAL_ESTATE_ADVISORS.map((advisor) => (
                  <Pressable
                    key={advisor.id}
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSelectedAdvisor(advisor.id); }}
                    style={[s.advisorPill, { borderColor: selectedAdvisor === advisor.id ? advisor.color : "rgba(255,255,255,0.1)", backgroundColor: selectedAdvisor === advisor.id ? `${advisor.color}20` : "rgba(255,255,255,0.05)" }]}
                  >
                    <Image source={advisor.image} style={[s.advisorImg, { borderColor: selectedAdvisor === advisor.id ? advisor.color : "rgba(255,255,255,0.2)" }]} />
                    <Text style={[s.advisorName, selectedAdvisor === advisor.id && { color: advisor.color }]}>{advisor.name}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            {loading && (
              <View style={s.loadingBox}>
                <ActivityIndicator size="large" color={Colors.gold} />
                <Text style={s.loadingText}>Scouting properties... The best properties.</Text>
              </View>
            )}

            {!loading && searched && properties.length === 0 && (
              <Animated.View entering={FadeIn.duration(400)} style={s.emptyState}>
                <FontAwesome5 name="hard-hat" size={40} color="rgba(212,164,32,0.4)" />
                <Text style={s.emptyTitle}>No Properties Found</Text>
                <Text style={s.emptyText}>Even Trump can't find deals there. Try another location!</Text>
              </Animated.View>
            )}

            {!loading && properties.map((item, index) => {
              const propId = item.id || `prop-${index}`;
              const isSpeakingThis = speakingId === propId;
              const comment = getPropertyComment(item);
              const rating = getPropertyRating(item);
              const isLoaded = !!aiComments[getAiKey(item)];
              const isFetching = !!aiLoading[getAiKey(item)];
              return (
                <Animated.View entering={FadeInDown.delay(index * 100).duration(400)} key={propId} style={s.propCard}>
                  <View style={s.propImgBox}>
                    {item.img ? (
                      <Image source={{ uri: item.img }} style={s.propImg} resizeMode="cover" />
                    ) : (
                      <View style={[s.propImg, s.propNoImg]}><FontAwesome5 name="home" size={40} color="rgba(212,164,32,0.3)" /></View>
                    )}
                    <View style={[s.propRating, { backgroundColor: `${activeAdvisor.color}CC` }]}>
                      <Text style={s.propRatingText}>{rating}%</Text>
                    </View>
                  </View>
                  <View style={s.propDetails}>
                    <Text style={s.propAddr} numberOfLines={2}>
                      {item.street ? `${item.street} — ${formatPrice(item.price)}` : `${item.city}, ${item.state} — ${formatPrice(item.price)}`}
                    </Text>
                    <Text style={s.propCity}>{item.city}, {item.state} {item.zip}</Text>
                    <View style={s.propStats}>
                      <Text style={s.propStatText}>{item.beds} bd</Text>
                      <Text style={s.propStatText}>{item.baths} ba</Text>
                      {item.sqft > 0 && <Text style={s.propStatText}>{item.sqft.toLocaleString()} sqft</Text>}
                    </View>
                    <View style={s.propQuote}>
                      {isLoaded && <View style={s.aiBadge}><Ionicons name="sparkles" size={10} color="#FFD700" /><Text style={s.aiBadgeText}>AI LIVE</Text></View>}
                      <Text style={[s.propCommentText, { borderLeftColor: activeAdvisor.color }]}>"{comment}"</Text>
                      {!isLoaded && (
                        <Pressable onPress={() => fetchAiAnalysis(item)} disabled={isFetching} style={[s.aiBtn, { borderColor: activeAdvisor.color }]}>
                          {isFetching ? <ActivityIndicator size="small" color={activeAdvisor.color} /> : <Ionicons name="sparkles" size={14} color={activeAdvisor.color} />}
                          <Text style={[s.aiBtnText, { color: activeAdvisor.color }]}>{isFetching ? "ANALYZING..." : `GET ${activeAdvisor.name.toUpperCase()}'S TAKE`}</Text>
                        </Pressable>
                      )}
                    </View>
                    <View style={s.propActions}>
                      <Pressable onPress={() => handleSpeak(comment, propId)} style={({ pressed }) => [s.propActionBtn, pressed && { opacity: 0.7 }]}>
                        <Ionicons name={isSpeakingThis ? "stop" : "volume-high"} size={14} color="#fff" />
                        <Text style={s.propActionText}>{isSpeakingThis ? "STOP" : "LISTEN"}</Text>
                      </Pressable>
                      {item.url && (
                        <Pressable onPress={() => handleViewListing(item.url)} style={({ pressed }) => [s.propActionBtn, s.propViewBtn, pressed && { opacity: 0.7 }]}>
                          <Ionicons name="open-outline" size={14} color={Colors.gold} />
                          <Text style={[s.propActionText, { color: Colors.gold }]}>VIEW</Text>
                        </Pressable>
                      )}
                    </View>
                  </View>
                </Animated.View>
              );
            })}

            {!searched && !loading && (
              <Animated.View entering={FadeIn.delay(200).duration(600)} style={s.emptyState}>
                <MaterialCommunityIcons name="city-variant" size={50} color="rgba(212,164,32,0.2)" />
                <Text style={s.emptyTitle}>Find Your Dream Deal</Text>
                <Text style={s.emptyText}>Search any neighborhood for Trump-rated property listings</Text>
              </Animated.View>
            )}
          </>
        )}

        {activeTab === "tour" && (
          <>
            <View style={s.tourSection}>
              <View style={s.sectionHeader}>
                <Ionicons name="people" size={18} color={Colors.gold} />
                <Text style={s.sectionTitle}>YOUR PERSONAL TOUR GUIDE</Text>
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.guideScroll}>
                {TOUR_GUIDES.map((guide) => (
                  <Pressable
                    key={guide.id}
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSelectedGuide(guide.id); }}
                    style={[s.guidePill, { borderColor: selectedGuide === guide.id ? guide.color : "rgba(255,255,255,0.1)", backgroundColor: selectedGuide === guide.id ? `${guide.color}20` : "rgba(255,255,255,0.05)" }]}
                  >
                    <Text style={s.guideEmoji}>{guide.emoji}</Text>
                    <View>
                      <Text style={[s.guideName, selectedGuide === guide.id && { color: guide.color }]}>{guide.name}</Text>
                      <Text style={s.guideTitle}>{guide.title}</Text>
                    </View>
                  </Pressable>
                ))}
              </ScrollView>

              <View style={s.tourStartRow}>
                <TextInput
                  style={s.tourNameInput}
                  value={tourUserName}
                  onChangeText={setTourUserName}
                  placeholder="Your name"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                />
                <Pressable onPress={startTour} style={({ pressed }) => [s.tourStartBtn, pressed && { opacity: 0.7 }]}>
                  <View style={s.tourStartGrad}>
                    <Ionicons name="mic" size={16} color="#fff" />
                    <Text style={s.tourStartText}>START TOUR</Text>
                  </View>
                </Pressable>
              </View>

              {tourMessages.length > 0 && (
                <View style={s.tourConvo}>
                  {tourMessages.map((msg) => (
                    <Animated.View
                      key={msg.id}
                      entering={SlideInRight.duration(300)}
                      style={[s.tourMsg, msg.role === "user" ? s.tourMsgUser : s.tourMsgGuide]}
                    >
                      {msg.role === "guide" && <Text style={s.tourMsgName}>{msg.guideName || activeGuide.name}</Text>}
                      <Text style={[s.tourMsgText, msg.role === "user" && { color: "#4ADE80" }]}>{msg.text}</Text>
                    </Animated.View>
                  ))}
                  {tourLoading && (
                    <View style={s.tourTyping}>
                      <ActivityIndicator size="small" color={Colors.gold} />
                      <Text style={s.tourTypingText}>{activeGuide.name} is thinking...</Text>
                    </View>
                  )}
                </View>
              )}

              {tourMessages.length > 0 && (
                <View style={s.tourInputRow}>
                  <TextInput
                    style={s.tourInput}
                    value={tourInput}
                    onChangeText={setTourInput}
                    placeholder="Ask a question..."
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    onSubmitEditing={() => sendTourMessage()}
                    returnKeyType="send"
                  />
                  <Pressable onPress={() => sendTourMessage()} disabled={!tourInput.trim() || tourLoading} style={({ pressed }) => [s.tourSendBtn, pressed && { opacity: 0.7 }]}>
                    <Ionicons name="send" size={18} color={!tourInput.trim() ? "rgba(255,255,255,0.3)" : Colors.gold} />
                  </Pressable>
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const RE_RED = "#ff4d4d";
const RE_BG = "#1a1a1a";
const RE_INPUT_BG = "#333333";

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 10 },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle: { fontSize: 24, fontWeight: "900" as const, color: RE_RED, letterSpacing: 2 },
  headerSub: { fontSize: 10, color: "#888", letterSpacing: 1, marginTop: 2 },
  liveBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, backgroundColor: RE_RED },
  liveBadgeActive: { backgroundColor: "#4ADE80" },
  liveDot: { width: 6, height: 6, borderRadius: 3 },
  liveBadgeText: { fontSize: 10, fontWeight: "800" as const, color: "#fff", letterSpacing: 1 },
  tabRow: { flexDirection: "row", paddingHorizontal: 12, gap: 6, marginBottom: 10 },
  tab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 10, backgroundColor: RE_BG, borderWidth: 2, borderColor: "rgba(255,255,255,0.08)" },
  tabActive: { backgroundColor: "rgba(255,77,77,0.12)", borderColor: RE_RED },
  tabText: { fontSize: 11, fontWeight: "700" as const, color: "rgba(255,255,255,0.4)", letterSpacing: 0.5 },
  tabTextActive: { color: RE_RED },
  scrollBody: { flex: 1 },
  mapSection: { marginHorizontal: 16, gap: 10, marginBottom: 16, backgroundColor: RE_BG, borderWidth: 2, borderColor: RE_RED, borderRadius: 15, padding: 16 },
  legendBox: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 8 },
  legendRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 18, height: 18, borderRadius: 4 },
  legendText: { fontSize: 12, fontWeight: "600" as const, color: "rgba(255,255,255,0.7)" },
  mapFrame: { borderRadius: 10, overflow: "hidden", marginBottom: 10 },
  mapPlaceholder: { height: 180, borderRadius: 10, backgroundColor: "#2a2a2a", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 10 },
  mapPlaceholderText: { fontSize: 12, color: "#888" },
  mapControls: { flexDirection: "row", gap: 10 },
  mapInput: { flex: 3, height: 44, backgroundColor: RE_INPUT_BG, borderRadius: 8, paddingHorizontal: 14, fontSize: 14, color: Colors.white, borderWidth: 2, borderColor: RE_RED },
  mapUpdateBtn: { flex: 1, borderRadius: 8, overflow: "hidden" },
  mapUpdateGrad: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, height: 44, justifyContent: "center", backgroundColor: RE_RED },
  mapUpdateText: { fontSize: 12, fontWeight: "800" as const, color: "#fff", letterSpacing: 0.5 },
  dashSection: { paddingHorizontal: 16, marginBottom: 16 },
  dashHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  dashTitle: { fontSize: 16, fontWeight: "800" as const, color: RE_RED, letterSpacing: 1 },
  dashNote: { fontSize: 10, color: "#888" },
  noZonesText: { fontSize: 13, color: "#888", textAlign: "center", paddingVertical: 20 },
  zoneCard: { backgroundColor: RE_BG, borderRadius: 15, padding: 14, marginBottom: 8, borderWidth: 2, borderColor: "rgba(255,77,77,0.25)" },
  zoneHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  zoneScoreBadge: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  zoneScoreText: { fontSize: 15, fontWeight: "900" as const, color: "#000" },
  zoneNameCol: { flex: 1 },
  zoneName: { fontSize: 15, fontWeight: "700" as const, color: Colors.white },
  zoneCat: { fontSize: 10, fontWeight: "700" as const, letterSpacing: 1, marginTop: 1 },
  zoneStats: { flexDirection: "row", justifyContent: "space-between", marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#333" },
  zoneStat: { alignItems: "center", gap: 2 },
  zoneStatLabel: { fontSize: 8, fontWeight: "700" as const, color: "#ccc", letterSpacing: 0.8 },
  zoneStatVal: { fontSize: 14, fontWeight: "700" as const, color: Colors.white },
  zoneDetail: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#333", gap: 8 },
  zoneDetailRow: { flexDirection: "row", justifyContent: "space-between" },
  zoneDetailLabel: { fontSize: 12, color: "#ccc" },
  zoneDetailVal: { fontSize: 12, fontWeight: "700" as const, color: Colors.white },
  filterSection: { marginBottom: 16, backgroundColor: RE_BG, marginHorizontal: 16, borderRadius: 15, padding: 16, borderWidth: 2, borderColor: RE_RED },
  filterTitle: { fontSize: 14, fontWeight: "800" as const, color: RE_RED, letterSpacing: 1, marginBottom: 10 },
  filterRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  checkboxActive: { backgroundColor: RE_RED, borderColor: RE_RED },
  filterLabel: { fontSize: 13, color: "rgba(255,255,255,0.8)" },
  applyBtn: { borderRadius: 8, overflow: "hidden", marginTop: 12 },
  applyGrad: { paddingVertical: 12, alignItems: "center", justifyContent: "center", backgroundColor: RE_RED },
  applyText: { fontSize: 13, fontWeight: "800" as const, color: "#fff", letterSpacing: 1 },
  lenderSection: { paddingHorizontal: 16, marginBottom: 16 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  sectionTitle: { fontSize: 14, fontWeight: "800" as const, color: RE_RED, letterSpacing: 1 },
  sectionNote: { fontSize: 10, color: "#888" },
  lenderCard: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: RE_BG, borderRadius: 10, padding: 15, marginBottom: 10, borderWidth: 2, borderColor: RE_RED },
  lenderInfo: { flex: 1, gap: 3 },
  lenderName: { fontSize: 15, fontWeight: "700" as const, color: Colors.white },
  lenderRate: { fontSize: 12, color: "#ccc" },
  lenderBtn: { borderRadius: 5, overflow: "hidden" },
  lenderBtnGrad: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: RE_RED },
  lenderBtnText: { fontSize: 11, fontWeight: "800" as const, color: "#fff", letterSpacing: 0.5 },
  calcToggleBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, marginHorizontal: 16, borderRadius: 10, backgroundColor: RE_BG, borderWidth: 2, borderColor: RE_RED, marginBottom: 10 },
  calcToggleText: { fontSize: 12, fontWeight: "800" as const, color: RE_RED, letterSpacing: 1.5 },
  calcSection: { paddingHorizontal: 16, marginBottom: 16, gap: 10 },
  calcRow: { flexDirection: "row", gap: 10 },
  calcInputGroup: { flex: 1, gap: 4 },
  calcLabel: { fontSize: 10, fontWeight: "700" as const, color: "#ccc", letterSpacing: 1 },
  calcInputWrap: { flexDirection: "row", alignItems: "center", backgroundColor: RE_INPUT_BG, borderRadius: 8, borderWidth: 2, borderColor: RE_RED, paddingHorizontal: 10, height: 42 },
  calcDollar: { fontSize: 15, color: RE_RED, fontWeight: "700" as const, marginRight: 4 },
  calcPercent: { fontSize: 15, color: RE_RED, fontWeight: "700" as const, marginLeft: 4 },
  calcInput: { flex: 1, fontSize: 15, color: Colors.white, fontWeight: "600" as const },
  calcTermRow: { flexDirection: "row", gap: 8 },
  calcTermBtn: { flex: 1, alignItems: "center", justifyContent: "center", height: 42, borderRadius: 8, backgroundColor: RE_INPUT_BG, borderWidth: 2, borderColor: "rgba(255,77,77,0.3)" },
  calcTermBtnActive: { backgroundColor: "rgba(255,77,77,0.2)", borderColor: RE_RED },
  calcTermText: { fontSize: 14, fontWeight: "700" as const, color: "rgba(255,255,255,0.4)" },
  calcTermTextActive: { color: RE_RED },
  calcButton: { borderRadius: 8, overflow: "hidden" },
  calcBtnGrad: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 13, backgroundColor: RE_RED },
  calcBtnText: { fontSize: 14, fontWeight: "900" as const, color: "#fff", letterSpacing: 1 },
  calcResults: { backgroundColor: RE_BG, borderRadius: 15, padding: 16, borderWidth: 2, borderColor: RE_RED, gap: 12 },
  calcResultRow: { flexDirection: "row", justifyContent: "space-between" },
  calcResultItem: { alignItems: "center", gap: 3 },
  calcResultLabel: { fontSize: 9, fontWeight: "700" as const, color: "#ccc", letterSpacing: 1 },
  calcResultVal: { fontSize: 22, fontWeight: "900" as const, color: RE_RED },
  calcResultValSm: { fontSize: 16, fontWeight: "800" as const, color: Colors.white },
  calcQuote: { flexDirection: "row", gap: 6, alignItems: "flex-start", backgroundColor: "#2a2a2a", borderRadius: 10, padding: 12, borderLeftWidth: 3, borderLeftColor: RE_RED },
  calcQuoteText: { flex: 1, fontSize: 13, color: Colors.white, lineHeight: 20, fontStyle: "italic" },
  disclaimer: { marginTop: 20, marginHorizontal: 16, paddingVertical: 15, paddingHorizontal: 15, backgroundColor: RE_BG, borderWidth: 1, borderColor: "#888", borderRadius: 5 },
  disclaimerText: { fontSize: 12, color: "#888", textAlign: "center", lineHeight: 18 },
  searchSection: { paddingHorizontal: 16, paddingBottom: 12 },
  searchRow: { flexDirection: "row", gap: 10, alignItems: "center" },
  searchInput: { flex: 3, height: 48, backgroundColor: RE_INPUT_BG, borderRadius: 8, paddingHorizontal: 16, fontSize: 16, color: Colors.white, borderWidth: 2, borderColor: RE_RED },
  searchBtn: { flex: 1, borderRadius: 8, overflow: "hidden" },
  searchBtnGrad: { width: 48, height: 48, alignItems: "center", justifyContent: "center", backgroundColor: RE_RED },
  searchHint: { fontSize: 11, color: "#888", marginTop: 6, marginLeft: 4 },
  advisorSection: { paddingHorizontal: 16, paddingBottom: 10 },
  advisorLabel: { fontSize: 10, fontWeight: "700" as const, color: "#888", letterSpacing: 1.5, marginBottom: 8 },
  advisorScroll: { gap: 8, paddingRight: 16 },
  advisorPill: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 2 },
  advisorImg: { width: 28, height: 28, borderRadius: 14, borderWidth: 1.5 },
  advisorName: { fontSize: 12, fontWeight: "700" as const, color: "rgba(255,255,255,0.6)" },
  loadingBox: { alignItems: "center", justifyContent: "center", gap: 16, paddingVertical: 40 },
  loadingText: { fontSize: 14, color: "#888", fontWeight: "600" as const, fontStyle: "italic" },
  emptyState: { alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 40, paddingVertical: 40 },
  emptyTitle: { fontSize: 18, fontWeight: "800" as const, color: Colors.white },
  emptyText: { fontSize: 14, color: "#888", textAlign: "center", lineHeight: 20 },
  propCard: { backgroundColor: RE_BG, borderRadius: 15, overflow: "hidden", borderWidth: 2, borderColor: RE_RED, marginHorizontal: 16, marginBottom: 14 },
  propImgBox: { position: "relative" },
  propImg: { width: "100%", height: 180, backgroundColor: "#2a2a2a" },
  propNoImg: { alignItems: "center", justifyContent: "center" },
  propRating: { position: "absolute", bottom: 10, right: 10, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: "rgba(0,0,0,0.7)" },
  propRatingText: { fontSize: 14, fontWeight: "800" as const, color: "#fff" },
  propDetails: { padding: 14, gap: 6 },
  propAddr: { fontSize: 16, fontWeight: "800" as const, color: Colors.white, lineHeight: 22 },
  propCity: { fontSize: 12, color: "#ccc" },
  propStats: { flexDirection: "row", gap: 12, marginTop: 4 },
  propStatText: { fontSize: 13, color: "#ccc", fontWeight: "600" as const },
  propQuote: { marginTop: 8, backgroundColor: "#2a2a2a", borderRadius: 10, padding: 12, borderLeftWidth: 3, borderLeftColor: RE_RED },
  propCommentText: { fontSize: 14, color: Colors.white, lineHeight: 22, fontStyle: "italic" },
  aiBadge: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 6, alignSelf: "flex-start", backgroundColor: "rgba(255,77,77,0.15)", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  aiBadgeText: { fontSize: 9, fontWeight: "800" as const, color: RE_RED, letterSpacing: 1 },
  aiBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 10, paddingVertical: 10, borderRadius: 8, borderWidth: 2 },
  aiBtnText: { fontSize: 12, fontWeight: "800" as const, letterSpacing: 0.8 },
  propActions: { flexDirection: "row", gap: 10, marginTop: 8 },
  propActionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 8, backgroundColor: "rgba(255,77,77,0.15)", borderWidth: 1, borderColor: "rgba(255,77,77,0.3)" },
  propViewBtn: { backgroundColor: "rgba(255,255,255,0.05)", borderColor: "rgba(255,77,77,0.25)" },
  propActionText: { fontSize: 12, fontWeight: "800" as const, color: "#fff", letterSpacing: 0.5 },
  tourSection: { marginHorizontal: 16, backgroundColor: RE_BG, borderWidth: 2, borderColor: RE_RED, borderRadius: 15, padding: 16, gap: 12 },
  guideScroll: { gap: 8, paddingRight: 16 },
  guidePill: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, borderWidth: 2 },
  guideEmoji: { fontSize: 22 },
  guideName: { fontSize: 13, fontWeight: "700" as const, color: "rgba(255,255,255,0.6)" },
  guideTitle: { fontSize: 10, color: "#888", marginTop: 1 },
  tourStartRow: { flexDirection: "row", gap: 10 },
  tourNameInput: { flex: 1, height: 44, backgroundColor: RE_INPUT_BG, borderRadius: 8, paddingHorizontal: 14, fontSize: 14, color: Colors.white, borderWidth: 2, borderColor: RE_RED, minWidth: 120 },
  tourStartBtn: { borderRadius: 8, overflow: "hidden" },
  tourStartGrad: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, height: 44, justifyContent: "center", backgroundColor: RE_RED },
  tourStartText: { fontSize: 12, fontWeight: "800" as const, color: "#fff", letterSpacing: 0.5 },
  tourConvo: { backgroundColor: "#2a2a2a", borderRadius: 10, padding: 15, minHeight: 100, maxHeight: 300, gap: 8 },
  tourMsg: { borderRadius: 4, padding: 10, maxWidth: "85%", borderLeftWidth: 3 },
  tourMsgUser: { alignSelf: "flex-end", backgroundColor: RE_INPUT_BG, borderLeftColor: "#4CAF50" },
  tourMsgGuide: { alignSelf: "flex-start", backgroundColor: RE_INPUT_BG, borderLeftColor: RE_RED },
  tourMsgName: { fontSize: 10, fontWeight: "700" as const, color: RE_RED, letterSpacing: 1, marginBottom: 4 },
  tourMsgText: { fontSize: 14, color: Colors.white, lineHeight: 22 },
  tourTyping: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8 },
  tourTypingText: { fontSize: 12, color: "#888", fontStyle: "italic" },
  tourInputRow: { flexDirection: "row", gap: 8, marginTop: 8 },
  tourInput: { flex: 1, height: 44, backgroundColor: RE_INPUT_BG, borderRadius: 8, paddingHorizontal: 14, fontSize: 14, color: Colors.white, borderWidth: 2, borderColor: RE_RED },
  tourSendBtn: { width: 44, height: 44, borderRadius: 8, backgroundColor: RE_RED, alignItems: "center", justifyContent: "center" },
});
