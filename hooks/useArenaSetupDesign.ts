import { useCallback, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  ARENA_DESIGN_STORAGE_KEY,
  isArenaSetupDesign,
  type ArenaSetupDesign,
} from "@/lib/arena-setup-design";

/** Cosmetic preference only: never touches personas, access, sessions, or tokens. */
export function useArenaSetupDesign() {
  const [design, setDesign] = useState<ArenaSetupDesign>("electric");
  const [pickerVisible, setPickerVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const saved = useRef(false);
  const busy = useRef(false);
  const mounted = useRef(true);
  const selectedSinceLoad = useRef(false);

  useEffect(() => {
    mounted.current = true;
    let cancelled = false;
    void AsyncStorage.getItem(ARENA_DESIGN_STORAGE_KEY)
      .then((stored) => {
        if (cancelled || selectedSinceLoad.current) return;
        if (isArenaSetupDesign(stored)) {
          saved.current = true;
          setDesign(stored);
        } else {
          setPickerVisible(true);
        }
      })
      .catch(() => {
        if (cancelled || selectedSinceLoad.current) return;
        setError("Your saved design could not be loaded. Choose a design to try again.");
        setPickerVisible(true);
      });
    return () => {
      cancelled = true;
      mounted.current = false;
    };
  }, []);

  const chooseDesign = useCallback(async (next: ArenaSetupDesign) => {
    if (busy.current || !isArenaSetupDesign(next)) return;
    selectedSinceLoad.current = true;
    busy.current = true;
    setDesign(next);
    setSaving(true);
    setError(null);
    try {
      await AsyncStorage.setItem(ARENA_DESIGN_STORAGE_KEY, next);
      saved.current = true;
      if (mounted.current) setPickerVisible(false);
    } catch {
      if (mounted.current) {
        setError("This design is applied, but could not be saved. Tap it again to retry.");
        setPickerVisible(true);
      }
    } finally {
      busy.current = false;
      if (mounted.current) setSaving(false);
    }
  }, []);

  const openPicker = useCallback(() => {
    if (!busy.current) setPickerVisible(true);
  }, []);

  const closePicker = useCallback(() => {
    if (busy.current) return;
    if (error) {
      // An optional cosmetic preference must never prevent entering the Arena.
      setPickerVisible(false);
    } else if (!saved.current) {
      void chooseDesign(design);
    } else {
      setPickerVisible(false);
    }
  }, [chooseDesign, design, error]);

  return { design, pickerVisible, saving, error, chooseDesign, openPicker, closePicker };
}