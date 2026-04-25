import React from "react";
import { router } from "expo-router";
import { VoiceMixerScreen } from "@/components/VoiceMixer";

export default function VoiceMixerRoute() {
  return (
    <VoiceMixerScreen
      onClose={() => {
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace("/");
        }
      }}
    />
  );
}
