import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Platform,
  type ImageSourcePropType,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import {
  PERSONA_VOICE_STORAGE,
  getVoiceSetting,
  usePersonaVoiceSettings,
  type PersonaVoiceSetting,
  type PersonaVoiceSettings,
} from "@/lib/persona-voice";

// Re-export the shared voice-settings primitives so existing imports from
// "@/components/VoiceMixer" keep working. The canonical store now lives in
// lib/persona-voice.ts and is consumed by every screen that plays persona TTS.
export {
  PERSONA_VOICE_STORAGE,
  getVoiceSetting,
  usePersonaVoiceSettings,
  type PersonaVoiceSetting,
  type PersonaVoiceSettings,
};

export interface PersonaMixerInfo {
  id: string;
  name: string;
  color: string;
  image: ImageSourcePropType;
  group: string;
}

export const VOICE_MIXER_PERSONAS: PersonaMixerInfo[] = [
  // Politics + Arena cast
  { id: "trump", name: "Donald Trump", color: "#ff4d4d", image: require("@/assets/images/persona-trump.png"), group: "Politics" },
  { id: "biden", name: "Joe Biden", color: "#0033A0", image: require("@/assets/images/persona-biden.png"), group: "Politics" },
  { id: "obama", name: "Barack Obama", color: "#1a3a5c", image: require("@/assets/images/persona-obama.png"), group: "Politics" },
  { id: "kamala", name: "Kamala Harris", color: "#7c3aed", image: require("@/assets/images/persona-kamala.png"), group: "Politics" },
  { id: "schumer", name: "Chuck Schumer", color: "#003DA5", image: require("@/assets/images/persona-schumer.png"), group: "Politics" },
  { id: "mcconnell", name: "Mitch McConnell", color: "#708090", image: require("@/assets/images/persona-mcconnell.png"), group: "Politics" },
  { id: "graham", name: "Lindsey Graham", color: "#B8860B", image: require("@/assets/images/persona-graham.png"), group: "Politics" },
  { id: "jimjordan", name: "Jim Jordan", color: "#8B0000", image: require("@/assets/images/persona-jimjordan.png"), group: "Politics" },
  { id: "mtg", name: "Marjorie Taylor Greene", color: "#dc2626", image: require("@/assets/images/persona-mtg.png"), group: "Politics" },
  { id: "rfk", name: "Robert F. Kennedy Jr.", color: "#7c3aed", image: require("@/assets/images/persona-rfk.png"), group: "Politics" },
  { id: "omar", name: "Ilhan Omar", color: "#2E8B57", image: require("@/assets/images/persona-omar.png"), group: "Politics" },
  { id: "netanyahu", name: "Benjamin Netanyahu", color: "#0038b8", image: require("@/assets/images/persona-netanyahu.png"), group: "Politics" },
  { id: "melania", name: "Melania Trump", color: "#C0C0C0", image: require("@/assets/images/persona-melania.png"), group: "Politics" },
  { id: "pambondi", name: "Pam Bondi", color: "#9c27b0", image: require("@/assets/images/persona-pambondi.png"), group: "Politics" },
  { id: "miller", name: "Stephen Miller", color: "#444444", image: require("@/assets/images/persona-miller.png"), group: "Politics" },
  { id: "erikakirk", name: "Erika Kirk", color: "#E8A2B8", image: require("@/assets/images/persona-erikakirk.png"), group: "Politics" },
  { id: "loomer", name: "Laura Loomer", color: "#8B0000", image: require("@/assets/images/persona-loomer.png"), group: "Politics" },
  { id: "leavitt", name: "Caroline Leavitt", color: "#1f3a8a", image: require("@/assets/images/persona-leavitt.png"), group: "Politics" },

  // Pundits + Media
  { id: "carville", name: "James Carville", color: "#5C4033", image: require("@/assets/images/persona-carville.png"), group: "Media" },
  { id: "maddow", name: "Rachel Maddow", color: "#4B0082", image: require("@/assets/images/persona-maddow.png"), group: "Media" },
  { id: "joyreid", name: "Joy Reid", color: "#A52A2A", image: require("@/assets/images/persona-joyreid.png"), group: "Media" },
  { id: "odonnell", name: "Lawrence O'Donnell", color: "#2563eb", image: require("@/assets/images/persona-odonnell.png"), group: "Media" },
  { id: "megynkelly", name: "Megyn Kelly", color: "#D4A420", image: require("@/assets/images/persona-megynkelly.png"), group: "Media" },
  { id: "candace", name: "Candace Owens", color: "#B22222", image: require("@/assets/images/persona-candace.png"), group: "Media" },
  { id: "galloway", name: "George Galloway", color: "#c41e3a", image: require("@/assets/images/persona-galloway.png"), group: "Media" },
  { id: "alexjones", name: "Alex Jones", color: "#FF4500", image: require("@/assets/images/persona-alexjones.png"), group: "Media" },

  // Personalities
  { id: "elon", name: "Elon Musk", color: "#1DA1F2", image: require("@/assets/images/persona-musk.png"), group: "Personalities" },
  { id: "musk", name: "Elon Musk (Money)", color: "#1DA1F2", image: require("@/assets/images/persona-musk.png"), group: "Personalities" },
  { id: "buffett", name: "Warren Buffett", color: "#1E5A99", image: require("@/assets/images/persona-buffett.png"), group: "Personalities" },
  { id: "suze", name: "Suze Orman", color: "#C71585", image: require("@/assets/images/persona-suze.png"), group: "Personalities" },
  { id: "dave", name: "Dave Ramsey", color: "#0B5394", image: require("@/assets/images/persona-dave.png"), group: "Personalities" },
  { id: "rosie", name: "Rosie O'Donnell", color: "#C71585", image: require("@/assets/images/persona-rosie.png"), group: "Personalities" },
  { id: "ruckus", name: "Uncle Ruckus", color: "#8b0000", image: require("@/assets/images/persona-ruckus.png"), group: "Personalities" },
  { id: "berniemc", name: "Bernie Mac", color: "#9B59B6", image: require("@/assets/images/persona-bernie.png"), group: "Personalities" },
  { id: "bernie", name: "Bernie Mac", color: "#9B59B6", image: require("@/assets/images/persona-bernie.png"), group: "Personalities" },
  { id: "grandma", name: "Your Grandma", color: "#ffffff", image: require("@/assets/images/persona-grandma.png"), group: "Personalities" },
  { id: "genie", name: "The Genie", color: "#00BFA5", image: require("@/assets/images/persona-genie.png"), group: "Personalities" },
  { id: "mansa", name: "Mansa Musa", color: "#FFD700", image: require("@/assets/images/persona-mansa.png"), group: "Personalities" },

  // Sports
  { id: "barkley", name: "Charles Barkley", color: "#FF6F00", image: require("@/assets/images/persona-barkley.png"), group: "Sports" },
  { id: "shannon", name: "Shannon Sharpe", color: "#1E88E5", image: require("@/assets/images/persona-shannon.png"), group: "Sports" },
  { id: "loudmouth", name: "Loudmouth", color: "#E53935", image: require("@/assets/images/persona-loudmouth.png"), group: "Sports" },
  { id: "jordan", name: "Michael Jordan", color: "#CE1141", image: require("@/assets/images/persona-jordan.png"), group: "Sports" },
  { id: "snoop", name: "Snoop Dogg", color: "#4CAF50", image: require("@/assets/images/persona-snoop.png"), group: "Sports" },
  { id: "rogan", name: "Joe Rogan", color: "#B71C1C", image: require("@/assets/images/persona-rogan.png"), group: "Sports" },
  { id: "maxkellerman", name: "Max Kellerman", color: "#5C6BC0", image: require("@/assets/images/persona-maxkellerman.png"), group: "Sports" },
  { id: "dickyV", name: "Dicky V", color: "#FF6F00", image: require("@/assets/images/persona-dickyV.png"), group: "Sports" },
  { id: "skipbayless", name: "Skip Bayless", color: "#0077C0", image: require("@/assets/images/persona-skipbayless.png"), group: "Sports" },

  // Racing
  { id: "speedDemon", name: "Speed Demon", color: "#FF3D00", image: require("@/assets/images/persona-speedDemon.png"), group: "Racing" },
  { id: "pitBoss", name: "Pit Boss", color: "#78909C", image: require("@/assets/images/persona-pitBoss.png"), group: "Racing" },
  { id: "driftQueen", name: "Drift Queen", color: "#E040FB", image: require("@/assets/images/persona-driftQueen.png"), group: "Racing" },
  { id: "throttle", name: "Throttle", color: "#FF6F00", image: require("@/assets/images/persona-throttle.png"), group: "Racing" },
  { id: "revTech", name: "Rev Tech", color: "#00BCD4", image: require("@/assets/images/persona-revTech.png"), group: "Racing" },

  // Soccer
  { id: "elCapitan", name: "El Capitán", color: "#F44336", image: require("@/assets/images/persona-elCapitan.png"), group: "Soccer" },
  { id: "sirGodfrey", name: "Sir Godfrey", color: "#5D4037", image: require("@/assets/images/persona-sirGodfrey.png"), group: "Soccer" },
  { id: "mamaFutbol", name: "Mama Fútbol", color: "#E91E63", image: require("@/assets/images/persona-mamaFutbol.png"), group: "Soccer" },
  { id: "phantomZZ", name: "Phantom ZZ", color: "#7E57C2", image: require("@/assets/images/persona-phantomZZ.png"), group: "Soccer" },
  { id: "theUltra", name: "The Ultra", color: "#FF9800", image: require("@/assets/images/persona-theUltra.png"), group: "Soccer" },
];

