import React, { useEffect, useState } from "react";
import {
  View, Text, Pressable, StyleSheet, Modal, TextInput,
  ActivityIndicator, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

export const MAX_TAGS_PER_INTERVIEW = 8;
export const MAX_TAG_LENGTH = 24;

export function normalizeTag(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").slice(0, MAX_TAG_LENGTH);
}

export type SmartTagResult =
  | { ok: true; tags?: string[] }
  | { ok: false; error?: string };

export type SaveTagsResult =
  | { ok: true; tags?: string[] }
  | { ok: false; error?: string };

export type TagEditorModalProps = {
  visible: boolean;
  initialTags: string[];
  smartSuggestions: string[];
  computeSmartSuggestions?: (currentDraft: string[]) => string[];
  allTags: { label: string; count: number }[];
  onClose: () => void;
  onSave: (tags: string[]) => Promise<SaveTagsResult>;
  onAddSmartTag?: (label: string, nextDraft: string[]) => Promise<SmartTagResult>;
  testIDPrefix?: string;
};

export default function TagEditorModal({
  visible,
  initialTags,
  smartSuggestions,
  computeSmartSuggestions,
  allTags,
  onClose,
  onSave,
  onAddSmartTag,
  testIDPrefix = "tag-editor",
}: TagEditorModalProps) {
  const [tagsDraft, setTagsDraft] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [savingTags, setSavingTags] = useState(false);
  const [addingSmartTag, setAddingSmartTag] = useState<string | null>(null);
  const [smartTagError, setSmartTagError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      const cleaned = Array.isArray(initialTags)
        ? initialTags.map(normalizeTag).filter((t) => t.length > 0)
        : [];
      setTagsDraft(cleaned);
      setTagInput("");
      setSmartTagError(null);
      setAddingSmartTag(null);
      setSaveError(null);
    }
  }, [visible, initialTags]);

  useEffect(() => {
    if (!smartTagError) return;
    const t = setTimeout(() => setSmartTagError(null), 2500);
    return () => clearTimeout(t);
  }, [smartTagError]);

  const addDraftTag = (raw: string) => {
    const cleaned = normalizeTag(raw);
    if (!cleaned) return;
    setTagsDraft((prev) => {
      if (prev.length >= MAX_TAGS_PER_INTERVIEW) return prev;
      const key = cleaned.toLowerCase();
      if (prev.some((t) => t.toLowerCase() === key)) return prev;
      return [...prev, cleaned];
    });
    setTagInput("");
  };

  const removeDraftTag = (tag: string) => {
    const key = tag.toLowerCase();
    setTagsDraft((prev) => prev.filter((t) => t.toLowerCase() !== key));
  };

  const handleAddSmartTag = async (label: string) => {
    if (!onAddSmartTag || addingSmartTag) return;
    const cleaned = normalizeTag(label);
    if (!cleaned) return;
    if (tagsDraft.length >= MAX_TAGS_PER_INTERVIEW) {
      setSmartTagError(`Limit is ${MAX_TAGS_PER_INTERVIEW} tags.`);
      return;
    }
    if (tagsDraft.some((t) => t.toLowerCase() === cleaned.toLowerCase())) return;
    setSmartTagError(null);
    setAddingSmartTag(cleaned);
    const nextDraft = [...tagsDraft, cleaned];
    try {
      const result = await onAddSmartTag(cleaned, nextDraft);
      if (result.ok) {
        if (Array.isArray(result.tags)) {
          setTagsDraft(result.tags);
        } else {
          setTagsDraft((prev) => {
            if (prev.some((t) => t.toLowerCase() === cleaned.toLowerCase())) return prev;
            return [...prev, cleaned];
          });
        }
      } else {
        setSmartTagError(result.error || "Couldn't add tag. Please try again.");
      }
    } catch {
      setSmartTagError("Couldn't add tag. Please try again.");
    } finally {
      setAddingSmartTag(null);
    }
  };

  const submit = async () => {
    setSavingTags(true);
    setSaveError(null);
    const nextTags = [...tagsDraft];
    const pending = normalizeTag(tagInput);
    if (pending && nextTags.length < MAX_TAGS_PER_INTERVIEW) {
      const key = pending.toLowerCase();
      if (!nextTags.some((t) => t.toLowerCase() === key)) {
        nextTags.push(pending);
      }
    }
    try {
      const result = await onSave(nextTags);
      if (result.ok) {
        setTagInput("");
        setSaveError(null);
      } else {
        setSaveError(result.error || "Couldn't save tags. Please try again.");
      }
    } catch {
      setSaveError("Couldn't save tags. Please try again.");
    } finally {
      setSavingTags(false);
    }
  };

  const inputDisabled = tagsDraft.length >= MAX_TAGS_PER_INTERVIEW;
  const addBtnDisabled = !normalizeTag(tagInput) || tagsDraft.length >= MAX_TAGS_PER_INTERVIEW;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.modalOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={s.sheet} testID={`${testIDPrefix}-sheet`}>
          <View style={s.handle} />
          <Text style={s.sheetTitle}>Tag this interview</Text>
          <Text style={s.sheetSub}>
            Add up to {MAX_TAGS_PER_INTERVIEW} short tags (e.g. favorites, for the show, spicy).
          </Text>

          {tagsDraft.length > 0 ? (
            <View style={s.draftTagsRow}>
              {tagsDraft.map((t) => (
                <Pressable
                  key={t.toLowerCase()}
                  onPress={() => removeDraftTag(t)}
                  style={s.draftTagChip}
                  testID={`${testIDPrefix}-draft-${t.toLowerCase()}`}
                >
                  <Text style={s.draftTagChipText}>#{t}</Text>
                  <Ionicons name="close" size={12} color="#000" />
                </Pressable>
              ))}
            </View>
          ) : (
            <Text style={s.tagsHint}>No tags yet — type one below or pick from your set.</Text>
          )}

          <View style={s.tagInputRow}>
            <TextInput
              value={tagInput}
              onChangeText={(v) => setTagInput(v.slice(0, MAX_TAG_LENGTH))}
              placeholder="New tag"
              placeholderTextColor="rgba(255,255,255,0.35)"
              style={[s.input, { flex: 1, marginBottom: 0 }]}
              maxLength={MAX_TAG_LENGTH}
              onSubmitEditing={() => addDraftTag(tagInput)}
              returnKeyType="done"
              blurOnSubmit={false}
              editable={!inputDisabled}
              testID={`${testIDPrefix}-input`}
            />
            <Pressable
              onPress={() => addDraftTag(tagInput)}
              disabled={addBtnDisabled}
              style={[s.tagAddBtn, addBtnDisabled && { opacity: 0.4 }]}
              testID={`${testIDPrefix}-add`}
            >
              <Ionicons name="add" size={20} color="#000" />
            </Pressable>
          </View>

          {(() => {
            const baseSuggestions = computeSmartSuggestions
              ? computeSmartSuggestions(tagsDraft)
              : smartSuggestions;
            const draftKeys = new Set(tagsDraft.map((t) => t.toLowerCase()));
            const visibleSmart = baseSuggestions.filter(
              (label) => !draftKeys.has(label.toLowerCase()),
            );
            if (visibleSmart.length === 0 || !onAddSmartTag) return null;
            return (
            <View style={{ marginTop: 14 }} testID={`${testIDPrefix}-smart-suggestions`}>
              <Text style={s.tagsSectionLabel}>Smart suggestions</Text>
              <View style={s.suggestionRow}>
                {visibleSmart.map((label) => {
                  const busy = addingSmartTag === label;
                  return (
                    <Pressable
                      key={`smart-${label.toLowerCase()}`}
                      onPress={() => handleAddSmartTag(label)}
                      disabled={!!addingSmartTag}
                      style={[s.suggestionChip, s.smartSuggestionChip, busy && { opacity: 0.6 }]}
                      testID={`${testIDPrefix}-smart-suggest-${label.toLowerCase()}`}
                    >
                      <Ionicons name="sparkles" size={11} color="#FFD700" />
                      <Text style={[s.suggestionChipText, s.smartSuggestionChipText]}>
                        #{label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {smartTagError ? (
                <Text style={s.smartTagErrorText} testID={`${testIDPrefix}-smart-tag-error`}>
                  {smartTagError}
                </Text>
              ) : null}
            </View>
            );
          })()}

          {allTags.length > 0 ? (
            <View style={{ marginTop: 14 }}>
              <Text style={s.tagsSectionLabel}>Your tags</Text>
              <View style={s.suggestionRow}>
                {allTags.map((t) => {
                  const inDraft = tagsDraft.some((d) => d.toLowerCase() === t.label.toLowerCase());
                  return (
                    <Pressable
                      key={t.label.toLowerCase()}
                      onPress={() => {
                        if (inDraft) removeDraftTag(t.label);
                        else addDraftTag(t.label);
                      }}
                      style={[s.suggestionChip, inDraft && s.suggestionChipActive]}
                      testID={`${testIDPrefix}-suggest-${t.label.toLowerCase()}`}
                    >
                      <Text style={[s.suggestionChipText, inDraft && s.suggestionChipTextActive]}>
                        #{t.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          {saveError ? (
            <Text
              style={s.saveErrorText}
              testID={`${testIDPrefix}-save-error`}
            >
              {saveError}
            </Text>
          ) : null}

          <View style={[s.sheetActions, { marginTop: saveError ? 8 : 18 }]}>
            <Pressable style={[s.sheetBtn, s.sheetBtnGhost]} onPress={onClose}>
              <Text style={s.sheetBtnGhostText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[s.sheetBtn, s.sheetBtnPrimary]}
              onPress={submit}
              disabled={savingTags}
              testID={`${testIDPrefix}-save`}
            >
              {savingTags ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={s.sheetBtnPrimaryText}>Save</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#0F0F12", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18, borderTopWidth: 1, borderColor: "rgba(255,215,0,0.2)", paddingBottom: Platform.OS === "web" ? 34 : 24 },
  handle: { alignSelf: "center", width: 44, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.2)", marginBottom: 12 },
  sheetTitle: { color: "#fff", fontSize: 16, fontWeight: "900", marginBottom: 6 },
  sheetSub: { color: "rgba(255,255,255,0.55)", fontSize: 12, marginBottom: 14 },
  input: { backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(255,215,0,0.3)", borderRadius: 12, paddingHorizontal: 12, paddingVertical: Platform.OS === "ios" ? 12 : 8, color: "#fff", fontSize: 14, marginBottom: 14 },
  sheetActions: { flexDirection: "row", gap: 8 },
  sheetBtn: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 12, borderRadius: 12 },
  sheetBtnGhost: { backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" },
  sheetBtnGhostText: { color: "#fff", fontSize: 13, fontWeight: "800" },
  sheetBtnPrimary: { backgroundColor: "#FFD700" },
  sheetBtnPrimaryText: { color: "#000", fontSize: 13, fontWeight: "900" },

  draftTagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 },
  draftTagChip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, backgroundColor: "#FFD700" },
  draftTagChipText: { color: "#000", fontSize: 12, fontWeight: "900" },
  tagsHint: { color: "rgba(255,255,255,0.45)", fontSize: 11, marginBottom: 12, fontWeight: "600" },
  tagInputRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  tagAddBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: "#FFD700", alignItems: "center", justifyContent: "center" },
  tagsSectionLabel: { color: "rgba(255,255,255,0.55)", fontSize: 10, fontWeight: "900", letterSpacing: 0.8, marginBottom: 8 },
  suggestionRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  suggestionChip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.14)" },
  suggestionChipActive: { backgroundColor: "rgba(255,215,0,0.18)", borderColor: "rgba(255,215,0,0.7)" },
  suggestionChipText: { color: "rgba(255,255,255,0.75)", fontSize: 11, fontWeight: "700" },
  suggestionChipTextActive: { color: "#FFD700", fontWeight: "900" },
  smartSuggestionChip: { backgroundColor: "rgba(255,215,0,0.1)", borderColor: "rgba(255,215,0,0.45)", borderStyle: "dashed" },
  smartSuggestionChipText: { color: "#FFD700", fontWeight: "800" },
  smartTagErrorText: { color: "#ff4d4d", fontSize: 11, marginTop: 8, fontWeight: "700" },
  saveErrorText: { color: "#ff4d4d", fontSize: 12, marginTop: 16, fontWeight: "700", textAlign: "center" },
});
