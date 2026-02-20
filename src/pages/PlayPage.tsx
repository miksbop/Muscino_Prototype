import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import GlassPanel from "../components/GlassPanel";
import { SongCard } from "../components/SongCard";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { api } from "../services/api";
import type { OwnedSong } from "../types/song";
import type { Sleeve } from "../types/sleeve";

import sleevePop from "../pictures/Pictures/sleeve_pop.png";
import sleevePopOpen from "../pictures/Pictures/sleeve_pop_open.png";
import sleeveRock from "../pictures/Pictures/sleeve_rock.png";
import sleeveRockOpen from "../pictures/Pictures/sleeve_rock_open.png";

type OpenState = "idle" | "rolling" | "revealed";
type PlayGenre = "Pop" | "Rock" | "Rap";

const PLAY_GENRES: PlayGenre[] = ["Pop", "Rock", "Rap"];

const SLEEVE_ART: Record<PlayGenre, { closed: string; open: string }> = {
  Pop: { closed: sleevePop, open: sleevePopOpen },
  Rock: { closed: sleeveRock, open: sleeveRockOpen },
  // TODO: add dedicated Rap sleeve art asset.
  Rap: { closed: sleeveRock, open: sleeveRockOpen },
};

// Must match CSS reel animation duration.
const REEL_DURATION_MS = 4200;

