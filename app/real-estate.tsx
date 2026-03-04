import React, { useState, useCallback } from "react";
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
  FlatList,
  Dimensions,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { Audio } from "expo-av";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
} from "react-native-reanimated";
import Colors from "@/constants/colors";
import { getApiUrl } from "@/lib/query-client";

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

interface AdvisorPersona {
  id: string;
  name: string;
  emoji: string;
  color: string;
  title: string;
  stampLabel: string;
  image: any;
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

const REAL_ESTATE_ADVISORS: AdvisorPersona[] = [
  { id: "trump", name: "Trump", emoji: "\uD83D\uDDE3\uFE0F", color: "#ff4d4d", title: "45th & 47th President", stampLabel: "TRUMP APPROVED", image: ADVISOR_IMAGES.trump },
  { id: "buffett", name: "Buffett", emoji: "\uD83D\uDC74", color: "#4d4dff", title: "Oracle of Omaha", stampLabel: "BUFFETT ANALYZED", image: ADVISOR_IMAGES.buffett },
  { id: "suze", name: "Suze", emoji: "\uD83D\uDC69", color: "#ff99cc", title: "Personal Finance Expert", stampLabel: "SUZE REVIEWED", image: ADVISOR_IMAGES.suze },
  { id: "grandma", name: "Grandma", emoji: "\uD83D\uDC75", color: "#ffffff", title: "Voice of Experience", stampLabel: "GRANDMA APPROVED", image: ADVISOR_IMAGES.grandma },
  { id: "musk", name: "Elon", emoji: "\uD83D\uDE80", color: "#00ccff", title: "CEO of Tesla & SpaceX", stampLabel: "ELON RATED", image: ADVISOR_IMAGES.musk },
  { id: "dave", name: "Dave", emoji: "\uD83D\uDCFB", color: "#ffaa00", title: "Financial Peace", stampLabel: "DAVE GRADED", image: ADVISOR_IMAGES.dave },
  { id: "mansa", name: "Mansa Musa", emoji: "\uD83D\uDC51", color: "#D4AF37", title: "Richest Man in History", stampLabel: "MANSA BLESSED", image: ADVISOR_IMAGES.mansa },
  { id: "jordan", name: "MJ", emoji: "\uD83C\uDFC0", color: "#CE1141", title: "6x NBA Champion", stampLabel: "MJ CERTIFIED", image: ADVISOR_IMAGES.jordan },
  { id: "bernie", name: "Bernie Mac", emoji: "\uD83C\uDFA4", color: "#9B59B6", title: "King of Comedy", stampLabel: "BERNIE APPROVED", image: ADVISOR_IMAGES.bernie },
  { id: "genie", name: "Genie", emoji: "\uD83E\uDDDE", color: "#9B59B6", title: "10,000 Years of Wisdom", stampLabel: "GENIE GRANTED", image: ADVISOR_IMAGES.genie },
  { id: "ruckus", name: "Ruckus", emoji: "\uD83D\uDE24", color: "#8B4513", title: "Contrarian Expert", stampLabel: "RUCKUS REJECTED", image: ADVISOR_IMAGES.ruckus },
];

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function RealEstateScreen() {
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const webBottomInset = Platform.OS === "web" ? 34 : 0;

  const [location, setLocation] = useState("");
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalResults, setTotalResults] = useState(0);
  const [searched, setSearched] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [selectedAdvisor, setSelectedAdvisor] = useState("trump");
  const soundRef = React.useRef<Audio.Sound | null>(null);

  const activeAdvisor = REAL_ESTATE_ADVISORS.find((a) => a.id === selectedAdvisor) || REAL_ESTATE_ADVISORS[0];

  const getPropertyComment = useCallback((property: Property): string => {
    if (property.personaComments && property.personaComments[selectedAdvisor]) {
      return property.personaComments[selectedAdvisor].comment;
    }
    return property.trumpComment;
  }, [selectedAdvisor]);