const VOICE_MIXER_GROUPS = [
  "Politics",
  "Media",
  "Personalities",
  "Sports",
  "Racing",
  "Soccer",
];

export function VoiceControlPopover({
  personaId,
  persona,
  setting,
  onClose,
  onUpdate,
}: {
  personaId: string | null;
  persona: { id: string; name: string; color: string; image: ImageSourcePropType } | undefined;
  setting: PersonaVoiceSetting | null;
  onClose: () => void;
  onUpdate: (update: Partial<PersonaVoiceSetting>) => void;
}) {
  const visible = !!personaId && !!persona && !!setting;
  const [trackWidth, setTrackWidth] = useState(0);
  const volume = setting?.volume ?? 1.0;
  const muted = setting?.muted ?? false;
  const settingRef = useRef<PersonaVoiceSetting>({ muted: false, volume: 1.0 });
  useEffect(() => {
    if (setting) settingRef.current = setting;
  }, [setting]);

  const updateVolumeFromTouch = (locationX: number) => {
    if (trackWidth <= 0) return;
    const pct = Math.max(0, Math.min(1, locationX / trackWidth));
    const rounded = Math.round(pct * 100) / 100;
    onUpdate({ volume: rounded, muted: rounded === 0 ? true : false });
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={popoverStyles.popoverBackdrop} onPress={onClose}>
        <Pressable style={popoverStyles.popoverCard} onPress={(e) => e.stopPropagation()}>
          {persona && (
            <>
              <View style={popoverStyles.popoverHeader}>
                <Image source={persona.image} style={[popoverStyles.popoverAvatar, { borderColor: persona.color }]} />
                <View style={{ flex: 1 }}>
                  <Text style={popoverStyles.popoverTitle}>{persona.name}</Text>
                  <Text style={popoverStyles.popoverSubtitle}>VOICE CONTROL</Text>
                </View>
                <Pressable onPress={onClose} testID="voice-popover-close" hitSlop={10}>
                  <Ionicons name="close" size={22} color="rgba(255,255,255,0.6)" />
                </Pressable>
              </View>

              <Pressable
                testID="voice-popover-mute"
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  const wasMuted = settingRef.current.muted;
                  const currentVolume = settingRef.current.volume;
                  if (wasMuted && currentVolume <= 0) {
                    onUpdate({ muted: false, volume: 0.5 });
                  } else {
                    onUpdate({ muted: !wasMuted });
                  }
                }}
                style={({ pressed }) => [
                  popoverStyles.muteToggle,
                  muted && { backgroundColor: "rgba(255,77,77,0.18)", borderColor: "#FF4D4D" },
                  pressed && { opacity: 0.8 },
                ]}
              >
                <Ionicons
                  name={muted ? "volume-mute" : "volume-high"}
                  size={18}
                  color={muted ? "#FF4D4D" : Colors.gold}
                />
                <Text style={[popoverStyles.muteToggleText, { color: muted ? "#FF4D4D" : Colors.gold }]}>
                  {muted ? "MUTED" : "UNMUTED"}
                </Text>
              </Pressable>

              <Text style={popoverStyles.volumeLabel}>VOLUME · {Math.round(volume * 100)}%</Text>
              <View
                testID="voice-popover-slider"
                style={popoverStyles.sliderTrack}
                onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
                onStartShouldSetResponder={() => true}
                onMoveShouldSetResponder={() => true}
                onResponderGrant={(e) => updateVolumeFromTouch(e.nativeEvent.locationX)}
                onResponderMove={(e) => updateVolumeFromTouch(e.nativeEvent.locationX)}
              >
                <View style={[popoverStyles.sliderFill, { width: `${volume * 100}%`, backgroundColor: persona.color }]} />
                <View style={[popoverStyles.sliderThumb, { left: `${volume * 100}%`, borderColor: persona.color }]} />
              </View>

              <View style={popoverStyles.presetRow}>
                {[0, 0.25, 0.5, 0.75, 1.0].map((v) => (
                  <Pressable
                    key={v}
                    testID={`voice-preset-${Math.round(v * 100)}`}
                    onPress={() => {
                      Haptics.selectionAsync();
                      onUpdate({ volume: v, muted: v === 0 });
                    }}
                    style={({ pressed }) => [
                      popoverStyles.presetBtn,
                      Math.abs(volume - v) < 0.01 && !muted && { backgroundColor: `${persona.color}30`, borderColor: persona.color },
                      pressed && { opacity: 0.8 },
                    ]}
                  >
                    <Text style={popoverStyles.presetText}>{v === 0 ? "MUTE" : v === 1.0 ? "MAX" : `${Math.round(v * 100)}%`}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function MixerRow({
  persona,
  setting,
  onUpdate,
}: {
  persona: PersonaMixerInfo;
  setting: PersonaVoiceSetting;
  onUpdate: (update: Partial<PersonaVoiceSetting>) => void;
}) {
  const [trackWidth, setTrackWidth] = useState(0);
  const muted = setting.muted;
  const volume = setting.volume;
  const settingRef = useRef<PersonaVoiceSetting>(setting);
  useEffect(() => {
    settingRef.current = setting;
  }, [setting]);

  const updateVolumeFromTouch = (locationX: number) => {
    if (trackWidth <= 0) return;
    const pct = Math.max(0, Math.min(1, locationX / trackWidth));
    const rounded = Math.round(pct * 100) / 100;
    onUpdate({ volume: rounded, muted: rounded === 0 ? true : false });
  };

  return (
    <View style={mixerStyles.row} testID={`voice-mixer-row-${persona.id}`}>
      <Image source={persona.image} style={[mixerStyles.avatar, { borderColor: persona.color }]} />
      <View style={mixerStyles.center}>
        <View style={mixerStyles.nameRow}>
          <Text style={mixerStyles.name} numberOfLines={1}>{persona.name}</Text>
          <Text style={[mixerStyles.volumeText, muted && { color: "#FF4D4D" }]}>
            {muted ? "MUTED" : `${Math.round(volume * 100)}%`}
          </Text>
        </View>
        <View
          testID={`voice-mixer-slider-${persona.id}`}
          style={mixerStyles.sliderTrack}
          onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderGrant={(e) => updateVolumeFromTouch(e.nativeEvent.locationX)}
          onResponderMove={(e) => updateVolumeFromTouch(e.nativeEvent.locationX)}
        >
          <View
            style={[
              mixerStyles.sliderFill,
              {
                width: `${(muted ? 0 : volume) * 100}%`,
                backgroundColor: muted ? "#444" : persona.color,
              },
            ]}
          />
          <View
            style={[
              mixerStyles.sliderThumb,
              {
                left: `${(muted ? 0 : volume) * 100}%`,
                borderColor: muted ? "#666" : persona.color,
              },
            ]}
          />
        </View>
      </View>
      <Pressable
        testID={`voice-mixer-mute-${persona.id}`}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          const wasMuted = settingRef.current.muted;
          const currentVolume = settingRef.current.volume;
          if (wasMuted && currentVolume <= 0) {
            onUpdate({ muted: false, volume: 0.5 });
          } else {
            onUpdate({ muted: !wasMuted });
          }
        }}
        style={({ pressed }) => [
          mixerStyles.muteBtn,
          muted && { backgroundColor: "rgba(255,77,77,0.18)", borderColor: "#FF4D4D" },
          pressed && { opacity: 0.7 },
        ]}
      >
        <Ionicons
          name={muted ? "volume-mute" : "volume-high"}
          size={18}
          color={muted ? "#FF4D4D" : Colors.gold}
        />
      </Pressable>
    </View>
  );
}

export function VoiceMixerScreen({ onClose }: { onClose?: () => void }) {
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const webBottomInset = Platform.OS === "web" ? 34 : 0;
  const { settings, updateSetting } = usePersonaVoiceSettings();

  const muteAll = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    VOICE_MIXER_PERSONAS.forEach((p) => updateSetting(p.id, { muted: true }));
  }, [updateSetting]);

  const unmuteAll = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    VOICE_MIXER_PERSONAS.forEach((p) =>
      updateSetting(p.id, { muted: false, volume: Math.max(0.5, getVoiceSetting(settings, p.id).volume) })
    );
  }, [updateSetting, settings]);

  const resetAll = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    VOICE_MIXER_PERSONAS.forEach((p) => updateSetting(p.id, { muted: false, volume: 1.0 }));
  }, [updateSetting]);

  const grouped = VOICE_MIXER_GROUPS.map((group) => ({
    group,
    personas: VOICE_MIXER_PERSONAS.filter((p) => p.group === group),
  }));

  const mutedCount = VOICE_MIXER_PERSONAS.reduce(
    (n, p) => (getVoiceSetting(settings, p.id).muted ? n + 1 : n),
    0
  );

  return (
    <View style={[mixerStyles.container, { paddingTop: insets.top + webTopInset }]}>
      <View style={mixerStyles.header}>
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            onClose?.();
          }}
          hitSlop={12}
          style={mixerStyles.headerBtn}
          testID="voice-mixer-close"
        >
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={mixerStyles.headerTitle}>VOICE MIXER</Text>
          <Text style={mixerStyles.headerSubtitle}>
            {mutedCount > 0 ? `${mutedCount} muted` : "All voices on"}
          </Text>
        </View>
        <View style={mixerStyles.bulkRow}>
          <Pressable
            onPress={mutedCount === VOICE_MIXER_PERSONAS.length ? unmuteAll : muteAll}
            style={({ pressed }) => [mixerStyles.bulkBtn, pressed && { opacity: 0.7 }]}
            testID="voice-mixer-mute-all"
          >
            <Ionicons
              name={mutedCount === VOICE_MIXER_PERSONAS.length ? "volume-high" : "volume-mute"}
              size={14}
              color={mutedCount === VOICE_MIXER_PERSONAS.length ? Colors.gold : "#FF4D4D"}
            />
            <Text
              style={[
                mixerStyles.bulkText,
                {
                  color:
                    mutedCount === VOICE_MIXER_PERSONAS.length ? Colors.gold : "#FF4D4D",
                },
              ]}
            >
              {mutedCount === VOICE_MIXER_PERSONAS.length ? "ALL ON" : "MUTE ALL"}
            </Text>
          </Pressable>
          <Pressable
            onPress={resetAll}
            style={({ pressed }) => [mixerStyles.bulkBtn, pressed && { opacity: 0.7 }]}
            testID="voice-mixer-reset"
          >
            <Ionicons name="refresh" size={14} color="rgba(255,255,255,0.7)" />
            <Text style={[mixerStyles.bulkText, { color: "rgba(255,255,255,0.7)" }]}>RESET</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: insets.bottom + 24 + webBottomInset }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={mixerStyles.intro}>
          Tune every persona's voice. Settings sync everywhere they speak — Sports, Arena, Chat, and more.
        </Text>

        {grouped.map(({ group, personas }) =>
          personas.length === 0 ? null : (
            <View key={group} style={mixerStyles.section}>
              <Text style={mixerStyles.sectionTitle}>{group.toUpperCase()}</Text>
              <View style={mixerStyles.card}>
                {personas.map((p, idx) => (
                  <View
                    key={p.id}
                    style={idx > 0 ? mixerStyles.rowDivider : undefined}
                  >
                    <MixerRow
                      persona={p}
                      setting={getVoiceSetting(settings, p.id)}
                      onUpdate={(update) => updateSetting(p.id, update)}
                    />
                  </View>
                ))}
              </View>
            </View>
          )
        )}
      </ScrollView>
    </View>
  );
}

