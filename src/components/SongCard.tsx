// src/components/SongCard.tsx
import type { OwnedSong } from "../types/song";
import { RarityPill } from "./RarityPill";

import {
  rarityBorderClass,
  rarityGlowClass,
  rarityRingClass,
  raritySelectedBgClass,
  rarityHoverOverlayClass,
  rarityHoverBorderClass,
} from "../types/rarity";

type SongCardProps = {
  song: OwnedSong;
  selected?: boolean;
  onSelect?: () => void;
};

export function SongCard({ song, selected = false, onSelect }: SongCardProps) {
  const hasCover = Boolean(song.coverUrl && song.coverUrl.trim().length > 0);

  return (
    <button
      onClick={onSelect}
      className={[
        "relative overflow-hidden z-0",
        "text-left rounded-2xl border p-2 transition",
        "focus:outline-none focus:ring-2 focus:ring-white/25",
        "transform-gpu",
        "hover:-translate-y-[1px]",
        "hover:shadow-lg hover:shadow-black/30",
        "before:rounded-2xl before:pointer-events-none before:z-0",
        rarityHoverOverlayClass(song.rarity),
        selected
          ? [
              "ring-1",
              rarityRingClass(song.rarity),
              raritySelectedBgClass(song.rarity),
              rarityBorderClass(song.rarity, "strong"),
              rarityGlowClass(song.rarity),
            ].join(" ")
          : [
              "bg-black/20",
              rarityBorderClass(song.rarity, "subtle"),
              rarityHoverBorderClass(song.rarity),
            ].join(" "),
      ].join(" ")}
    >
      {song.rarity === "Legendary" && selected && (
        <div className="muscino-legendary-sheen" />
      )}

      <div className="relative z-10">
        {hasCover ? (
          <img
            src={song.coverUrl}
            alt={`${song.title} cover`}
            className="w-full aspect-square object-cover rounded-xl mb-2"
            loading="lazy"
          />
        ) : (
          <div className="w-full aspect-square rounded-xl mb-2 bg-white/5 border border-white/10 flex items-center justify-center text-neutral-400 text-sm">
            No cover
          </div>
        )}

        <div className="font-medium leading-5 truncate">{song.title}</div>
<div className="text-sm text-neutral-300 leading-5 truncate">{song.artist}</div>


        <div className="mt-1">
          <RarityPill rarity={song.rarity} />
        </div>
      </div>
    </button>
  );
}
