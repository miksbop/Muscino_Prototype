import type { OwnedSong, Song } from "../types/song";

type PreviewTarget = Pick<Song, "title" | "artist"> | Pick<OwnedSong, "title" | "artist">;
type PlaySongPreviewOptions = {
  volume?: number;
  fadeInMs?: number;
};

const previewCache = new Map<string, string | null>();
let activeAudio: HTMLAudioElement | null = null;
let playRequestId = 0;
let activeFadeRafId: number | null = null;
let globalPreviewVolume = 0.55;

function clampVolume(value: number) {
  return Math.max(0, Math.min(1, value));
}

function cacheKeyFor(song: PreviewTarget) {
  return `${song.title}__${song.artist}`.toLowerCase();
}

async function lookupApplePreview(song: PreviewTarget): Promise<string | null> {
  const cacheKey = cacheKeyFor(song);
  const cached = previewCache.get(cacheKey);
  if (typeof cached !== "undefined") return cached;

  const term = encodeURIComponent(`${song.title} ${song.artist}`);
  const response = await fetch(`https://itunes.apple.com/search?media=music&entity=song&limit=1&term=${term}`);
  if (!response.ok) {
    previewCache.set(cacheKey, null);
    return null;
  }

  const data = (await response.json()) as { results?: Array<{ previewUrl?: string }> };
  const previewUrl = data.results?.[0]?.previewUrl ?? null;
  previewCache.set(cacheKey, previewUrl);
  return previewUrl;
}

export function stopSongPreview() {
  if (activeFadeRafId !== null) {
    window.cancelAnimationFrame(activeFadeRafId);
    activeFadeRafId = null;
  }
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
    audio.volume = targetVolume;
    activeAudio = audio;
    await audio.play();
    runFadeIn(audio, targetVolume, fadeInMs);
  } catch {
    // Ignore preview failures: no preview and autoplay restrictions should not break UX.
  }
}