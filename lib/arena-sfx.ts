import { Platform } from "react-native";
import { Audio } from "expo-av";

let audioContextWeb: AudioContext | null = null;

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

export async function playDingSound() {
  if (Platform.OS === "web") {
    playWebTone(1200, 0.15, "sine", 0.4);
    setTimeout(() => playWebTone(1600, 0.2, "sine", 0.3), 80);
  } else {
    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri: "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQ==" },
        { shouldPlay: true, volume: 0.5 }
      );
      setTimeout(() => sound.unloadAsync().catch(() => {}), 500);
    } catch {
      playWebTone(1200, 0.15, "sine", 0.4);
    }
  }
}

export async function playBellSound() {
  if (Platform.OS === "web") {
    const ctx = getWebAudioContext();
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
      const { sound } = await Audio.Sound.createAsync(
        { uri: "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQ==" },
        { shouldPlay: true, volume: 0.6 }
      );
      setTimeout(() => sound.unloadAsync().catch(() => {}), 2000);
    } catch {}
  }
}

export async function playCrowdCheer() {
  if (Platform.OS === "web") {
    try {
      const ctx = getWebAudioContext();
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
      const { sound } = await Audio.Sound.createAsync(
        { uri: "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQ==" },
        { shouldPlay: true, volume: 0.5 }
      );
      setTimeout(() => sound.unloadAsync().catch(() => {}), 2000);
    } catch {}
  }
}

export async function playPointAwardSound() {
  if (Platform.OS === "web") {
    playWebTone(880, 0.08, "sine", 0.35);
    setTimeout(() => playWebTone(1320, 0.12, "sine", 0.3), 60);
    setTimeout(() => playWebTone(1760, 0.15, "sine", 0.25), 120);
  } else {
    try {
      await playDingSound();
    } catch {}
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
  }
}
