import React, { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { VoiceMixerScreen } from "@/components/VoiceMixer";
import { getApiUrl } from "@/lib/query-client";
import Colors from "@/constants/colors";

// Persona voice volume is a back-office-only control (see app/admin.tsx's
// PersonaVolumeSection). This route used to be reachable by any end user via
// SoundToggle; it's now gated behind the same admin passcode used elsewhere,
// so navigating here directly without having unlocked the back office bounces
// back out instead of exposing the mixer.
const ADMIN_KEY_STORAGE = "trumpbot-admin-key";

export default function VoiceMixerRoute() {
  const [checking, setChecking] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const savedKey = await AsyncStorage.getItem(ADMIN_KEY_STORAGE);
        if (!savedKey) {
          if (!cancelled) {
            setChecking(false);
            router.replace("/admin");
          }
          return;
        }
        const res = await fetch(new URL("/api/admin/auth-check", getApiUrl()).toString(), {
          headers: { "x-admin-key": savedKey },
        });
        const data = res.ok ? await res.json() : null;
        if (cancelled) return;
        if (data?.valid) {
          setAuthorized(true);
        } else {
          router.replace("/admin");
        }
      } catch {
        if (!cancelled) router.replace("/admin");
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (checking || !authorized) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.background, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color={Colors.gold} />
      </View>
    );
  }

  return (
    <VoiceMixerScreen
      onClose={() => {
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace("/admin");
        }
      }}
    />
  );
}
