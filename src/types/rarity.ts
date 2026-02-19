import type { Rarity } from "./song";

export function rarityTextClass(rarity: Rarity): string {
  switch (rarity) {
    case "Common":
      return "text-neutral-400";
    case "Uncommon":
      return "text-emerald-300 drop-shadow-[0_0_8px_rgba(52,211,153,0.18)]";
    case "Rare":
      return "text-sky-300 drop-shadow-[0_0_8px_rgba(52,211,153,0.18)]";
    case "Epic":
      return "text-violet-300 drop-shadow-[0_0_10px_rgba(52,211,153,0.18)]";
    case "Legendary":
      return "text-amber-300 drop-shadow-[0_0_12px_rgba(52,211,153,0.18)]";
    default:
      return "text-neutral-400";
  }
}

export function raritySelectedBgClass(rarity: Rarity): string {
  // Selected should feel tinted, not whitened.
  switch (rarity) {
    case "Uncommon":
      return "bg-emerald-500/10";
    case "Rare":
      return "bg-sky-500/10";
    case "Epic":
      return "bg-violet-500/10";
    case "Legendary":
      return "bg-amber-500/10";
    case "Common":
    default:
      return "bg-white/6";
  }
}

export function rarityRingClass(rarity: Rarity): string {
  // Common ring should stay off so common cards don't look "selected by default".
  switch (rarity) {
    case "Uncommon":
      return "ring-emerald-300/35";
    case "Rare":
      return "ring-sky-300/30";
    case "Epic":
      return "ring-violet-300/28";
    case "Legendary":
      return "ring-amber-300/35";
    case "Common":
    default:
      return "ring-transparent";
  }
}

export function rarityBorderClass(
  rarity: Rarity,
  strength: "subtle" | "strong" = "subtle",
): string {
  const strong = strength === "strong";

  switch (rarity) {
    case "Common":
      return strong ? "border-white/25" : "border-white/10";
    case "Uncommon":
      return strong ? "border-emerald-300/85" : "border-emerald-400/35";
    case "Rare":
      return strong ? "border-sky-300/80" : "border-sky-400/30";
    case "Epic":
      return strong ? "border-violet-300/80" : "border-violet-400/30";
    case "Legendary":
      return strong ? "border-amber-300/90" : "border-amber-400/35";
    default:
      return strong ? "border-white/25" : "border-white/10";
  }
}

export function rarityGlowClass(rarity: Rarity): string {
  switch (rarity) {
    case "Uncommon":
      return "shadow-[0_0_0_1px_rgba(52,211,153,0.18)]";
    case "Rare":
      return "shadow-[0_0_0_1px_rgba(56,189,248,0.18)]";
    case "Epic":
      return [
        "shadow-[0_0_0_1px_rgba(167,139,250,0.28)]",
        "shadow-[0_0_20px_rgba(167,139,250,0.18)]",
      ].join(" ");
    case "Legendary":
      return [
        "shadow-[0_0_0_1px_rgba(251,191,36,0.30)]",
        "shadow-[0_0_22px_rgba(251,191,36,0.20)]",
        "hover:shadow-[0_0_28px_rgba(251,191,36,0.28)]",
      ].join(" ");
    case "Common":
    default:
      return "";
  }
}

export function rarityPillClass(rarity: Rarity): string {
  switch (rarity) {
    case "Common":
      return "bg-white/5 text-neutral-300 border-white/10";
    case "Uncommon":
      return "bg-emerald-800/20 text-emerald-200 border-emerald-400/35";
    case "Rare":
      return "bg-sky-500/10 text-sky-200 border-sky-400/20";
    case "Epic":
      return "bg-violet-500/10 text-violet-200 border-violet-400/20";
    case "Legendary":
      return "bg-amber-500/10 text-amber-200 border-amber-400/25";
    default:
      return "bg-white/5 text-neutral-300 border-white/10";
  }
}

/**
 * Hover overlay utilities (pseudo-element).
 * Guarantees hover tint shows up even with baseline `bg-black/20` present.
 */
export function rarityHoverOverlayClass(rarity: Rarity): string {
  const base = [
    "before:absolute before:inset-0 before:opacity-0 hover:before:opacity-100",
    "before:transition-opacity before:duration-200",
    "before:bg-gradient-to-t",
  ];

  switch (rarity) {
    case "Uncommon":
      return [...base, "before:from-emerald-500/20 before:via-emerald-500/10 before:to-transparent"].join(" ");
    case "Rare":
      return [...base, "before:from-sky-500/20 before:via-sky-500/10 before:to-transparent"].join(" ");
    case "Epic":
      return [...base, "before:from-violet-500/20 before:via-violet-500/10 before:to-transparent"].join(" ");
    case "Legendary":
      return [...base, "before:from-amber-400/30 before:via-amber-500/14 before:to-transparent"].join(" ");
    case "Common":
    default:
      return [...base, "before:from-white/10 before:via-white/5 before:to-transparent"].join(" ");
  }
}

export function rarityHoverBorderClass(rarity: Rarity): string {
  switch (rarity) {
    case "Uncommon":
      return "hover:border-emerald-300/55";
    case "Rare":
      return "hover:border-sky-300/55";
    case "Epic":
      return "hover:border-violet-300/55";
    case "Legendary":
      return "hover:border-amber-300/65";
    case "Common":
    default:
      return "hover:border-white/18";
  }
}

export function rarityRgb(rarity?: Rarity): string {
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
