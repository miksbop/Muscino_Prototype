import type { Rarity } from "../types/song";
import { rarityPillClass } from "../types/rarity";

type Props = {
  rarity: Rarity;
  className?: string;
};

export function RarityPill({ rarity, className = "" }: Props) {
  return (
    <span
      className={[
        "inline-flex items-center px-2 py-0.5 rounded-full border text-xs",
        rarityPillClass(rarity),
        className,
      ].join(" ")}
    >
      {rarity}
    </span>
  );
}
