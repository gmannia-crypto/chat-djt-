import { Platform } from "react-native";
import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from "expo-av";
import { getApiUrl } from "@/lib/query-client";

// Audio mode is set once for the lifetime of the app — calling setAudioModeAsync
// on every play causes audio session churn that produces lag and interference,
// especially when clips play in rapid succession.
let _audioModeSet = false;
async function ensureAudioMode() {
  if (_audioModeSet) return;
  _audioModeSet = true;
  await Audio.setAudioModeAsync({
    playsInSilentModeIOS: true,
    staysActiveInBackground: true,
    // MixWithOthers (not DoNotMix) lets two of our own Sound instances play at
    // once. DoNotMix operates at the native OS audio-session level, BELOW our
    // own ducking/overlap logic (processTTSQueue's overlap window,
    // playInterruptionAudio, playReactionOverlap) — so even though the app
    // intentionally starts an overlapping/reaction clip while the prior line
    // is still speaking (often in its last ~500ms), DoNotMix made the OS kill
    // the first clip outright the instant the second one started, which read
    // as dialogue getting cut off right before it finished. MixWithOthers lets
    // both clips actually play concurrently, so our own setVolumeAsync-based
    // ducking is what the listener hears, not a hard OS-level stop.
    interruptionModeIOS: InterruptionModeIOS.MixWithOthers,
    // Android has no MixWithOthers value — DoNotMix/DuckOthers here only ever
    // governs focus arbitration with OTHER apps' audio, not between multiple
    // Sound instances inside our own app, so it was never the Android side of
    // this bug. DuckOthers is the platform default.
    interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
    shouldDuckAndroid: false,
    playThroughEarpieceAndroid: false,
  });
}

// Call this early (e.g. on screen mount) to pre-initialize the audio session
// before the first clip plays, avoiding the cold-start lag on the first TTS call.
export async function warmupAudio(): Promise<void> {
  await ensureAudioMode().catch(() => {});
}

