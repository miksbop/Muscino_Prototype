import type { OwnedSong } from "../types/song";
import type { SleeveSong } from "../types/sleeve";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { RarityPill } from "./RarityPill";
import {
  rarityBorderClass,
  rarityGlowClass,
  rarityHoverBorderClass,
  rarityHoverOverlayClass,
  rarityRingClass,
  raritySelectedBgClass,
} from "../types/rarity";

type SongCardData = OwnedSong | SleeveSong;

type SongCardProps = {
  song: SongCardData;
  selected?: boolean;
  onSelect?: () => void;
  className?: string;
  style?: CSSProperties;
  hoverChancePercent?: number;
  onHoverStart?: (song: SongCardData) => void;
  onHoverEnd?: (song: SongCardData) => void;
};

export function SongCard({
  song,
  selected = false,
  onSelect,
  className,
  style,
  hoverChancePercent,
  onHoverStart,
  onHoverEnd,
}: SongCardProps) {
  const hasCover = Boolean(song.coverUrl && song.coverUrl.trim().length > 0);
  const [chanceDisplay, setChanceDisplay] = useState(0);
  const frameRef = useRef<number | null>(null);

  function stopChanceAnimation() {
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
  }

  function runChanceAnimation() {
    if (typeof hoverChancePercent !== "number") return;

    stopChanceAnimation();
    setChanceDisplay(0);

    const animationStart = performance.now();
    const durationMs = 420;

    const tick = (now: number) => {
      const elapsed = now - animationStart;
      const progress = Math.min(1, elapsed / durationMs);
      const eased = 1 - (1 - progress) ** 3;
      const value = Math.round(hoverChancePercent * eased);
      setChanceDisplay(value);

      if (progress < 1) {
        frameRef.current = window.requestAnimationFrame(tick);
      } else {
        frameRef.current = null;
      }
    };

    frameRef.current = window.requestAnimationFrame(tick);
  }

    function handleHoverStart() {
    runChanceAnimation();
    onHoverStart?.(song);
  }

  function handleHoverEnd() {
    stopChanceAnimation();
    onHoverEnd?.(song);
  }


  useEffect(() => () => stopChanceAnimation(), []);

  return (
    <button
      onClick={onSelect}
      onMouseEnter={handleHoverStart}
      onFocus={handleHoverStart}
      onMouseLeave={handleHoverEnd}
      onBlur={handleHoverEnd}
      style={style}
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
        className ?? "",
      ].join(" ")}
    >
      {song.rarity === "Legendary" && selected && <div className="muscino-legendary-sheen" />}

      <div className="relative z-10 song-card-content">
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

        {typeof hoverChancePercent === "number" ? (
          <div className="play-odds-overlay" aria-hidden="true">
            <span className="play-odds-overlay-value">{chanceDisplay}%</span>
          </div>
        ) : null}
      </div>
    </button>
  );
}