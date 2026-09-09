import React from "react";
import { router } from "expo-router";
import { VoiceMixerScreen } from "@/components/VoiceMixer";

// Player-facing per-persona voice mixer, reachable from app/settings.tsx
// without the admin passcode. The admin-only route (app/voice-mixer.tsx,
// opened from the back office) keeps working unchanged; both routes render
// the same VoiceMixerScreen backed by the shared lib/persona-voice.ts store,
// so changes made here apply everywhere personas speak.
export default function VoiceSettingsRoute() {
  return (
    <VoiceMixerScreen
      onClose={() => {
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace("/settings");
        }
      }}
    />
  );
}