function buildReel(items: OwnedSong[], result: OwnedSong) {
  const pool = items.length ? items : [result];
  const total = 23;
  const finalIndex = 15;

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
  const [loading, setLoading] = useState(true);
  const [sleeves, setSleeves] = useState<Sleeve[]>([]);

  const [genreIndex, setGenreIndex] = useState(0);
  const genre = PLAY_GENRES[genreIndex];

  const [switchTick, setSwitchTick] = useState(0);
  const [peekOpen, setPeekOpen] = useState(false);
  const timersRef = useRef<number[]>([]);

  const [overlayOpen, setOverlayOpen] = useState(false);
  const [openState, setOpenState] = useState<OpenState>("idle");
  const [rolled, setRolled] = useState<OwnedSong | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);

  const [reelTiles, setReelTiles] = useState<OwnedSong[]>([]);
  const [finalIndex, setFinalIndex] = useState(0);
  const [reelTick, setReelTick] = useState(0);

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
    };
  }, []);

  const sleevesForGenre = useMemo(
    () => sleeves.filter((sleeve) => sleeve.genre === genre),
    [sleeves, genre],
  );

  const current = sleevesForGenre[0] ?? null;
  const canPrev = genreIndex > 0;
  const canNext = genreIndex < PLAY_GENRES.length - 1;

  function runSwitchAnimation() {
    setSwitchTick((tick) => tick + 1);
    setPeekOpen(false);

    timersRef.current.forEach((timerId) => window.clearTimeout(timerId));
    timersRef.current = [];

    timersRef.current.push(window.setTimeout(() => setPeekOpen(true), 180));
  }

  function goPrev() {
    if (!canPrev) return;
    setGenreIndex((index) => index - 1);
  }

  function goNext() {
    if (!canNext) return;
    setGenreIndex((index) => index + 1);
  }

  useEffect(() => {
    runSwitchAnimation();
  }, [genreIndex]);

  function closeOverlay() {
    setOverlayOpen(false);
    setOpenState("idle");
    setRolled(null);
    setOpenError(null);

    setReelTiles([]);
    setFinalIndex(0);
    setReelTick((tick) => tick + 1);
  }

  async function handleOpen() {
    if (!current) return;

    setOverlayOpen(true);
    setOpenState("rolling");
    setRolled(null);
    setOpenError(null);

    timersRef.current.forEach((timerId) => window.clearTimeout(timerId));
    timersRef.current = [];

    try {
      const owned = await api.openSleeve(current.id);
      const pool = (current.contents ?? []) as OwnedSong[];
      const built = buildReel(pool, owned);

      setReelTiles(built.tiles);
      setFinalIndex(built.finalIndex);
      setReelTick((tick) => tick + 1);

      timersRef.current.push(
        window.setTimeout(() => {
          setRolled(owned);
          setOpenState("revealed");
        }, REEL_DURATION_MS),
      );
    } catch (error) {
      setOpenState("idle");
      setOpenError(error instanceof Error ? error.message : "Failed to open sleeve");
    }
  }

  const art = SLEEVE_ART[genre];
  const previewA = current?.contents?.[0] ?? null;
  const previewB = current?.contents?.[1] ?? null;

  return (
    <div className={["play-page h-full text-white", genre === "Pop" ? "is-pop" : "is-rock"].join(" ")}>
      <div className="play-bg" aria-hidden="true">
        <div className={["play-bg-layer play-bg-pop", genre === "Pop" ? "is-active" : ""].join(" ")} />
        <div className={["play-bg-layer play-bg-rock", genre !== "Pop" ? "is-active" : ""].join(" ")} />
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
              ) : openState === "rolling" ? (
                <div className="flex flex-col items-center gap-5 py-6">
                  <div className="text-3xl md:text-4xl font-medium text-white/90">Opening…</div>

                  <div className="muscino-reel" aria-hidden="true">
                    <div className="muscino-reel-window">
                      <div className="muscino-reel-marker" />
                      <div
                        key={`reel-${reelTick}`}
                        className="muscino-reel-track"
                        style={{ ["--final-i" as const]: finalIndex } as CSSProperties}
                      >
                        {reelTiles.map((song, index) => {
                          const delta = Math.abs(index - finalIndex);
                          const clampedDelta = delta >= 3 ? 3 : delta;

                          return (
                            <div key={`${song.id}-${index}`} className="muscino-reel-tile" data-delta={clampedDelta}>
                              {song.coverUrl ? <img src={song.coverUrl} alt="" draggable={false} /> : null}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="text-white/60 text-sm">Rolling a song from this sleeve</div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-4 py-4">
                  <div className="text-3xl md:text-4xl font-medium text-white/90">{genre} Sleeve Opened!</div>

                  <div className="w-[min(520px,90vw)] aspect-square rounded-2xl overflow-hidden border border-white/10 bg-white/5">
                    {rolled?.coverUrl ? (
                      <img src={rolled.coverUrl} alt="" className="w-full h-full object-cover" draggable={false} />
                    ) : null}
                  </div>

                  <div className="text-center">
                    <div className="text-2xl md:text-3xl text-blue-300 font-medium">{rolled?.title ?? "Unknown"}</div>
                    <div className="text-white/70 text-lg">{rolled?.artist ?? ""}</div>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={closeOverlay}
                      className="px-4 py-2 rounded-xl bg-white/10 border border-white/10 hover:border-white/20 transition"
                    >
                      Close
                    </button>
                    <button
                      onClick={closeOverlay}
                      className="px-4 py-2 rounded-xl bg-blue-500/70 border border-blue-300/20 hover:bg-blue-500/80 transition"
                    >
                      Save to Collection
                    </button>
                  </div>

                  <div className="text-xs text-white/45 pt-1">(Injected into inventory via mock API)</div>
                </div>
              )}
            </GlassPanel>
          </div>
        </div>
      )}

      <div className="relative max-w-6xl mx-auto px-6 pt-6 pb-6 h-full flex flex-col min-h-0">
        <div className="play-side-label">Play / / /</div>

        {loading ? (
          <div className="flex-1 grid place-items-center min-h-0">
            <LoadingSpinner />
          </div>
        ) : (
          <div className="grid grid-cols-12 gap-4 flex-1 min-h-0">
            <GlassPanel
              key={`play-left-${genre}-${switchTick}`}
              className={[
                "col-span-12 md:col-span-4 p-4 h-full min-h-0 overflow-hidden flex flex-col",
                "rarity-rotating-border rarity-rim-sweep rarity-bg-wash",
              ].join(" ")}
              style={{ ["--rarity-rgb" as const]: genre === "Pop" ? "96 165 250" : genre === "Rap" ? "255 215 64" : "255 110 160" } as CSSProperties}
            >
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

                <div className="play-sleeve-label mt-6 text-5xl font-medium leading-none tracking-tight">
                  <span className="play-sleeve-genre">{genre}</span>{" "}
                  <span className="play-sleeve-word">Sleeve</span>
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
            </GlassPanel>

            <GlassPanel className="col-span-12 md:col-span-8 p-4 h-full min-h-0 overflow-hidden flex flex-col">
              <div className="text-white/60 mb-1 text-small">Contents:</div>

              <div className="flex-1 min-h-0 overflow-y-auto pr-2 pb-6 muscino-scroll">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 items-start">
                  {(current?.contents ?? []).map((song) => (
                    <SongCard key={song.id} song={song} selected={false} onSelect={() => {}} />
                  ))}
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-3">
                <button
                  className="px-4 py-1 rounded-xl bg-blue-500/70 border border-blue-300/20 hover:bg-blue-500/80 transition text-xl disabled:opacity-50 disabled:cursor-not-allowed"
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
            </GlassPanel>
          </div>
        )}
      </div>
    </div>
  );
}
