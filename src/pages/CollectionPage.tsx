import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { OwnedSong } from "../types/song";
import { api } from "../services/api";
import type { SpotifyArtistSearchResult } from "../services/api";
import GlassPanel from "../components/GlassPanel";
import { SongCard } from "../components/SongCard";
import { MarqueeText } from "../components/MarqueeText";
import { rarityTextClass, rarityRgb } from "../types/rarity";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { useAuth } from "../context/useAuth";
import { playSongPreview, stopSongPreview, subscribeSongPreviewLevel } from "../services/songPreview";

type RerollFxState = "idle" | "dropping" | "merging" | "exploding" | "revealed";

const RARITY_ORDER: Record<OwnedSong["rarity"], number> = {
  Legendary: 5,
  Epic: 4,
  Rare: 3,
  Uncommon: 2,
  Common: 1,
};

const COLS_DESKTOP = 4;
const REROLL_DROP_MS = 480;
const REROLL_MERGE_MS = 260;
const REROLL_EXPLOSION_MS = 420;

export function CollectionPage() {
  const { refreshUser } = useAuth();
  const [songs, setSongs] = useState<OwnedSong[]>([]);
  const [selected, setSelected] = useState<OwnedSong | null>(null);
  const [loading, setLoading] = useState(true);
  const [listing, setListing] = useState(false);
  const [rerollOpen, setRerollOpen] = useState(false);
  const [rerollSelection, setRerollSelection] = useState<string[]>([]);
  const [artistQuery, setArtistQuery] = useState("");
  const [artistOptions, setArtistOptions] = useState<SpotifyArtistSearchResult[]>([]);
  const [artistSearchLoading, setArtistSearchLoading] = useState(false);
  const [selectedArtist, setSelectedArtist] = useState<SpotifyArtistSearchResult | null>(null);
  const [rerolling, setRerolling] = useState(false);
  const [rerollFxOpen, setRerollFxOpen] = useState(false);
  const [rerollFxState, setRerollFxState] = useState<RerollFxState>("idle");
  const [rerollFxInputs, setRerollFxInputs] = useState<OwnedSong[]>([]);
  const [rerollResultSong, setRerollResultSong] = useState<OwnedSong | null>(null);
  const [previewReactiveLevel, setPreviewReactiveLevel] = useState(0);
  const [hasPreviewReactiveSignal, setHasPreviewReactiveSignal] = useState(false);
  const rerollFxTimersRef = useRef<number[]>([]);
  const artistSearchRequestIdRef = useRef(0);
  const [artistHintPulse, setArtistHintPulse] = useState(false);
  const [songHintPulse, setSongHintPulse] = useState(false);
  const [hoveredRerollSongId, setHoveredRerollSongId] = useState<string | null>(null);

  const clearRerollFxTimers = () => {
    rerollFxTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
    rerollFxTimersRef.current = [];
  };

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        const data = await api.getInventory();
        if (!cancelled) {
          setSongs(data);
          setSelected(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      clearRerollFxTimers();
      stopSongPreview();
    };
  }, []);

    useEffect(() => {
    const unsubscribe = subscribeSongPreviewLevel((level, hasSignal) => {
      setPreviewReactiveLevel(level);
      setHasPreviewReactiveSignal(hasSignal);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const sortedSongs = useMemo(
    () => [...songs].sort((a, b) => RARITY_ORDER[b.rarity] - RARITY_ORDER[a.rarity]),
    [songs],
  );

  const remainder = songs.length % COLS_DESKTOP;
  const emptySlots = remainder === 0 ? 0 : COLS_DESKTOP - remainder;

  const listSelectedOnMarket = async () => {
    if (!selected || listing) return;

    const rawPrice = window.prompt("Set your sale price (whole number):", "50");
    if (rawPrice === null) return;

    const parsed = Number.parseInt(rawPrice.trim(), 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      window.alert("Please enter a valid positive whole number.");
      return;
    }

    try {
      setListing(true);
      await api.createMarketListing({ ownedSongId: Number(selected.id), price: parsed });
      window.alert(`Listed ${selected.title} for ${parsed}.`);
      await refreshUser();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to create listing.";
      window.alert(message);
    } finally {
      setListing(false);
    }
  };

  const closeRerollFx = () => {
    clearRerollFxTimers();
    setRerollFxOpen(false);
    setRerollFxState("idle");
    setRerollFxInputs([]);
    setRerollResultSong(null);
  };

  const playRerollFx = (inputs: OwnedSong[], resultSong: OwnedSong) => {
    clearRerollFxTimers();
    setRerollFxInputs(inputs.slice(0, 3));
    setRerollResultSong(resultSong);
    setRerollFxState("dropping");
    setRerollFxOpen(true);

    rerollFxTimersRef.current.push(
      window.setTimeout(() => setRerollFxState("merging"), REROLL_DROP_MS),
    );
    rerollFxTimersRef.current.push(
      window.setTimeout(() => setRerollFxState("exploding"), REROLL_DROP_MS + REROLL_MERGE_MS),
    );
    rerollFxTimersRef.current.push(
      window.setTimeout(
        () => setRerollFxState("revealed"),
        REROLL_DROP_MS + REROLL_MERGE_MS + REROLL_EXPLOSION_MS,
      ),
    );
  };

  const toggleRerollSong = (ownedSongId: string) => {
    setRerollSelection((current) => {
      let nextSelection: string[];
      if (current.includes(ownedSongId)) {
        nextSelection = current.filter((id) => id !== ownedSongId);
      } else if (current.length >= 3) {
        nextSelection = current;
      } else {
        nextSelection = [...current, ownedSongId];
      }

      if (nextSelection.length === 3 && !selectedArtist) {
        setArtistHintPulse(true);
        window.setTimeout(() => setArtistHintPulse(false), 820);
      }
      return nextSelection;
    });
  };

  const submitReroll = async () => {
    if (rerollSelection.length !== 3) {
      window.alert("Select exactly 3 songs to reroll.");
      return;
    }

    if (!selectedArtist) {
      window.alert("Select an artist from the Spotify dropdown before rerolling.");
      return;
    }

    try {
      setRerolling(true);
      const parsedOwnedSongIds = rerollSelection.map((id) => Number(id));
      if (parsedOwnedSongIds.some((id) => !Number.isFinite(id))) {
        window.alert("Reroll is unavailable while running in local mock mode.");
        return;
      }

      const selectedInputs = songs.filter((song) => parsedOwnedSongIds.includes(Number(song.id))).slice(0, 3);
      const result = await api.rerollInventorySongs({
        ownedSongIds: parsedOwnedSongIds,
        artistKeyword: selectedArtist.name.trim(),
        artistId: selectedArtist.id,
      });

      const refreshedSongs = await api.getInventory();
      setSongs(refreshedSongs);
      const newlyCreated = refreshedSongs.find((song) => song.id === result.newSong.id) ?? result.newSong;
      setSelected(newlyCreated);
      setRerollOpen(false);
      setRerollSelection([]);
      setArtistQuery("");
      setArtistOptions([]);
      setSelectedArtist(null);
      playRerollFx(selectedInputs, newlyCreated);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to reroll songs.";
      window.alert(message);
    } finally {
      setRerolling(false);
    }
  };

  useEffect(() => {
    const query = artistQuery.trim();
    if (query.length < 2) {
      artistSearchRequestIdRef.current += 1;
      setArtistOptions([]);
      setArtistSearchLoading(false);
      return;
    }

    const timerId = window.setTimeout(async () => {
      const requestId = ++artistSearchRequestIdRef.current;
      try {
        setArtistSearchLoading(true);
        const artists = await api.searchSpotifyArtists(query);
        if (requestId !== artistSearchRequestIdRef.current) return;
        setArtistOptions(artists);
      } catch {
        if (requestId !== artistSearchRequestIdRef.current) return;
        setArtistOptions([]);
      } finally {
        if (requestId !== artistSearchRequestIdRef.current) return;
        setArtistSearchLoading(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [artistQuery]);

    useEffect(() => {
    if (rerollFxState === "revealed" && rerollResultSong) {
      void playSongPreview(rerollResultSong);
    }
  }, [rerollFxState, rerollResultSong]);

  const rerollReady = Boolean(selectedArtist) && rerollSelection.length === 3;

  return (
    <div className="h-full bg-neutral-950 text-white">
      <div className="relative max-w-6xl mx-auto px-6 pt-6 pb-6 h-full flex flex-col min-h-0">
        <div className="collection-side-label tracking-wide">Collection</div>


        {loading ? (
          <div className="flex-1 grid place-items-center min-h-0">
            <LoadingSpinner />
          </div>
        ) : (
          <div className="grid grid-cols-12 gap-4 flex-1 min-h-0">
            <GlassPanel
              key={selected?.id ?? "none"}
              className="col-span-12 md:col-span-4 p-4 md:sticky md:top-0 h-full min-h-0 overflow-hidden flex flex-col rarity-rotating-border rarity-rim-sweep rarity-bg-wash"
              style={{ ["--rarity-rgb" as const]: rarityRgb(selected?.rarity) } as CSSProperties}
            >
              {selected ? (
                <>
                  <div className="relative w-full aspect-[1/1] rounded-xl overflow-hidden border border-white/10 bg-white/5 rarity-media-glow">
                    <img
                      src={selected.coverUrl}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover"
                      draggable={false}
                    />
                  </div>

                  <div className="pt-4 min-w-0">
                    <MarqueeText text={selected.title} className="text-xl font-semibold rarity-title-glow" />
                    <div className="text-neutral-300 truncate">{selected.artist}</div>
                    <div className="mt-2 text-neutral-400 whitespace-nowrap">
                      {selected.genre} • <span className={rarityTextClass(selected.rarity)}>{selected.rarity}</span>
                    </div>
                  </div>

                  <div className="mt-auto pt-4 flex gap-2">
                    <button
                      type="button"
                      className="flex-1 px-3 py-2 rounded-xl bg-white/10 border border-white/10 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                      onClick={() => setRerollOpen(true)}
                      disabled={songs.length < 3 || rerolling}
                      title={songs.length < 3 ? "You need at least 3 songs to reroll." : "Reroll 3 songs for a new pull"}
                    >
                      Reroll 3 Songs
                    </button>
                    <button
                      type="button"
                      className="flex-1 px-3 py-2 rounded-xl bg-white/10 border border-white/10 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                      onClick={() => {
                        void listSelectedOnMarket();
                      }}
                      disabled={listing}
                    >
                      {listing ? "Listing..." : "List on market"}
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex flex-col h-full min-h-0">
                  <div className="relative w-full aspect-[1/1] rounded-xl overflow-hidden border border-white/10 bg-white/5" />

                  <div className="pt-4 text-center text-neutral-400">
                    <div className="text-lg font-medium text-white/80">No song selected</div>
                    <div className="text-sm text-neutral-400 mt-1">
                      Select a song from your collection to view details
                    </div>
                  </div>

                  <div className="mt-auto pt-4 flex gap-2 opacity-60">
                    <button
                      type="button"
                      className="flex-1 px-3 py-2 rounded-xl bg-white/10 border border-white/10 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                      onClick={() => setRerollOpen(true)}
                      disabled={songs.length < 3 || rerolling}
                      title={songs.length < 3 ? "You need at least 3 songs to reroll." : "Reroll 3 songs for a new pull"}
                    >
                      Reroll 3 Songs
                    </button>
                    <button
                      className="flex-1 px-3 py-2 rounded-xl bg-white/10 border border-white/10 text-sm"
                      disabled
                    >
                      List on market
                    </button>
                  </div>
                </div>
              )}
            </GlassPanel>

            <GlassPanel className="col-span-12 md:col-span-8 p-4 overflow-y-auto pr-3 pb-10 muscino-scroll min-h-0">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 items-start">
                {sortedSongs.map((song) => (
                  <SongCard
                    key={song.id}
                    song={song}
                    selected={selected?.id === song.id}
                    className={selected?.id === song.id ? `collection-song-card-reactive ${hasPreviewReactiveSignal ? "is-audio-reactive" : ""}` : ""}
                    style={
                      selected?.id === song.id
                        ? ({
                            ["--rarity-rgb" as const]: rarityRgb(song.rarity),
                            ["--audio-reactive-level" as const]: previewReactiveLevel.toFixed(3),
                          } as CSSProperties)
                        : undefined
                    }
                    onSelect={() => {
                      setSelected(song);
                      void playSongPreview(song);
                    }}
                  />
                ))}

                {emptySlots > 0 &&
                  Array.from({ length: emptySlots }).map((_, index) => (
                    <div
                      key={`empty-slot-${index}`}
                      aria-hidden="true"
                      className={[
                        "hidden lg:block",
                        "rounded-2xl border border-white/10",
                        "bg-gradient-to-t from-black/35 via-black/15 to-transparent",
                        "min-h-[342px]",
                        "opacity-70",
                        "p-2",
                      ].join(" ")}
                    >
                      <div className="w-full aspect-square rounded-xl bg-white/5 border border-white/10" />
                      <div className="px-1 pb-3 text-neutral-500 text-sm">Empty slot</div>
                    </div>
                  ))}
              </div>
            </GlassPanel>
          </div>
        )}
      </div>

      {rerollOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm p-4 md:p-8">
          <div className="mx-auto max-w-3xl h-full">
            <GlassPanel className="collection-reroll-pop-in h-full p-5 flex flex-col gap-4 border border-white/20">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold">Song Reroll</h2>
                  <p className="text-sm text-neutral-300">
                    Exchange any 3 songs to recieve one from your desired artist!
                  </p>
                </div>
                <button
                  type="button"
                  className="px-3 py-2 rounded-lg bg-white/10 border border-white/15 text-sm"
                  onClick={() => {
                    if (!rerolling) setRerollOpen(false);
                  }}
                >
                  Close
                </button>
              </div>

              <div className="relative flex items-center gap-3">
                <div className={`relative flex-1 rounded-xl transition-all duration-300 ${artistHintPulse ? "ring-2 ring-indigo-300/90 shadow-[0_0_24px_rgba(129,140,248,0.55)]" : ""}`}>
                  <input
                    value={artistQuery}
                    onChange={(e) => {
                      stopSongPreview();
                      setArtistQuery(e.target.value);
                      setSelectedArtist(null);
                    }}
                    placeholder="Search artists (e.g. Drake, Paramore, Skrillex)"
                    className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/15 outline-none focus:border-white/40"
                    disabled={rerolling}
                  />
                  {(artistSearchLoading || artistQuery.trim().length >= 2) && !selectedArtist && (
                    <div className="absolute z-10 mt-2 w-full rounded-lg border border-white/20 bg-neutral-950/95 shadow-2xl overflow-hidden">
                      {artistSearchLoading ? (
                        <div className="px-3 py-2 text-sm text-neutral-300">Searching Spotify artists…</div>
                      ) : artistOptions.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-neutral-400">No artists found.</div>
                      ) : (
                        <div className="max-h-56 overflow-y-auto muscino-scroll">
                          {artistOptions.map((artist) => (
                            <button
                              key={artist.id}
                              type="button"
                              className="w-full px-3 py-2 text-left text-sm hover:bg-white/10 flex items-center justify-between gap-3 border-b border-white/5 last:border-b-0"
                              onClick={() => {
                                stopSongPreview();
                                setSelectedArtist(artist);
                                setArtistQuery(artist.name);
                                setArtistOptions([]);
                                if (rerollSelection.length < 3) {
                                  setSongHintPulse(true);
                                  window.setTimeout(() => setSongHintPulse(false), 820);
                                }
                              }}
                            >
                              <span className="truncate">{artist.name}</span>
                              <span className="w-8 h-8 shrink-0 rounded-sm overflow-hidden border border-white/15 bg-white/5">
                                {artist.imageUrl ? (
                                  <img src={artist.imageUrl} alt="" className="w-full h-full object-cover" />
                                ) : null}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  className={[
                    "px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-300 disabled:opacity-60",
                    rerollReady
                      ? "collection-reroll-ready-btn"
                      : "bg-indigo-500/80 border border-indigo-300/40",
                  ].join(" ")}
                  onClick={() => {
                    void submitReroll();
                  }}
                  disabled={rerolling || rerollSelection.length !== 3 || !selectedArtist}
                >
                  {rerolling ? "Rerolling..." : rerollReady ? "REROLL!" : "Exchange 3 Songs"}
                </button>
              </div>

              {selectedArtist ? (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-300/45 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
                  {selectedArtist.imageUrl ? (
                    <img src={selectedArtist.imageUrl} alt="" className="w-7 h-7 rounded-sm object-cover border border-emerald-200/45" />
                  ) : (
                    <span className="w-7 h-7 rounded-sm bg-emerald-400/20 border border-emerald-200/45" />
                  )}
                  <span>
                    <strong>Artist locked in:</strong> {selectedArtist.name}
                  </span>
                </div>
              ) : (
                <div className="text-xs text-neutral-400">Select one artist from the dropdown to enable reroll.</div>
              )}

              <div className="text-xs text-neutral-400">
                Selected: {rerollSelection.length}/3
              </div>

              <div
                className={`overflow-y-auto pr-1 muscino-scroll grid grid-cols-1 md:grid-cols-2 gap-2 rounded-xl transition-all duration-300 ${songHintPulse ? "ring-2 ring-indigo-300/90 shadow-[0_0_24px_rgba(129,140,248,0.55)]" : ""}`}
              >
                {sortedSongs.map((song) => {
                  const isChecked = rerollSelection.includes(String(song.id));
                  const isHovered = hoveredRerollSongId === String(song.id);
                  const rarityColor = rarityRgb(song.rarity);
                  const selectionStyle: CSSProperties = isChecked
                    ? {
                        borderColor: `rgb(${rarityColor} / 0.7)`,
                        background: `linear-gradient(135deg, rgb(${rarityColor} / 0.2), rgb(8 8 12 / 0.58))`,
                        boxShadow: `0 0 16px rgb(${rarityColor} / 0.2)`,
                      }
                    : isHovered
                      ? {
                          borderColor: `rgb(${rarityColor} / 0.5)`,
                          background: `linear-gradient(135deg, rgb(${rarityColor} / 0.12), rgb(8 8 12 / 0.48))`,
                          boxShadow: `0 0 12px rgb(${rarityColor} / 0.14)`,
                        }
                      : {};
                  return (
                    <button
                      key={`reroll-${song.id}`}
                      type="button"
                      onClick={() => toggleRerollSong(String(song.id))}
                      onMouseEnter={() => setHoveredRerollSongId(String(song.id))}
                      onMouseLeave={() => setHoveredRerollSongId(null)}
                      disabled={rerolling}
                      style={selectionStyle}
                      className={`w-full text-left p-2 rounded-xl border transition ${
                        isChecked
                          ? "border-white/40"
                          : isHovered
                            ? "border-white/30"
                            : "border-white/10 bg-white/5 hover:bg-white/10"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img src={song.coverUrl} alt="" className="w-12 h-12 rounded-md object-cover bg-white/10" />
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">{song.title}</div>
                          <div className="truncate text-xs text-neutral-300">{song.artist}</div>
                          <div className={`text-xs ${rarityTextClass(song.rarity)}`}>{song.rarity}</div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </GlassPanel>
          </div>
        </div>
      )}

      {rerollFxOpen && (
        <div className="muscino-reroll-overlay" role="dialog" aria-modal="true" aria-label="Reroll result">
          <div
            className="muscino-reroll-backdrop"
            onClick={() => {
              if (rerollFxState === "revealed") closeRerollFx();
            }}
          />

          <div className="muscino-reroll-center">
            <GlassPanel className="muscino-reroll-panel">
              <div className={["muscino-reroll-sequence", `is-${rerollFxState}`].join(" ")}>
                {rerollFxState !== "revealed" && (
                  <>
                    <div className="muscino-reroll-drop-zone" aria-hidden="true">
                      {rerollFxInputs.map((song, index) => (
                        <div
                          key={`fx-input-${song.id}-${index}`}
                          className="muscino-reroll-input-card"
                          style={{ ["--offset" as const]: index - 1 } as CSSProperties}
                        >
                          <img src={song.coverUrl} alt="" draggable={false} />
                        </div>
                      ))}
                    </div>

                    <div
                      className="muscino-reroll-explosion"
                      style={{ ["--rarity-rgb" as const]: rarityRgb(rerollResultSong?.rarity ?? "Common") } as CSSProperties}
                      aria-hidden="true"
                    />
                  </>
                )}

                {rerollFxState === "revealed" && rerollResultSong && (
                  <>
                    <div className="text-3xl md:text-4xl font-medium text-white/90 -mt-7"></div>
                    <div className="muscino-reroll-reveal-stage">
                      <div
                        className="muscino-opening-featured"
                        style={{ ["--rarity-rgb" as const]: rarityRgb(rerollResultSong.rarity) } as CSSProperties}
                      >
                        <div className="muscino-opening-soundbar" aria-hidden="true">
                          {Array.from({ length: 34 }).map((_, idx) => (
                            <span key={idx} className="muscino-opening-soundbar-bar" />
                          ))}
                        </div>

                        <div className="muscino-opening-featured-card">
                          {rerollResultSong.coverUrl ? (
                            <img src={rerollResultSong.coverUrl} alt="" draggable={false} />
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div
                      className="muscino-opening-current is-revealed"
                      style={{ ["--rarity-rgb" as const]: rarityRgb(rerollResultSong.rarity) } as CSSProperties}
                    >
                      {rerollResultSong.title} – {rerollResultSong.artist}
                    </div>

                    <div className="flex gap-1 pt-0">
                      <button
                        onClick={closeRerollFx}
                        className="px-5 py-2 rounded-xl bg-blue-500/75 border border-blue-300/20 hover:bg-blue-500/90 transition"
                      >
                        Confirm
                      </button>
                    </div>
                  </>
                )}
              </div>
            </GlassPanel>
          </div>
        </div>
      )}
    </div>
  );
}