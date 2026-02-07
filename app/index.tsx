import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  Pressable,
  Platform,
  Alert,
  Image,
  Modal,
  Dimensions,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons, Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import Animated, {
  FadeInDown,
  FadeInUp,
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  cancelAnimation,
} from "react-native-reanimated";
import Colors from "@/constants/colors";
import { getApiUrl } from "@/lib/query-client";
import {
  Conversation,
  getAllConversations,
  createConversation,
  deleteConversation,
} from "@/lib/chat-storage";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

function ConversationItem({
  item,
  index,
  onDelete,
}: {
  item: Conversation;
  index: number;
  onDelete: (id: string) => void;
}) {
  const lastMessage = item.messages[item.messages.length - 1];
  const preview = lastMessage
    ? lastMessage.content.slice(0, 80) + (lastMessage.content.length > 80 ? "..." : "")
    : "Start a tremendous conversation...";

  const timeAgo = getTimeAgo(item.updatedAt);

  return (
    <Animated.View entering={FadeInDown.delay(index * 60).duration(400)}>
      <Pressable
        style={({ pressed }) => [
          styles.conversationCard,
          pressed && styles.conversationCardPressed,
        ]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.push({ pathname: "/chat/[id]", params: { id: item.id } });
        }}
        onLongPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          if (Platform.OS === "web") {
            if (confirm("Delete this conversation?")) {
              onDelete(item.id);
            }
          } else {
            Alert.alert("Delete Chat", "Remove this tremendous conversation?", [
              { text: "Keep It", style: "cancel" },
              {
                text: "Delete",
                style: "destructive",
                onPress: () => onDelete(item.id),
              },
            ]);
          }
        }}
        testID={`conversation-${item.id}`}
      >
        <View style={styles.conversationIcon}>
          <MaterialCommunityIcons name="crown" size={22} color={Colors.gold} />
        </View>
        <View style={styles.conversationContent}>
          <View style={styles.conversationHeader}>
            <Text style={styles.conversationTitle} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={styles.conversationTime}>{timeAgo}</Text>
          </View>
          <Text style={styles.conversationPreview} numberOfLines={2}>
            {preview}
          </Text>
        </View>
        <Feather name="chevron-right" size={18} color={Colors.whiteMuted} />
      </Pressable>
    </Animated.View>
  );
}

let themePlayer: HTMLAudioElement | null = null;
let hasAutoPlayed = false;

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [archiveVisible, setArchiveVisible] = useState(false);
  const [isThemePlaying, setIsThemePlaying] = useState(false);
  const pulseAnim = useSharedValue(1);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseAnim.value }],
  }));

  useEffect(() => {
    if (isThemePlaying) {
      pulseAnim.value = withRepeat(
        withTiming(1.15, { duration: 600, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      );
    } else {
      cancelAnimation(pulseAnim);
      pulseAnim.value = withTiming(1, { duration: 200 });
    }
  }, [isThemePlaying]);

  useEffect(() => {
    if (!hasAutoPlayed) {
      hasAutoPlayed = true;
      playThemeSong();
    }
    return () => {
      if (themePlayer) {
        if (Platform.OS === "web") {
          (themePlayer as HTMLAudioElement).pause();
          (themePlayer as HTMLAudioElement).src = "";
        }
        themePlayer = null;
      }
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadConversations();
    }, [])
  );

  async function loadConversations() {
    const convs = await getAllConversations();
    setConversations(convs);
  }

  function getThemeSongUrl() {
    const baseUrl = getApiUrl();
    const songs = [
      "server/assets/theme-song.m4a",
      "server/assets/theme-song-2.mp3",
      "server/assets/theme-song-3.mp4",
      "server/assets/theme-song-4.mp3",
    ];
    const pick = songs[Math.floor(Math.random() * songs.length)];
    return `${baseUrl}${pick}`;
  }

  async function playThemeSong() {
    try {
      const url = getThemeSongUrl();

      if (Platform.OS === "web") {
        const audio = new Audio(url);
        themePlayer = audio;

        audio.onended = () => {
          setIsThemePlaying(false);
          themePlayer = null;
        };

        audio.onerror = () => {
          setIsThemePlaying(false);
          themePlayer = null;
        };

        await audio.play().catch(() => {
          setIsThemePlaying(false);
          themePlayer = null;
        });
        setIsThemePlaying(true);
      } else {
        const { createAudioPlayer } = await import("expo-audio");
        const player = createAudioPlayer(url);
        themePlayer = player as any;

        player.addListener("playbackStatusUpdate", (status: any) => {
          if (status.didJustFinish) {
            setIsThemePlaying(false);
            themePlayer = null;
          }
        });

        player.play();
        setIsThemePlaying(true);
      }
    } catch (error) {
      console.error("Theme song error:", error);
      setIsThemePlaying(false);
    }
  }

  function toggleThemeMusic() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (isThemePlaying && themePlayer) {
      if (Platform.OS === "web") {
        (themePlayer as HTMLAudioElement).pause();
        (themePlayer as HTMLAudioElement).currentTime = 0;
      }
      themePlayer = null;
      setIsThemePlaying(false);
      return;
    }

    playThemeSong();
  }

  async function handleNewChat() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const conv = await createConversation("New Chat");
    router.push({ pathname: "/chat/[id]", params: { id: conv.id } });
  }

  async function handleDelete(id: string) {
    await deleteConversation(id);
    setConversations((prev) => prev.filter((c) => c.id !== id));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const webBottomInset = Platform.OS === "web" ? 34 : 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <View style={styles.woodFrameOuter}>
        <View style={styles.woodFrameInner}>
          <Image
            source={require("@/assets/images/djt-logo.png")}
            style={styles.backgroundLogo}
            resizeMode="cover"
          />
        </View>
      </View>
      <LinearGradient
        colors={["rgba(10, 10, 10, 0)", "rgba(10, 10, 10, 0.1)", "rgba(10, 10, 10, 0.7)"]}
        style={styles.backgroundOverlay}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      <Animated.View
        entering={FadeInUp.duration(600)}
        style={styles.header}
      >
        <View style={styles.headerLeft}>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              loadConversations();
              setArchiveVisible(true);
            }}
            style={styles.headerButton}
            testID="archive-button"
          >
            <Ionicons name="folder-outline" size={24} color={Colors.whiteDim} />
          </Pressable>
        </View>
        <View style={styles.headerRight}>
          <Pressable
            onPress={toggleThemeMusic}
            style={styles.headerButton}
            testID="theme-music-button"
          >
            <Animated.View style={isThemePlaying ? pulseStyle : undefined}>
              <Ionicons
                name={isThemePlaying ? "musical-notes" : "musical-notes-outline"}
                size={22}
                color={isThemePlaying ? Colors.gold : Colors.whiteDim}
              />
            </Animated.View>
          </Pressable>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push("/admin");
            }}
            style={styles.headerButton}
            testID="admin-button"
          >
            <Ionicons name="settings-outline" size={22} color={Colors.whiteDim} />
          </Pressable>
        </View>
      </Animated.View>

      <View style={styles.centerContent} />

      <View
        style={[
          styles.fabContainer,
          { bottom: insets.bottom + webBottomInset + 20 },
        ]}
      >
        <Pressable
          onPress={handleNewChat}
          style={({ pressed }) => [
            styles.fab,
            pressed && styles.fabPressed,
          ]}
          testID="new-chat-button"
        >
          <LinearGradient
            colors={[Colors.goldLight, Colors.gold, Colors.goldDark]}
            style={styles.fabGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Ionicons name="add" size={30} color={Colors.black} />
          </LinearGradient>
        </Pressable>
      </View>

      <Modal
        visible={archiveVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setArchiveVisible(false)}
      >
        <View style={[styles.archiveContainer, { paddingTop: Platform.OS === "web" ? 20 : insets.top }]}>
          <View style={styles.archiveHeader}>
            <Text style={styles.archiveTitle}>Archive</Text>
            <Pressable
              onPress={() => setArchiveVisible(false)}
              style={styles.archiveCloseButton}
              testID="archive-close-button"
            >
              <Ionicons name="close" size={24} color={Colors.white} />
            </Pressable>
          </View>
          <FlatList
            data={conversations}
            keyExtractor={(item) => item.id}
            renderItem={({ item, index }) => (
              <ConversationItem item={item} index={index} onDelete={handleDelete} />
            )}
            contentContainerStyle={[
              styles.archiveListContent,
              { paddingBottom: insets.bottom + webBottomInset + 20 },
            ]}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="chatbubbles-outline" size={48} color={Colors.goldDark} />
                <Text style={styles.emptyTitle}>No Chats Yet</Text>
                <Text style={styles.emptySubtitle}>
                  Start a new conversation and it will appear here.
                </Text>
              </View>
            }
            showsVerticalScrollIndicator={false}
          />
        </View>
      </Modal>
    </View>
  );
}

function getTimeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(timestamp).toLocaleDateString();
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  woodFrameOuter: {
    position: "absolute",
    top: 8,
    left: 8,
    right: 8,
    bottom: 8,
    borderRadius: 12,
    borderWidth: 6,
    borderColor: "#3B2415",
    backgroundColor: "#1E0F07",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.8,
    shadowRadius: 16,
    elevation: 20,
    overflow: "hidden",
  },
  woodFrameInner: {
    flex: 1,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#5C3820",
    overflow: "hidden",
  },
  backgroundLogo: {
    width: "100%",
    height: "100%",
  },
  backgroundOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    zIndex: 10,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  headerButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  centerContent: {
    flex: 1,
    justifyContent: "flex-end",
    alignItems: "center",
    paddingBottom: 120,
    zIndex: 5,
  },
  brandTitle: {
    fontSize: 42,
    fontFamily: "PlayfairDisplay_900Black",
    color: Colors.gold,
    letterSpacing: 6,
    textShadowColor: "rgba(0, 0, 0, 0.8)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  },
  fabContainer: {
    position: "absolute",
    right: 20,
    zIndex: 10,
  },
  fab: {
    width: 60,
    height: 60,
    borderRadius: 30,
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  fabPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.92 }],
  },
  fabGradient: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  archiveContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  archiveHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  archiveTitle: {
    fontSize: 24,
    fontFamily: "PlayfairDisplay_700Bold",
    color: Colors.gold,
    letterSpacing: 1,
  },
  archiveCloseButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  archiveListContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  conversationCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  conversationCardPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.98 }],
  },
  conversationIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(212, 164, 32, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  conversationContent: {
    flex: 1,
    marginRight: 8,
  },
  conversationHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  conversationTitle: {
    fontSize: 16,
    fontFamily: "PlayfairDisplay_700Bold",
    color: Colors.white,
    flex: 1,
    marginRight: 8,
  },
  conversationTime: {
    fontSize: 12,
    color: Colors.whiteMuted,
  },
  conversationPreview: {
    fontSize: 13,
    color: Colors.whiteDim,
    lineHeight: 18,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 100,
    paddingHorizontal: 40,
    gap: 16,
  },
  emptyTitle: {
    fontSize: 22,
    fontFamily: "PlayfairDisplay_700Bold",
    color: Colors.gold,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 15,
    color: Colors.whiteDim,
    textAlign: "center",
    lineHeight: 22,
  },
});
