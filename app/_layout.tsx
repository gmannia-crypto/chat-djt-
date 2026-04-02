import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  ScrollView,
  StyleSheet,
  Platform,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { queryClient, getApiUrl } from "@/lib/query-client";
import { TokenProvider } from "@/lib/token-context";
import { SoundProvider } from "@/lib/sound-context";
import { EngagementProvider } from "@/lib/engagement-context";
import { ShareCard } from "@/components/ShareCard";
import { StreakToast } from "@/components/StreakToast";
import { StatusBar } from "expo-status-bar";
import {
  useFonts,
  PlayfairDisplay_400Regular,
  PlayfairDisplay_700Bold,
  PlayfairDisplay_900Black,
} from "@expo-google-fonts/playfair-display";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import Colors from "@/constants/colors";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { getOrCreateDeviceId } from "@/lib/token-context";

const DISCLAIMER_KEY = "chatdjt_disclaimer_accepted";

SplashScreen.preventAutoHideAsync();

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function registerForPushNotifications() {
  if (Platform.OS === "web") return;

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      console.log("Push notification permission not granted");
      return;
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: projectId ?? undefined,
    });
    const expoPushToken = tokenData.data;

    const deviceId = await getOrCreateDeviceId();
    const baseUrl = getApiUrl();

    await fetch(new URL("/api/push-tokens", baseUrl).toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deviceId,
        expoPushToken,
        platform: Platform.OS,
      }),
    });

    if (Platform.OS === "android") {
      Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#FF231F7C",
      });
    }
  } catch (error) {
    console.log("Push notification registration error:", error);
  }
}

function DisclaimerModal({ visible, onAccept }: { visible: boolean; onAccept: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={disclaimerStyles.overlay}>
        <View style={disclaimerStyles.popup}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={disclaimerStyles.warningHeader}>
              {"\u26A0\uFE0F"} REAL TALK {"\u26A0\uFE0F"}
            </Text>
            <View style={disclaimerStyles.subtitleRow}>
              <Text style={disclaimerStyles.subtitle}>THIS IS AN AI PARODY</Text>
              <View style={disclaimerStyles.subtitleLine} />
            </View>
            <View style={disclaimerStyles.cardBox}>
              <View style={disclaimerStyles.bulletRow}>
                <Text style={disclaimerStyles.bulletDot}>{"\u2022"}</Text>
                <Text style={disclaimerStyles.bulletText}>
                  <Text style={disclaimerStyles.redBold}>
                    "Donald Trump" here is 100% AI-generated
                  </Text>
                  {" \u2014 "}a comedic simulation for entertainment
                </Text>
              </View>
              <View style={disclaimerStyles.bulletRow}>
                <Text style={disclaimerStyles.bulletDot}>{"\u2022"}</Text>
                <Text style={disclaimerStyles.bulletText}>
                  <Text style={disclaimerStyles.redBold}>NO affiliation</Text> with
                  Donald J. Trump, his family, businesses, or any political organization
                </Text>
              </View>
              <View style={disclaimerStyles.bulletRow}>
                <Text style={disclaimerStyles.bulletDot}>{"\u2022"}</Text>
                <Text style={disclaimerStyles.bulletText}>
                  All news responses and conversations are{" "}
                  <Text style={disclaimerStyles.redBold}>AI-generated fiction</Text>
                  {" \u2014 "}not real statements
                </Text>
              </View>
              <View style={disclaimerStyles.bulletRow}>
                <Text style={disclaimerStyles.bulletDot}>{"\u2022"}</Text>
                <Text style={disclaimerStyles.bulletText}>
                  This is{" "}
                  <Text style={disclaimerStyles.redBold}>satire and parody</Text>,
                  protected as entertainment
                </Text>
              </View>
            </View>
            <Text style={disclaimerStyles.acknowledgement}>
              By clicking "I UNDERSTAND", you acknowledge this is an AI comedy
              experience {"\u2014"} not the real Donald Trump.
            </Text>
            <Pressable
              onPress={onAccept}
              style={({ pressed }) => [
                disclaimerStyles.acceptButton,
                pressed && { transform: [{ scale: 0.97 }], opacity: 0.9 },
              ]}
            >
              <Text style={disclaimerStyles.acceptButtonText}>
                I UNDERSTAND, LET ME IN
              </Text>
            </Pressable>
            <Text style={disclaimerStyles.footer}>
              {"\uD83C\uDDFA\uD83C\uDDF8"} For entertainment purposes only. Making AI
              parody great again! {"\uD83C\uDDFA\uD83C\uDDF8"}
            </Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const disclaimerStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  popup: {
    backgroundColor: "#1a1a1a",
    borderRadius: 15,
    padding: 30,
    maxWidth: 550,
    width: "100%",
    maxHeight: "88%",
    borderWidth: 1,
    borderColor: "#ff9999",
    shadowColor: "#ff4d4d",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 30,
    elevation: 12,
  },
  warningHeader: {
    fontSize: 28,
    fontWeight: "900",
    textAlign: "center",
    color: "#ff4d4d",
    letterSpacing: 3,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  subtitleRow: {
    alignItems: "center",
    marginBottom: 20,
  },
  subtitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: 10,
  },
  subtitleLine: {
    width: 200,
    height: 2,
    backgroundColor: "#ff4d4d",
  },
  cardBox: {
    backgroundColor: "rgba(255,75,75,0.08)",
    borderRadius: 10,
    padding: 18,
    marginBottom: 20,
    borderLeftWidth: 5,
    borderLeftColor: "#ff4d4d",
  },
  bulletRow: {
    flexDirection: "row",
    marginBottom: 12,
    alignItems: "flex-start",
  },
  bulletDot: {
    color: "#ff4d4d",
    fontWeight: "700",
    fontSize: 20,
    marginRight: 10,
    lineHeight: 24,
  },
  bulletText: {
    flex: 1,
    fontSize: 15,
    color: "#CCCCCC",
    lineHeight: 22,
  },
  redBold: {
    color: "#ff4d4d",
    fontWeight: "700",
  },
  acknowledgement: {
    fontSize: 14,
    color: "#AAAAAA",
    fontStyle: "italic",
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 20,
  },
  acceptButton: {
    backgroundColor: "#ff4d4d",
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 50,
    alignItems: "center",
    alignSelf: "center",
    borderWidth: 2,
    borderColor: "#ff9999",
    shadowColor: "#ff4d4d",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.6,
    shadowRadius: 15,
    elevation: 8,
  },
  acceptButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  footer: {
    fontSize: 12,
    color: "#888888",
    textAlign: "center",
    marginTop: 22,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#444444",
  },
});

