import { useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

type Options = {
  /** Gate when the hint is allowed to start counting down (e.g. wait for intro to pass). */
  active?: boolean;
  /** Delay before the hint appears, so it doesn't fight for attention on first paint. */
  showDelayMs?: number;
  /** How long the hint stays visible before disappearing for good. */
  hideAfterMs?: number;
};

/**
 * Shows a one-time hint the first time a player reaches a screen, then
 * remembers via AsyncStorage so it never appears again on this device.
 * Reused anywhere a low-discoverability affordance (like a long-press)
 * needs a brief, self-dismissing nudge.
 */
export function useFirstRunHint(storageKey: string, options?: Options) {
  const { active = true, showDelayMs = 1200, hideAfterMs = 5000 } = options || {};
  const [visible, setVisible] = useState(false);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!active || startedRef.current) return;
    startedRef.current = true;
    let cancelled = false;
    let hideTimer: ReturnType<typeof setTimeout> | undefined;

    AsyncStorage.getItem(storageKey)
      .then((seen) => {
        if (cancelled || seen === "1") return;
        const showTimer = setTimeout(() => {
          if (cancelled) return;
          setVisible(true);
          AsyncStorage.setItem(storageKey, "1").catch(() => {});
          hideTimer = setTimeout(() => {
            if (!cancelled) setVisible(false);
          }, hideAfterMs);
        }, showDelayMs);
        return () => clearTimeout(showTimer);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      if (hideTimer) clearTimeout(hideTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  return { visible, dismiss: () => setVisible(false) };
}
