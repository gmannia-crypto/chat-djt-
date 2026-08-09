import { Link, Stack } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Colors from "@/constants/colors";

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Not Found" }} />
      <View style={styles.container}>
        <MaterialCommunityIcons name="crown-outline" size={48} color={Colors.goldDark} />
        <Text style={styles.title}>This page doesn't exist.</Text>
        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>Go back to The Arena</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    backgroundColor: Colors.background,
    gap: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    color: Colors.white,
  },
  link: {
    marginTop: 8,
    paddingVertical: 12,
  },
  linkText: {
    fontSize: 14,
    color: Colors.gold,
  },
});
