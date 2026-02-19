import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type { OwnedSong } from "../types/song";
import { api } from "../services/api";
import GlassPanel from "../components/GlassPanel";
import { rarityRgb } from "../types/rarity";

type CoverTile = {
  src: string;
  rarity?: OwnedSong["rarity"];
  rgb: string;
};

function buildCoverStrip(items: CoverTile[], minTiles: number) {
  if (items.length === 0) return [];

  const out: CoverTile[] = [];
  while (out.length < minTiles) out.push(...items);

  return out.slice(0, minTiles);
}

export default function HomePage() {
  const [songs, setSongs] = useState<OwnedSong[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        const data = await api.getInventory();
        if (!cancelled) setSongs(data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const strip = useMemo<CoverTile[]>(() => {
    // Dedup by cover URL (keep the highest rarity if duplicates exist).
    const rarityRank: Record<OwnedSong["rarity"], number> = {
      Legendary: 5,
      Epic: 4,
      Rare: 3,
      Uncommon: 2,
      Common: 1,
    };

    const bestByCover = new Map<string, OwnedSong>();

    for (const song of songs) {
      if (!song.coverUrl) continue;

      const existing = bestByCover.get(song.coverUrl);
      if (!existing) {
        bestByCover.set(song.coverUrl, song);
        continue;
      }

      const nextRank = rarityRank[song.rarity] ?? 0;
      const existingRank = rarityRank[existing.rarity] ?? 0;
      if (nextRank > existingRank) bestByCover.set(song.coverUrl, song);
    }

    const tiles: CoverTile[] = Array.from(bestByCover.values()).map((song) => ({
      src: song.coverUrl,
      rarity: song.rarity,
      rgb: rarityRgb(song.rarity),
    }));

    // If inventory is small, repeat to keep motion full.
    return buildCoverStrip(tiles, 18);
  }, [songs]);

  const ready = !loading && strip.length > 0;

  return (
    <div className="relative h-full bg-neutral-950 text-white overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/55 to-black/80" />

        <div className="absolute left-0 right-0 bottom-0 h-[440px]">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/10 to-black/70" />

          {strip.length > 0 && (
            <div
              className={[
                "absolute inset-0 overflow-hidden home-covers-stage",
                ready ? "is-ready" : "",
              ].join(" ")}
            >
              <div className="home-cover-track home-cover-row">
                <div className="home-cover-move-ltr">
                  {[...strip, ...strip].map((tile, index) => {
                    const introIndex = index % strip.length;
                    const intro = introIndex < 8;

                    return (
                      <div
                        key={`${tile.src}-${index}`}
                        className={["home-cover-tile", intro ? "home-cover-tile-intro" : ""].join(" ")}
                        style={
                          intro
                            ? ({ ["--tile-delay" as const]: `${introIndex * 45}ms` } as CSSProperties)
                            : undefined
                        }
                        aria-hidden="true"
                      >
                        <img
                          src={tile.src}
                          alt=""
                          className="h-full w-full object-cover"
                          draggable={false}
                          loading="lazy"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="home-cover-track home-cover-reflection" aria-hidden="true">
                <div className="home-cover-move-ltr">
                  {[...strip, ...strip].map((tile, index) => {
                    const introIndex = index % strip.length;
                    const intro = introIndex < 8;

                    return (
                      <div
                        key={`ref-${tile.src}-${index}`}
                        className={[
                          "home-cover-tile",
                          "home-cover-reflection-tile",
                          intro ? "home-cover-tile-intro" : "",
                        ].join(" ")}
                        style={({
                          ["--rarity-rgb" as const]: tile.rgb,
                          ...(intro ? { ["--tile-delay" as const]: `${introIndex * 90}ms` } : {}),
                        } as CSSProperties)}
                      >
                        <img
                          src={tile.src}
                          alt=""
                          className="h-full w-full object-cover"
                          draggable={false}
                          loading="lazy"
                        />
                        <div className="home-cover-reflection-tint" />
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="absolute inset-0 backdrop-blur-[1px]" />
              <div className="absolute inset-0 bg-black/30" />
            </div>
          )}
        </div>
      </div>

      <div className="relative max-w-6xl mx-auto px-6 pt-16 mt-1">
        <div className="text-center">
          <h1 className="text-5xl md:text-6xl font-semibold tracking-tight">
            Welcome to{" "}
            <span className="muscino-title relative inline-block">
              Muscino
              <span className="muscino-title-sheen" aria-hidden="true">
                Muscino
              </span>
            </span>
          </h1>

          <p className="mt-4 text-2xl md:text-3xl text-white/85">
            Collect and trade your favorite songs!
          </p>
        </div>

        <div className="mt-10 flex justify-center">
          {!loading && songs.length === 0 ? (
            <GlassPanel className="px-6 py-5 text-white/70">
              Your collection is empty — open your first sleeve to begin.
            </GlassPanel>
          ) : null}
        </div>
      </div>
    </div>
  );
}
