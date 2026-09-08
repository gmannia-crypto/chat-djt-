import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Image,
  Modal,
  TextInput,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { getApiUrl } from "@/lib/query-client";
import { useTokens } from "@/lib/token-context";
import { trackAnalyticsEvent } from "@/lib/use-analytics";

const STUDENT_NAME_KEY = "dc_university_student_name";

const EDUCATOR_PORTRAITS: Record<string, any> = {
  cornellwest: require("@/assets/images/persona-cornellwest.jpg"),
  richardwolff: require("@/assets/images/persona-richardwolff.jpg"),
  jeffreysachs: require("@/assets/images/persona-jeffreysachs.png"),
  claudeanderson: require("@/assets/images/persona-claudeanderson.png"),
  drbenj: require("@/assets/images/persona-drbenj.jpg"),
  clarke: require("@/assets/images/persona-clarke.png"),
  neiltyson: require("@/assets/images/persona-neiltyson.jpg"),
  professorjiang: require("@/assets/images/persona-professorjiang.png"),
  carlsagan: require("@/assets/images/persona-carlsagan.png"),
};

interface CourseLength {
  minutes: 5 | 10 | 15;
  tokenCost: number;
}
interface Course {
  id: string;
  departmentId: string;
  departmentLabel: string;
  educatorId: string;
  educatorName: string;
  educatorTitle: string;
  courseTitle: string;
  courseDescription: string;
  comingSoon: boolean;
  lengths: CourseLength[];
}
interface Level {
  name: string;
  minPoints: number;
  reward: string;
}
interface Progress {
  totalSessions: number;
  totalMinutes: number;
  points: number;
  currentStreak: number;
  longestStreak: number;
  level: string;
  nextLevel: { name: string; pointsToGo: number } | null;
  certificates: any[];
}

