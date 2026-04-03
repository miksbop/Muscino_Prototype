import type { OwnedSong, Song } from "../types/song";

type PreviewTarget = Pick<Song, "title" | "artist"> | Pick<OwnedSong, "title" | "artist">;
type PlaySongPreviewOptions = {
  volume?: number;
  fadeInMs?: number;
};

type PreviewLevelListener = (level: number, hasSignal: boolean) => void;

type ItunesSongResult = {
  trackName?: string;
  artistName?: string;
  previewUrl?: string;
};

const previewCache = new Map<string, string>();
let activeAudio: HTMLAudioElement | null = null;
let playRequestId = 0;
let activeFadeRafId: number | null = null;
let globalPreviewVolume = 0.55;
const levelListeners = new Set<PreviewLevelListener>();
let audioContext: AudioContext | null = null;
let analyserNode: AnalyserNode | null = null;
let analyserData: Uint8Array<ArrayBuffer> | null = null;
let analyserRafId: number | null = null;
let smoothedLevel = 0;
let signalHoldUntil = 0;

function clampVolume(value: number) {
  return Math.max(0, Math.min(1, value));
}

function cacheKeyFor(song: PreviewTarget) {
  return `${song.title}__${song.artist}`.toLowerCase();
}

function emitPreviewLevel(level: number, hasSignal: boolean) {
  levelListeners.forEach((listener) => listener(level, hasSignal));
}

function stopAnalyserLoop() {
  if (analyserRafId !== null) {
    window.cancelAnimationFrame(analyserRafId);
    analyserRafId = null;
  }
  analyserNode = null;
  analyserData = null;
  smoothedLevel = 0;
  signalHoldUntil = 0;
  emitPreviewLevel(0, false);
}

function ensureAudioContext() {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
}

function startAnalyserLoop(audio: HTMLAudioElement) {
  stopAnalyserLoop();

  try {
    const context = ensureAudioContext();
    const source = context.createMediaElementSource(audio);
    const analyser = context.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.62;
    source.connect(analyser);
    analyser.connect(context.destination);
    analyserNode = analyser;
    analyserData = new Uint8Array(analyser.frequencyBinCount);
  } catch {
    emitPreviewLevel(0, false);
    return;
  }

  const frame = () => {
    if (!analyserNode || !analyserData || audio !== activeAudio || audio.paused) {
      stopAnalyserLoop();
      return;
    }

    analyserNode.getByteFrequencyData(analyserData);
    let sum = 0;
    for (let index = 0; index < analyserData.length; index++) {
      sum += analyserData[index];
    }

    const normalized = sum / analyserData.length / 255;
    const dynamicFloor = 0.03;
    const leveled = Math.max(0, (normalized - dynamicFloor) / (1 - dynamicFloor));
    smoothedLevel = smoothedLevel * 0.8 + leveled * 0.2;
    const hasInstantSignal = smoothedLevel > 0.04;
    const now = performance.now();
    if (hasInstantSignal) {
      signalHoldUntil = now + 220;
    }
    const hasSignal = now <= signalHoldUntil;
    emitPreviewLevel(smoothedLevel, hasSignal);
    analyserRafId = window.requestAnimationFrame(frame);
  };

  analyserRafId = window.requestAnimationFrame(frame);
}

export function subscribeSongPreviewLevel(listener: PreviewLevelListener) {
  levelListeners.add(listener);
  listener(0, false);

  return () => {
    levelListeners.delete(listener);
  };
}

