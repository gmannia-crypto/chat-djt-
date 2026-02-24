import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Platform,
  RefreshControl,
  Image,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons, FontAwesome5, Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import * as Haptics from "expo-haptics";
import { useQuery } from "@tanstack/react-query";
import Colors from "@/constants/colors";
import { getApiUrl } from "@/lib/query-client";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getWeatherIcon(icon: string, size: number = 28) {
  const map: Record<string, { name: string; color: string }> = {
    sunny: { name: "sunny", color: "#FFD700" },
    "partly-sunny": { name: "partly-sunny", color: "#FFA500" },
    cloudy: { name: "cloudy", color: "#B0B0B0" },
    rainy: { name: "rainy", color: "#6CB4EE" },
    snow: { name: "snow", color: "#E0E8FF" },
    thunderstorm: { name: "thunderstorm", color: "#9370DB" },
  };
  const w = map[icon] || map.cloudy;
  return <Ionicons name={w.name as any} size={size} color={w.color} />;
}

function formatPrice(n: number) {
  if (n >= 10000) return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (n >= 100) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function PriceChange({ value, isPercent }: { value: number | null; isPercent?: boolean }) {
  if (value == null) return null;
  const positive = value >= 0;
  return (
    <Text style={[styles.changeText, { color: positive ? "#4ADE80" : "#F87171" }]}>
      {positive ? "+" : ""}{isPercent ? `${value.toFixed(2)}%` : `$${value.toFixed(2)}`}
    </Text>
  );
}

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const webBottomInset = Platform.OS === "web" ? 34 : 0;
  const [location, setLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [showPickReason, setShowPickReason] = useState(false);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocationError("Location permission needed for weather");
        return;
      }
      try {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
        setLocation({ lat: loc.coords.latitude, lon: loc.coords.longitude });
      } catch {
        setLocationError("Could not get your location");
      }
    })();
  }, []);

  const { data: weather, isLoading: weatherLoading, refetch: refetchWeather } = useQuery({
    queryKey: ["weather", location?.lat, location?.lon],
    queryFn: async () => {
      if (!location) return null;
      const res = await fetch(`${getApiUrl()}/api/weather?lat=${location.lat}&lon=${location.lon}`);
      if (!res.ok) throw new Error("Weather fetch failed");
      return res.json();
    },
    enabled: !!location,
    staleTime: 10 * 60 * 1000,
  });

  const { data: markets, isLoading: marketsLoading, refetch: refetchMarkets } = useQuery({
    queryKey: ["markets"],
    queryFn: async () => {
      const res = await fetch(`${getApiUrl()}/api/markets`);
      if (!res.ok) throw new Error("Markets fetch failed");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: weatherComment } = useQuery({
    queryKey: ["weather-commentary", weather?.city, weather?.current?.temp, weather?.current?.label],
    queryFn: async () => {
      const res = await fetch(`${getApiUrl()}/api/weather-commentary?temp=${weather.current.temp}&condition=${encodeURIComponent(weather.current.label)}&city=${encodeURIComponent(weather.city)}`);
      if (!res.ok) throw new Error("Commentary failed");
      return res.json();
    },
    enabled: !!weather,
    staleTime: 30 * 60 * 1000,
  });

  const { data: hotTakes } = useQuery({
    queryKey: ["market-hot-takes", !!markets],
    queryFn: async () => {
      const summary = `BTC: $${markets.bitcoin?.price || 0}, ETH: $${markets.ethereum?.price || 0}, Gold: $${markets.gold?.price || 0}, Silver: $${markets.silver?.price || 0}`;
      const res = await fetch(`${getApiUrl()}/api/market-hot-takes?prices=${encodeURIComponent(summary)}`);
      if (!res.ok) throw new Error("Hot takes failed");
      return res.json();
    },
    enabled: !!markets,
    staleTime: 30 * 60 * 1000,
  });

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchWeather(), refetchMarkets()]);
    setRefreshing(false);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={Colors.gold} />
        </Pressable>
        <Text style={styles.headerTitle}>TRUMP DASHBOARD</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + webBottomInset + 20 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.gold} />
        }
      >
        <View style={styles.sectionHeader}>
          <Ionicons name="cloudy" size={18} color={Colors.gold} />
          <Text style={styles.sectionTitle}>WEATHER FORECAST</Text>
        </View>

        {weatherLoading && !weather && (
          <View style={styles.loadingCard}>
            <ActivityIndicator size="small" color={Colors.gold} />
            <Text style={styles.loadingText}>Getting your weather...</Text>
          </View>
        )}

        {locationError && !weather && (
          <View style={styles.errorCard}>
            <Ionicons name="location-outline" size={20} color="#F87171" />
            <Text style={styles.errorText}>{locationError}</Text>
          </View>
        )}

        {weather && (
          <>
            <LinearGradient
              colors={["#1A2332", "#0F1923"]}
              style={styles.weatherCard}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.weatherMain}>
                <View style={styles.weatherLeft}>
                  <Text style={styles.weatherCity}>{weather.city}</Text>
                  <Text style={styles.weatherTemp}>{weather.current.temp}°F</Text>
                  <Text style={styles.weatherLabel}>{weather.current.label}</Text>
                </View>
                <View style={styles.weatherRight}>
                  {getWeatherIcon(weather.current.icon, 56)}
                </View>
              </View>
              <View style={styles.weatherDetails}>
                <View style={styles.weatherDetail}>
                  <Ionicons name="thermometer-outline" size={14} color={Colors.whiteDim} />
                  <Text style={styles.weatherDetailText}>Feels {weather.current.feelsLike}°</Text>
                </View>
                <View style={styles.weatherDetail}>
                  <Ionicons name="water-outline" size={14} color={Colors.whiteDim} />
                  <Text style={styles.weatherDetailText}>{weather.current.humidity}%</Text>
                </View>
                <View style={styles.weatherDetail}>
                  <Feather name="wind" size={14} color={Colors.whiteDim} />
                  <Text style={styles.weatherDetailText}>{weather.current.windSpeed} mph</Text>
                </View>
              </View>

              {weatherComment && (
                <View style={styles.trumpCommentBox}>
                  <View style={styles.trumpCommentHeader}>
                    <Image
                      source={require("@/assets/images/trump-avatar.jpg")}
                      style={styles.trumpMiniAvatar}
                    />
                    <Text style={styles.trumpCommentLabel}>TRUMP SAYS:</Text>
                  </View>
                  <Text style={styles.trumpCommentText}>"{weatherComment.comment}"</Text>
                  <View style={styles.weatherButtonRow}>
                    {weatherComment.coldButton && (
                      <Pressable
                        onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
                        style={({ pressed }) => [styles.weatherReactButton, styles.coldButton, pressed && { opacity: 0.7 }]}
                      >
                        <Text style={styles.weatherReactText}>{"\u2744\uFE0F"} {weatherComment.coldButton}</Text>
                      </Pressable>
                    )}
                    {weatherComment.hotButton && (
                      <Pressable
                        onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
                        style={({ pressed }) => [styles.weatherReactButton, styles.hotButton, pressed && { opacity: 0.7 }]}
                      >
                        <Text style={styles.weatherReactText}>{"\uD83D\uDD25"} {weatherComment.hotButton}</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              )}
            </LinearGradient>

            <View style={styles.forecastRow}>
              {weather.forecast.map((day: any, i: number) => {
                const d = new Date(day.date + "T12:00:00");
                const label = i === 0 ? "Today" : WEEKDAYS[d.getDay()];
                return (
                  <View key={day.date} style={styles.forecastDay}>
                    <Text style={styles.forecastDayLabel}>{label}</Text>
                    {getWeatherIcon(day.icon, 22)}
                    <Text style={styles.forecastHigh}>{day.high}°</Text>
                    <Text style={styles.forecastLow}>{day.low}°</Text>
                    {day.precipChance > 0 && (
                      <View style={styles.precipRow}>
                        <Ionicons name="water" size={9} color="#6CB4EE" />
                        <Text style={styles.precipText}>{day.precipChance}%</Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </>
        )}

        <View style={[styles.sectionHeader, { marginTop: 24 }]}>
          <MaterialCommunityIcons name="chart-line" size={18} color={Colors.gold} />
          <Text style={styles.sectionTitle}>{"\uD83D\uDCCA"} TRUMP'S MARKET HOT TAKES {"\uD83D\uDCCA"}</Text>
        </View>

        {marketsLoading && !markets && (
          <View style={styles.loadingCard}>
            <ActivityIndicator size="small" color={Colors.gold} />
            <Text style={styles.loadingText}>Loading markets...</Text>
          </View>
        )}

        {markets && (
          <>
            <View style={styles.marketsGrid}>
              {markets.bitcoin && (
                <LinearGradient colors={["#1A1A2E", "#16213E"]} style={styles.marketCard}>
                  <View style={styles.marketHeader}>
                    <FontAwesome5 name="bitcoin" size={20} color="#F7931A" />
                    <Text style={styles.marketSymbol}>BTC</Text>
                  </View>
                  <Text style={styles.marketPrice}>${formatPrice(markets.bitcoin.price)}</Text>
                  <PriceChange value={markets.bitcoin.change24h} isPercent />
                  {hotTakes?.bitcoin && (
                    <Text style={styles.trumpNote}>"{hotTakes.bitcoin}"</Text>
                  )}
                </LinearGradient>
              )}

              {markets.ethereum && (
                <LinearGradient colors={["#1A1A2E", "#16213E"]} style={styles.marketCard}>
                  <View style={styles.marketHeader}>
                    <MaterialCommunityIcons name="ethereum" size={22} color="#627EEA" />
                    <Text style={styles.marketSymbol}>ETH</Text>
                  </View>
                  <Text style={styles.marketPrice}>${formatPrice(markets.ethereum.price)}</Text>
                  <PriceChange value={markets.ethereum.change24h} isPercent />
                  {hotTakes?.ethereum && (
                    <Text style={styles.trumpNote}>"{hotTakes.ethereum}"</Text>
                  )}
                </LinearGradient>
              )}

              {markets.gold && (
                <LinearGradient colors={["#1A1A0E", "#1E1C10"]} style={styles.marketCard}>
                  <View style={styles.marketHeader}>
                    <MaterialCommunityIcons name="gold" size={20} color="#FFD700" />
                    <Text style={styles.marketSymbol}>GOLD</Text>
                  </View>
                  <Text style={styles.marketPrice}>${formatPrice(markets.gold.price)}</Text>
                  <PriceChange value={markets.gold.changePercent} isPercent />
                  {hotTakes?.gold && (
                    <Text style={styles.trumpNote}>"{hotTakes.gold}"</Text>
                  )}
                </LinearGradient>
              )}

              {markets.silver && (
                <LinearGradient colors={["#1A1A1E", "#1C1C20"]} style={styles.marketCard}>
                  <View style={styles.marketHeader}>
                    <MaterialCommunityIcons name="circle" size={18} color="#C0C0C0" />
                    <Text style={styles.marketSymbol}>SILVER</Text>
                  </View>
                  <Text style={styles.marketPrice}>${formatPrice(markets.silver.price)}</Text>
                  <PriceChange value={markets.silver.changePercent} isPercent />
                  {hotTakes?.silver && (
                    <Text style={styles.trumpNote}>"{hotTakes.silver}"</Text>
                  )}
                </LinearGradient>
              )}
            </View>

            {hotTakes?.todaysPick && (
              <LinearGradient
                colors={["#2A1A0A", "#1E1408"]}
                style={styles.stockPickCard}
              >
                <View style={styles.stockPickHeader}>
                  <Text style={styles.stockPickEmoji}>{"\uD83D\uDD25"}</Text>
                  <Text style={styles.stockPickTitle}>TODAY'S PICK: Buy {hotTakes.todaysPick}</Text>
                </View>
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    setShowPickReason(!showPickReason);
                  }}
                  style={({ pressed }) => [styles.whyButton, pressed && { opacity: 0.7 }]}
                >
                  <Text style={styles.whyButtonText}>WHY?</Text>
                </Pressable>
                {showPickReason && hotTakes.todaysPickReason && (
                  <View style={styles.pickReasonBox}>
                    <Image
                      source={require("@/assets/images/trump-avatar.jpg")}
                      style={styles.trumpMiniAvatar}
                    />
                    <Text style={styles.pickReasonText}>"{hotTakes.todaysPickReason}"</Text>
                  </View>
                )}
              </LinearGradient>
            )}
          </>
        )}

        {markets && (
          <Text style={styles.updatedAt}>
            Last updated: {new Date(markets.updatedAt).toLocaleTimeString()}
          </Text>
        )}
      </ScrollView>
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
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.gold,
    letterSpacing: 2,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.gold,
    letterSpacing: 1.5,
  },
  loadingCard: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 30,
    alignItems: "center",
    gap: 10,
  },
  loadingText: {
    color: Colors.whiteDim,
    fontSize: 13,
  },
  errorCard: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  errorText: {
    color: "#F87171",
    fontSize: 14,
    flex: 1,
  },
  weatherCard: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(100, 149, 237, 0.2)",
  },
  weatherMain: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  weatherLeft: {},
  weatherRight: {
    alignItems: "center",
  },
  weatherCity: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.whiteDim,
    marginBottom: 4,
  },
  weatherTemp: {
    fontSize: 48,
    fontWeight: "200",
    color: Colors.white,
    lineHeight: 52,
  },
  weatherLabel: {
    fontSize: 15,
    color: Colors.whiteDim,
    marginTop: 2,
  },
  weatherDetails: {
    flexDirection: "row",
    gap: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.1)",
    paddingTop: 12,
  },
  weatherDetail: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  weatherDetailText: {
    fontSize: 13,
    color: Colors.whiteDim,
  },
  trumpCommentBox: {
    marginTop: 16,
    backgroundColor: "rgba(212, 164, 32, 0.08)",
    borderRadius: 12,
    padding: 14,
    borderLeftWidth: 3,
    borderLeftColor: Colors.gold,
  },
  trumpCommentHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  trumpMiniAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  trumpCommentLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: Colors.gold,
    letterSpacing: 1,
  },
  trumpCommentText: {
    fontSize: 14,
    color: Colors.whiteDim,
    fontStyle: "italic",
    lineHeight: 20,
  },
  weatherButtonRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  weatherReactButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  coldButton: {
    backgroundColor: "rgba(96, 165, 250, 0.2)",
    borderWidth: 1,
    borderColor: "rgba(96, 165, 250, 0.4)",
  },
  hotButton: {
    backgroundColor: "rgba(248, 113, 113, 0.2)",
    borderWidth: 1,
    borderColor: "rgba(248, 113, 113, 0.4)",
  },
  weatherReactText: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.white,
    textAlign: "center",
  },
  forecastRow: {
    flexDirection: "row",
    marginTop: 12,
    gap: 4,
  },
  forecastDay: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    gap: 6,
  },
  forecastDayLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.whiteDim,
  },
  forecastHigh: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.white,
  },
  forecastLow: {
    fontSize: 12,
    color: Colors.whiteMuted,
  },
  precipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  precipText: {
    fontSize: 10,
    color: "#6CB4EE",
  },
  marketsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  marketCard: {
    flexBasis: "47%",
    flexGrow: 1,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  marketHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  marketSymbol: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.whiteDim,
    letterSpacing: 1,
  },
  marketPrice: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.white,
    marginBottom: 4,
  },
  changeText: {
    fontSize: 13,
    fontWeight: "600",
  },
  trumpNote: {
    fontSize: 11,
    color: Colors.gold,
    fontStyle: "italic",
    marginTop: 8,
    lineHeight: 15,
  },
  stockPickCard: {
    marginTop: 12,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(212, 164, 32, 0.3)",
  },
  stockPickHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  stockPickEmoji: {
    fontSize: 18,
  },
  stockPickTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: Colors.gold,
    flex: 1,
    letterSpacing: 0.5,
  },
  whyButton: {
    marginTop: 12,
    backgroundColor: "rgba(212, 164, 32, 0.2)",
    borderWidth: 1,
    borderColor: Colors.gold,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 24,
    alignSelf: "flex-start",
  },
  whyButtonText: {
    fontSize: 14,
    fontWeight: "800",
    color: Colors.gold,
    letterSpacing: 1,
  },
  pickReasonBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginTop: 12,
    backgroundColor: "rgba(212, 164, 32, 0.06)",
    borderRadius: 10,
    padding: 12,
  },
  pickReasonText: {
    flex: 1,
    fontSize: 13,
    color: Colors.whiteDim,
    fontStyle: "italic",
    lineHeight: 19,
  },
  updatedAt: {
    fontSize: 11,
    color: Colors.whiteMuted,
    textAlign: "center",
    marginTop: 16,
  },
});
