// src/services/api.ts
import type { OwnedSong, Rarity } from "../types/song";
import type { Sleeve, SleeveSong } from "../types/sleeve";
import { MOCK_SLEEVES } from "../mock/sleeves";
import { mockInventory as MOCK_INVENTORY } from "../mock/mockData";


// ------------------------------------------------------------
// FRONTEND-ONLY mock "DB" (in-memory). Backend replaces this.
// ------------------------------------------------------------
let mockInventory: OwnedSong[] = [...MOCK_INVENTORY];

// helper
function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function pickWeightedByRarity(items: SleeveSong[]): SleeveSong {
  const weight: Record<Rarity, number> = {
    Common: 35,
    Uncommon: 25,
    Rare: 20,
    Epic: 15,
    Legendary: 5,
  };

  const bag = items.map((item) => ({ item, w: weight[item.rarity] ?? 1 }));
  const total = bag.reduce((s, x) => s + x.w, 0);

  let roll = Math.random() * total;
  for (const x of bag) {
    roll -= x.w;
    if (roll <= 0) return x.item;
  }
  return bag[bag.length - 1].item;
}

function toOwnedSong(s: SleeveSong): OwnedSong {
  return {
    ...s,
    // If you want duplicate copies to be possible, uncomment:
    // id: `${s.id}_${crypto.randomUUID()}`,

    obtainedAt: new Date().toISOString(),
  } as OwnedSong;
}

export const api = {
  async getInventory(): Promise<OwnedSong[]> {
    await delay(250);
    return mockInventory;
  },

  async getSleeves(): Promise<Sleeve[]> {
    await delay(250);
    return MOCK_SLEEVES;
  },

  async openSleeve(sleeveId: string): Promise<OwnedSong> {
    await delay(600);

    const sleeve = MOCK_SLEEVES.find((s) => s.id === sleeveId);
    if (!sleeve) throw new Error("Sleeve not found");
    if (!sleeve.contents.length) throw new Error("Sleeve is empty");

    const rolled = pickWeightedByRarity(sleeve.contents);
    const owned = toOwnedSong(rolled);

    mockInventory = [owned, ...mockInventory];
    return owned;
  },

  // Optional: dev convenience
  __resetMocks() {
    mockInventory = [...MOCK_INVENTORY];
  },
};