  const getPropertyRating = useCallback((property: Property): number => {
    if (property.personaComments && property.personaComments[selectedAdvisor]) {
      return property.personaComments[selectedAdvisor].rating;
    }
    return property.trumpRating;
  }, [selectedAdvisor]);

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
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      console.error("Property search error:", err);
      setProperties([]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  const handleSpeak = async (text: string, propId: string) => {
    if (speaking) {
      if (soundRef.current) {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
      setSpeaking(false);
      setSpeakingId(null);
      return;
    }

    setSpeaking(true);
    setSpeakingId(propId);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const baseUrl = getApiUrl().replace(/\/$/, "");
      const ttsRes = await fetch(`${baseUrl}/api/persona-speak`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.slice(0, 300), personaId: selectedAdvisor }),
      });

      if (!ttsRes.ok) throw new Error("TTS failed");

      const audioBlob = await ttsRes.blob();
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const base64 = (reader.result as string).split(",")[1];
          const { sound } = await Audio.Sound.createAsync(
            { uri: `data:audio/mp3;base64,${base64}` },
            { shouldPlay: true }
          );
          soundRef.current = sound;
          sound.setOnPlaybackStatusUpdate((status: any) => {
            if (status.didJustFinish) {
              setSpeaking(false);
              setSpeakingId(null);
              sound.unloadAsync();
              soundRef.current = null;
            }
          });
        } catch (e) {
          setSpeaking(false);
          setSpeakingId(null);
        }
      };
      reader.readAsDataURL(audioBlob);
    } catch (err) {
      setSpeaking(false);
      setSpeakingId(null);
    }
  };

  const handleShare = async (property: Property) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const priceStr = formatPrice(property.price);
    const addr = property.street || `${property.city}, ${property.state}`;
    const listing = property.url ? `\n\n${property.url}` : "";
    const comment = getPropertyComment(property);
    const rating = getPropertyRating(property);
    try {
      await Share.share({
        message: `${activeAdvisor.emoji} ${activeAdvisor.stampLabel} ${activeAdvisor.emoji}\n\n${addr} — ${priceStr}\n${property.beds}bd / ${property.baths}ba${property.sqft ? ` / ${property.sqft.toLocaleString()} sqft` : ""}\n\n${activeAdvisor.name} says: "${comment}"\n\nRating: ${rating}%${listing}\n\n- via Chat DJT`,
      });
    } catch {}
  };

  const formatPrice = (price: number) => {
    if (price >= 1000000) return `$${(price / 1000000).toFixed(1)}M`;
    if (price >= 1000) return `$${(price / 1000).toFixed(0)}K`;
    return `$${price}`;
  };

  const handleViewListing = (url: string | null) => {
    if (!url) return;
    if (Platform.OS === "web") {
      window.open(url, "_blank");
    } else {
      import("expo-linking").then((Linking) => Linking.openURL(url));
    }
  };

  const renderProperty = ({ item, index }: { item: Property; index: number }) => {
    const propId = item.id || `prop-${index}`;
    const isSpeakingThis = speakingId === propId;
    const addressLine = item.street
      ? `${item.street} — ${formatPrice(item.price)}`
      : `${item.city}, ${item.state} — ${formatPrice(item.price)}`;
    const comment = getPropertyComment(item);
    const rating = getPropertyRating(item);
    return (
      <Animated.View entering={FadeInDown.delay(index * 100).duration(400)} key={propId}>
        <View style={styles.propertyCard}>
          <View style={styles.imageContainer}>
            {item.img ? (
              <Image source={{ uri: item.img }} style={styles.propertyImage} resizeMode="cover" />
            ) : (
              <View style={[styles.propertyImage, styles.noImage]}>
                <FontAwesome5 name="home" size={40} color="rgba(212,164,32,0.3)" />
              </View>
            )}
            <View style={styles.stampContainer}>
              <LinearGradient
                colors={[`${activeAdvisor.color}E6`, `${activeAdvisor.color}F0`]}
                style={styles.stampGradient}
              >
                <Text style={styles.stampText}>{activeAdvisor.emoji} {activeAdvisor.stampLabel} {activeAdvisor.emoji}</Text>
              </LinearGradient>
            </View>
            <View style={[styles.ratingBadge, { backgroundColor: `${activeAdvisor.color}CC` }]}>
              <Text style={styles.ratingText}>{rating}%</Text>
              <MaterialCommunityIcons name="trophy" size={12} color="#fff" />
            </View>
            {item.propertyType && (
              <View style={styles.typeBadge}>
                <Text style={styles.typeText}>{item.propertyType}</Text>
              </View>
            )}
          </View>

          <View style={styles.propertyDetails}>
            <Text style={styles.addressHeadline} numberOfLines={2}>
              {addressLine}
            </Text>
            <Text style={styles.cityText}>
              {item.city}, {item.state} {item.zip}
            </Text>

            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <Ionicons name="bed" size={14} color={Colors.gold} />
                <Text style={styles.statText}>{item.beds} bd</Text>
              </View>
              <View style={styles.stat}>
                <MaterialCommunityIcons name="bathtub" size={14} color={Colors.gold} />
                <Text style={styles.statText}>{item.baths} ba</Text>
              </View>
              {item.sqft > 0 && (
                <View style={styles.stat}>
                  <MaterialCommunityIcons name="ruler-square" size={14} color={Colors.gold} />
                  <Text style={styles.statText}>{item.sqft.toLocaleString()} sqft</Text>
                </View>
              )}
              {item.yearBuilt && (
                <View style={styles.stat}>
                  <Ionicons name="calendar" size={13} color={Colors.gold} />
                  <Text style={styles.statText}>{item.yearBuilt}</Text>
                </View>
              )}
            </View>

            {item.pricePerSqFt && item.pricePerSqFt > 0 && (
              <Text style={styles.pricePerSqFt}>${item.pricePerSqFt}/sqft{item.dom ? ` · ${item.dom} days on market` : ""}</Text>
            )}

            <View style={styles.trumpSection}>
              <Text style={[styles.trumpComment, { borderLeftColor: activeAdvisor.color }]}>"{comment}"</Text>
            </View>

            <View style={styles.cardActions}>
              <Pressable
                onPress={() => handleSpeak(comment, propId)}
                style={({ pressed }) => [styles.actionBtn, styles.speakBtn, pressed && { opacity: 0.7 }]}
              >
                <Ionicons name={isSpeakingThis ? "stop" : "volume-high"} size={16} color="#fff" />
                <Text style={styles.actionBtnText}>{isSpeakingThis ? "STOP" : "LISTEN"}</Text>
              </Pressable>
              <Pressable
                onPress={() => handleShare(item)}
                style={({ pressed }) => [styles.actionBtn, styles.shareBtn, pressed && { opacity: 0.7 }]}
              >
                <Ionicons name="share-social" size={16} color="#fff" />
                <Text style={styles.actionBtnText}>{"\uD83D\uDD01"} SHARE THIS DEAL</Text>
              </Pressable>
            </View>

            {item.url && (
              <Pressable
                onPress={() => handleViewListing(item.url)}
                style={({ pressed }) => [styles.viewListingBtn, pressed && { opacity: 0.7 }]}
              >
                <Ionicons name="open-outline" size={14} color={Colors.gold} />
                <Text style={styles.viewListingText}>View Full Listing</Text>
              </Pressable>
            )}

            <Text style={styles.affiliateDisclaimer}>
              As an Amazon Associate I earn from qualifying purchases
            </Text>
          </View>
        </View>
      </Animated.View>
    );
  };

  return (
    <View style={[styles.container, Platform.OS === "web" && { maxHeight: "100vh" as any, overflow: "auto" as any }]}>
      <LinearGradient
        colors={["#0a0a0a", "#1a0f00", "#0a0a0a"]}
        style={StyleSheet.absoluteFillObject}
      />

      <Animated.View
        entering={FadeInUp.duration(400)}
        style={[styles.header, { paddingTop: insets.top + webTopInset + 8 }]}
      >
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={Colors.gold} />
        </Pressable>
        <View style={styles.headerCenter}>
          <MaterialCommunityIcons name="office-building" size={20} color={Colors.gold} />
          <Text style={styles.headerTitle}>TRUMP REALTY</Text>
        </View>
        <View style={styles.backButton} />
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.searchSection}>
        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchInput}
            placeholder="Enter zip code or city..."
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={location}
            onChangeText={setLocation}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
            autoCapitalize="none"
          />
          <Pressable
            onPress={handleSearch}
            disabled={loading || !location.trim()}
            style={({ pressed }) => [
              styles.searchButton,
              pressed && { opacity: 0.7 },
              (!location.trim() || loading) && { opacity: 0.4 },
            ]}
          >
            <LinearGradient
              colors={[Colors.gold, "#B8860B"]}
              style={styles.searchButtonGradient}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <Ionicons name="search" size={20} color="#000" />
              )}
            </LinearGradient>
          </Pressable>
        </View>
        <Text style={styles.searchHint}>
          Search by zip code (e.g. 90210) or city name
        </Text>
      </Animated.View>

      <View style={styles.advisorSection}>
        <Text style={styles.advisorLabel}>YOUR ADVISOR</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.advisorScroll}>
          {REAL_ESTATE_ADVISORS.map((advisor) => (
            <Pressable
              key={advisor.id}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setSelectedAdvisor(advisor.id);
              }}
              style={[
                styles.advisorPill,
                {
                  borderColor: selectedAdvisor === advisor.id ? advisor.color : "rgba(255,255,255,0.1)",
                  backgroundColor: selectedAdvisor === advisor.id ? `${advisor.color}20` : "rgba(255,255,255,0.05)",
                },
              ]}
            >
              <Image source={advisor.image} style={[styles.advisorImage, { borderColor: selectedAdvisor === advisor.id ? advisor.color : "rgba(255,255,255,0.2)" }]} />
              <Text style={[styles.advisorName, selectedAdvisor === advisor.id && { color: advisor.color }]}>{advisor.name}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.gold} />
          <Text style={styles.loadingText}>Scouting properties... The best properties.</Text>
        </View>
      )}

      {!loading && searched && properties.length === 0 && (
        <Animated.View entering={FadeIn.duration(400)} style={styles.emptyState}>
          <FontAwesome5 name="hard-hat" size={40} color="rgba(212,164,32,0.4)" />
          <Text style={styles.emptyTitle}>No Properties Found</Text>
          <Text style={styles.emptyText}>
            Even Trump can't find deals there. Try another location!
          </Text>
        </Animated.View>
      )}

      {!loading && properties.length > 0 && (
        <FlatList
          data={properties}
          renderItem={renderProperty}
          keyExtractor={(item, index) => item.id || `prop-${index}`}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + webBottomInset + 20 },
          ]}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <>
              {Platform.OS === "web" && properties.some(p => p.lat && p.lng) && (
                <View style={styles.mapContainer}>
                  <iframe
                    style={{ width: "100%", height: 220, border: "none", borderRadius: 12 } as any}
                    srcDoc={`<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script><style>body{margin:0}#map{width:100%;height:220px}</style></head><body><div id="map"></div><script>var props=${JSON.stringify(properties.filter(p=>p.lat&&p.lng).map(p=>({lat:p.lat,lng:p.lng,price:p.price,beds:p.beds,street:p.street})))};var map=L.map('map',{zoomControl:false});L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'OSM'}).addTo(map);var bounds=[];props.forEach(function(p){var m=L.marker([p.lat,p.lng]).addTo(map);m.bindPopup('<b>$'+(p.price>=1e6?(p.price/1e6).toFixed(1)+'M':(p.price/1e3).toFixed(0)+'K')+'</b><br>'+p.beds+' bed - '+p.street);bounds.push([p.lat,p.lng])});if(bounds.length)map.fitBounds(bounds,{padding:[20,20]});</script></body></html>`}
                  />
                </View>
              )}
              <Animated.View entering={FadeIn.duration(300)} style={styles.resultsHeader}>
                <Text style={styles.resultsCount}>
                  {totalResults} properties in {location}
                </Text>
                <Text style={styles.resultsSubtext}>{activeAdvisor.name}-Rated for your pleasure</Text>
              </Animated.View>
            </>
          }
          ListFooterComponent={
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.push("/game");
              }}
              style={({ pressed }) => [styles.gamePromo, pressed && { opacity: 0.7 }]}
            >
              <MaterialCommunityIcons name="gamepad-variant" size={22} color="#FBBF24" />
              <View style={{ flex: 1 }}>
                <Text style={styles.gamePromoTitle}>PLAY TRUMP BILLIONAIRES</Text>
                <Text style={styles.gamePromoSub}>Build your own real estate empire!</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#FBBF24" />
            </Pressable>
          }
        />
      )}

      {!searched && !loading && (
        <Animated.View entering={FadeIn.delay(400).duration(600)} style={styles.heroSection}>
          <MaterialCommunityIcons name="city-variant" size={60} color="rgba(212,164,32,0.2)" />
          <Text style={styles.heroTitle}>Find Your Dream Deal</Text>
          <Text style={styles.heroText}>
            Search any neighborhood and get Trump's expert real estate commentary on every listing. Nobody knows real estate like Trump!
          </Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "900" as const,
    color: Colors.gold,
    letterSpacing: 2,
  },
  searchSection: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  searchRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  searchInput: {
    flex: 1,
    height: 48,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: Colors.white,
    borderWidth: 1,
    borderColor: "rgba(212,164,32,0.2)",
  },
  searchButton: {
    borderRadius: 12,
    overflow: "hidden",
  },
  searchButtonGradient: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  searchHint: {
    fontSize: 11,
    color: "rgba(255,255,255,0.3)",
    marginTop: 6,
    marginLeft: 4,
  },
  advisorSection: {
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  advisorLabel: {
    fontSize: 10,
    fontWeight: "700" as const,
    color: "rgba(255,255,255,0.4)",
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  advisorScroll: {
    gap: 8,
    paddingRight: 16,
  },
  advisorPill: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  advisorImage: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  advisorName: {
    fontSize: 12,
    fontWeight: "700" as const,
    color: "rgba(255,255,255,0.6)",
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.gold,
    fontWeight: "600" as const,
    fontStyle: "italic",
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "800" as const,
    color: Colors.white,
  },
  emptyText: {
    fontSize: 14,
    color: "rgba(255,255,255,0.5)",
    textAlign: "center",
    lineHeight: 20,
  },
  heroSection: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    paddingHorizontal: 40,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: "900" as const,
    color: Colors.gold,
    textAlign: "center",
  },
  heroText: {
    fontSize: 14,
    color: "rgba(255,255,255,0.5)",
    textAlign: "center",
    lineHeight: 22,
  },
  mapContainer: {
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,215,0,0.2)",
  },
  resultsHeader: {
    alignItems: "center",
    paddingVertical: 8,
    gap: 2,
  },
  resultsCount: {
    fontSize: 14,
    fontWeight: "700" as const,
    color: Colors.gold,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  resultsSubtext: {
    fontSize: 11,
    color: "rgba(255,255,255,0.4)",
    fontStyle: "italic",
  },
  listContent: {
    paddingHorizontal: 16,
    gap: 18,
    paddingTop: 4,
  },
  propertyCard: {
    backgroundColor: "rgba(20,15,5,0.85)",
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "rgba(212,164,32,0.25)",
    ...Platform.select({
      web: { boxShadow: "0 6px 30px rgba(0,0,0,0.6)" },
      default: { elevation: 8 },
    }),
  },
  imageContainer: {
    position: "relative",
  },
  propertyImage: {
    width: "100%",
    height: 200,
    backgroundColor: "rgba(20,15,5,0.8)",
  },
  noImage: {
    alignItems: "center",
    justifyContent: "center",
  },
  stampContainer: {
    position: "absolute",
    top: 12,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 2,
  },
  stampGradient: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 6,
    ...Platform.select({
      web: { boxShadow: "0 2px 10px rgba(0,0,0,0.5)" },
      default: { elevation: 4 },
    }),
  },
  stampText: {
    fontSize: 13,
    fontWeight: "900" as const,
    color: "#fff",
    letterSpacing: 1.5,
    textAlign: "center" as const,
  },
  ratingBadge: {
    position: "absolute",
    bottom: 10,
    right: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(212,164,32,0.4)",
  },
  ratingText: {
    fontSize: 14,
    fontWeight: "800" as const,
    color: Colors.gold,
  },
  typeBadge: {
    position: "absolute",
    bottom: 10,
    left: 10,
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  typeText: {
    fontSize: 11,
    fontWeight: "700" as const,
    color: "rgba(255,255,255,0.8)",
    letterSpacing: 0.5,
    textTransform: "uppercase" as const,
  },
  propertyDetails: {
    padding: 16,
    gap: 8,
  },
  addressHeadline: {
    fontSize: 17,
    fontWeight: "800" as const,
    color: Colors.gold,
    lineHeight: 22,
  },
  cityText: {
    fontSize: 13,
    color: "rgba(255,255,255,0.5)",
  },
  statsRow: {
    flexDirection: "row",
    gap: 14,
    marginTop: 4,
    flexWrap: "wrap",
  },
  stat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statText: {
    fontSize: 13,
    color: Colors.white,
    fontWeight: "600" as const,
  },
  pricePerSqFt: {
    fontSize: 12,
    color: "rgba(255,255,255,0.4)",
    marginTop: 2,
  },
  trumpSection: {
    marginTop: 8,
    backgroundColor: "rgba(212,164,32,0.06)",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(212,164,32,0.2)",
    borderLeftWidth: 3,
    borderLeftColor: Colors.gold,
  },
  trumpComment: {
    fontSize: 15,
    color: Colors.white,
    lineHeight: 23,
    fontStyle: "italic",
  },
  cardActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 11,
    borderRadius: 10,
  },
  speakBtn: {
    backgroundColor: "rgba(212,164,32,0.2)",
    borderWidth: 1,
    borderColor: "rgba(212,164,32,0.3)",
  },
  shareBtn: {
    backgroundColor: "rgba(59,130,246,0.2)",
    borderWidth: 1,
    borderColor: "rgba(59,130,246,0.35)",
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: "800" as const,
    color: "#fff",
    letterSpacing: 0.5,
  },
  viewListingBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    marginTop: 4,
  },
  viewListingText: {
    fontSize: 12,
    fontWeight: "600" as const,
    color: Colors.gold,
    textDecorationLine: "underline",
  },
  affiliateDisclaimer: {
    fontSize: 9,
    color: "rgba(255,255,255,0.2)",
    textAlign: "center" as const,
    marginTop: 8,
  },
  gamePromo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    marginTop: 16,
    borderRadius: 14,
    backgroundColor: "rgba(251,191,36,0.08)",
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.25)",
  },
  gamePromoTitle: {
    fontSize: 14,
    fontWeight: "800" as const,
    color: "#FBBF24",
    letterSpacing: 0.5,
  },
  gamePromoSub: {
    fontSize: 11,
    color: "rgba(255,255,255,0.4)",
    marginTop: 2,
  },
});
