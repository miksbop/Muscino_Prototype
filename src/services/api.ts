// src/services/api.ts
import type { OwnedSong, Rarity } from "../types/song";
import type { Sleeve, SleeveSong } from "../types/sleeve";
import { MOCK_SLEEVES } from "../mock/sleeves";
import { mockInventory as MOCK_INVENTORY } from "../mock/mockData";

// Small fetch wrapper that throws on non-OK
async function fetchJson<T>(
  input: RequestInfo,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(input, init);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Request failed ${res.status} ${res.statusText}: ${text}`);
  }
  return (await res.json()) as T;
}

// Fallback mock state (used if backend unreachable during dev)
let mockInventory: OwnedSong[] = [...MOCK_INVENTORY];

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
    obtainedAt: new Date().toISOString(),
  } as OwnedSong;
}

export const api = {
  // Try backend first. If it fails (no server in dev), fall back to the in-memory mock so UI stays usable.
  async getInventory(): Promise<OwnedSong[]> {
    try {
      return await fetchJson<OwnedSong[]>("/api/inventory/");
    } catch (err) {
      // console.warn('Backend unavailable, falling back to mock inventory', err);
      // small artificial delay to keep behaviour similar to mock
      await new Promise((r) => setTimeout(r, 200));
      return mockInventory;
    }
  },

  async getSleeves(): Promise<Sleeve[]> {
    try {
      return await fetchJson<Sleeve[]>("/api/sleeves/");
    } catch (err) {
      // console.warn('Backend unavailable, falling back to mock sleeves', err);
      await new Promise((r) => setTimeout(r, 200));
      return MOCK_SLEEVES;
    }
  },

  async openSleeve(sleeveId: string): Promise<OwnedSong> {
    try {
      return await fetchJson<OwnedSong>(
        `/api/sleeves/${encodeURIComponent(sleeveId)}/open`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        },
      );
    } catch (err) {
      // fallback to mock roll
      await new Promise((r) => setTimeout(r, 400));

      const sleeve = MOCK_SLEEVES.find((s) => s.id === sleeveId);
      if (!sleeve) throw new Error("Sleeve not found");
      if (!sleeve.contents.length) throw new Error("Sleeve is empty");

      const rolled = pickWeightedByRarity(sleeve.contents);
      const owned = toOwnedSong(rolled);

      mockInventory = [owned, ...mockInventory];
      return owned;
    }
  },

  // Dev helper: reset the in-memory mocks (no-op for backend)
  __resetMocks() {
    mockInventory = [...MOCK_INVENTORY];
  },
};
