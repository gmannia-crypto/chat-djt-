import { Platform } from "react-native";
import { Audio } from "expo-av";
import { getApiUrl } from "@/lib/query-client";

let audioContextWeb: AudioContext | null = null;
let audioModeConfigured = false;

async function ensureAudioMode() {
  if (audioModeConfigured || Platform.OS === "web") return;
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
    });
    audioModeConfigured = true;
  } catch (e) {
    console.warn("Failed to set audio mode:", e);
  }
}

function getWebAudioContext(): AudioContext {
  if (!audioContextWeb || audioContextWeb.state === "closed") {
    audioContextWeb = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (audioContextWeb.state === "suspended") {
    audioContextWeb.resume();
  }
  return audioContextWeb;
}

function playWebTone(frequency: number, duration: number, type: OscillatorType = "sine", volume = 0.3) {
  try {
    const ctx = getWebAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  } catch {}
}

function playWebAudio(urlPath: string, volume = 0.7) {
  try {
    const baseUrl = getApiUrl().replace(/\/$/, "");
    const audio = new window.Audio(`${baseUrl}${urlPath}`);
    audio.volume = volume;
    audio.play().catch((e) => console.warn("Web audio play failed:", e));
  } catch (e) {
    console.warn("Web audio error:", e);
  }
}

async function playNativeSound(urlPath: string, volume = 0.7): Promise<void> {
  await ensureAudioMode();
  const baseUrl = getApiUrl().replace(/\/$/, "");
  const uri = `${baseUrl}${urlPath}`;
  console.log("SFX: loading", uri);
  const { sound } = await Audio.Sound.createAsync(
    { uri },
    { shouldPlay: true, volume }
  );
  sound.setOnPlaybackStatusUpdate((status) => {
    if (status.isLoaded && status.didJustFinish) {
      sound.unloadAsync().catch(() => {});
    }
  });
}

export async function playVoteClickSound() {
  if (Platform.OS === "web") {
    playWebAudio("/public/vote-click.m4a", 0.7);
  } else {
    try {
      await playNativeSound("/public/vote-click.m4a", 0.7);
    } catch (e) {
      console.warn("SFX vote-click failed:", e);
    }
  }
}

export async function playVoteSound2() {
  if (Platform.OS === "web") {
    playWebAudio("/public/vote-sound2.m4a", 0.7);
  } else {
    try {
      await playNativeSound("/public/vote-sound2.m4a", 0.7);
    } catch (e) {
      console.warn("SFX vote-sound2 failed:", e);
    }
  }
}

export async function playWinnerChosenSound() {
  if (Platform.OS === "web") {
    playWebAudio("/public/winner-chosen.m4a", 0.8);
  } else {
    try {
      await playNativeSound("/public/winner-chosen.m4a", 0.8);
    } catch (e) {
      console.warn("SFX winner-chosen failed:", e);
    }
  }
}

export async function playWinnerAfterSound() {
  if (Platform.OS === "web") {
    playWebAudio("/public/winner-after.m4a", 0.8);
  } else {
    try {
      await playNativeSound("/public/winner-after.m4a", 0.8);
    } catch (e) {
      console.warn("SFX winner-after failed:", e);
    }
  }
}

export async function playPointAwardSound() {
  return playVoteClickSound();
}

export async function playDingSound() {
  if (Platform.OS === "web") {
    playWebTone(1200, 0.15, "sine", 0.4);
    setTimeout(() => playWebTone(1600, 0.2, "sine", 0.3), 80);
  } else {
    try {
      await playNativeSound("/public/vote-click.m4a", 0.5);
    } catch (e) {
      console.warn("SFX ding failed:", e);
    }
  }
}

export async function playBellSound() {
  if (Platform.OS === "web") {
    try {
      const bellFreqs = [800, 1000, 1200, 1500];
      for (let i = 0; i < 3; i++) {
        setTimeout(() => {
          bellFreqs.forEach((freq, idx) => {
            setTimeout(() => playWebTone(freq, 0.6, "sine", 0.25), idx * 40);
          });
        }, i * 400);
      }
    } catch {}
  } else {
    try {
      await playNativeSound("/public/winner-chosen.m4a", 0.6);
    } catch (e) {
      console.warn("SFX bell failed:", e);
    }
  }
}

export async function playCrowdCheer() {
  if (Platform.OS === "web") {
    try {
      for (let i = 0; i < 8; i++) {
        setTimeout(() => {
          const freq = 300 + Math.random() * 400;
          playWebTone(freq, 0.3 + Math.random() * 0.3, "sawtooth", 0.08);
          playWebTone(freq * 1.5, 0.2, "triangle", 0.06);
        }, i * 100 + Math.random() * 50);
      }
      setTimeout(() => {
        playWebTone(523, 0.5, "sine", 0.2);
        setTimeout(() => playWebTone(659, 0.5, "sine", 0.2), 150);
        setTimeout(() => playWebTone(784, 0.8, "sine", 0.25), 300);
      }, 800);
    } catch {}
  } else {
    try {
      await playNativeSound("/public/winner-chosen.m4a", 0.5);
    } catch (e) {
      console.warn("SFX crowd failed:", e);
    }
  }
}

export async function playBreakingNewsAlert() {
  if (Platform.OS === "web") {
    try {
      playWebTone(880, 0.15, "square", 0.2);
      playWebTone(440, 0.15, "sine", 0.1);
      setTimeout(() => {
        playWebTone(1100, 0.15, "square", 0.2);
        playWebTone(550, 0.15, "sine", 0.1);
      }, 150);
      setTimeout(() => {
        playWebTone(880, 0.15, "square", 0.2);
        playWebTone(440, 0.15, "sine", 0.1);
      }, 300);
      setTimeout(() => {
        playWebTone(1320, 0.4, "square", 0.25);
        playWebTone(660, 0.4, "sine", 0.15);
        playWebTone(990, 0.4, "triangle", 0.1);
      }, 500);
    } catch {}
  } else {
    try {
      await playNativeSound("/public/vote-sound2.m4a", 0.6);
    } catch (e) {
      console.warn("SFX breaking-news alert failed:", e);
    }
  }
}

export async function playDrumroll() {
  if (Platform.OS === "web") {
    try {
      for (let i = 0; i < 20; i++) {
        const delay = i * 60 + Math.random() * 20;
        const vol = 0.05 + (i / 20) * 0.2;
        setTimeout(() => {
          playWebTone(100 + Math.random() * 50, 0.05, "triangle", vol);
        }, delay);
      }
      setTimeout(() => {
        playWebTone(200, 0.3, "triangle", 0.3);
        playWebTone(100, 0.4, "square", 0.15);
      }, 1300);
    } catch {}
  } else {
    try {
      await playNativeSound("/public/vote-sound2.m4a", 0.5);
    } catch (e) {
      console.warn("SFX drumroll failed:", e);
    }
  }
}
