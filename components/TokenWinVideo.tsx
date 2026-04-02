import React, { useRef, useEffect, useCallback, useMemo } from "react";
import { StyleSheet, View, Pressable, Text, Platform, Modal, Image } from "react-native";
import { Video, ResizeMode } from "expo-av";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, ZoomIn } from "react-native-reanimated";
import Colors from "@/constants/colors";
import { getApiUrl } from "@/lib/query-client";

interface TokenWinVideoProps {
  visible: boolean;
  onClose: () => void;
  amount?: number;
  source?: string;
}

export function TokenWinVideo({ visible, onClose, amount, source }: TokenWinVideoProps) {
  const videoRef = useRef<Video>(null);
  const webVideoRef = useRef<HTMLVideoElement | null>(null);

  const videoUrl = useMemo(() => {
    const base = getApiUrl().replace(/\/$/, "");
    return `${base}/public/token-win.mp4`;
  }, []);

  useEffect(() => {
    if (visible) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 200);
      setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium), 400);
      setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light), 600);
    }
  }, [visible]);

  const handleVideoEnd = useCallback(() => {
    setTimeout(onClose, 800);
  }, [onClose]);

  useEffect(() => {
    if (!visible && Platform.OS === "web" && webVideoRef.current) {
      webVideoRef.current.pause();
      webVideoRef.current.currentTime = 0;
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <Pressable style={st.overlay} onPress={onClose}>
        <Animated.View entering={ZoomIn.duration(400)} style={st.container}>
          <View style={st.videoWrap}>
            {Platform.OS === "web" ? (
              <video
                ref={(el: any) => { webVideoRef.current = el; }}
                src={videoUrl}
                autoPlay
                playsInline
                onEnded={handleVideoEnd}
                style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 20 } as any}
              />
            ) : (
              <Video
                ref={videoRef}
                source={{ uri: videoUrl }}
                style={st.video}
                resizeMode={ResizeMode.COVER}
                shouldPlay
                isLooping={false}
                onPlaybackStatusUpdate={(status: any) => {
                  if (status.didJustFinish) handleVideoEnd();
                }}
              />
            )}
          </View>

          <Animated.View entering={FadeIn.delay(300).duration(500)} style={st.infoOverlay}>
            <Image source={require("@/assets/images/dc-lightning-token.jpeg")} style={st.tokenIcon} />
            {amount ? (
              <Text style={st.amountText}>+{amount}</Text>
            ) : null}
            <Text style={st.labelText}>
              {source ? `D.C. Tokens from ${source}!` : "D.C. Tokens Added!"}
            </Text>
          </Animated.View>

          <Pressable onPress={onClose} style={({ pressed }) => [st.closeBtn, pressed && { opacity: 0.7 }]}>
            <Text style={st.closeBtnText}>TREMENDOUS!</Text>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const st = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    width: "90%",
    maxWidth: 400,
    alignItems: "center",
  },
  videoWrap: {
    width: "100%",
    aspectRatio: 9 / 16,
    maxHeight: 420,
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: Colors.gold,
    ...Platform.select({
      web: {
        boxShadow: "0 0 40px rgba(255,215,0,0.4)",
      },
    }),
  },
  video: {
    width: "100%",
    height: "100%",
  },
  infoOverlay: {
    alignItems: "center",
    marginTop: 16,
  },
  tokenIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: Colors.gold,
  },
  amountText: {
    fontSize: 36,
    fontWeight: "900" as const,
    color: Colors.gold,
    marginTop: 6,
    textShadowColor: "rgba(255,215,0,0.5)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  labelText: {
    fontSize: 14,
    color: "rgba(255,255,255,0.8)",
    fontWeight: "600" as const,
    marginTop: 4,
  },
  closeBtn: {
    marginTop: 20,
    backgroundColor: Colors.gold,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 25,
  },
  closeBtnText: {
    color: "#000",
    fontWeight: "900" as const,
    fontSize: 16,
    letterSpacing: 1,
  },
});
