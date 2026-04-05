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
  artistId?: number;
};
type PreviewQueryPlan = {
  term: string;
  mode: "mixed" | "title_only" | "artist_probe";
};

const previewCache = new Map<string, string>();
const inflightPreviewLookups = new Map<string, Promise<string | null>>();
let activeAudio: HTMLAudioElement | null = null;
let playRequestId = 0;
let activeFadeRafId: number | null = null;
let globalPreviewVolume = 0.5;
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

function normalizeForMatch(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitArtistTokens(artist: string) {
  return artist
    .split(/,|&|\/|;|\bx\b|\band\b|\bfeat\.?\b|\bfeaturing\b|\bft\.?\b/gi)
    .map((token) => normalizeForMatch(token))
    .map((token) => token.trim())
    .filter(Boolean);
}

const EDITION_QUALIFIER_WORD_RE =
  /\b(remaster(ed)?|mix|edit|version|mono|stereo|acoustic|instrumental|karaoke|demo|radio|extended|original|clean|explicit|bonus|deluxe)\b/i;
const EDITION_YEAR_RE = /^\d{4}$/;

function isEditionLikeSegment(segment: string) {
  const normalized = segment.replace(/\s+/g, " ").trim();
  if (!normalized) return false;
  if (EDITION_YEAR_RE.test(normalized)) return true;
  return EDITION_QUALIFIER_WORD_RE.test(normalized);
}

function stripEditionSuffixes(title: string) {
  let current = title.trim();

  for (let i = 0; i < 4; i++) {
    let changed = false;

    const bracketMatch = current.match(/\s*(\(([^)]*)\)|\[([^\]]*)\])\s*$/);
    if (bracketMatch) {
      const inner = (bracketMatch[2] ?? bracketMatch[3] ?? "").trim();
      if (isEditionLikeSegment(inner)) {
        current = current.slice(0, bracketMatch.index).trim();
        changed = true;
      }
    }

    const dashParts = current.split(/\s+-\s+/);
    if (!changed && dashParts.length > 1) {
      const tail = dashParts[dashParts.length - 1] ?? "";
      if (isEditionLikeSegment(tail)) {
        dashParts.pop();
        current = dashParts.join(" - ").trim();
        changed = true;
      }
    }

    if (!changed) break;
  }

  return current.replace(/\s+/g, " ").trim();
}

function buildTitleVariants(title: string) {
  const base = title.trim();
  const stripped = stripEditionSuffixes(base);

  const variants = [base, stripped].filter(Boolean);
  return [...new Set(variants)];
}

