import React, { useState, useEffect, useCallback } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  Platform,
  Modal,
  Image,
  Dimensions,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import Colors from "@/constants/colors";
import { useSoundEffects } from "@/lib/use-sound";
import {
  CARD_CATALOG,
  RARITY_COLORS,
  RARITY_GRADIENTS,
  getCollection,
  getCollectionStats,
  hasCardSync,
  type CollectibleCard,
  type OwnedCard,
  type Rarity,
} from "@/lib/collectibles";

const RARITY_FILTERS: (Rarity | "ALL")[] = ["ALL", "Common", "Rare", "Epic", "Legendary"];
const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_GAP = 10;
const CARD_PADDING = 12;
const CARD_WIDTH = (SCREEN_WIDTH - CARD_PADDING * 2 - CARD_GAP) / 2;
const CARD_HEIGHT = CARD_WIDTH * 1.4;

function DCWatermark({ size = "small" }: { size?: "small" | "large" }) {
  const isLarge = size === "large";
  return (
    <View style={[dcStyles.container, isLarge && dcStyles.containerLarge]}>
      <Text style={[dcStyles.dc, isLarge && dcStyles.dcLarge]}>DC</Text>
      <Text style={[dcStyles.text, isLarge && dcStyles.textLarge]}>DYNAMIC CREATIONS</Text>
    </View>
  );
}

const dcStyles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 6,
    right: 6,
    alignItems: "center",
    opacity: 0.2,
  },
  containerLarge: {
    bottom: 12,
    right: 12,
    opacity: 0.15,
  },
  dc: {
    fontSize: 14,
    fontWeight: "900" as const,
    color: "#FFD700",
    letterSpacing: 2,
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  dcLarge: {
    fontSize: 22,
  },
  text: {
    fontSize: 4,
    fontWeight: "800" as const,
    color: "#FFD700",
    letterSpacing: 1.5,
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    marginTop: -2,
  },
  textLarge: {
    fontSize: 6,
    marginTop: -3,
  },
});

