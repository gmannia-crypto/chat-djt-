import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { View, Text, StyleSheet, Platform, Pressable, Dimensions } from "react-native";
import Animated, { FadeInRight, FadeOutRight, FadeInUp, FadeOutUp } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { getApiUrl } from "@/lib/query-client";

const ANON_NAMES = [
  "PatriotEagle", "MAGAMike", "CryptoQueen", "GoldBug24", "TrumpFan45",
  "DiamondHands", "StonksMaster", "FreedomFirst", "AmericaStrong", "SilverSurfer",
  "BasedTrader", "LibertyBell", "RedPillKing", "WallStWolf", "DealMaker99",
  "TokenHunter", "DebateKing", "VoteWarrior", "PropertyHawk", "WhaleAlert",
  "BitcoinBro", "GrandmaFan", "ArenaChamp", "TherapyGrad", "MuskFanboy",
  "RealEstatePro", "BullMarket", "MAGA2024", "TrumpVIP", "LuckyStrike",
];

interface LiveEvent {
  id: string;
  type: string;
  message: string;
  icon: string;
  color: string;
  timestamp: number;
}

interface LiveActivityContextType {
  events: LiveEvent[];
  logEvent: (type: string, detail?: string) => void;
  toastsEnabled: boolean;
  setToastsEnabled: (v: boolean) => void;
}

const LiveActivityContext = createContext<LiveActivityContextType>({
  events: [],
  logEvent: () => {},
  toastsEnabled: true,
  setToastsEnabled: () => {},
});

export const useLiveActivity = () => useContext(LiveActivityContext);

const EVENT_CONFIG: Record<string, { icon: string; color: string; templates: string[] }> = {
  visit: {
    icon: "eye",
    color: "#4ADE80",
    templates: ["just joined the site", "is browsing the app", "entered the lobby"],
  },
  therapy_start: {
    icon: "heart",
    color: "#ec4899",
    templates: ["started a therapy session", "is chatting with Trump", "opened a therapy chat"],
  },
  arena_enter: {
    icon: "flame",
    color: "#ff4d4d",
    templates: ["entered the Political Arena", "joined a live debate", "started a debate session"],
  },
  arena_vote: {
    icon: "thumbs-up",
    color: "#FFD700",
    templates: ["cast a debate vote", "voted in the Arena", "scored a debater"],
  },
  arena_win: {
    icon: "trophy",
    color: "#FFD700",
    templates: ["won a debate round!", "dominated the Arena!", "claimed victory!"],
  },
  token_purchase: {
    icon: "flash",
    color: "#FFD700",
    templates: ["bought D.C. Tokens!", "loaded up on tokens!", "just purchased tokens!"],
  },
  subscribe: {
    icon: "star",
    color: "#9333ea",
    templates: ["subscribed to VIP!", "joined the VIP club!", "upgraded their plan!"],
  },
  realestate_view: {
    icon: "home",
    color: "#1DA1F2",
    templates: ["is browsing properties", "searched real estate listings", "checked property values"],
  },
  sports_view: {
    icon: "football",
    color: "#53D337",
    templates: ["opened the Sports Book", "is checking predictions", "viewed sports analysis"],
  },
  finance_view: {
    icon: "trending-up",
    color: "#4A90D9",
    templates: ["opened Financial Faceoff", "is debating finances", "checked market analysis"],
  },
  mystery_box: {
    icon: "gift",
    color: "#FFD700",
    templates: ["opened a Mystery Box!", "revealed a mystery prize!", "got a mystery reward!"],
  },
};

function randomName(): string {
  return ANON_NAMES[Math.floor(Math.random() * ANON_NAMES.length)];
}