function previewDebugEnabled() {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem("muscino:preview-debug") === "1";
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
  const inflight = inflightPreviewLookups.get(cacheKey);
  if (inflight) return inflight;

  const lookupPromise = (async (): Promise<string | null> => {
    const titleVariants = buildTitleVariants(song.title);
    const normalizedTitleVariants = titleVariants.map((value) => normalizeForMatch(value));
    const wantedTitle = normalizedTitleVariants[0] ?? normalizeForMatch(song.title);
    const artistTokens = splitArtistTokens(song.artist);
    const queryPlans: PreviewQueryPlan[] = [
      ...titleVariants.map((title) => ({ term: `${title} ${song.artist}`.trim(), mode: "mixed" as const })),
      ...(artistTokens[0]
        ? titleVariants.map((title) => ({ term: `${title} ${artistTokens[0]}`.trim(), mode: "mixed" as const }))
        : []),
      ...artistTokens.slice(0, 2).map((token) => ({ term: token, mode: "artist_probe" as const })),
    ];
    if (artistTokens.length === 0) {
      for (const title of titleVariants) {
        queryPlans.push({ term: title, mode: "title_only" });
      }
    }
    const debug = previewDebugEnabled();
    const matchedArtistIds = new Set<number>();

    const searchUrlFor = (query: PreviewQueryPlan, limit: number) => {
      const params = new URLSearchParams({
        media: "music",
        entity: "song",
        limit: String(limit),
        country: "US",
        term: query.term,
      });
      if (query.mode === "artist_probe") params.set("attribute", "artistTerm");
      else params.set("attribute", "songTerm");
      return `https://itunes.apple.com/search?${params.toString()}`;
    };

    const pickBestPreview = (results: ItunesSongResult[], query: PreviewQueryPlan): string | null => {
      let bestStrictScore = -1;
      let bestStrictPreview: string | null = null;
      let bestLooseScore = -1;
      let bestLoosePreview: string | null = null;
      const debugRows: Array<{
        trackName: string;
        artistName: string;
        score: number;
        artistMatched: boolean;
        hasPreview: boolean;
      }> = [];

      for (const item of results) {
        const previewUrl = item.previewUrl?.trim();
        const trackName = normalizeForMatch(item.trackName ?? "");
        const artistName = normalizeForMatch(item.artistName ?? "");
        const hasPreview = Boolean(previewUrl);
        let titleScore = 0;
        let score = 0;
        let artistMatched = false;

        if (trackName === wantedTitle) titleScore = 5;
        else if (normalizedTitleVariants.includes(trackName)) titleScore = 4;
        else if (normalizedTitleVariants.some((variant) => variant && trackName.includes(variant))) titleScore = 2;
        score += titleScore;

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

        if (debug) {
          debugRows.push({ trackName, artistName, score, artistMatched, hasPreview });
        }

        if (artistMatched && typeof item.artistId === "number") {
          matchedArtistIds.add(item.artistId);
        }

        if (!previewUrl) continue;

        if (artistMatched && titleScore > 0 && score > bestStrictScore) {
          bestStrictScore = score;
          bestStrictPreview = previewUrl;
        }

        if (score > bestLooseScore) {
          bestLooseScore = score;
          bestLoosePreview = previewUrl;
        }
      }

      if (debug) {
        console.groupCollapsed(
          `[preview] mode="${query.mode}" query="${query.term}" title="${song.title}" artist="${song.artist}"`,
        );
        console.table(debugRows);
        console.log("artistTokens", artistTokens);
        console.log("bestStrictScore", bestStrictScore, "bestLooseScore", bestLooseScore);
        console.groupEnd();
      }

      if (bestStrictPreview) return bestStrictPreview;

      // Artist metadata from upstream can be inconsistent for collaborations
      // (punctuation, aliases, missing featured artist names). If strict match
      // fails, allow a title-forward fallback.
      // If caller provided artist metadata, prefer silence over wrong-song audio.
      if (artistTokens.length > 0) return null;
      return bestLooseScore >= 4 ? bestLoosePreview : null;
    };

    let previewUrl: string | null = null;
    const seenTerms = new Set<string>();
    for (const query of queryPlans) {
      if (!query.term) continue;
      const dedupeKey = `${query.mode}:${query.term.toLowerCase()}`;
      if (seenTerms.has(dedupeKey)) continue;
      seenTerms.add(dedupeKey);

      const limit = query.mode === "artist_probe" ? 75 : 25;
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 5000);
      let response: Response;
      try {
        response = await fetch(searchUrlFor(query, limit), { signal: controller.signal });
      } catch {
        window.clearTimeout(timeoutId);
        continue;
      }
      window.clearTimeout(timeoutId);
      if (!response.ok) continue;
      const data = (await response.json()) as { results?: ItunesSongResult[] };
      previewUrl = pickBestPreview(data.results ?? [], query);
      if (previewUrl) break;
    }

    // Second-pass fallback: ask iTunes for full song lists by matched artist IDs.
    // This helps when term search doesn't surface the desired track in top results.
    if (!previewUrl && matchedArtistIds.size > 0) {
      for (const artistId of matchedArtistIds) {
        const response = await fetch(
          `https://itunes.apple.com/lookup?id=${artistId}&entity=song&limit=200&sort=recent`,
        );
        if (!response.ok) continue;
        const data = (await response.json()) as { results?: ItunesSongResult[] };
        previewUrl = pickBestPreview(data.results ?? [], { term: `artistId:${artistId}`, mode: "artist_probe" });
        if (previewUrl) break;
      }
    }

    if (previewUrl) {
      previewCache.set(cacheKey, previewUrl);
    }
    return previewUrl;
  })();

  inflightPreviewLookups.set(cacheKey, lookupPromise);
  try {
    return await lookupPromise;
  } finally {
    inflightPreviewLookups.delete(cacheKey);
  }
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
    // Stop any in-progress preview immediately so stale audio never bleeds through
    // while the next lookup resolves (or if no preview is found).
    stopSongPreview();
    const previewUrl = await lookupApplePreview(song);
    if (!previewUrl || requestId !== playRequestId) return;

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