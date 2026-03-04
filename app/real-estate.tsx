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

interface Property {
  zpid: string | null;
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
  trumpComment: string;
  trumpRating: number;
}

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
  const soundRef = React.useRef<Audio.Sound | null>(null);

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
      const baseUrl = getApiUrl();
      const ttsRes = await fetch(`${baseUrl}api/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voice: "trump", mood: "EXCITED" }),
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
    const priceStr = property.price >= 1000000
      ? `$${(property.price / 1000000).toFixed(1)}M`
      : `$${(property.price / 1000).toFixed(0)}K`;
    try {
      await Share.share({
        message: `Trump says about this ${property.beds}bd/${property.baths}ba in ${property.city}, ${property.state} (${priceStr}):\n\n"${property.trumpComment}"\n\nTrump Rating: ${property.trumpRating}% WINNER\n\n- via Chat DJT`,
      });
    } catch {}
  };

  const formatPrice = (price: number) => {
    if (price >= 1000000) return `$${(price / 1000000).toFixed(1)}M`;
    if (price >= 1000) return `$${(price / 1000).toFixed(0)}K`;
    return `$${price}`;
  };

  const renderProperty = ({ item, index }: { item: Property; index: number }) => {
    const propId = item.zpid || `prop-${index}`;
    const isSpeakingThis = speakingId === propId;
    return (
      <Animated.View entering={FadeInDown.delay(index * 100).duration(400)} key={propId}>
        <View style={styles.propertyCard}>
          {item.img && (
            <Image source={{ uri: item.img }} style={styles.propertyImage} resizeMode="cover" />
          )}
          {!item.img && (
            <View style={[styles.propertyImage, styles.noImage]}>
              <FontAwesome5 name="home" size={40} color="rgba(212,164,32,0.3)" />
            </View>
          )}
          <View style={styles.propertyOverlay}>
            <View style={styles.priceRow}>
              <Text style={styles.priceText}>{formatPrice(item.price)}</Text>
              <View style={styles.ratingBadge}>
                <Text style={styles.ratingText}>{item.trumpRating}%</Text>
                <MaterialCommunityIcons name="trophy" size={12} color={Colors.gold} />
              </View>
            </View>
          </View>

          <View style={styles.propertyDetails}>
            <Text style={styles.addressText} numberOfLines={1}>
              {item.street}
            </Text>
            <Text style={styles.cityText}>
              {item.city}, {item.state} {item.zip}
            </Text>
            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <Ionicons name="bed" size={14} color={Colors.gold} />
                <Text style={styles.statText}>{item.beds}</Text>
              </View>
              <View style={styles.stat}>
                <MaterialCommunityIcons name="bathtub" size={14} color={Colors.gold} />
                <Text style={styles.statText}>{item.baths}</Text>
              </View>
              <View style={styles.stat}>
                <MaterialCommunityIcons name="ruler-square" size={14} color={Colors.gold} />
                <Text style={styles.statText}>{item.sqft.toLocaleString()} sqft</Text>
              </View>
            </View>

            <View style={styles.trumpSection}>
              <View style={styles.trumpHeader}>
                <MaterialCommunityIcons name="crown" size={14} color={Colors.gold} />
                <Text style={styles.trumpLabel}>TRUMP'S TAKE</Text>
              </View>
              <Text style={styles.trumpComment}>"{item.trumpComment}"</Text>
            </View>

            <View style={styles.cardActions}>
              <Pressable
                onPress={() => handleSpeak(item.trumpComment, propId)}
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
                <Text style={styles.actionBtnText}>SHARE</Text>
              </Pressable>
            </View>
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
          keyExtractor={(item, index) => item.zpid || `prop-${index}`}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + webBottomInset + 20 },
          ]}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <Animated.View entering={FadeIn.duration(300)} style={styles.resultsHeader}>
              <Text style={styles.resultsCount}>
                {totalResults} properties in {location}
              </Text>
              <Text style={styles.resultsSubtext}>Trump-Rated for your pleasure</Text>
            </Animated.View>
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
    gap: 16,
    paddingTop: 4,
  },
  propertyCard: {
    backgroundColor: "rgba(20,15,5,0.6)",
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(212,164,32,0.15)",
    ...Platform.select({
      web: { boxShadow: "0 4px 24px rgba(0,0,0,0.5)" },
      default: { elevation: 6 },
    }),
  },
  propertyImage: {
    width: "100%",
    height: 180,
    backgroundColor: "rgba(20,15,5,0.8)",
  },
  noImage: {
    alignItems: "center",
    justifyContent: "center",
  },
  propertyOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 180,
    justifyContent: "flex-end",
    padding: 12,
    ...Platform.select({
      web: { background: "linear-gradient(transparent 40%, rgba(0,0,0,0.8) 100%)" },
      default: {},
    }),
  },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  priceText: {
    fontSize: 24,
    fontWeight: "900" as const,
    color: Colors.gold,
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  ratingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: "800" as const,
    color: Colors.gold,
  },
  propertyDetails: {
    padding: 14,
    gap: 8,
  },
  addressText: {
    fontSize: 15,
    fontWeight: "700" as const,
    color: Colors.white,
  },
  cityText: {
    fontSize: 13,
    color: "rgba(255,255,255,0.5)",
  },
  statsRow: {
    flexDirection: "row",
    gap: 16,
    marginTop: 4,
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
  trumpSection: {
    marginTop: 8,
    backgroundColor: "rgba(212,164,32,0.06)",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(212,164,32,0.15)",
  },
  trumpHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  trumpLabel: {
    fontSize: 10,
    fontWeight: "900" as const,
    color: Colors.gold,
    letterSpacing: 1.5,
  },
  trumpComment: {
    fontSize: 14,
    color: Colors.white,
    lineHeight: 21,
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
    paddingVertical: 10,
    borderRadius: 10,
  },
  speakBtn: {
    backgroundColor: "rgba(212,164,32,0.2)",
    borderWidth: 1,
    borderColor: "rgba(212,164,32,0.3)",
  },
  shareBtn: {
    backgroundColor: "rgba(96,165,250,0.15)",
    borderWidth: 1,
    borderColor: "rgba(96,165,250,0.3)",
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: "800" as const,
    color: "#fff",
    letterSpacing: 0.5,
  },
});
