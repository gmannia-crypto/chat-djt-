import React, { useState, useRef, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TextInput,
  Pressable,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { createAudioPlayer, type AudioPlayer as ExpoAudioPlayer } from "expo-audio";
import Colors from "@/constants/colors";
import {
  Message,
  getConversation,
  saveMessages,
  generateUniqueId,
} from "@/lib/chat-storage";
import { streamChat } from "@/lib/stream-chat";
import { getApiUrl } from "@/lib/query-client";

const TRUMP_VOICE_KEY = "chatdjt_trump_voice";
const AUTO_SPEAK_KEY = "chatdjt_auto_speak";

let currentPlayer: ExpoAudioPlayer | HTMLAudioElement | null = null;

function MessageBubble({
  message,
  onSpeak,
  isSpeaking,
  isSpeakingThisMessage,
}: {
  message: Message;
  onSpeak: (messageId: string, text: string) => void;
  isSpeaking: boolean;
  isSpeakingThisMessage: boolean;
}) {
  const isUser = message.role === "user";

  return (
    <View
      style={[
        styles.bubbleRow,
        isUser ? styles.bubbleRowUser : styles.bubbleRowAssistant,
      ]}
    >
      {!isUser && (
        <View style={styles.avatarContainer}>
          <MaterialCommunityIcons name="crown" size={16} color={Colors.gold} />
        </View>
      )}
      <View style={isUser ? styles.userBubbleWrap : styles.assistantBubbleWrap}>
        <View
          style={[
            styles.bubble,
            isUser ? styles.bubbleUser : styles.bubbleAssistant,
          ]}
        >
          <Text
            style={[
              styles.bubbleText,
              isUser ? styles.bubbleTextUser : styles.bubbleTextAssistant,
            ]}
          >
            {message.content}
          </Text>
        </View>
        {!isUser && message.content.length > 0 && (
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onSpeak(message.id, message.content);
            }}
            disabled={isSpeaking && !isSpeakingThisMessage}
            style={[
              styles.speakButton,
              isSpeakingThisMessage && styles.speakButtonActive,
              isSpeaking && !isSpeakingThisMessage && styles.speakButtonDisabled,
            ]}
            testID={`speak-${message.id}`}
          >
            {isSpeakingThisMessage ? (
              <ActivityIndicator size={12} color={Colors.gold} />
            ) : (
              <Ionicons name="volume-high" size={14} color={Colors.whiteMuted} />
            )}
          </Pressable>
        )}
      </View>
    </View>
  );
}