export default function CollectiblesScreen() {
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const webBottomInset = Platform.OS === "web" ? 34 : 0;
  const [collection, setCollection] = useState<OwnedCard[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<Rarity | "ALL">("ALL");
  const [selectedCard, setSelectedCard] = useState<CollectibleCard | null>(null);
  const { playClick, playTransition } = useSoundEffects();

  useEffect(() => {
    getCollection().then(setCollection);
  }, []);

  const stats = getCollectionStats(collection);
  const filteredCards = selectedFilter === "ALL"
    ? CARD_CATALOG
    : CARD_CATALOG.filter((c) => c.rarity === selectedFilter);

  const handleCardPress = useCallback((card: CollectibleCard) => {
    const owned = hasCardSync(card.id, collection);
    if (owned) {
      playClick();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setSelectedCard(card);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
  }, [collection, playClick]);

  const ownedCard = selectedCard ? collection.find((c) => c.cardId === selectedCard.id) : null;

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <View style={styles.header}>
        <Pressable onPress={() => { playTransition(); router.back(); }} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.gold} />
        </Pressable>
        <View style={styles.headerCenter}>
          <MaterialCommunityIcons name="cards" size={20} color={Colors.gold} />
          <Text style={styles.headerTitle}>DJT COLLECTIBLES</Text>
        </View>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{stats.owned}/{stats.total}</Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        {(["Common", "Rare", "Epic", "Legendary"] as Rarity[]).map((r) => (
          <View key={r} style={styles.statItem}>
            <View style={[styles.statDot, { backgroundColor: RARITY_COLORS[r] }]} />
            <Text style={[styles.statLabel, { color: RARITY_COLORS[r] }]}>{r}</Text>
            <Text style={styles.statValue}>{stats.byRarity[r].owned}/{stats.byRarity[r].total}</Text>
          </View>
        ))}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterContent}
      >
        {RARITY_FILTERS.map((f) => (
          <Pressable
            key={f}
            onPress={() => { playClick(); setSelectedFilter(f); }}
            style={[
              styles.filterBtn,
              selectedFilter === f && styles.filterBtnActive,
              selectedFilter === f && f !== "ALL" && { borderColor: RARITY_COLORS[f as Rarity] },
            ]}
          >
            <Text style={[
              styles.filterText,
              selectedFilter === f && styles.filterTextActive,
              selectedFilter === f && f !== "ALL" && { color: RARITY_COLORS[f as Rarity] },
            ]}>
              {f}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.grid, { paddingBottom: insets.bottom + webBottomInset + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {filteredCards.map((card, index) => {
          const owned = hasCardSync(card.id, collection);
          const rarityColor = RARITY_COLORS[card.rarity];
          return (
            <Animated.View
              key={card.id}
              entering={FadeInDown.delay(index * 40).duration(300)}
              style={styles.cardWrapper}
            >
              <Pressable
                onPress={() => handleCardPress(card)}
                style={({ pressed }) => [
                  styles.card,
                  { borderColor: owned ? `${rarityColor}40` : "rgba(255,255,255,0.03)" },
                  pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] },
                ]}
              >
                <Image source={card.image} style={[styles.cardImage, !owned && styles.cardImageDimmed]} resizeMode="cover" />
                <LinearGradient
                  colors={owned
                    ? ["transparent", "rgba(0,0,0,0.3)", "rgba(0,0,0,0.85)"]
                    : ["rgba(0,0,0,0.55)", "rgba(0,0,0,0.7)", "rgba(0,0,0,0.92)"]}
                  style={styles.cardOverlay}
                />
                <View style={[styles.rarityStripe, { backgroundColor: owned ? rarityColor : "rgba(255,255,255,0.05)" }]} />
                {owned && <DCWatermark />}
                <View style={styles.cardBottom}>
                  {!owned && (
                    <Ionicons name="lock-closed" size={24} color="rgba(255,255,255,0.12)" style={styles.lockIcon} />
                  )}
                  <Text style={[styles.cardName, !owned && styles.cardNameLocked]} numberOfLines={1}>
                    {owned ? card.name : "???"}
                  </Text>
                  <View style={[styles.rarityBadge, { backgroundColor: owned ? `${rarityColor}25` : "rgba(255,255,255,0.04)" }]}>
                    <Text style={[styles.rarityText, { color: owned ? rarityColor : "rgba(255,255,255,0.15)" }]}>
                      {card.rarity.toUpperCase()}
                    </Text>
                  </View>
                </View>
                {owned && (
                  <View style={styles.categoryTag}>
                    <MaterialCommunityIcons name={card.icon as any} size={10} color={card.color} />
                    <Text style={[styles.categoryText, { color: card.color }]}>{card.category.toUpperCase()}</Text>
                  </View>
                )}
              </Pressable>
            </Animated.View>
          );
        })}
      </ScrollView>

      <Modal visible={!!selectedCard} transparent animationType="fade" statusBarTranslucent>
        <Pressable style={styles.modalOverlay} onPress={() => setSelectedCard(null)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            {selectedCard && (
              <Animated.View entering={FadeIn.duration(300)}>
                <View style={styles.modalImageWrap}>
                  <Image source={selectedCard.image} style={styles.modalImage} resizeMode="cover" />
                  <LinearGradient
                    colors={["transparent", "rgba(0,0,0,0.4)", "rgba(0,0,0,0.92)"]}
                    style={styles.modalImageGradient}
                  />
                  <DCWatermark size="large" />
                  <View style={[styles.modalRarityBar, { backgroundColor: RARITY_COLORS[selectedCard.rarity] }]} />
                </View>
                <View style={styles.modalContent}>
                  <View style={styles.modalIconRow}>
                    <MaterialCommunityIcons
                      name={selectedCard.icon as any}
                      size={20}
                      color={selectedCard.color}
                    />
                    <Text style={styles.modalName}>{selectedCard.name}</Text>
                  </View>
                  <View style={[styles.modalRarityBadge, { backgroundColor: `${RARITY_COLORS[selectedCard.rarity]}20` }]}>
                    <Text style={[styles.modalRarityText, { color: RARITY_COLORS[selectedCard.rarity] }]}>
                      {selectedCard.rarity.toUpperCase()} • {selectedCard.category.toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.modalDescription}>"{selectedCard.description}"</Text>
                  {ownedCard && (
                    <Text style={styles.modalEarned}>
                      Earned {new Date(ownedCard.earnedAt).toLocaleDateString()}
                    </Text>
                  )}
                  <Pressable
                    onPress={() => { playClick(); setSelectedCard(null); }}
                    style={styles.modalClose}
                  >
                    <Text style={styles.modalCloseText}>CLOSE</Text>
                  </Pressable>
                </View>
              </Animated.View>
            )}
          </Pressable>
        </Pressable>
      </Modal>
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
    borderBottomWidth: 1,
    borderBottomColor: "rgba(212,164,32,0.15)",
  },
  backBtn: {
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
    fontSize: 16,
    fontWeight: "900",
    color: Colors.gold,
    letterSpacing: 1.5,
  },
  countBadge: {
    backgroundColor: "rgba(212,164,32,0.15)",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "rgba(212,164,32,0.25)",
  },
  countText: {
    fontSize: 12,
    fontWeight: "800",
    color: Colors.gold,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  statItem: {
    alignItems: "center",
    gap: 2,
  },
  statDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statLabel: {
    fontSize: 8,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 11,
    fontWeight: "800",
    color: "#fff",
  },
  filterScroll: {
    maxHeight: 44,
  },
  filterContent: {
    paddingHorizontal: 16,
    gap: 8,
    paddingVertical: 8,
  },
  filterBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  filterBtnActive: {
    borderColor: Colors.gold,
    backgroundColor: "rgba(212,164,32,0.1)",
  },
  filterText: {
    fontSize: 11,
    fontWeight: "700",
    color: "rgba(255,255,255,0.4)",
  },
  filterTextActive: {
    color: Colors.gold,
  },
  scrollView: {
    flex: 1,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: CARD_PADDING,
    paddingTop: 12,
    gap: CARD_GAP,
  },
  cardWrapper: {
    width: CARD_WIDTH,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1.5,
    overflow: "hidden",
    height: CARD_HEIGHT,
  },
  cardImage: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
  cardImageDimmed: {
    opacity: 0.3,
  },
  cardOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  rarityStripe: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  cardBottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 10,
    alignItems: "center",
    gap: 4,
  },
  lockIcon: {
    marginBottom: 4,
  },
  cardName: {
    fontSize: 12,
    fontWeight: "800",
    color: "#fff",
    textAlign: "center",
    letterSpacing: 0.3,
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  cardNameLocked: {
    color: "rgba(255,255,255,0.12)",
  },
  rarityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
  },
  rarityText: {
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 1,
  },
  categoryTag: {
    position: "absolute",
    top: 8,
    left: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  categoryText: {
    fontSize: 7,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.88)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    width: "100%",
    maxWidth: 320,
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "rgba(212,164,32,0.25)",
    backgroundColor: "#0a0a0a",
  },
  modalImageWrap: {
    width: "100%",
    height: 240,
    overflow: "hidden",
  },
  modalImage: {
    width: "100%",
    height: "100%",
  },
  modalImageGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  modalRarityBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  modalContent: {
    padding: 20,
    alignItems: "center",
    gap: 10,
  },
  modalIconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  modalName: {
    fontSize: 20,
    fontWeight: "900",
    color: "#fff",
    textAlign: "center",
    letterSpacing: 0.5,
  },
  modalRarityBadge: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 12,
  },
  modalRarityText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  modalDescription: {
    fontSize: 14,
    fontWeight: "500",
    color: "rgba(255,255,255,0.7)",
    textAlign: "center",
    fontStyle: "italic",
    lineHeight: 20,
  },
  modalEarned: {
    fontSize: 10,
    fontWeight: "600",
    color: "rgba(255,255,255,0.3)",
    marginTop: 2,
  },
  modalClose: {
    marginTop: 6,
    paddingHorizontal: 28,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(212,164,32,0.3)",
    backgroundColor: "rgba(212,164,32,0.08)",
  },
  modalCloseText: {
    fontSize: 12,
    fontWeight: "800",
    color: Colors.gold,
    letterSpacing: 1,
  },
});
