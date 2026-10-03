import React from "react";
import { Pressable, Text, TextInput, View } from "react-native";

type Props = {
  topics: { id: string; title: string }[];
  selectedTopicId: string | null;
  useCustomTopic: boolean;
  customTopicText: string;
  onSelectTopic: (id: string | null) => void;
  onCustomMode: (enabled: boolean) => void;
  onCustomText: (text: string) => void;
  testID: string;
};

export function ArenaTopicPicker(props: Props) {
  const selectedTitle = props.useCustomTopic
    ? props.customTopicText.trim() || "Enter your topic below"
    : props.topics.find((topic) => topic.id === props.selectedTopicId)?.title || "Random topic";
  const choice = (id: string | null, label: string) => {
    const selected = !props.useCustomTopic && props.selectedTopicId === id;
    return (
      <Pressable
        key={id ?? "random"}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        onPress={() => { props.onCustomMode(false); props.onSelectTopic(id); }}
        style={{ padding: 10, marginBottom: 6, borderRadius: 9, borderWidth: 1, borderColor: selected ? "#FFD700" : "rgba(255,255,255,0.15)", backgroundColor: selected ? "rgba(255,215,0,0.1)" : "rgba(255,255,255,0.04)" }}
      >
        <Text style={{ color: selected ? "#FFD700" : "#eee", fontSize: 12, fontWeight: selected ? "800" : "600" }}>{label}</Text>
      </Pressable>
    );
  };
  return (
    <View testID={props.testID} style={{ marginTop: 12, marginBottom: 6 }}>
      <Text style={{ color: "#FFD700", fontSize: 13, fontWeight: "800", marginBottom: 8 }}>CHOOSE TOPIC</Text>
      {props.topics.map((topic) => choice(topic.id, topic.title))}
      {choice(null, "Random topic")}
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: props.useCustomTopic }}
        onPress={() => { props.onCustomMode(true); props.onSelectTopic(null); }}
        style={{ padding: 10, marginBottom: 6, borderRadius: 9, borderWidth: 1, borderColor: props.useCustomTopic ? "#FFD700" : "rgba(255,255,255,0.15)" }}
      >
        <Text style={{ color: props.useCustomTopic ? "#FFD700" : "#eee", fontSize: 12, fontWeight: "800" }}>Create your own topic</Text>
      </Pressable>
      {props.useCustomTopic && (
        <TextInput
          accessibilityLabel="Custom debate topic"
          value={props.customTopicText}
          onChangeText={props.onCustomText}
          placeholder="Type your debate topic..."
          placeholderTextColor="#999"
          multiline
          maxLength={200}
          style={{ color: "#fff", padding: 12, borderRadius: 9, borderWidth: 1, borderColor: "#FFD700", marginBottom: 8, minHeight: 50 }}
        />
      )}
      <Text testID={`${props.testID}-selection`} style={{ color: "#c2b7a6", fontSize: 11, lineHeight: 16 }}>Topic: {selectedTitle}</Text>
    </View>
  );
}