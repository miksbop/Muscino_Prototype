import type { CSSProperties, ReactNode } from "react";
import GlassPanel from "./GlassPanel";
import type { Rarity } from "../types/song";

type Props = {
  children: ReactNode;
  rarity?: Rarity | null;
  className?: string;
};

const RARITY_RGB: Record<Rarity, string> = {
  Common: "160 160 160",
  Uncommon: "52 211 153",
  Rare: "56 189 248",
  Epic: "167 139 250",
  Legendary: "245 158 11",
};

export function RarityGlowPanel({ children, rarity, className = "" }: Props) {
  const rgb = rarity && RARITY_RGB[rarity] ? RARITY_RGB[rarity] : "255 255 255";

  return (
    <div
      className={["relative overflow-visible rounded-2xl", rarity ? "rarity-rotating-border" : "", className].join(
        " ",
      )}
      style={{ ["--rarity-rgb" as const]: rgb } as CSSProperties}
    >
      <GlassPanel className="relative z-10 h-full">{children}</GlassPanel>
    </div>
  );
}
