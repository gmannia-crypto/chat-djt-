import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";

const STREAK_KEY = "chatdjt_streak";
const LAST_VISIT_KEY = "chatdjt_last_visit";
const BADGES_KEY = "chatdjt_badges";

export interface Badge {
  id: string;
  label: string;
  icon: string;
  earned: boolean;
}

const ALL_BADGES: Badge[] = [
  { id: "first_session", label: "First Session", icon: "🎭", earned: false },
  { id: "streak_3", label: "3-Day Streak", icon: "🔥", earned: false },
  { id: "streak_7", label: "7-Day Streak", icon: "🌟", earned: false },
  { id: "streak_30", label: "30-Day Streak", icon: "👑", earned: false },
  { id: "arena_debut", label: "Arena Debut", icon: "⚔️", earned: false },
  { id: "therapy_complete", label: "Therapy Graduate", icon: "🧠", earned: false },
  { id: "fortune_seeker", label: "Fortune Seeker", icon: "🔮", earned: false },
  { id: "roast_survivor", label: "Roast Survivor", icon: "🔥", earned: false },
  { id: "share_first", label: "First Share", icon: "📤", earned: false },
  { id: "debate_5", label: "5 Debates", icon: "🏆", earned: false },
];

interface EngagementContextValue {
  streak: number;
  badges: Badge[];
  showStreakToast: boolean;
  dismissStreakToast: () => void;
  awardBadge: (badgeId: string) => void;
  newBadge: Badge | null;
  dismissNewBadge: () => void;
  shareCard: ShareCardData | null;
  showShareCard: (title: string, quote: string, context?: string) => void;
  dismissShareCard: () => void;
}

export interface ShareCardData {
  title: string;
  quote: string;
  context: string;
}

const EngagementContext = createContext<EngagementContextValue | null>(null);

export function EngagementProvider({ children }: { children: ReactNode }) {
  const [streak, setStreak] = useState(0);
  const [badges, setBadges] = useState<Badge[]>(ALL_BADGES);
  const [showStreakToast, setShowStreakToast] = useState(false);
  const [newBadge, setNewBadge] = useState<Badge | null>(null);
  const [shareCard, setShareCard] = useState<ShareCardData | null>(null);

  useEffect(() => {
    (async () => {
      const savedBadges = await AsyncStorage.getItem(BADGES_KEY);
      if (savedBadges) {
        const earnedIds: string[] = JSON.parse(savedBadges);
        setBadges(ALL_BADGES.map(b => ({ ...b, earned: earnedIds.includes(b.id) })));
      }

      const savedStreak = await AsyncStorage.getItem(STREAK_KEY);
      const lastVisit = await AsyncStorage.getItem(LAST_VISIT_KEY);
      const today = new Date().toDateString();
      let currentStreak = parseInt(savedStreak || "0");

      if (lastVisit !== today) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        if (lastVisit === yesterday.toDateString()) {
          currentStreak++;
          setShowStreakToast(true);
          setTimeout(() => setShowStreakToast(false), 4000);
        } else if (lastVisit) {
          currentStreak = 1;
        } else {
          currentStreak = 1;
        }

        await AsyncStorage.setItem(STREAK_KEY, String(currentStreak));
        await AsyncStorage.setItem(LAST_VISIT_KEY, today);
      }

      setStreak(currentStreak);

      if (currentStreak >= 3) await checkAndAwardBadge("streak_3");
      if (currentStreak >= 7) await checkAndAwardBadge("streak_7");
      if (currentStreak >= 30) await checkAndAwardBadge("streak_30");
    })();
  }, []);

  async function checkAndAwardBadge(badgeId: string) {
    const saved = await AsyncStorage.getItem(BADGES_KEY);
    const earnedIds: string[] = saved ? JSON.parse(saved) : [];
    if (!earnedIds.includes(badgeId)) {
      earnedIds.push(badgeId);
      await AsyncStorage.setItem(BADGES_KEY, JSON.stringify(earnedIds));
      setBadges(ALL_BADGES.map(b => ({ ...b, earned: earnedIds.includes(b.id) })));
      const badge = ALL_BADGES.find(b => b.id === badgeId);
      if (badge) {
        setNewBadge({ ...badge, earned: true });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setTimeout(() => setNewBadge(null), 4000);
      }
    }
  }

  const awardBadge = useCallback(async (badgeId: string) => {
    await checkAndAwardBadge(badgeId);
  }, []);

  const showShareCardFn = useCallback((title: string, quote: string, context: string = "") => {
    setShareCard({ title, quote, context });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const dismissShareCard = useCallback(() => setShareCard(null), []);
  const dismissStreakToast = useCallback(() => setShowStreakToast(false), []);
  const dismissNewBadge = useCallback(() => setNewBadge(null), []);

  return (
    <EngagementContext.Provider value={{
      streak,
      badges,
      showStreakToast,
      dismissStreakToast,
      awardBadge,
      newBadge,
      dismissNewBadge,
      shareCard,
      showShareCard: showShareCardFn,
      dismissShareCard,
    }}>
      {children}
    </EngagementContext.Provider>
  );
}

export function useEngagement() {
  const ctx = useContext(EngagementContext);
  if (!ctx) throw new Error("useEngagement must be inside EngagementProvider");
  return ctx;
}
