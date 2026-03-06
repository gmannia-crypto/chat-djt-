import React, { useState, useEffect, useCallback } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  Platform,
  Modal,
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
          const gradColors = RARITY_GRADIENTS[card.rarity];
          return (
            <Animated.View
              key={card.id}
              entering={FadeInDown.delay(index * 50).duration(300)}
              style={styles.cardWrapper}
            >
              <Pressable
                onPress={() => handleCardPress(card)}
                style={({ pressed }) => [
                  styles.card,
                  !owned && styles.cardLocked,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <LinearGradient
                  colors={owned ? gradColors as [string, string, string] : ["#151515", "#0a0a0a", "#151515"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFillObject}
                />
                {owned && (
                  <View style={[styles.cardShine, { backgroundColor: `${rarityColor}08` }]} />
                )}
                <View style={[styles.rarityStripe, { backgroundColor: owned ? rarityColor : "rgba(255,255,255,0.05)" }]} />
                <View style={styles.cardContent}>
                  <View style={[styles.iconCircle, { backgroundColor: owned ? `${card.color}20` : "rgba(255,255,255,0.03)" }]}>
                    <MaterialCommunityIcons
                      name={card.icon as any}
                      size={28}
                      color={owned ? card.color : "rgba(255,255,255,0.1)"}
                    />
                  </View>
                  <Text style={[styles.cardName, !owned && styles.cardNameLocked]} numberOfLines={1}>
                    {owned ? card.name : "???"}
                  </Text>
                  <View style={[styles.rarityBadge, { backgroundColor: owned ? `${rarityColor}20` : "rgba(255,255,255,0.03)" }]}>
                    <Text style={[styles.rarityText, { color: owned ? rarityColor : "rgba(255,255,255,0.15)" }]}>
                      {card.rarity.toUpperCase()}
                    </Text>
                  </View>
                  {!owned && (
                    <View style={styles.lockOverlay}>
                      <Ionicons name="lock-closed" size={20} color="rgba(255,255,255,0.15)" />
                    </View>
                  )}
                </View>
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
                <LinearGradient
                  colors={RARITY_GRADIENTS[selectedCard.rarity] as [string, string, string]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFillObject}
                />
                <View style={[styles.modalRarityBar, { backgroundColor: RARITY_COLORS[selectedCard.rarity] }]} />
                <View style={styles.modalContent}>
                  <View style={[styles.modalIconCircle, { backgroundColor: `${selectedCard.color}25` }]}>
                    <MaterialCommunityIcons
                      name={selectedCard.icon as any}
                      size={48}
                      color={selectedCard.color}
                    />
                  </View>
                  <Text style={styles.modalName}>{selectedCard.name}</Text>
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
    paddingHorizontal: 12,
    paddingTop: 12,
    gap: 10,
  },
  cardWrapper: {
    width: "47%",
    flexGrow: 1,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
    minHeight: 160,
  },
  cardLocked: {
    borderColor: "rgba(255,255,255,0.03)",
  },
  cardShine: {
    ...StyleSheet.absoluteFillObject,
  },
  rarityStripe: {
    height: 3,
    width: "100%",
  },
  cardContent: {
    padding: 14,
    alignItems: "center",
    gap: 8,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  cardName: {
    fontSize: 12,
    fontWeight: "800",
    color: "#fff",
    textAlign: "center",
    letterSpacing: 0.3,
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
  lockOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    width: "100%",
    maxWidth: 320,
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(212,164,32,0.2)",
  },
  modalRarityBar: {
    height: 4,
    width: "100%",
  },
  modalContent: {
    padding: 28,
    alignItems: "center",
    gap: 12,
  },
  modalIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  modalName: {
    fontSize: 22,
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
    marginTop: 4,
  },
  modalClose: {
    marginTop: 8,
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