function RootLayoutNav() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.background },
        animation: "slide_from_right",
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="chat/[id]" />
      <Stack.Screen
        name="subscribe"
        options={{ presentation: "modal", animation: "slide_from_bottom" }}
      />
      <Stack.Screen
        name="cabinet"
        options={{ presentation: "modal", animation: "slide_from_bottom" }}
      />
      <Stack.Screen
        name="admin"
        options={{ presentation: "modal", animation: "slide_from_bottom" }}
      />
      <Stack.Screen
        name="dashboard"
        options={{ animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="rate-trump"
        options={{ animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="fortune"
        options={{ animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="real-estate"
        options={{ animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="challenge/[id]"
        options={{ animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="game"
        options={{ animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="faceoff"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="debate"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="sports"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="collectibles"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="march-madness"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="arena"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="arena-replay"
        options={{ headerShown: false }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    PlayfairDisplay_400Regular,
    PlayfairDisplay_700Bold,
    PlayfairDisplay_900Black,
    ...Ionicons.font,
    ...MaterialCommunityIcons.font,
  });
  const [disclaimerVisible, setDisclaimerVisible] = useState(false);
  const [disclaimerChecked, setDisclaimerChecked] = useState(false);
  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(DISCLAIMER_KEY).then((val) => {
      if (val !== "true") {
        setDisclaimerVisible(true);
      }
      setDisclaimerChecked(true);
    });
  }, []);

  useEffect(() => {
    registerForPushNotifications();

    notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
      console.log("Notification received:", notification.request.content.title);
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      console.log("Notification tapped:", response.notification.request.content.title);
    });

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, []);

  useEffect(() => {
    if ((fontsLoaded || fontError) && disclaimerChecked) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError, disclaimerChecked]);

  if (!fontsLoaded && !fontError) return null;

  function handleAcceptDisclaimer() {
    AsyncStorage.setItem(DISCLAIMER_KEY, "true");
    setDisclaimerVisible(false);
  }

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TokenProvider>
          <SoundProvider>
            <EngagementProvider>
              <GestureHandlerRootView style={{ flex: 1 }}>
                <KeyboardProvider>
                  <StatusBar style="light" />
                  <DisclaimerModal
                    visible={disclaimerVisible}
                    onAccept={handleAcceptDisclaimer}
                  />
                  <RootLayoutNav />
                  <ShareCard />
                  <StreakToast />
                </KeyboardProvider>
              </GestureHandlerRootView>
            </EngagementProvider>
          </SoundProvider>
        </TokenProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