function buildEvent(type: string, detail?: string): LiveEvent {
  const config = EVENT_CONFIG[type] || EVENT_CONFIG.visit;
  const template = config.templates[Math.floor(Math.random() * config.templates.length)];
  const name = randomName();
  const isPurchase = type === "token_purchase" || type === "subscribe";
  const prefix = isPurchase ? "⚡ " : "";
  return {
    id: Date.now().toString() + Math.random().toString(36).substr(2, 6),
    type,
    message: `${prefix}@${name} ${detail || template}`,
    icon: config.icon,
    color: config.color,
    timestamp: Date.now(),
  };
}

function LiveToast({ event, onDismiss }: { event: LiveEvent; onDismiss: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 4000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Animated.View
      entering={FadeInRight.duration(300)}
      exiting={FadeOutRight.duration(300)}
      style={[toastStyles.container, { borderLeftColor: event.color }]}
    >
      <Pressable onPress={onDismiss} style={toastStyles.inner}>
        <View style={[toastStyles.iconCircle, { backgroundColor: event.color + "25" }]}>
          <Ionicons name={event.icon as any} size={14} color={event.color} />
        </View>
        <Text style={toastStyles.text} numberOfLines={1}>{event.message}</Text>
        <Ionicons name="close" size={12} color="rgba(255,255,255,0.3)" />
      </Pressable>
    </Animated.View>
  );
}

export function LiveActivityProvider({ children }: { children: React.ReactNode }) {
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [toastQueue, setToastQueue] = useState<LiveEvent[]>([]);
  const [currentToast, setCurrentToast] = useState<LiveEvent | null>(null);
  const [toastsEnabled, setToastsEnabled] = useState(true);
  const mountedRef = useRef(true);
  const lastFetchRef = useRef(0);
  const seenIdsRef = useRef(new Set<string>());

  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  const logEvent = useCallback((type: string, detail?: string) => {
    try {
      fetch(new URL("/api/live-activity/log", getApiUrl()).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, detail }),
      }).catch(() => {});
    } catch {}
  }, []);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const since = lastFetchRef.current || (Date.now() - 60000);
        const res = await fetch(
          new URL(`/api/live-activity/feed?since=${since}`, getApiUrl()).toString()
        );
        if (!res.ok) return;
        const data = await res.json();
        if (!mountedRef.current) return;

        const newEvents: LiveEvent[] = [];
        for (const ev of (data.events || [])) {
          if (!seenIdsRef.current.has(ev.id)) {
            seenIdsRef.current.add(ev.id);
            newEvents.push(ev);
          }
        }

        if (newEvents.length > 0) {
          setEvents((prev) => [...newEvents, ...prev].slice(0, 30));
          if (toastsEnabled) {
            setToastQueue((prev) => [...prev, ...newEvents.slice(0, 2)]);
          }
        }
        lastFetchRef.current = Date.now();
      } catch {}
    };

    fetchEvents();
    const interval = setInterval(fetchEvents, 8000);
    return () => clearInterval(interval);
  }, [toastsEnabled]);

  useEffect(() => {
    if (currentToast || toastQueue.length === 0) return;
    const next = toastQueue[0];
    setToastQueue((prev) => prev.slice(1));
    setCurrentToast(next);
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  }, [toastQueue, currentToast]);

  const dismissToast = useCallback(() => {
    setCurrentToast(null);
  }, []);

  return (
    <LiveActivityContext.Provider value={{ events, logEvent, toastsEnabled, setToastsEnabled }}>
      {children}
      {currentToast && toastsEnabled && (
        <View style={toastStyles.wrapper} pointerEvents="box-none">
          <LiveToast event={currentToast} onDismiss={dismissToast} />
        </View>
      )}
    </LiveActivityContext.Provider>
  );
}

const toastStyles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    top: Platform.OS === "web" ? 75 : 55,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 9999,
    pointerEvents: "box-none",
  },
  container: {
    backgroundColor: "rgba(20,20,35,0.95)",
    borderRadius: 10,
    borderLeftWidth: 3,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    maxWidth: 360,
    width: "90%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 10,
  },
  inner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  iconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: "center",
    alignItems: "center",
  },
  text: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 12,
    fontWeight: "600" as const,
    flex: 1,
  },
});