async function lookupApplePreview(song: PreviewTarget): Promise<string | null> {
  const cacheKey = cacheKeyFor(song);
  const cached = previewCache.get(cacheKey);
  if (cached) return cached;

  const normalize = (value: string) => value.trim().toLowerCase();
  const wantedTitle = normalize(song.title);
  const artistTokens = normalize(song.artist)
    .split(/,|&| feat\.?| featuring /g)
    .map((token) => token.trim())
    .filter(Boolean);
  const queries = [`${song.title} ${song.artist}`, `${song.title} ${artistTokens[0] ?? ""}`.trim(), song.title];

  const pickBestPreview = (results: ItunesSongResult[]): string | null => {
    let bestScore = -1;
    let bestPreview: string | null = null;
    const requireArtistMatch = artistTokens.length > 0;

    for (const item of results) {
      const previewUrl = item.previewUrl?.trim();
      if (!previewUrl) continue;

      const trackName = normalize(item.trackName ?? "");
      const artistName = normalize(item.artistName ?? "");
      let score = 0;
      let artistMatched = false;

      if (trackName === wantedTitle) score += 5;
      else if (wantedTitle && trackName.includes(wantedTitle)) score += 2;

      for (const token of artistTokens) {
        if (!token) continue;
        if (artistName === token) {
          score += 4;
          artistMatched = true;
        } else if (artistName.includes(token)) {
          score += 2;
          artistMatched = true;
        }
      }

      if (requireArtistMatch && !artistMatched) continue;

      if (score > bestScore) {
        bestScore = score;
        bestPreview = previewUrl;
      }
    }

    return bestPreview;
  };

  let previewUrl: string | null = null;
  for (const query of queries) {
    if (!query) continue;
    const term = encodeURIComponent(query);
    const response = await fetch(`https://itunes.apple.com/search?media=music&entity=song&limit=20&country=US&term=${term}`);
    if (!response.ok) continue;
    const data = (await response.json()) as { results?: ItunesSongResult[] };
    previewUrl = pickBestPreview(data.results ?? []);
    if (previewUrl) break;
  }

  if (previewUrl) {
    previewCache.set(cacheKey, previewUrl);
  }
  return previewUrl;
}

export function stopSongPreview() {
  if (activeFadeRafId !== null) {
    window.cancelAnimationFrame(activeFadeRafId);
    activeFadeRafId = null;
  }
  stopAnalyserLoop();
  if (!activeAudio) return;
  activeAudio.pause();
  activeAudio.currentTime = 0;
  activeAudio = null;
}

export function setSongPreviewVolume(volume: number) {
  globalPreviewVolume = clampVolume(volume);
  if (activeAudio) {
    activeAudio.volume = globalPreviewVolume;
  }
}

export function getSongPreviewVolume() {
  return globalPreviewVolume;
}

function runFadeIn(audio: HTMLAudioElement, targetVolume: number, fadeInMs: number) {
  if (fadeInMs <= 0) {
    audio.volume = targetVolume;
    return;
  }

  const start = performance.now();
  audio.volume = 0;

  const tick = (now: number) => {
    if (audio !== activeAudio) {
      activeFadeRafId = null;
      return;
    }

    const elapsed = now - start;
    const progress = Math.min(1, elapsed / fadeInMs);
    audio.volume = targetVolume * progress;

    if (progress < 1) {
      activeFadeRafId = window.requestAnimationFrame(tick);
    } else {
      activeFadeRafId = null;
    }
  };

  activeFadeRafId = window.requestAnimationFrame(tick);
}

export async function playSongPreview(song: PreviewTarget, options?: PlaySongPreviewOptions): Promise<void> {
  const requestId = ++playRequestId;
  const targetVolume = clampVolume(options?.volume ?? globalPreviewVolume);
  const fadeInMs = Math.max(0, options?.fadeInMs ?? 0);

  try {
    const previewUrl = await lookupApplePreview(song);
    if (!previewUrl || requestId !== playRequestId) return;

    stopSongPreview();
    const audio = new Audio(previewUrl);
    audio.crossOrigin = "anonymous";
    audio.volume = targetVolume;
    activeAudio = audio;
    await audio.play();
    if (audioContext && audioContext.state === "suspended") {
      void audioContext.resume();
    }
    startAnalyserLoop(audio);
    runFadeIn(audio, targetVolume, fadeInMs);
  } catch {
    // Ignore preview failures: no preview and autoplay restrictions should not break UX.
  }
}