// Every TTS/audio fetch in this file used to be a bare, unguarded fetch() —
// a slow or hung request (dead network, overloaded TTS provider) would await
// forever with nothing downstream ever timing out it. Callers like
// playReactionOverlap duck the main line's volume BEFORE this promise
// resolves, so a hung fetch here reads to the listener as literal dead air
// with no recovery, sometimes for tens of seconds until some unrelated timer
// elsewhere finally forces things to move on. Every fetch below goes through
// this helper so a stalled request fails fast and lets its caller's own
// catch/restore logic run instead of hanging indefinitely.
const TTS_FETCH_TIMEOUT_MS = 10000;
async function fetchWithTimeout(url: string, init?: RequestInit, timeoutMs: number = TTS_FETCH_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await globalThis.fetch(url, { ...(init || {}), signal: controller.signal });
  } catch (e: any) {
    if (e?.name === "AbortError") throw new Error(`Audio fetch timed out after ${timeoutMs}ms: ${url}`);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export async function playAudioFromUrl(
  url: string,
  options?: { method?: string; body?: any; headers?: Record<string, string>; volume?: number; rate?: number }
): Promise<Audio.Sound> {
  const vol = options?.volume ?? 1.0;
  const rate = options?.rate ?? 1.0;

  await ensureAudioMode();

  if (Platform.OS === "web") {
    if (!options?.method || options.method === "GET") {
      try {
        const res = await fetchWithTimeout(url, options?.headers ? { headers: options.headers } : undefined);
        if (!res.ok) throw new Error(`Audio fetch failed: ${res.status}`);
        const ct = res.headers.get("content-type") || "";
        if (ct.includes("text/html")) throw new Error("Server returned HTML instead of audio");
        const blob = await res.blob();
        const reader = new FileReader();
        const dataUri = await new Promise<string>((resolve, reject) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        const { sound } = await Audio.Sound.createAsync(
          { uri: dataUri },
          { shouldPlay: false, volume: vol }
        );
        await sound.setRateAsync(rate, true).catch(() => {});
        await sound.playAsync();
        return sound;
      } catch (e) {
        console.warn("Audio.Sound fallback failed, trying window.Audio:", e);
        const audio = new window.Audio(url);
        audio.volume = vol;
        audio.playbackRate = rate;
        await audio.play();
        const { sound } = await Audio.Sound.createAsync(
          { uri: url },
          { shouldPlay: false, volume: vol }
        );
        return sound;
      }
    }
    const res = await fetchWithTimeout(url, {
      method: options.method,
      headers: options.headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    if (!res.ok) throw new Error(`Audio fetch failed: ${res.status}`);
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("text/html")) throw new Error("Server returned HTML instead of audio");
    const blob = await res.blob();
    const reader = new FileReader();
    const dataUri = await new Promise<string>((resolve, reject) => {
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    const { sound } = await Audio.Sound.createAsync(
      { uri: dataUri },
      { shouldPlay: false, volume: vol }
    );
    await sound.setRateAsync(rate, true).catch(() => {});
    await sound.playAsync();
    return sound;
  }

  const fetchOpts: RequestInit = {};
  if (options?.headers) fetchOpts.headers = options.headers;
  const res = await fetchWithTimeout(url, Object.keys(fetchOpts).length > 0 ? fetchOpts : undefined);
  if (!res.ok) throw new Error(`Audio fetch failed: ${res.status}`);
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("text/html")) throw new Error("Server returned HTML instead of audio");

  const { sound } = await Audio.Sound.createAsync(
    { uri: url, headers: options?.headers },
    { shouldPlay: false, volume: vol, rate, shouldCorrectPitch: true }
  );
  await sound.setRateAsync(rate, true).catch(() => {});
  await sound.playAsync();

  return sound;
}

function buildTTSUrl(endpoint: string, body: Record<string, any>): string {
  const baseUrl = getApiUrl().replace(/\/$/, "");
  const params = new URLSearchParams();
  Object.entries(body).forEach(([k, v]) => {
    if (v !== undefined && v !== null) params.append(k, String(v));
  });
  return `${baseUrl}${endpoint}?${params.toString()}`;
}

export async function prefetchTTSAudio(
  endpoint: string,
  body: Record<string, any>
): Promise<string> {
  const url = buildTTSUrl(endpoint, body);

  await ensureAudioMode();

  if (Platform.OS === "web") {
    const res = await fetchWithTimeout(url);
    if (!res.ok) throw new Error(`TTS prefetch failed: ${res.status}`);
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("text/html")) throw new Error("Server returned HTML instead of audio");
    const blob = await res.blob();
    const reader = new FileReader();
    const dataUri = await new Promise<string>((resolve, reject) => {
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    return dataUri;
  }

  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`TTS prefetch failed: ${res.status}`);
  return url;
}

export async function playPrefetchedAudio(
  audioUri: string,
  options?: { volume?: number }
): Promise<Audio.Sound> {
  const vol = options?.volume ?? 1.0;

  await ensureAudioMode();

  const { sound } = await Audio.Sound.createAsync(
    { uri: audioUri },
    { shouldPlay: false, volume: vol }
  );
  await sound.playAsync();
  return sound;
}

// Strips markdown-style stage directions (*laughs*, *scoffs, laughing*, etc.)
// from text before it reaches the TTS engine. These are meant as flavor for
// on-screen transcript text, not literal words — without this, Fish Audio
// reads the asterisks and action words out loud verbatim (e.g. "asterisk
// laughs asterisk boy you musta..."), which is exactly what makes canned
// reaction/catchphrase lines sound broken when spoken.
export function stripStageDirectionsForTTS(text: string): string {
  return text.replace(/\*[^*]*\*/g, "").replace(/\s{2,}/g, " ").trim();
}

export async function playTTS(
  endpoint: string,
  body: Record<string, any>,
  options?: { volume?: number }
): Promise<Audio.Sound> {
  const cleanedBody = typeof body.text === "string" ? { ...body, text: stripStageDirectionsForTTS(body.text) } : body;
  const url = buildTTSUrl(endpoint, cleanedBody);
  return playAudioFromUrl(url, { volume: options?.volume });
}

let _trumpSpeakingCount = 0;
let _trumpQueue: Promise<void> = Promise.resolve();

export function isTrumpCurrentlySpeaking(): boolean {
  return _trumpSpeakingCount > 0;
}

export async function playTrumpTTS(
  endpoint: string,
  body: Record<string, any>,
  options?: { volume?: number }
): Promise<Audio.Sound> {
  const previous = _trumpQueue;
  let completionResolve: () => void;
  let completed = false;

  const finish = () => {
    if (!completed) {
      completed = true;
      _trumpSpeakingCount = Math.max(0, _trumpSpeakingCount - 1);
      completionResolve!();
    }
  };

  const completionPromise = new Promise<void>((resolve) => {
    completionResolve = resolve;
  });

  _trumpQueue = completionPromise;
  _trumpSpeakingCount++;

  try {
    await previous;
  } catch {}

  let sound: Audio.Sound;
  try {
    sound = await playTTS(endpoint, body, options);
  } catch (err) {
    finish();
    throw err;
  }

  const origSetHandler = sound.setOnPlaybackStatusUpdate.bind(sound);
  let externalHandler: ((status: any) => void) | null = null;

  origSetHandler((status: any) => {
    if (externalHandler) externalHandler(status);
    if (!status.isLoaded || status.didJustFinish) {
      finish();
    }
  });

  const origUnload = sound.unloadAsync.bind(sound);
  sound.unloadAsync = async () => {
    finish();
    return origUnload();
  };

  sound.setOnPlaybackStatusUpdate = (handler: (status: any) => void) => {
    externalHandler = handler;
  };

  return sound;
}

export async function playTrumpAudioFromUrl(
  url: string,
  options?: { method?: string; body?: any; headers?: Record<string, string>; volume?: number; rate?: number }
): Promise<Audio.Sound> {
  const previous = _trumpQueue;
  let completionResolve: () => void;
  let completed = false;

  const finish = () => {
    if (!completed) {
      completed = true;
      _trumpSpeakingCount = Math.max(0, _trumpSpeakingCount - 1);
      completionResolve!();
    }
  };

  const completionPromise = new Promise<void>((resolve) => {
    completionResolve = resolve;
  });

  _trumpQueue = completionPromise;
  _trumpSpeakingCount++;

  try {
    await previous;
  } catch {}

  let sound: Audio.Sound;
  try {
    sound = await playAudioFromUrl(url, options);
  } catch (err) {
    finish();
    throw err;
  }

  const origSetHandler = sound.setOnPlaybackStatusUpdate.bind(sound);
  let externalHandler: ((status: any) => void) | null = null;

  origSetHandler((status: any) => {
    if (externalHandler) externalHandler(status);
    if (!status.isLoaded || status.didJustFinish) {
      finish();
    }
  });

  const origUnload = sound.unloadAsync.bind(sound);
  sound.unloadAsync = async () => {
    finish();
    return origUnload();
  };

  sound.setOnPlaybackStatusUpdate = (handler: (status: any) => void) => {
    externalHandler = handler;
  };

  return sound;
}
