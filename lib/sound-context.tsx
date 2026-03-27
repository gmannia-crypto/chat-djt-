import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const SOUND_KEY = "trumpbot_sound_enabled";

interface SoundContextValue {
  soundEnabled: boolean;
  toggleSound: () => void;
}

const SoundContext = createContext<SoundContextValue>({ soundEnabled: true, toggleSound: () => {} });

export function SoundProvider({ children }: { children: ReactNode }) {
  const [soundEnabled, setSoundEnabled] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(SOUND_KEY).then((val) => {
      if (val === "false") setSoundEnabled(false);
    });
  }, []);

  const toggleSound = useCallback(() => {
    setSoundEnabled((prev) => {
      const next = !prev;
      AsyncStorage.setItem(SOUND_KEY, String(next));
      return next;
    });
  }, []);

  return (
    <SoundContext.Provider value={{ soundEnabled, toggleSound }}>
      {children}
    </SoundContext.Provider>
  );
}

export function useSound() {
  return useContext(SoundContext);
}
