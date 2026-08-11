import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  Share, Platform, Clipboard,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInDown } from "react-native-reanimated";
import Colors from "@/constants/colors";
import { getApiUrl } from "@/lib/query-client";
import { getOrCreateDeviceId } from "@/lib/token-context";

// ─── UTM link helpers ─────────────────────────────────────────────────────────

const APP_BASE_URL = "https://trumpbot.rip";

/** Map a platform display name to a utm_source slug. */
function platformToUtmSource(platformName: string): string {
  const name = platformName.toLowerCase();
  if (name.includes("reddit"))        return "reddit";
  if (name.includes("twitter") || name.includes("/x")) return "twitter";
  if (name.includes("facebook"))      return "facebook";
  if (name.includes("discord"))       return "discord";
  if (name.includes("truth"))         return "truth_social";
  if (name.includes("youtube"))       return "youtube";
  if (name.includes("tiktok"))        return "tiktok";
  if (name.includes("parler") || name.includes("gab")) return "parler";
  return name.replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function buildUtmLink(communityId: string, platformName: string): string {
  const utmSource   = platformToUtmSource(platformName);
  const utmCampaign = communityId;
  return `${APP_BASE_URL}?utm_source=${utmSource}&utm_medium=social&utm_campaign=${utmCampaign}`;
}

// ─── Community templates ──────────────────────────────────────────────────────

interface CommunityTemplate {
  id: string;
  label: string;
  emoji: string;
  color: string;
  tagline: string;
  platforms: { name: string; icon: string }[];
  posts: {
    platform: string;
    title?: string;
    body: string;
  }[];
}

const TEMPLATES: CommunityTemplate[] = [
  {
    id: "political_left",
    label: "Progressive / Left",
    emoji: "🌹",
    color: "#4ADE80",
    tagline: "AOC, Bernie, Cenk, Joy Reid — all in one room",
    platforms: [
      { name: "Reddit", icon: "logo-reddit" },
      { name: "Twitter/X", icon: "logo-twitter" },
      { name: "Facebook", icon: "logo-facebook" },
      { name: "Discord", icon: "chatbubbles" },
    ],
    posts: [
      {
        platform: "Reddit (r/politics, r/progressive, r/Socialism)",
        title: "This AI debate app let me watch AOC, Bernie, and Cenk argue live — it's actually wild",
        body: `So I found this app called The Arena that lets AI versions of real political figures debate each other in real time on actual breaking news topics.\n\nYou can set up debates between AOC, Bernie Sanders, Cenk Uygur, Joy Reid, Rachel Maddow, George Galloway, Ilhan Omar, Rashida Tlaib, Jasmine Crockett — and watch them go at it. The AI actually knows their real policy positions and speaking styles.\n\nThere's also a 1-on-1 interview mode where you pick a host and a guest and they do a full interview. Joy Reid interviewing Trump is... something else.\n\nThe debates cover real current news topics pulled fresh every session. Not scripted — the AI generates arguments on the spot based on each persona's actual worldview.\n\nFree to try. Genuinely fun. Highly recommend for political junkies.`,
      },
      {
        platform: "Twitter/X thread",
        body: `🔥 Found an app that lets you watch AOC, Bernie Sanders, and Cenk Uygur debate in real-time AI — using their actual policy positions and speaking styles.\n\nCalled The Arena. It's free. It's unhinged. I've watched 6 debates today.\n\nThey cover actual breaking news topics so every debate is different.\n\nThere's also a mode where Joy Reid can interview Trump or any other political figure. It goes exactly how you'd expect.\n\nHighly recommend for anyone who lives for political debates 👇`,
      },
      {
        platform: "Facebook Group / Discord",
        body: `Hey everyone — wanted to share something I've been obsessed with this week.\n\nThere's an app called The Arena where AI versions of real political figures debate each other. We're talking AOC, Bernie, Cenk, Maddow, Joy Reid, Ilhan Omar, Jasmine Crockett, George Galloway — all of them.\n\nYou pick two personas, pick a topic, and watch them argue. The AI knows their real positions and their actual debate style. It's not generic — AOC actually sounds like AOC.\n\nThey also have a roundtable mode where multiple personas go at it simultaneously, and an interview mode where any host can interview any guest.\n\nFree to download. Thought this community would love it.`,
      },
    ],
  },
  {
    id: "political_right",
    label: "Conservative / Right",
    emoji: "🦅",
    color: "#EF4444",
    tagline: "Trump, Hannity, Tucker — raw and unfiltered",
    platforms: [
      { name: "Truth Social", icon: "chatbubble" },
      { name: "Twitter/X", icon: "logo-twitter" },
      { name: "Facebook", icon: "logo-facebook" },
      { name: "Parler / Gab", icon: "chatbubbles" },
    ],
    posts: [
      {
        platform: "Facebook / Truth Social",
        title: "AI app lets Trump debate the fake news media — and he wins every time",
        body: `Found an incredible app called The Arena. You can watch an AI version of President Trump debate Maddow, Biden, AOC, Hannity — whoever you want.\n\nThe Trump AI knows all his real positions, his speaking style, his MAGA energy. It's not some left-wing parody. It actually sounds like him.\n\nYou can also watch Hannity interview Trump, Tucker Carlson debate the establishment, and more. Full debate sessions covering real current news.\n\nThere's even a lie-detector that flags fake news in real time during debates.\n\nFree to download. This is what media should look like — unfiltered and real.`,
      },
      {
        platform: "Twitter/X",
        body: `🇺🇸 Found an app where Trump debates the fake news media in real time AI.\n\nCalled The Arena. Sean Hannity, Tucker Carlson, Trump, Megyn Kelly — all available as debate personas using their actual positions.\n\nThe AI even has a live fact-check feature that flags when anyone says something false.\n\nFree. Worth checking out if you're tired of one-sided media.`,
      },
    ],
  },
  {
    id: "sports",
    label: "Sports Fans",
    emoji: "🏀",
    color: "#F97316",
    tagline: "Stephen A., Skip, Shannon Sharpe going at it",
    platforms: [
      { name: "Reddit", icon: "logo-reddit" },
      { name: "Twitter/X", icon: "logo-twitter" },
      { name: "YouTube comments", icon: "logo-youtube" },
    ],
    posts: [
      {
        platform: "Reddit (r/nba, r/nfl, r/sports)",
        title: "App where you can watch Stephen A. Smith and Skip Bayless debate any sports topic in real-time AI",
        body: `Been using this app called The Arena and it has sports debate modes.\n\nYou can watch Stephen A. Smith, Skip Bayless, Shannon Sharpe, and Howard Cosell argue about any sports topic. The AI actually knows their real takes and their personalities — Stephen A. is absolutely unhinged in the right way.\n\nThere's also a debate arena where you can pick any two and set the topic. Watching Skip and Stephen A. argue about LeBron vs Jordan while the AI generates both sides in their actual voices is genuinely entertaining.\n\nFree to try. Worth it for any sports media fan.`,
      },
      {
        platform: "Twitter/X",
        body: `💀 Found an AI app where you can watch Stephen A. Smith and Skip Bayless argue any sports topic you want.\n\nCalled The Arena. The Stephen A. AI is UNHINGED. Exactly right.\n\nYou can also add Shannon Sharpe and it just becomes First Take at 3am.\n\nFree to download. Sports media fans need this.`,
      },
    ],
  },
  {
    id: "black_media",
    label: "Black Media & Culture",
    emoji: "✊🏾",
    color: "#A855F7",
    tagline: "Joy Reid, Don Lemon, Shannon Sharpe, Malcolm X",
    platforms: [
      { name: "Twitter/X (Black Twitter)", icon: "logo-twitter" },
      { name: "Reddit", icon: "logo-reddit" },
      { name: "Facebook", icon: "logo-facebook" },
      { name: "Discord", icon: "chatbubbles" },
    ],
    posts: [
      {
        platform: "Twitter/X (Black Twitter)",
        body: `Y'all… there's an app where Joy Reid interviews Trump, Don Lemon debates Hannity, and Shannon Sharpe goes IN on anybody.\n\nCalled The Arena. They also have Malcolm X, MLK, Dr. Frances Cress Welsing, Claude Anderson, Arikana Chihombori-Quao — all debating in their real voices and worldviews.\n\nThe Malcolm X AI pulled ZERO punches. I was shook.\n\nFree to try. Black Twitter needs to find this immediately.`,
      },
      {
        platform: "Facebook Group / Community",
        title: "This AI debate app has Malcolm X, Joy Reid, Don Lemon, Shannon Sharpe — worth checking out",
        body: `I wanted to share something with this community.\n\nThere's an app called The Arena where AI versions of Black public figures can debate in real time. The lineup includes:\n\n• Joy Reid, Don Lemon, Shannon Sharpe\n• Malcolm X, MLK, Louis Farrakhan\n• Dr. Frances Cress Welsing, Claude Anderson, Arikana Chihombori-Quao\n• Ilhan Omar, AOC, Jasmine Crockett, Ayanna Pressley\n\nThe AI knows their real positions, their speaking styles, and their actual political philosophy. The Malcolm X AI is something else — it really captures the spirit of his radical clarity.\n\nYou can set up any debate — Malcolm X vs. MLK on strategy, Joy Reid interviewing Trump, Cress Welsing vs. Candace Owens.\n\nFree to download. This community would appreciate the depth of the personas.`,
      },
    ],
  },
  {
    id: "comedy",
    label: "Comedy & Satire",
    emoji: "😂",
    color: "#FACC15",
    tagline: "George Carlin, Wanda Sykes, Gilbert Gottfried",
    platforms: [
      { name: "Reddit", icon: "logo-reddit" },
      { name: "Twitter/X", icon: "logo-twitter" },
      { name: "TikTok", icon: "musical-notes" },
    ],
    posts: [
      {
        platform: "Reddit (r/comedy, r/Standup)",
        title: "AI debate app with George Carlin and Gilbert Gottfried — absolutely unhinged",
        body: `Someone added George Carlin, Wanda Sykes, Gilbert Gottfried, Charlie Murphy, and Trevor Noah to a political debate app and I am DONE.\n\nCalled The Arena. You can make Carlin moderate a debate between Trump and Biden and he just spends the whole time savaging both of them equally. Wanda Sykes as moderator is comedy perfection. Gilbert Gottfried as debate host is chaos incarnate.\n\nThey also have Charlie Murphy who tells the Rick James story as a metaphor for every political argument.\n\nFree to try. This is the funniest app I've found in years.`,
      },
      {
        platform: "Twitter/X",
        body: `I made George Carlin moderate a debate between Trump and Biden on this AI app and he spent the entire time telling them both they were full of sh*t.\n\nCalled The Arena. Wanda Sykes is also in here. And Gilbert Gottfried. As a debate MODERATOR.\n\nFree. You need this immediately.`,
      },
    ],
  },
  {
    id: "faith",
    label: "Faith & Religion",
    emoji: "🙏",
    color: "#60A5FA",
    tagline: "Bishop Fundme, Pastor Manning, Louis Farrakhan",
    platforms: [
      { name: "Facebook", icon: "logo-facebook" },
      { name: "YouTube comments", icon: "logo-youtube" },
      { name: "Twitter/X", icon: "logo-twitter" },
    ],
    posts: [
      {
        platform: "Facebook / Church Community",
        title: "This AI app has a preacher character who fundraises during every debate — wild",
        body: `Friends, I need to share something with this community that is equal parts entertaining and thought-provoking.\n\nThere's an app called The Arena that has AI personas of Bishop Dr. Cornelius T. Fundme III, Pastor Manning, and Louis Farrakhan — all as debate participants or moderators.\n\nBishop Fundme cites scripture in every response and then asks for donations to his building fund. It's simultaneously a parody and a genuine theological experience.\n\nThey also have serious personas like MLK and Malcolm X debating real policy issues in their actual voices and frameworks.\n\nThe app is free. It's not disrespectful — it's genuinely thoughtful about each person's real beliefs. Worth a look.`,
      },
    ],
  },
  {
    id: "debate_academic",
    label: "Debate / Academic",
    emoji: "🎓",
    color: "#38BDF8",
    tagline: "Structured debates, fact-checking, critical thinking",
    platforms: [
      { name: "Reddit", icon: "logo-reddit" },
      { name: "Discord", icon: "chatbubbles" },
      { name: "Twitter/X", icon: "logo-twitter" },
    ],
    posts: [
      {
        platform: "Reddit (r/changemyview, r/DebateAnything)",
        title: "AI debate app that runs live structured debates between real public figures with fact-checking — actually useful",
        body: `For people interested in rhetoric and argumentation, I found an app called The Arena that does something interesting.\n\nIt runs AI debates between real public figures (politicians, journalists, commentators) using their actual documented positions. Each persona is trained on the real person's stated worldview, debate style, and policy record.\n\nFeatures worth noting:\n• Live fact-check overlay that flags claims as they're made\n• Real-time lie detector that tracks each debater's accuracy\n• Multiple formats: 1-on-1, roundtable, interview\n• Topics pulled from current breaking news\n• Cross-examination mode where the moderator presses on evasion\n\nIt's not a replacement for actual debate practice but it's a useful tool for studying rhetorical patterns and argument structures across different political ideologies.\n\nFree to use.`,
      },
      {
        platform: "Discord (debate servers)",
        body: `Hey everyone — found a tool that might be useful for this server.\n\nIt's called The Arena. It runs AI debates between real public figures using their actual positions and debate styles. You can watch Bernie Sanders argue against Milton Friedman's economics, or set up a foreign policy debate between Obama and George Galloway.\n\nHas a live fact-check overlay and a lie detector that runs in real time. The AI moderators also press on evasive answers with follow-up questions.\n\nFree to try. Good for studying argument structure across different ideological frameworks.`,
      },
    ],
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function CommunityLeadPage() {
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<CommunityTemplate>(TEMPLATES[0]);
  const [activePostIdx, setActivePostIdx] = useState(0);
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const activePost = selected.posts[Math.min(activePostIdx, selected.posts.length - 1)];

  const fullPostText = activePost.title
    ? `${activePost.title}\n\n${activePost.body}`
    : activePost.body;

  // Derive the UTM link from the active post's platform
  const utmLink = buildUtmLink(selected.id, activePost.platform);

  const handleCopy = useCallback(() => {
    if (Platform.OS === "web") {
      navigator.clipboard?.writeText(fullPostText).catch(() => {});
    } else {
      Clipboard.setString(fullPostText);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    // Track usage
    getOrCreateDeviceId().then((deviceId) => {
      fetch(new URL("/api/analytics/event", getApiUrl()).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId, feature: "lead_gen", action: "copy", metadata: { community: selected.id } }),
      }).catch(() => {});
    });
  }, [fullPostText, selected.id]);

  const handleCopyLink = useCallback(() => {
    if (Platform.OS === "web") {
      navigator.clipboard?.writeText(utmLink).catch(() => {});
    } else {
      Clipboard.setString(utmLink);
    }
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
    getOrCreateDeviceId().then((deviceId) => {
      fetch(new URL("/api/analytics/event", getApiUrl()).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId, feature: "lead_gen", action: "copy_link", metadata: { community: selected.id, platform: activePost.platform } }),
      }).catch(() => {});
    });
  }, [utmLink, selected.id, activePost.platform]);

  const handleShare = useCallback(async () => {
    try {
      await Share.share({ message: fullPostText, title: activePost.title });
      getOrCreateDeviceId().then((deviceId) => {
        fetch(new URL("/api/analytics/event", getApiUrl()).toString(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deviceId, feature: "lead_gen", action: "share", metadata: { community: selected.id } }),
        }).catch(() => {});
      });
    } catch {}
  }, [fullPostText, activePost.title, selected.id]);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <LinearGradient
        colors={["rgba(80,40,160,0.18)", Colors.background]}
        style={StyleSheet.absoluteFill}
      />

      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.gold} />
        </Pressable>
        <View style={styles.headerCenter}>
          <MaterialCommunityIcons name="rocket-launch" size={20} color={Colors.gold} />
          <Text style={styles.headerTitle}>Lead Generator</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.duration(400)}>
          <Text style={styles.subtitle}>
            Ready-made posts for communities that will love The Arena.{"\n"}
            Pick a community, copy the post, and spread the word.
          </Text>
        </Animated.View>

        {/* Community selector */}
        <Animated.View entering={FadeInDown.delay(80).duration(400)}>
          <Text style={styles.sectionLabel}>CHOOSE COMMUNITY</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillRow} contentContainerStyle={styles.pillRowContent}>
            {TEMPLATES.map((t) => (
              <Pressable
                key={t.id}
                onPress={() => { setSelected(t); setActivePostIdx(0); setCopied(false); }}
                style={[styles.pill, selected.id === t.id && { backgroundColor: t.color + "28", borderColor: t.color }]}
              >
                <Text style={styles.pillEmoji}>{t.emoji}</Text>
                <Text style={[styles.pillLabel, selected.id === t.id && { color: t.color }]}>{t.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </Animated.View>

        {/* Community card */}
        <Animated.View key={selected.id} entering={FadeInDown.delay(100).duration(350)} style={[styles.communityCard, { borderColor: selected.color + "40" }]}>
          <Text style={[styles.communityEmoji]}>{selected.emoji}</Text>
          <Text style={[styles.communityLabel, { color: selected.color }]}>{selected.label}</Text>
          <Text style={styles.communityTagline}>{selected.tagline}</Text>

          {/* Platform badges */}
          <View style={styles.platformRow}>
            {selected.platforms.map((p) => (
              <View key={p.name} style={styles.platformBadge}>
                <Ionicons name={p.icon as any} size={13} color={Colors.whiteMuted} />
                <Text style={styles.platformName}>{p.name}</Text>
              </View>
            ))}
          </View>
        </Animated.View>

        {/* Post selector tabs */}
        {selected.posts.length > 1 && (
          <View style={styles.tabRow}>
            {selected.posts.map((p, i) => (
              <Pressable
                key={i}
                onPress={() => { setActivePostIdx(i); setCopied(false); }}
                style={[styles.tab, activePostIdx === i && { borderBottomColor: selected.color }]}
              >
                <Text style={[styles.tabText, activePostIdx === i && { color: selected.color }]}
                  numberOfLines={1}>
                  {p.platform.split(" (")[0].split(" /")[0]}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        {/* Post preview */}
        <Animated.View key={`${selected.id}-${activePostIdx}`} entering={FadeInDown.delay(50).duration(300)} style={styles.postCard}>
          <View style={styles.postHeader}>
            <Text style={styles.postPlatformLabel}>{activePost.platform}</Text>
          </View>
          {activePost.title && (
            <Text style={styles.postTitle}>{activePost.title}</Text>
          )}
          <Text style={styles.postBody}>{activePost.body}</Text>
        </Animated.View>

        {/* UTM link row */}
        <Animated.View key={`link-${selected.id}-${activePostIdx}`} entering={FadeInDown.delay(70).duration(300)} style={styles.linkCard}>
          <View style={styles.linkCardHeader}>
            <Ionicons name="link-outline" size={14} color={Colors.gold} />
            <Text style={styles.linkCardTitle}>App link (paste as first comment)</Text>
          </View>
          <View style={styles.linkRow}>
            <Text style={styles.linkText} numberOfLines={1} ellipsizeMode="middle">{utmLink}</Text>
            <Pressable
              onPress={handleCopyLink}
              style={({ pressed }) => [styles.linkCopyBtn, pressed && { opacity: 0.7 }]}
            >
              <Ionicons name={linkCopied ? "checkmark" : "copy-outline"} size={15} color={linkCopied ? "#4ADE80" : Colors.gold} />
              <Text style={[styles.linkCopyText, linkCopied && { color: "#4ADE80" }]}>
                {linkCopied ? "Copied!" : "Copy"}
              </Text>
            </Pressable>
          </View>
        </Animated.View>

        {/* Action buttons */}
        <View style={styles.actionRow}>
          <Pressable
            onPress={handleCopy}
            style={({ pressed }) => [styles.actionBtn, styles.copyBtn, pressed && { opacity: 0.75 }]}
          >
            <Ionicons name={copied ? "checkmark" : "copy-outline"} size={18} color={Colors.background} />
            <Text style={styles.copyBtnText}>{copied ? "Copied!" : "Copy Post"}</Text>
          </Pressable>
          <Pressable
            onPress={handleShare}
            style={({ pressed }) => [styles.actionBtn, styles.shareBtn, pressed && { opacity: 0.75 }]}
          >
            <Ionicons name="share-social-outline" size={18} color={Colors.white} />
            <Text style={styles.shareBtnText}>Share</Text>
          </Pressable>
        </View>

        {/* Tips */}
        <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.tipsCard}>
          <Text style={styles.tipsTitle}>💡 Posting tips</Text>
          <Text style={styles.tipLine}>• Edit the post to match your own voice — authenticity gets more clicks than copy-paste</Text>
          <Text style={styles.tipLine}>• Pin the app store link in your first comment on Reddit</Text>
          <Text style={styles.tipLine}>• Post in subreddits where debate and political commentary is welcome — avoid pure news subs</Text>
          <Text style={styles.tipLine}>• Discord: drop it in the #off-topic or #recommendations channel with a personal note</Text>
          <Text style={styles.tipLine}>• Timing: political subreddits peak Tues–Thurs 9am–3pm Eastern</Text>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: Colors.white,
    fontFamily: "PlayfairDisplay_700Bold",
  },
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 20,
    gap: 16,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.whiteMuted,
    lineHeight: 21,
    textAlign: "center",
    marginBottom: 4,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.whiteDim,
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  pillRow: {
    flexGrow: 0,
  },
  pillRowContent: {
    gap: 8,
    paddingBottom: 4,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pillEmoji: {
    fontSize: 14,
  },
  pillLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.whiteDim,
  },
  communityCard: {
    backgroundColor: Colors.card,
    borderRadius: 18,
    borderWidth: 1,
    padding: 20,
    alignItems: "center",
    gap: 6,
  },
  communityEmoji: {
    fontSize: 36,
    marginBottom: 4,
  },
  communityLabel: {
    fontSize: 20,
    fontWeight: "800",
    fontFamily: "PlayfairDisplay_900Black",
  },
  communityTagline: {
    fontSize: 13,
    color: Colors.whiteMuted,
    textAlign: "center",
  },
  platformRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8,
    justifyContent: "center",
  },
  platformBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.06)",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  platformName: {
    fontSize: 11,
    color: Colors.whiteMuted,
  },
  tabRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.whiteDim,
  },
  postCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 18,
    gap: 10,
  },
  postHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  postPlatformLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.gold,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  postTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: Colors.white,
    fontFamily: "PlayfairDisplay_700Bold",
    lineHeight: 22,
  },
  postBody: {
    fontSize: 13,
    color: Colors.whiteDim,
    lineHeight: 20,
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
  copyBtn: {
    backgroundColor: Colors.gold,
  },
  copyBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.background,
  },
  shareBtn: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  shareBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.white,
  },
  tipsCard: {
    backgroundColor: "rgba(212,164,32,0.08)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(212,164,32,0.18)",
    padding: 16,
    gap: 7,
  },
  tipsTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.gold,
    marginBottom: 4,
  },
  tipLine: {
    fontSize: 12,
    color: Colors.whiteDim,
    lineHeight: 18,
  },
  linkCard: {
    backgroundColor: "rgba(212,164,32,0.06)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(212,164,32,0.22)",
    padding: 12,
    gap: 8,
  },
  linkCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  linkCardTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.gold,
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  linkText: {
    flex: 1,
    fontSize: 12,
    color: Colors.whiteDim,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  linkCopyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(212,164,32,0.12)",
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(212,164,32,0.25)",
  },
  linkCopyText: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.gold,
  },
});
