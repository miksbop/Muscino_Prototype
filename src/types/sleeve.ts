import type { Song, Rarity } from "./song";

export type SleeveGenre = "Pop" | "Rock" | "Indie" | "Rap";

/**
 * Sleeve content is a song + drop metadata.
 * (Later backend can add odds/weights here too.)
 */
export type SleeveSong = Song & {
  rarity: Rarity;         // preview rarity for borders/tints
  weight?: number;        // optional future: explicit odds tuning (frontend-safe)
};

export type Sleeve = {
  id: string;
  name: string;              // "Pop Sleeve"
  genre: SleeveGenre;        // Pop/Rock/Indie/Rap
  cost: number;              // 20
  contents: SleeveSong[];    // what can drop
  refreshedWeekly?: boolean; // optional UI text
};
