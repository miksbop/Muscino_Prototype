import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import GlassPanel from "../components/GlassPanel";
import { SongCard } from "../components/SongCard";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { api } from "../services/api";
import { playSongPreview, stopSongPreview } from "../services/songPreview";
import { useAuth } from "../context/useAuth";
import type { OwnedSong } from "../types/song";
import type { Sleeve } from "../types/sleeve";
import { rarityBorderClass, rarityGlowClass, rarityRgb } from "../types/rarity";

import sleevePop from "../pictures/Pictures/sleeve_pop.png";
import sleevePopOpen from "../pictures/Pictures/sleeve_pop_open.png";
import sleeveRock from "../pictures/Pictures/sleeve_rock.png";
import sleeveRockOpen from "../pictures/Pictures/sleeve_rock_open.png";
import sleeveRap from "../pictures/Pictures/sleeve_rap.png";
import sleeveRapOpen from "../pictures/Pictures/sleeve_rap_open.png";
import sleeveCountry from "../pictures/Pictures/sleeve_country.png";
import sleeveCountryOpen from "../pictures/Pictures/sleeve_country_open.png";
import sleeveKpop from "../pictures/Pictures/sleeve_kpop.png";
import sleeveKpopOpen from "../pictures/Pictures/sleeve_kpop_open.png";
import sleeveDanceElectronic from "../pictures/Pictures/sleeve_dance_electronic.png";
import sleeveDanceElectronicOpen from "../pictures/Pictures/sleeve_dance_electronic_open.png";
import sleeveGameSoundtrack from "../pictures/Pictures/sleeve_game_soundtrack.png";
import sleeveGameSoundtrackOpen from "../pictures/Pictures/sleeve_game_soundtrack_open.png";
import sleeveIndie from "../pictures/Pictures/sleeve_indie.png";
import sleeveIndieOpen from "../pictures/Pictures/sleeve_indie_open.png";

type OpenState = "idle" | "dropping" | "burst" | "rolling" | "revealed";
type PlayGenre = "Pop" | "Rock" | "Rap" | "Country" | "K-Pop" | "Dance/Electronic" | "Game Soundtrack" | "Indie";

const PLAY_GENRES: PlayGenre[] = ["Pop", "Rock", "Rap", "Country", "K-Pop", "Dance/Electronic", "Game Soundtrack", "Indie"];

const GENRE_THEME: Record<PlayGenre, {
  slug: string;
  bgClass: string;
  art: { closed: string; open: string };
  sleeveLabel: string;
  panelRarityRgb: string;
  panelSheenRgb: string;
}> = {
  Pop: {
    slug: "pop",
    bgClass: "play-bg-pop",
    art: { closed: sleevePop, open: sleevePopOpen },
    sleeveLabel: "Pop",
    panelRarityRgb: "96 165 250",
    panelSheenRgb: "120 185 255",
  },
  Rock: {
    slug: "rock",
    bgClass: "play-bg-rock",
    art: { closed: sleeveRock, open: sleeveRockOpen },
    sleeveLabel: "Rock",
    panelRarityRgb: "255 110 160",
    panelSheenRgb: "255 140 190",
  },
  Rap: {
    slug: "rap",
    bgClass: "play-bg-rap",
    art: { closed: sleeveRap, open: sleeveRapOpen },
    sleeveLabel: "Rap",
    panelRarityRgb: "255 170 76",
    panelSheenRgb: "255 170 76",
  },
  Country: {
    slug: "country",
    bgClass: "play-bg-country",
    art: { closed: sleeveCountry, open: sleeveCountryOpen },
    sleeveLabel: "Country",
    panelRarityRgb: "110 220 140",
    panelSheenRgb: "138 236 168",
  },
  "K-Pop": {
    slug: "kpop",
    bgClass: "play-bg-kpop",
    art: { closed: sleeveKpop, open: sleeveKpopOpen },
    sleeveLabel: "K-Pop",
    panelRarityRgb: "255 120 215",
    panelSheenRgb: "255 160 228",
  },
  "Dance/Electronic": {
    slug: "dance-electronic",
    bgClass: "play-bg-dance-electronic",
    art: { closed: sleeveDanceElectronic, open: sleeveDanceElectronicOpen },
    sleeveLabel: "EDM",
    panelRarityRgb: "255 210 120",
    panelSheenRgb: "255 255 160",
  },
  "Game Soundtrack": {
    slug: "game-soundtrack",
    bgClass: "play-bg-game-soundtrack",
    art: { closed: sleeveGameSoundtrack, open: sleeveGameSoundtrackOpen },
    sleeveLabel: "Game",
    panelRarityRgb: "160 125 255",
    panelSheenRgb: "186 160 255",
  },
  Indie: {
    slug: "indie",
    bgClass: "play-bg-indie",
    art: { closed: sleeveIndie, open: sleeveIndieOpen },
    sleeveLabel: "Indie",
    panelRarityRgb: "240 240 240",
    panelSheenRgb: "255 255 255",
  },
};

