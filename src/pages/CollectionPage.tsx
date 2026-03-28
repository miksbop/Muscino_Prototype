import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type { OwnedSong } from "../types/song";
import { api } from "../services/api";
import GlassPanel from "../components/GlassPanel";
import { SongCard } from "../components/SongCard";
import { MarqueeText } from "../components/MarqueeText";
import { rarityRgb, rarityTextClass } from "../types/rarity";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { useAuth } from "../context/useAuth";

const RARITY_ORDER: Record<OwnedSong["rarity"], number> = {
  Legendary: 5,
  Epic: 4,
  Rare: 3,
  Uncommon: 2,
  Common: 1,
};

const COLS_DESKTOP = 4;

export function CollectionPage() {
  const { refreshUser } = useAuth();
  const [songs, setSongs] = useState<OwnedSong[]>([]);
  const [selected, setSelected] = useState<OwnedSong | null>(null);
  const [loading, setLoading] = useState(true);
  const [listing, setListing] = useState(false);
  const [rerollOpen, setRerollOpen] = useState(false);
  const [rerollSelection, setRerollSelection] = useState<string[]>([]);
  const [artistKeyword, setArtistKeyword] = useState("");
  const [rerolling, setRerolling] = useState(false);

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

  const toggleRerollSong = (ownedSongId: string) => {
    setRerollSelection((current) => {
      if (current.includes(ownedSongId)) {
        return current.filter((id) => id !== ownedSongId);
      }
      if (current.length >= 3) {
        return current;
      }
      return [...current, ownedSongId];
    });
  };

  const submitReroll = async () => {
    if (rerollSelection.length !== 3) {
      window.alert("Select exactly 3 songs to reroll.");
      return;
    }

    if (!artistKeyword.trim()) {
      window.alert("Enter an artist keyword before rerolling.");
      return;
    }

    try {
      setRerolling(true);
      const parsedOwnedSongIds = rerollSelection.map((id) => Number(id));
      if (parsedOwnedSongIds.some((id) => !Number.isFinite(id))) {
        window.alert("Reroll is unavailable while running in local mock mode.");
        return;
      }

      const result = await api.rerollInventorySongs({
        ownedSongIds: parsedOwnedSongIds,
        artistKeyword: artistKeyword.trim(),
      });

      const refreshedSongs = await api.getInventory();
      setSongs(refreshedSongs);
      const newlyCreated = refreshedSongs.find((song) => song.id === result.newSong.id) ?? result.newSong;
      setSelected(newlyCreated);
      setRerollOpen(false);
      setRerollSelection([]);
      setArtistKeyword("");
      window.alert(`You rolled a ${result.rolledRarity} song: ${result.newSong.title} by ${result.newSong.artist}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to reroll songs.";
      window.alert(message);
    } finally {
      setRerolling(false);
    }
  };

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
                    onSelect={() => setSelected(song)}
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
            <GlassPanel className="h-full p-5 flex flex-col gap-4 border border-white/20">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold">Song Reroll</h2>
                  <p className="text-sm text-neutral-300">
                    Pick 3 songs, then search an artist keyword. Higher rarity inputs improve your rarity odds.
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

              <div className="flex items-center gap-3">
                <input
                  value={artistKeyword}
                  onChange={(e) => setArtistKeyword(e.target.value)}
                  placeholder="Artist keyword (e.g. Drake, Paramore, Skrillex)"
                  className="flex-1 px-3 py-2 rounded-lg bg-black/40 border border-white/15 outline-none focus:border-white/40"
                  disabled={rerolling}
                />
                <button
                  type="button"
                  className="px-4 py-2 rounded-lg bg-indigo-500/80 border border-indigo-300/40 text-sm font-medium disabled:opacity-60"
                  onClick={() => {
                    void submitReroll();
                  }}
                  disabled={rerolling || rerollSelection.length !== 3 || !artistKeyword.trim()}
                >
                  {rerolling ? "Rerolling..." : "Exchange 3 Songs"}
                </button>
              </div>

              <div className="text-xs text-neutral-400">
                Selected: {rerollSelection.length}/3
              </div>

              <div className="overflow-y-auto pr-1 muscino-scroll grid grid-cols-1 md:grid-cols-2 gap-2">
                {sortedSongs.map((song) => {
                  const isChecked = rerollSelection.includes(String(song.id));
                  return (
                    <button
                      key={`reroll-${song.id}`}
                      type="button"
                      onClick={() => toggleRerollSong(String(song.id))}
                      disabled={rerolling}
                      className={`w-full text-left p-2 rounded-xl border transition ${
                        isChecked
                          ? "border-indigo-300/80 bg-indigo-500/20"
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
    </div>
  );
}