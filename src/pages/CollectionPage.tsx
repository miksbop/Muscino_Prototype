import React, { useEffect, useState } from "react";
import type { OwnedSong } from "../types/song";
import { api } from "../services/api";
import GlassPanel from "../components/GlassPanel";
import { SongCard } from "../components/SongCard";
import { MarqueeText } from "../components/MarqueeText";
import { rarityTextClass } from "../types/rarity";
import { LoadingSpinner } from "../components/LoadingSpinner";

// THIS IS MY FORK TEST
function rarityRgb(rarity?: string) {
  switch (rarity) {
    case "Uncommon":
      return "52 211 153";
    case "Rare":
      return "56 189 248";
    case "Epic":
      return "167 139 250";
    case "Legendary":
      return "251 191 36";
    default:
      return "255 255 255";
  }
}

const RARITY_ORDER: Record<string, number> = {
  Legendary: 5,
  Epic: 4,
  Rare: 3,
  Uncommon: 2,
  Common: 1,
};

export function CollectionPage() {
  const [songs, setSongs] = useState<OwnedSong[]>([]);
  const [selected, setSelected] = useState<OwnedSong | null>(null);
  const [loading, setLoading] = useState(true);

  // MUST be inside component
  const [sweepTick, setSweepTick] = useState(0);

  useEffect(() => {
  (async () => {
    const data = await api.getInventory();
    setSongs(data);
    setSelected(null); // 👈 explicitly no selection
    setLoading(false);
  })();
}, []);

  const COLS_DESKTOP = 4;
  const remainder = songs.length % COLS_DESKTOP;
  const emptySlots = remainder === 0 ? 0 : COLS_DESKTOP - remainder;
  const sortedSongs = [...songs].sort(
    (a, b) => RARITY_ORDER[b.rarity] - RARITY_ORDER[a.rarity]
  );

 return (
  <div className="h-full bg-neutral-950 text-white">

      <div className="relative max-w-6xl mx-auto px-6 pt-6 pb-6 h-full flex flex-col min-h-0">
        


        {/* Vertical side label */}
        <div className="collection-side-label tracking-wide">Collection</div>

        {loading ? (
          <div className="flex-1 grid place-items-center min-h-0">
  <LoadingSpinner />
</div>

        ) : (
          <div className="grid grid-cols-12 gap-4 flex-1 min-h-0">



            {/* LEFT PANEL */}
            <GlassPanel
  key={`${selected?.id ?? "none"}-${sweepTick}`}
  className="col-span-12 md:col-span-4 p-4 md:sticky md:top-0 h-full min-h-0 overflow-hidden flex flex-col rarity-rotating-border rarity-rim-sweep rarity-bg-wash"
  style={{ ["--rarity-rgb" as any]: rarityRgb(selected?.rarity) }}
>


             {selected ? (
  <>
    {/* MEDIA */}
<div className="relative w-full aspect-[1/1] rounded-xl overflow-hidden border border-white/10 bg-white/5 rarity-media-glow">
  <img
    src={selected.coverUrl}
    alt=""
    className="absolute inset-0 h-full w-full object-cover"
    draggable={false}
  />
</div>


    {/* TEXT */}
    <div className="pt-4 min-w-0">
      <MarqueeText
        text={selected.title}
        className="text-xl font-semibold rarity-title-glow"
      />
      <div className="text-neutral-300 truncate">{selected.artist}</div>
      <div className="mt-2 text-neutral-400 whitespace-nowrap">
        {selected.genre} •{" "}
        <span className={rarityTextClass(selected.rarity)}>
          {selected.rarity}
        </span>
      </div>
    </div>

    {/* ACTIONS pinned to bottom */}
    <div className="mt-auto pt-4 flex gap-2">
      <button className="flex-1 px-3 py-2 rounded-xl bg-white/10 border border-white/10 text-sm">
        Display on profile
      </button>
      <button className="flex-1 px-3 py-2 rounded-xl bg-white/10 border border-white/10 text-sm">
        List on market
      </button>
    </div>
  </>
)  : (
  <div className="flex flex-col h-full min-h-0">
<div className="relative w-full aspect-[1/1] rounded-xl overflow-hidden border border-white/10 bg-white/5"/>


  <div className="pt-4 text-center text-neutral-400">
    <div className="text-lg font-medium text-white/80">No song selected</div>
    <div className="text-sm text-neutral-400 mt-1">
      Select a song from your collection to view details
    </div>
  </div>

  <div className="mt-auto pt-4 flex gap-2 opacity-60">
    <button className="flex-1 px-3 py-2 rounded-xl bg-white/10 border border-white/10 text-sm" disabled>
      Display on profile
    </button>
    <button className="flex-1 px-3 py-2 rounded-xl bg-white/10 border border-white/10 text-sm" disabled>
      List on market
    </button>
  </div>
</div>


)}

            </GlassPanel>

            {/* Right grid */}
            <GlassPanel className="col-span-12 md:col-span-8 p-4 overflow-y-auto pr-3 pb-10 muscino-scroll min-h-0">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 items-start">
                {sortedSongs.map((s) => (
                  <SongCard
                    key={s.id}
                    song={s}
                    selected={selected?.id === s.id}
                    onSelect={() => setSelected(s)}
                  />
                ))}

                {emptySlots > 0 &&
                  Array.from({ length: emptySlots }).map((_, i) => (
                    <div
                      key={`empty-slot-${i}`}
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
                      <div className="px-1 pb-3 text-neutral-500 text-sm">
                        Empty slot
                      </div>
                    </div>
                  ))}
              </div>
            </GlassPanel>
          </div>
        )}
      </div>
    </div>
  );
}