export default function DcUniversityScreen() {
  const insets = useSafeAreaInsets();
  const { deviceId, balance } = useTokens();
  const [courses, setCourses] = useState<Course[]>([]);
  const [today, setToday] = useState<{ label: string; bonusPoints: number; blurb: string } | null>(null);
  const [levels, setLevels] = useState<Level[]>([]);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [loading, setLoading] = useState(true);
  const [pickerCourse, setPickerCourse] = useState<Course | null>(null);
  const [pickerMode, setPickerMode] = useState<"lecture" | "discussion">("lecture");
  const [studentName, setStudentName] = useState("");
  const [factOfDay, setFactOfDay] = useState<{ educatorId: string; educatorName: string; courseTitle: string; fact: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const catalogRes = await fetch(`${getApiUrl()}/api/dc-university/catalog`);
      const catalog = await catalogRes.json();
      setCourses(catalog.courses || []);
      setToday(catalog.today || null);
      setLevels(catalog.levels || []);
    } catch {}
    try {
      const savedName = await AsyncStorage.getItem(STUDENT_NAME_KEY);
      if (savedName) setStudentName(savedName);
    } catch {}
    try {
      const factRes = await fetch(`${getApiUrl()}/api/dc-university/fact-of-day`);
      if (factRes.ok) setFactOfDay(await factRes.json());
    } catch {}
    if (deviceId) {
      try {
        const progRes = await fetch(`${getApiUrl()}/api/dc-university/progress`, {
          headers: { "x-device-id": deviceId },
        });
        if (progRes.ok) setProgress(await progRes.json());
      } catch {}
    }
    setLoading(false);
  }, [deviceId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const openPicker = (course: Course, mode: "lecture" | "discussion" = "lecture") => {
    if (course.comingSoon) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPickerMode(mode);
    setPickerCourse(course);
  };

  const startSession = async (minutes: 5 | 10 | 15) => {
    if (!pickerCourse) return;
    const name = studentName.trim() || "Student";
    await AsyncStorage.setItem(STUDENT_NAME_KEY, name);
    trackAnalyticsEvent(pickerMode === "lecture" ? "dc_university_lecture_selected" : "dc_university_discussion_selected", { courseId: pickerCourse.id, minutes });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setPickerCourse(null);
    router.push({
      pathname: pickerMode === "lecture" ? "/dc-university-lecture" : "/dc-university-discussion",
      params: { courseId: pickerCourse.id, minutes: String(minutes), studentName: name },
    });
  };

  const grouped = courses.reduce<Record<string, Course[]>>((acc, c) => {
    (acc[c.departmentLabel] = acc[c.departmentLabel] || []).push(c);
    return acc;
  }, {});

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <LinearGradient colors={["#0B1F3A", "#050B18"]} style={StyleSheet.absoluteFill} />
      <Image source={require("@/assets/images/dc-university-crest.png")} style={styles.crestWatermark} resizeMode="contain" />

      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton} testID="dc-university-back">
          <Feather name="chevron-left" size={26} color="#FFF" />
        </Pressable>
        <Text style={styles.headerTitle}>DC UNIVERSITY</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
        <View style={styles.hero}>
          <MaterialCommunityIcons name="school" size={36} color="#FFD700" />
          <Text style={styles.heroTitle}>Real educators. Real facts. One-on-one.</Text>
          <Text style={styles.heroSubtitle}>
            Private lectures from Arena's real-world scholars — 5, 10, or 15 minutes, 1 DC Token per minute. Ask questions anytime, take the quiz, earn your certificate.
          </Text>
        </View>

        {today && (
          <View style={styles.scheduleBanner}>
            <Ionicons name="calendar" size={18} color="#FFD700" />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.scheduleTitle}>{today.label} · +{today.bonusPoints} bonus DC Points today</Text>
              <Text style={styles.scheduleBlurb}>{today.blurb}</Text>
            </View>
          </View>
        )}

        {progress && (
          <View style={styles.progressCard}>
            <View style={styles.progressRow}>
              <View style={styles.progressStat}>
                <Text style={styles.progressValue}>{progress.level}</Text>
                <Text style={styles.progressLabel}>Level</Text>
              </View>
              <View style={styles.progressStat}>
                <Text style={styles.progressValue}>{progress.points}</Text>
                <Text style={styles.progressLabel}>DC Points</Text>
              </View>
              <View style={styles.progressStat}>
                <Text style={styles.progressValue}>{progress.currentStreak}🔥</Text>
                <Text style={styles.progressLabel}>Day Streak</Text>
              </View>
              <View style={styles.progressStat}>
                <Text style={styles.progressValue}>{progress.certificates.length}</Text>
                <Text style={styles.progressLabel}>Certificates</Text>
              </View>
            </View>
            {progress.nextLevel && (
              <Text style={styles.nextLevelText}>
                {progress.nextLevel.pointsToGo} points to {progress.nextLevel.name}
              </Text>
            )}
            {balance && (
              <Text style={styles.balanceText}>Balance: {balance.totalAvailable} DC Tokens</Text>
            )}
          </View>
        )}

        {factOfDay && (
          <View style={styles.factCard}>
            <View style={styles.factHeader}>
              <MaterialCommunityIcons name="lightbulb-on" size={16} color="#FFD700" />
              <Text style={styles.factLabel}>FACT OF THE DAY · {factOfDay.educatorName.toUpperCase()}</Text>
            </View>
            <Text style={styles.factText}>{factOfDay.fact}</Text>
            <Text style={styles.factSource}>from {factOfDay.courseTitle}</Text>
          </View>
        )}

        {Object.entries(grouped).map(([dept, deptCourses]) => (
          <View key={dept} style={styles.deptSection}>
            <Text style={styles.deptLabel}>{dept.toUpperCase()}</Text>
            {deptCourses.map((course) => (
              <View key={course.id} style={styles.courseCard}>
                <Pressable
                  onPress={() => openPicker(course, "lecture")}
                  style={({ pressed }) => [styles.courseCardMain, pressed && !course.comingSoon && { opacity: 0.75 }]}
                  testID={`dc-course-${course.id}`}
                >
                  <Image source={EDUCATOR_PORTRAITS[course.educatorId]} style={styles.portrait} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.courseTitle}>{course.courseTitle}</Text>
                    <Text style={styles.educatorName}>{course.educatorName} · {course.educatorTitle}</Text>
                    <Text style={styles.courseDescription} numberOfLines={2}>{course.courseDescription}</Text>
                    {!course.comingSoon && (
                      <Text style={styles.tokenCosts}>
                        5 min · {course.lengths[0]?.tokenCost} tokens   10 min · {course.lengths[1]?.tokenCost} tokens   15 min · {course.lengths[2]?.tokenCost} tokens
                      </Text>
                    )}
                  </View>
                  {course.comingSoon ? (
                    <View style={styles.comingSoonBadge}>
                      <Text style={styles.comingSoonText}>SOON</Text>
                    </View>
                  ) : (
                    <Feather name="chevron-right" size={20} color="#FFD700" />
                  )}
                </Pressable>
                {!course.comingSoon && (
                  <Pressable
                    onPress={() => openPicker(course, "discussion")}
                    style={({ pressed }) => [styles.officeHoursButton, pressed && { opacity: 0.75 }]}
                    testID={`dc-office-hours-${course.id}`}
                  >
                    <Ionicons name="chatbubbles" size={13} color="#FFD700" />
                    <Text style={styles.officeHoursText}>Office Hours — ask {course.educatorName.split(" ").slice(-1)[0]} anything</Text>
                  </Pressable>
                )}
              </View>
            ))}
          </View>
        ))}

        {levels.length > 0 && (
          <View style={styles.levelsSection}>
            <Text style={styles.deptLabel}>ACHIEVEMENT LEVELS</Text>
            {levels.filter((l) => l.reward).map((l) => (
              <View key={l.name} style={styles.levelRow}>
                <Text style={styles.levelName}>{l.name}</Text>
                <Text style={styles.levelPoints}>{l.minPoints}+ pts</Text>
                <Text style={styles.levelReward} numberOfLines={1}>{l.reward}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <Modal visible={!!pickerCourse} transparent animationType="fade" onRequestClose={() => setPickerCourse(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Pressable style={styles.modalClose} onPress={() => setPickerCourse(null)} hitSlop={12}>
              <Feather name="x" size={22} color="#FFF" />
            </Pressable>
            <Text style={styles.modalTitle}>{pickerCourse?.courseTitle}</Text>
            <Text style={styles.modalSubtitle}>with {pickerCourse?.educatorName}</Text>

            <Text style={styles.inputLabel}>Your name (the educator will address you personally)</Text>
            <TextInput
              value={studentName}
              onChangeText={setStudentName}
              placeholder="e.g. Marcus"
              placeholderTextColor="#8899AA"
              style={styles.nameInput}
              maxLength={40}
              testID="dc-university-name-input"
            />

            <Text style={styles.inputLabel}>{pickerMode === "lecture" ? "Choose lecture length" : "Choose office hours length"}</Text>
            {pickerCourse?.lengths.map((l) => (
              <Pressable
                key={l.minutes}
                onPress={() => startSession(l.minutes)}
                style={({ pressed }) => [styles.lengthButton, pressed && { opacity: 0.8 }]}
                testID={`dc-length-${l.minutes}`}
              >
                <Text style={styles.lengthButtonText}>{l.minutes} minute lecture</Text>
                <Text style={styles.lengthButtonCost}>{l.tokenCost} tokens</Text>
              </Pressable>
            ))}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#050B18" },
  crestWatermark: { position: "absolute", width: 480, height: 860, opacity: 0.16, alignSelf: "center", top: 0, pointerEvents: "none" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12 },
  backButton: { padding: 4 },
  headerTitle: { color: "#FFD700", fontSize: 18, fontWeight: "800", letterSpacing: 1 },
  hero: { alignItems: "center", paddingHorizontal: 24, paddingVertical: 20 },
  heroTitle: { color: "#FFF", fontSize: 20, fontWeight: "800", textAlign: "center", marginTop: 10 },
  heroSubtitle: { color: "#B9C4D4", fontSize: 13, textAlign: "center", marginTop: 8, lineHeight: 19 },
  scheduleBanner: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,215,0,0.1)", marginHorizontal: 16, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: "rgba(255,215,0,0.3)" },
  scheduleTitle: { color: "#FFD700", fontWeight: "700", fontSize: 13 },
  scheduleBlurb: { color: "#B9C4D4", fontSize: 12, marginTop: 2 },
  progressCard: { marginHorizontal: 16, marginTop: 14, backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 16, padding: 14 },
  progressRow: { flexDirection: "row", justifyContent: "space-between" },
  progressStat: { alignItems: "center", flex: 1 },
  progressValue: { color: "#FFF", fontSize: 16, fontWeight: "800" },
  progressLabel: { color: "#8899AA", fontSize: 11, marginTop: 2 },
  nextLevelText: { color: "#B9C4D4", fontSize: 12, textAlign: "center", marginTop: 10 },
  balanceText: { color: "#FFD700", fontSize: 12, textAlign: "center", marginTop: 4, fontWeight: "600" },
  deptSection: { marginTop: 22, paddingHorizontal: 16 },
  deptLabel: { color: "#8899AA", fontSize: 12, fontWeight: "700", letterSpacing: 1.2, marginBottom: 10 },
  courseCard: { backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 16, marginBottom: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", overflow: "hidden" },
  courseCardMain: { flexDirection: "row", alignItems: "center", padding: 12 },
  officeHoursButton: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 9, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.08)", backgroundColor: "rgba(255,215,0,0.05)" },
  officeHoursText: { color: "#FFD700", fontSize: 11.5, fontWeight: "600" },
  factCard: { marginHorizontal: 16, marginTop: 14, backgroundColor: "rgba(255,215,0,0.08)", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "rgba(255,215,0,0.25)" },
  factHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  factLabel: { color: "#FFD700", fontSize: 10.5, fontWeight: "800", letterSpacing: 0.8 },
  factText: { color: "#FFF", fontSize: 13, lineHeight: 19 },
  factSource: { color: "#8899AA", fontSize: 10.5, marginTop: 6, fontStyle: "italic" },
  portrait: { width: 56, height: 56, borderRadius: 28, backgroundColor: "#222" },
  courseTitle: { color: "#FFF", fontSize: 14, fontWeight: "700" },
  educatorName: { color: "#FFD700", fontSize: 11, marginTop: 2, fontWeight: "600" },
  courseDescription: { color: "#8899AA", fontSize: 11, marginTop: 3, lineHeight: 15 },
  tokenCosts: { color: "#6FCF97", fontSize: 10, marginTop: 5, fontWeight: "600" },
  comingSoonBadge: { backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  comingSoonText: { color: "#B9C4D4", fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  levelsSection: { marginTop: 22, paddingHorizontal: 16 },
  levelRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)" },
  levelName: { color: "#FFF", fontSize: 13, fontWeight: "700", width: 100 },
  levelPoints: { color: "#FFD700", fontSize: 12, width: 70 },
  levelReward: { color: "#8899AA", fontSize: 11, flex: 1 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "center", padding: 20 },
  modalCard: { backgroundColor: "#0F1E33", borderRadius: 20, padding: 20, borderWidth: 1, borderColor: "rgba(255,215,0,0.25)" },
  modalClose: { position: "absolute", top: 14, right: 14, zIndex: 1 },
  modalTitle: { color: "#FFF", fontSize: 17, fontWeight: "800", paddingRight: 30 },
  modalSubtitle: { color: "#FFD700", fontSize: 13, marginTop: 4, marginBottom: 16 },
  inputLabel: { color: "#8899AA", fontSize: 12, marginBottom: 8, marginTop: 6 },
  nameInput: { backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, color: "#FFF", fontSize: 14, marginBottom: 6 },
  lengthButton: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "rgba(255,215,0,0.12)", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, marginTop: 8, borderWidth: 1, borderColor: "rgba(255,215,0,0.3)" },
  lengthButtonText: { color: "#FFF", fontSize: 14, fontWeight: "700" },
  lengthButtonCost: { color: "#FFD700", fontSize: 13, fontWeight: "700" },
});