function TypingIndicator() {
  return (
    <Animated.View entering={FadeIn.duration(300)} style={styles.typingRow}>
      <View style={styles.avatarContainer}>
        <MaterialCommunityIcons name="crown" size={16} color={Colors.gold} />
      </View>
      <View style={styles.typingBubble}>
        <View style={styles.typingDots}>
          <Animated.View
            entering={FadeIn.delay(0).duration(400)}
            style={styles.dot}
          />
          <Animated.View
            entering={FadeIn.delay(200).duration(400)}
            style={styles.dot}
          />
          <Animated.View
            entering={FadeIn.delay(400).duration(400)}
            style={styles.dot}
          />
        </View>
      </View>
    </Animated.View>
  );
}

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [showTyping, setShowTyping] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [trumpVoice, setTrumpVoice] = useState(true);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [autoSpeak, setAutoSpeak] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const initializedRef = useRef(false);
  const conversationIdRef = useRef(id);
  const trumpVoiceRef = useRef(true);
  const autoSpeakRef = useRef(false);
  const pendingAutoSpeakRef = useRef<string | null>(null);

  useEffect(() => {
    loadConversation();
    loadVoicePreference();
    loadAutoSpeakPreference();
  }, [id]);

  async function loadVoicePreference() {
    try {
      const saved = await AsyncStorage.getItem(TRUMP_VOICE_KEY);
      if (saved !== null) {
        const val = saved === "true";
        setTrumpVoice(val);
        trumpVoiceRef.current = val;
      }
    } catch {}
  }

  async function loadAutoSpeakPreference() {
    try {
      const saved = await AsyncStorage.getItem(AUTO_SPEAK_KEY);
      if (saved !== null) {
        const val = saved === "true";
        setAutoSpeak(val);
        autoSpeakRef.current = val;
      }
    } catch {}
  }

  async function toggleTrumpVoice() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const newVal = !trumpVoice;
    setTrumpVoice(newVal);
    trumpVoiceRef.current = newVal;
    await AsyncStorage.setItem(TRUMP_VOICE_KEY, String(newVal));
  }

  async function toggleAutoSpeak() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const newVal = !autoSpeak;
    setAutoSpeak(newVal);
    autoSpeakRef.current = newVal;
    await AsyncStorage.setItem(AUTO_SPEAK_KEY, String(newVal));
  }

  async function handleSpeak(messageId: string, text: string) {
    if (speakingMessageId === messageId) {
      if (currentPlayer) {
        if (currentPlayer instanceof HTMLAudioElement) {
          currentPlayer.pause();
          currentPlayer.src = "";
        } else {
          currentPlayer.pause();
          currentPlayer.remove();
        }
        currentPlayer = null;
      }
      setSpeakingMessageId(null);
      return;
    }

    if (currentPlayer) {
      if (currentPlayer instanceof HTMLAudioElement) {
        currentPlayer.pause();
        currentPlayer.src = "";
      } else {
        currentPlayer.pause();
        currentPlayer.remove();
      }
      currentPlayer = null;
    }

    setSpeakingMessageId(messageId);

    try {
      const baseUrl = getApiUrl();
      const response = await globalThis.fetch(`${baseUrl}api/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) throw new Error("TTS request failed");

      const audioBlob = await response.blob();

      if (Platform.OS === "web") {
        const blobUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(blobUrl);
        currentPlayer = audio;

        audio.onended = () => {
          setSpeakingMessageId(null);
          URL.revokeObjectURL(blobUrl);
          currentPlayer = null;
        };

        audio.onerror = () => {
          setSpeakingMessageId(null);
          URL.revokeObjectURL(blobUrl);
          currentPlayer = null;
        };

        await audio.play();
      } else {
        const reader = new FileReader();
        const dataUri = await new Promise<string>((resolve, reject) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(audioBlob);
        });

        const player = createAudioPlayer({ uri: dataUri });
        currentPlayer = player;

        player.addListener("playbackStatusUpdate", (status: any) => {
          if (status.didJustFinish) {
            setSpeakingMessageId(null);
            player.remove();
            currentPlayer = null;
          }
        });

        player.play();
      }
    } catch (error) {
      console.error("TTS playback error:", error);
      setSpeakingMessageId(null);
    }
  }

  async function loadConversation() {
    if (initializedRef.current) return;
    const conv = await getConversation(id!);
    if (conv) {
      setMessages(conv.messages);
    }
    initializedRef.current = true;
    setIsLoading(false);
  }

  async function handleSend() {
    const text = inputText.trim();
    if (!text || isStreaming) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setInputText("");

    const currentMessages = [...messages];
    const userMessage: Message = {
      id: generateUniqueId(),
      role: "user",
      content: text,
      timestamp: Date.now(),
    };

    const updatedWithUser = [...currentMessages, userMessage];
    setMessages(updatedWithUser);
    setIsStreaming(true);
    setShowTyping(true);

    let fullContent = "";
    let assistantAdded = false;
    let finalMessages = updatedWithUser;

    try {
      const chatHistory = [
        ...currentMessages.map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: text },
      ];

      const voiceSetting = trumpVoiceRef.current;
      await streamChat(chatHistory, (chunk) => {
        fullContent += chunk;

        if (!assistantAdded) {
          setShowTyping(false);
          const assistantMsg: Message = {
            id: generateUniqueId(),
            role: "assistant",
            content: chunk,
            timestamp: Date.now(),
          };
          setMessages((prev) => {
            const updated = [...prev, assistantMsg];
            finalMessages = updated;
            return updated;
          });
          assistantAdded = true;
        } else {
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              ...updated[updated.length - 1],
              content: fullContent,
            };
            finalMessages = updated;
            return updated;
          });
        }
      }, voiceSetting);
    } catch (error) {
      setShowTyping(false);
      const errorMsg: Message = {
        id: generateUniqueId(),
        role: "assistant",
        content:
          "Look, we had a little problem. Believe me, it's not my fault. The FAKE servers are acting up. Try again!",
        timestamp: Date.now(),
      };
      setMessages((prev) => {
        const updated = [...prev, errorMsg];
        finalMessages = updated;
        return updated;
      });
    } finally {
      setIsStreaming(false);
      setShowTyping(false);
      await saveMessages(conversationIdRef.current!, finalMessages);

      if (autoSpeakRef.current && fullContent.length > 0) {
        const lastMsg = finalMessages[finalMessages.length - 1];
        if (lastMsg && lastMsg.role === "assistant") {
          handleSpeak(lastMsg.id, lastMsg.content);
        }
      }
    }
  }

  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const webBottomInset = Platform.OS === "web" ? 34 : 0;
  const reversedMessages = [...messages].reverse();

  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={Colors.gold} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <View style={styles.chatHeader}>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.back();
          }}
          style={styles.backButton}
          testID="back-button"
        >
          <Ionicons name="chevron-back" size={24} color={Colors.gold} />
        </Pressable>
        <View style={styles.chatHeaderCenter}>
          <MaterialCommunityIcons name="crown" size={20} color={Colors.gold} />
          <Text style={styles.chatHeaderTitle}>Chat DJT</Text>
        </View>
        <View style={styles.headerRight}>
          <Pressable
            onPress={toggleAutoSpeak}
            style={[
              styles.autoSpeakToggle,
              autoSpeak ? styles.autoSpeakOn : styles.autoSpeakOff,
            ]}
            testID="auto-speak-toggle"
          >
            <Ionicons
              name={autoSpeak ? "volume-high" : "volume-mute"}
              size={18}
              color={autoSpeak ? Colors.gold : Colors.whiteMuted}
            />
          </Pressable>
          <Pressable
            onPress={toggleTrumpVoice}
            style={[
              styles.voiceToggle,
              trumpVoice ? styles.voiceToggleOn : styles.voiceToggleOff,
            ]}
            disabled={isStreaming}
            testID="voice-toggle"
          >
            <MaterialCommunityIcons
              name={trumpVoice ? "account-voice" : "account-voice-off"}
              size={18}
              color={trumpVoice ? Colors.gold : Colors.whiteMuted}
            />
            <Text
              style={[
                styles.voiceToggleText,
                { color: trumpVoice ? Colors.gold : Colors.whiteMuted },
              ]}
            >
              {trumpVoice ? "DJT" : "Spirit"}
            </Text>
          </Pressable>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior="padding"
        keyboardVerticalOffset={0}
      >
        <FlatList
          data={reversedMessages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <MessageBubble
              message={item}
              onSpeak={handleSpeak}
              isSpeaking={!!speakingMessageId}
              isSpeakingThisMessage={speakingMessageId === item.id}
            />
          )}
          inverted={messages.length > 0}
          ListHeaderComponent={showTyping ? <TypingIndicator /> : null}
          ListEmptyComponent={
            <View style={styles.welcomeContainer}>
              <Animated.View
                entering={FadeInDown.duration(600)}
                style={styles.welcomeInner}
              >
                <MaterialCommunityIcons
                  name="crown"
                  size={48}
                  color={Colors.gold}
                />
                <Text style={styles.welcomeTitle}>
                  Ask Me Anything!
                </Text>
                <Text style={styles.welcomeSubtitle}>
                  I know more about everything than anybody. Believe me. Go ahead, ask!
                </Text>
              </Animated.View>
            </View>
          }
          contentContainerStyle={[
            styles.messageList,
            messages.length === 0 && styles.messageListEmpty,
          ]}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        />

        <View
          style={[
            styles.inputContainer,
            { paddingBottom: insets.bottom + webBottomInset + 8 },
          ]}
        >
          <View style={styles.inputRow}>
            <TextInput
              ref={inputRef}
              style={styles.input}
              placeholder="Ask the greatest president ever..."
              placeholderTextColor={Colors.whiteMuted}
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={2000}
              blurOnSubmit={false}
              onSubmitEditing={handleSend}
              editable={!isStreaming}
              testID="chat-input"
            />
            <Pressable
              onPress={() => {
                handleSend();
                inputRef.current?.focus();
              }}
              disabled={!inputText.trim() || isStreaming}
              style={({ pressed }) => [
                styles.sendButton,
                (!inputText.trim() || isStreaming) && styles.sendButtonDisabled,
                pressed && styles.sendButtonPressed,
              ]}
              testID="send-button"
            >
              {isStreaming ? (
                <ActivityIndicator size="small" color={Colors.black} />
              ) : (
                <Ionicons name="arrow-up" size={20} color={Colors.black} />
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  chatHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  chatHeaderCenter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  chatHeaderTitle: {
    fontSize: 18,
    fontFamily: "PlayfairDisplay_700Bold",
    color: Colors.gold,
  },
  messageList: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  messageListEmpty: {
    flex: 1,
  },
  bubbleRow: {
    flexDirection: "row",
    marginBottom: 12,
    maxWidth: "85%",
  },
  bubbleRowUser: {
    alignSelf: "flex-end",
  },
  bubbleRowAssistant: {
    alignSelf: "flex-start",
  },
  avatarContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(212, 164, 32, 0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
    marginTop: 4,
  },
  bubble: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxWidth: "100%",
    flexShrink: 1,
  },
  bubbleUser: {
    backgroundColor: Colors.gold,
    borderBottomRightRadius: 4,
  },
  bubbleAssistant: {
    backgroundColor: Colors.card,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 22,
  },
  bubbleTextUser: {
    color: Colors.black,
    fontWeight: "500" as const,
  },
  bubbleTextAssistant: {
    color: Colors.white,
  },
  typingRow: {
    flexDirection: "row",
    alignSelf: "flex-start",
    marginBottom: 12,
  },
  typingBubble: {
    backgroundColor: Colors.card,
    borderRadius: 20,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  typingDots: {
    flexDirection: "row",
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.gold,
  },
  welcomeContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    transform: [{ scaleY: -1 }],
  },
  welcomeInner: {
    alignItems: "center",
    paddingHorizontal: 40,
    gap: 16,
  },
  welcomeTitle: {
    fontSize: 24,
    fontFamily: "PlayfairDisplay_700Bold",
    color: Colors.gold,
    textAlign: "center",
  },
  welcomeSubtitle: {
    fontSize: 15,
    color: Colors.whiteDim,
    textAlign: "center",
    lineHeight: 22,
  },
  inputContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.background,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 15,
    color: Colors.white,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.gold,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  sendButtonDisabled: {
    backgroundColor: Colors.goldDark,
    opacity: 0.5,
  },
  sendButtonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.9 }],
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  autoSpeakToggle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  autoSpeakOn: {
    backgroundColor: "rgba(212, 164, 32, 0.2)",
    borderColor: "rgba(212, 164, 32, 0.5)",
  },
  autoSpeakOff: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderColor: Colors.border,
  },
  voiceToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
  },
  voiceToggleOn: {
    backgroundColor: "rgba(212, 164, 32, 0.15)",
    borderColor: "rgba(212, 164, 32, 0.4)",
  },
  voiceToggleOff: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderColor: Colors.border,
  },
  voiceToggleText: {
    fontSize: 12,
    fontFamily: "PlayfairDisplay_700Bold",
  },
  userBubbleWrap: {
    maxWidth: "100%",
    flexShrink: 1,
  },
  assistantBubbleWrap: {
    maxWidth: "100%",
    flexShrink: 1,
  },
  speakButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 4,
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
  },
  speakButtonActive: {
    backgroundColor: "rgba(212, 164, 32, 0.15)",
  },
  speakButtonDisabled: {
    opacity: 0.3,
  },
});