const popoverStyles = StyleSheet.create({
  popoverBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  popoverCard: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: "#141414",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,215,0,0.25)",
    padding: 18,
  },
  popoverHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  popoverAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
  },
  popoverTitle: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "800" as const,
  },
  popoverSubtitle: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 10,
    fontWeight: "700" as const,
    letterSpacing: 1,
    marginTop: 2,
  },
  muteToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(212,164,32,0.4)",
    backgroundColor: "rgba(212,164,32,0.1)",
    marginBottom: 16,
  },
  muteToggleText: {
    fontSize: 12,
    fontWeight: "900" as const,
    letterSpacing: 1,
  },
  volumeLabel: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 10,
    fontWeight: "800" as const,
    letterSpacing: 1,
    marginBottom: 8,
  },
  sliderTrack: {
    height: 28,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 14,
    justifyContent: "center",
    marginBottom: 14,
    overflow: "visible",
  },
  sliderFill: {
    height: 28,
    borderRadius: 14,
    opacity: 0.6,
  },
  sliderThumb: {
    position: "absolute",
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#fff",
    borderWidth: 2,
    top: 3,
    marginLeft: -11,
  },
  presetRow: {
    flexDirection: "row",
    gap: 6,
  },
  presetBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.04)",
    alignItems: "center",
  },
  presetText: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 10,
    fontWeight: "800" as const,
    letterSpacing: 0.5,
  },
});

const mixerStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0a0a",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,215,0,0.15)",
    gap: 10,
  },
  headerBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  headerTitle: {
    color: Colors.gold,
    fontSize: 16,
    fontWeight: "900" as const,
    letterSpacing: 2,
  },
  headerSubtitle: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 10,
    fontWeight: "700" as const,
    letterSpacing: 0.5,
    marginTop: 2,
  },
  bulkRow: {
    flexDirection: "row",
    gap: 6,
  },
  bulkBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  bulkText: {
    fontSize: 9,
    fontWeight: "900" as const,
    letterSpacing: 0.5,
  },
  intro: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 12,
    lineHeight: 17,
    marginTop: 14,
    marginBottom: 14,
  },
  section: {
    marginBottom: 18,
  },
  sectionTitle: {
    color: "rgba(255,215,0,0.7)",
    fontSize: 11,
    fontWeight: "900" as const,
    letterSpacing: 2,
    marginBottom: 8,
  },
  card: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 12,
  },
  rowDivider: {
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.05)",
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
  },
  center: {
    flex: 1,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  name: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700" as const,
    flex: 1,
    marginRight: 8,
  },
  volumeText: {
    color: "rgba(255,215,0,0.85)",
    fontSize: 10,
    fontWeight: "900" as const,
    letterSpacing: 0.5,
  },
  sliderTrack: {
    height: 18,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: 9,
    justifyContent: "center",
    overflow: "visible",
  },
  sliderFill: {
    height: 18,
    borderRadius: 9,
    opacity: 0.7,
  },
  sliderThumb: {
    position: "absolute",
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#fff",
    borderWidth: 2,
    top: 1,
    marginLeft: -8,
  },
  muteBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(212,164,32,0.4)",
    backgroundColor: "rgba(212,164,32,0.1)",
  },
});