// Must match CSS reel animation duration.
const REEL_DURATION_MS = 5600;
const DROP_DURATION_MS = 650;
const BURST_DURATION_MS = 320;
const SONG_ACQUIRED_HOLD_MS = 1400;
const CARD_INTRO_STAGGER_MS = 88;
const CARD_INTRO_BASE_MS = 340;
const CARD_INTRO_START_DELAY_MS = 220;
const CARD_INTRO_WAVE_COLUMNS = 4;
const RARITY_WEIGHT: Record<OwnedSong["rarity"], number> = {
  Common: 35,
  Uncommon: 25,
  Rare: 20,
  Epic: 15,
  Legendary: 5,
};

function buildReel(items: OwnedSong[], result: OwnedSong) {
  const pool = items.length ? items : [result];
  const total = 29;
  const finalIndex = 19;

  const tiles: OwnedSong[] = [];
  for (let index = 0; index < total; index++) {
    if (index === finalIndex) {
      tiles.push(result);
      continue;
    }

    const pick = pool[Math.floor(Math.random() * pool.length)];
    tiles.push(pick);
  }

  return { tiles, finalIndex };
}

export function PlayPage() {
  const { refreshUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [sleeves, setSleeves] = useState<Sleeve[]>([]);

  const [genreIndex, setGenreIndex] = useState(0);
  const genre = PLAY_GENRES[genreIndex];

  const [switchTick, setSwitchTick] = useState(0);
  const [peekOpen, setPeekOpen] = useState(false);
  const timersRef = useRef<number[]>([]);
  const reelTrackRef = useRef<HTMLDivElement | null>(null);
  const reelSyncRafRef = useRef<number | null>(null);

  const [overlayOpen, setOverlayOpen] = useState(false);
  const [openState, setOpenState] = useState<OpenState>("idle");
  const [rolled, setRolled] = useState<OwnedSong | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);

  const [reelTiles, setReelTiles] = useState<OwnedSong[]>([]);
  const [finalIndex, setFinalIndex] = useState(0);
  const [reelTick, setReelTick] = useState(0);
  const [reelFocusIndex, setReelFocusIndex] = useState(0);
  const [hasActivatedBackground, setHasActivatedBackground] = useState(false);
  const [panelIntroStage, setPanelIntroStage] = useState<"idle" | "left" | "right" | "sheen">("idle");
  const panelIntroTimersRef = useRef<number[]>([]);
  const [cardIntroActive, setCardIntroActive] = useState(false);
  const hasPlayedCardIntroRef = useRef(false);
  const [leftPanelSheenTick, setLeftPanelSheenTick] = useState(0);
  const hasInitializedGenreRef = useRef(false);
  const [artistTickerIndex, setArtistTickerIndex] = useState(0);
  const [showSongAcquiredText, setShowSongAcquiredText] = useState(false);

  const stopReelSyncLoop = useCallback(() => {
    if (reelSyncRafRef.current !== null) {
      window.cancelAnimationFrame(reelSyncRafRef.current);
      reelSyncRafRef.current = null;
    }
  }, []);

  const startReelSyncLoop = useCallback(() => {
    stopReelSyncLoop();

    const syncFrame = () => {
      const trackEl = reelTrackRef.current;
      if (!trackEl) {
        reelSyncRafRef.current = window.requestAnimationFrame(syncFrame);
        return;
      }

      const reelWindow = trackEl.closest(".muscino-reel-window");
      if (!reelWindow) {
        reelSyncRafRef.current = window.requestAnimationFrame(syncFrame);
        return;
      }

      const reelWindowRect = reelWindow.getBoundingClientRect();
      const markerX = reelWindowRect.left + reelWindowRect.width / 2;
      const tileNodes = Array.from(trackEl.querySelectorAll<HTMLElement>("[data-reel-index]"));
      let closestIndex = 0;
      let smallestDistance = Number.POSITIVE_INFINITY;

      tileNodes.forEach((tileNode) => {
        const tileRect = tileNode.getBoundingClientRect();
        const tileCenter = tileRect.left + tileRect.width / 2;
        const distance = Math.abs(markerX - tileCenter);

        if (distance < smallestDistance) {
          smallestDistance = distance;
          closestIndex = Number(tileNode.dataset.reelIndex ?? 0);
        }
      });

      setReelFocusIndex((prev) => (prev === closestIndex ? prev : closestIndex));
      reelSyncRafRef.current = window.requestAnimationFrame(syncFrame);
    };

    reelSyncRafRef.current = window.requestAnimationFrame(syncFrame);
  }, [stopReelSyncLoop]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        const data = await api.getSleeves();
        if (!cancelled) setSleeves(data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      timersRef.current.forEach((timerId) => window.clearTimeout(timerId));
      timersRef.current = [];
      stopReelSyncLoop();
      stopSongPreview();
    };
  }, [stopReelSyncLoop]);

  useEffect(() => {
    if (openState !== "rolling") {
      stopReelSyncLoop();
      return;
    }

    startReelSyncLoop();
    return () => {
      stopReelSyncLoop();
    };
  }, [openState, reelTick, startReelSyncLoop, stopReelSyncLoop]);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      setHasActivatedBackground(true);
    }, 60);

    return () => {
      window.clearTimeout(timerId);
    };
  }, []);

  useEffect(() => {
    panelIntroTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
    panelIntroTimersRef.current = [];

    if (loading) {
      setPanelIntroStage("idle");
      return;
    }

    setPanelIntroStage("left");

    panelIntroTimersRef.current.push(window.setTimeout(() => setPanelIntroStage("right"), 220));
    panelIntroTimersRef.current.push(window.setTimeout(() => setPanelIntroStage("sheen"), 480));

    return () => {
      panelIntroTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
      panelIntroTimersRef.current = [];
    };
  }, [loading]);

  const sleevesForGenre = useMemo(
    () => sleeves.filter((sleeve) => sleeve.genre === genre),
    [sleeves, genre],
  );

  const current = sleevesForGenre[0] ?? null;
  const artistTicker = useMemo(() => {
    const uniqueArtists = Array.from(
      new Set(
        (current?.contents ?? [])
          .map((song) => song.artist?.trim())
          .filter((artist): artist is string => Boolean(artist)),
      ),
    );

    return uniqueArtists.length ? uniqueArtists : ["No artists yet"];
  }, [current]);

  const canPrev = PLAY_GENRES.length > 1;
  const canNext = PLAY_GENRES.length > 1;
  const activeSong = (reelTiles[reelFocusIndex] ?? rolled) ?? null;
  const dropChanceBySongId = useMemo(() => {
    const songs = current?.contents ?? [];
    if (!songs.length) return new Map<string, number>();

    const weighted = songs.map((song) => ({
      id: song.id,
      weight: Math.max(0, song.weight ?? RARITY_WEIGHT[song.rarity]),
    }));

    const totalWeight = weighted.reduce((sum, entry) => sum + entry.weight, 0);
    if (totalWeight <= 0) return new Map<string, number>();

    const chances = weighted.map((entry) => ({
      id: entry.id,
      chance: Math.round((entry.weight / totalWeight) * 100),
    }));

    const currentTotal = chances.reduce((sum, entry) => sum + entry.chance, 0);
    if (chances.length > 0 && currentTotal !== 100) {
      chances[chances.length - 1].chance += 100 - currentTotal;
    }

    return new Map(chances.map((entry) => [entry.id, entry.chance]));
  }, [current]);

  useEffect(() => {
    setArtistTickerIndex(0);

    if (artistTicker.length <= 1) {
      return;
    }

    const timerId = window.setInterval(() => {
      setArtistTickerIndex((index) => (index + 1) % artistTicker.length);
    }, 2400);

    return () => {
      window.clearInterval(timerId);
    };
  }, [artistTicker]);

  useEffect(() => {
    if (loading || hasPlayedCardIntroRef.current) return;

    const songCount = current?.contents?.length ?? 0;
    if (!songCount) return;

    const startTimerId = window.setTimeout(() => {
      setCardIntroActive(true);
      hasPlayedCardIntroRef.current = true;
    }, CARD_INTRO_START_DELAY_MS);

    const waveSteps = Math.max(0, Math.min(songCount, CARD_INTRO_WAVE_COLUMNS) - 1);
    const duration = Math.max(460, waveSteps * CARD_INTRO_STAGGER_MS + CARD_INTRO_BASE_MS);
    const stopTimerId = window.setTimeout(() => {
      setCardIntroActive(false);
    }, CARD_INTRO_START_DELAY_MS + duration);

    return () => {
      window.clearTimeout(startTimerId);
      window.clearTimeout(stopTimerId);
    };
  }, [loading, current]);

  function runSwitchAnimation() {
    setSwitchTick((tick) => tick + 1);
    setPeekOpen(false);

    timersRef.current.forEach((timerId) => window.clearTimeout(timerId));
    timersRef.current = [];

    timersRef.current.push(window.setTimeout(() => setPeekOpen(true), 180));
  }

  function goPrev() {
    if (!canPrev) return;
    setGenreIndex((index) => (index - 1 + PLAY_GENRES.length) % PLAY_GENRES.length);
  }

  function goNext() {
    if (!canNext) return;
    setGenreIndex((index) => (index + 1) % PLAY_GENRES.length);
  }

  useEffect(() => {
    runSwitchAnimation();

    if (!hasInitializedGenreRef.current) {
      hasInitializedGenreRef.current = true;
      return;
    }

    setLeftPanelSheenTick((tick) => tick + 1);
  }, [genreIndex]);

  function closeOverlay() {
    timersRef.current.forEach((timerId) => window.clearTimeout(timerId));
    timersRef.current = [];
    stopReelSyncLoop();
    stopSongPreview();

    setOverlayOpen(false);
    setOpenState("idle");
    setRolled(null);
    setOpenError(null);
    setShowSongAcquiredText(false);

    setReelTiles([]);
    setFinalIndex(0);
    setReelTick((tick) => tick + 1);
    setReelFocusIndex(0);
  }

  
  useEffect(() => {
    if (openState !== "revealed" || !activeSong) {
      stopSongPreview();
      return;
    }

    void playSongPreview(activeSong);
  }, [activeSong, openState]);

  async function handleOpen() {
    if (!current) return;

    timersRef.current.forEach((timerId) => window.clearTimeout(timerId));
    timersRef.current = [];
    stopReelSyncLoop();

    setOverlayOpen(true);
    setOpenState("dropping");
    setRolled(null);
    setOpenError(null);
    setShowSongAcquiredText(false);
    setReelFocusIndex(0);
    setReelTiles([]);
    setFinalIndex(0);
    setReelTick((tick) => tick + 1);

    const burstTimerId = window.setTimeout(() => setOpenState("burst"), DROP_DURATION_MS);
    timersRef.current.push(burstTimerId);

    let owned: OwnedSong;
    try {
      [owned] = await Promise.all([
        api.openSleeve(current.id),
        new Promise<void>((resolve) => {
          const minIntroTimerId = window.setTimeout(resolve, DROP_DURATION_MS + BURST_DURATION_MS);
          timersRef.current.push(minIntroTimerId);
        }),
      ]);
      void refreshUser();
    } catch (error) {
      setOpenState("idle");
      setOpenError(error instanceof Error ? error.message : "Failed to open sleeve");
      return;
    }

    const pool = (current.contents ?? []) as OwnedSong[];
    const built = buildReel(pool, owned);

    setReelTiles(built.tiles);
    setFinalIndex(built.finalIndex);
    setReelTick((tick) => tick + 1);

    setOpenState("rolling");
    setReelFocusIndex(0);

    timersRef.current.push(
      window.setTimeout(() => {
        setReelFocusIndex(built.finalIndex);
        setRolled(owned);
        setShowSongAcquiredText(true);
        setOpenState("revealed");

        const acquiredTimerId = window.setTimeout(() => {
          setShowSongAcquiredText(false);
        }, SONG_ACQUIRED_HOLD_MS);
        timersRef.current.push(acquiredTimerId);
      }, REEL_DURATION_MS),
    );
  }

  const theme = GENRE_THEME[genre];
  const art = theme.art;
  const previewA = current?.contents?.[0] ?? null;
  const previewB = current?.contents?.[1] ?? null;

  return (
    <div className={["play-page h-full text-white", `is-${theme.slug}`].join(" ")}>
      <div className="play-bg" aria-hidden="true">
        {PLAY_GENRES.map((playGenre) => (
          <div
            key={playGenre}
            className={["play-bg-layer", GENRE_THEME[playGenre].bgClass, genre === playGenre ? "is-active" : ""].join(" ")}
          />
        ))}
        <div className={["play-bg-intro", hasActivatedBackground ? "is-faded" : ""].join(" ")} />
      </div>

      {overlayOpen && (
        <div className="muscino-opening-overlay" role="dialog" aria-modal="true">
          <div className="muscino-opening-backdrop" onClick={closeOverlay} />

          <div className="muscino-opening-center">
            <GlassPanel className="muscino-opening-panel">
              {openError ? (
                <div className="flex flex-col items-center gap-4 py-6">
                  <div className="text-3xl font-medium text-white/90">Couldn’t open</div>
                  <div className="text-white/60 text-sm text-center">{openError}</div>
                  <button
                    onClick={closeOverlay}
                    className="px-4 py-2 rounded-xl bg-white/10 border border-white/10 hover:border-white/20 transition"
                  >
                    Close
                  </button>
                </div>
              ) : (
                <div className={["muscino-opening-sequence", `is-${openState}`].join(" ")}>
                  <img
                    src={art.closed}
                    alt=""
                    className="muscino-opening-drop-sleeve"
                    draggable={false}
                  />

                  <div className="muscino-opening-main">
                    {(openState === "rolling" || openState === "revealed") && (
                      <>
                        {openState !== "revealed" && (
                          <div className="text-3xl md:text-4xl font-medium text-white/90">{genre} Sleeve Opened!</div>
                        )}

                        <div className={["muscino-opening-reveal-stage", openState === "revealed" ? "is-revealed" : ""].join(" ")}>
                          <div className="muscino-reel" aria-hidden="true">
                            <div className="muscino-reel-window">
                              <div className="muscino-reel-marker" />
                              <div
                                key={`reel-${reelTick}`}
                                className="muscino-reel-track"
                                ref={reelTrackRef}
                                style={{ ["--final-i" as const]: finalIndex } as CSSProperties}
                              >
                                {reelTiles.map((song, index) => {
                                  const delta = Math.abs(index - finalIndex);
                                  const clampedDelta = delta >= 3 ? 3 : delta;

                                  return (
                                    <div
                                      key={`${song.id}-${index}`}
                                      className={[
                                        "muscino-reel-tile",
                                        rarityBorderClass(song.rarity, "strong"),
                                        rarityGlowClass(song.rarity),
                                      ].join(" ")}
                                      data-delta={clampedDelta}
                                      data-reel-index={index}
                                      style={{ ["--rarity-rgb" as const]: rarityRgb(song.rarity) } as CSSProperties}
                                    >
                                      {song.coverUrl ? <img src={song.coverUrl} alt="" draggable={false} /> : null}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>

                          {openState === "revealed" && (
                            <div
                              className="muscino-opening-featured"
                              style={{ ["--rarity-rgb" as const]: rarityRgb(activeSong?.rarity ?? "Common") } as CSSProperties}
                            >
                              <div className="muscino-opening-soundbar" aria-hidden="true">
                                {Array.from({ length: 34 }).map((_, idx) => (
                                  <span key={idx} className="muscino-opening-soundbar-bar" />
                                ))}
                              </div>

                              <div className="muscino-opening-featured-card">
                                {activeSong?.coverUrl ? <img src={activeSong.coverUrl} alt="" draggable={false} /> : null}
                              </div>
                            </div>
                          )}
                        </div>

                        <div
                          className={["muscino-opening-current", openState === "revealed" ? "is-revealed" : ""].join(" ")}
                          style={{ ["--rarity-rgb" as const]: rarityRgb(activeSong?.rarity ?? "Common") } as CSSProperties}
                        >
                          {openState === "revealed" && showSongAcquiredText
                            ? "Song Acquired!"
                            : `${activeSong?.title ?? "Rolling..."}${activeSong?.artist ? ` – ${activeSong.artist}` : ""}`}
                        </div>
                      </>
                    )}

                    {openState === "revealed" && (
                      <div className="flex gap-3 pt-4">
                        <button
                          onClick={closeOverlay}
                          className="px-4 py-1.5 rounded-xl bg-blue-500/75 border border-blue-300/20 hover:bg-blue-500/90 transition"
                        >
                          Confirm
                        </button>
                      </div>
                    )}

                    {openState === "rolling" && (
                      <div className="flex gap-3 pt-1">
                        <button
                          onClick={closeOverlay}
                          className="px-4 py-2 rounded-xl bg-white/10 border border-white/10 hover:border-white/20 transition"
                        >
                          Skip
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </GlassPanel>
          </div>
        </div>
      )}

      <div
        className={[
          "relative max-w-6xl mx-auto px-6 pt-6 pb-6 h-full flex flex-col min-h-0 play-content",
          overlayOpen ? "is-opening" : "",
        ].join(" ")}
      >
        <div className="play-side-label">Play / / /</div>

        {loading ? (
          <div className="flex-1 grid place-items-center min-h-0">
            <LoadingSpinner />
          </div>
        ) : (
          <div className="grid grid-cols-12 gap-4 flex-1 min-h-0">
            <GlassPanel
              key={`play-left-${genre}-${switchTick}-${leftPanelSheenTick}`}
              className={[
                "col-span-12 md:col-span-4 p-4 h-full min-h-0 overflow-hidden flex flex-col",
                "rarity-rotating-border rarity-rim-sweep rarity-bg-wash",
                "play-panel-pop",
                panelIntroStage !== "idle" ? "is-visible" : "",
                leftPanelSheenTick > 0 ? "has-sheen" : "",
              ].join(" ")}
              style={
                {
                  ["--rarity-rgb" as const]: theme.panelRarityRgb,
                  ["--sheen-rgb" as const]: theme.panelSheenRgb,
                } as CSSProperties
              }
            >
              <div className="play-panel-content">
                <div className="play-left-header">
                  <div className="play-left-title">Sleeve Collections</div>
                  <div className="play-left-weekly">Refreshed Weekly!</div>
                </div>

                <div className="mt-4 flex-1 min-h-0 flex flex-col items-center justify-center play-left-stage">
                  <div key={`${genre}-${switchTick}`} className="play-sleeve-stage">
                    <div className={["play-peek", peekOpen ? "is-open" : ""].join(" ")}>
                      {previewA?.coverUrl ? (
                        <img className="play-peek-card play-peek-a" src={previewA.coverUrl} alt="" draggable={false} />
                      ) : null}
                      {previewB?.coverUrl ? (
                        <img className="play-peek-card play-peek-b" src={previewB.coverUrl} alt="" draggable={false} />
                      ) : null}
                    </div>

                    <img
                      src={art.closed}
                      alt=""
                      className={["play-sleeve-img play-sleeve-closed", peekOpen ? "is-hidden" : ""].join(" ")}
                      draggable={false}
                    />
                    <img
                      src={art.open}
                      alt=""
                      className={["play-sleeve-img play-sleeve-open", peekOpen ? "is-visible" : ""].join(" ")}
                      draggable={false}
                    />

                    <div className="play-sleeve-glow" />
                  </div>

                  <div className="play-sleeve-label text-5xl font-medium leading-none tracking-tight">
                    <span className="play-sleeve-genre">{theme.sleeveLabel}</span>{" "}
                    <span className="play-sleeve-word">Sleeve</span>
                  </div>

                  <div className="play-artist-rotator" aria-live="polite">
                    <div className="play-artist-rotator-label">Featuring</div>
                    <div key={`${genre}-${artistTickerIndex}`} className="play-artist-rotator-name">
                      {artistTicker[artistTickerIndex]}
                    </div>
                  </div>
                </div>

                <div className="play-left-controls">
                  <button
                    onClick={goPrev}
                    disabled={!canPrev}
                    className={["play-left-navbtn", !canPrev ? "is-disabled" : ""].join(" ")}
                    aria-label="Previous sleeve"
                  >
                    ◀
                  </button>

                  <button
                    onClick={goNext}
                    disabled={!canNext}
                    className={["play-left-navbtn", "is-primary", !canNext ? "is-disabled" : ""].join(" ")}
                    aria-label="Next sleeve"
                  >
                    ▶
                  </button>
                </div>
              </div>
            </GlassPanel>

            <GlassPanel
              className={[
                "col-span-12 md:col-span-8 p-4 h-full min-h-0 overflow-hidden flex flex-col",
                "play-panel-pop play-panel-pop-right",
                panelIntroStage === "right" || panelIntroStage === "sheen" ? "is-visible" : "",
              ].join(" ")}
            >
              <div className="play-panel-content">
                <div className="flex-1 min-h-0 overflow-y-auto pr-2 pb-6 muscino-scroll">
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 items-start">
                    {(current?.contents ?? []).map((song, index) => (
                      <SongCard
                        key={song.id}
                        song={song}
                        selected={false}
                        onSelect={() => {}}
                        className={cardIntroActive ? "play-song-card-intro" : ""}
                        hoverChancePercent={dropChanceBySongId.get(song.id)}
                        style={
                          {
                            ["--intro-delay" as const]: `${(index % CARD_INTRO_WAVE_COLUMNS) * CARD_INTRO_STAGGER_MS}ms`,
                            ["--intro-duration" as const]: "340ms",
                            ["--rarity-rgb" as const]: rarityRgb(song.rarity),
                          } as CSSProperties
                        }
                      />
                    ))}
                  </div>
                </div>

                <div className="pt-3 flex items-center justify-end gap-3">
                  <button
                    className="play-open-btn px-4 py-1 rounded-xl text-xl disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={!current}
                    onClick={handleOpen}
                  >
                    Open
                  </button>

                  <div className="text-lg text-white/60">
                    {current ? `${current.cost}` : ""}
                    <span className="ml-2 text-blue-400">⛃</span>
                  </div>
                </div>
              </div>
            </GlassPanel>
          </div>
        )}
      </div>
    </div>
  );
}