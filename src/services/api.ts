import type { AuthUser, LoginInput } from "../types/auth";
import { mockInventory as MOCK_INVENTORY } from "../mock/mockData";
import { MOCK_SLEEVES } from "../mock/sleeves";
import type { OwnedSong, Rarity } from "../types/song";

export type RerollInventoryResponse = {
  newSong: OwnedSong;
  consumedOwnedSongIds: number[];
  rolledRarity: Rarity;
};

import type { Sleeve, SleeveSong } from "../types/sleeve";
import type { MarketListing } from "../types/market";
import type { ProfileView } from "../types/profile";

async function fetchJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    ...init,
    credentials: "include", // Required for session cookies
  });
  if (!res.ok) {
    let detail = "";
    try {
      const data = await res.json();
      detail = data.detail || data.message || "";
    } catch {
      detail = await res.text().catch(() => "");
    }
    throw new Error(detail || `Request failed ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as T;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Fallback mock state (used if backend unreachable during dev)
let mockInventory: OwnedSong[] = [...MOCK_INVENTORY];

function pickWeightedByRarity(items: SleeveSong[]): SleeveSong {
  const weightByRarity: Record<Rarity, number> = {
    Common: 35,
    Uncommon: 25,
    Rare: 20,
    Epic: 15,
    Legendary: 5,
  };

  const weightedItems = items.map((item) => ({ item, weight: weightByRarity[item.rarity] ?? 1 }));
  const totalWeight = weightedItems.reduce((sum, x) => sum + x.weight, 0);

  let roll = Math.random() * totalWeight;
  for (const x of weightedItems) {
    roll -= x.weight;
    if (roll <= 0) return x.item;
  }

  return weightedItems[weightedItems.length - 1].item;
}

function toOwnedSong(song: SleeveSong): OwnedSong {
  return {
    ...song,
    obtainedAt: new Date().toISOString(),
  };
}

export const api = {
  async getInventory(): Promise<OwnedSong[]> {
    try {
      return await fetchJson<OwnedSong[]>("/api/inventory/");
    } catch {
      await delay(200);
      return mockInventory;
    }
  },

  async getSleeves(): Promise<Sleeve[]> {
    try {
      return await fetchJson<Sleeve[]>("/api/sleeves/");
    } catch {
      await delay(200);
      return MOCK_SLEEVES;
    }
  },

  async openSleeve(sleeveId: string): Promise<OwnedSong> {
    try {
      return await fetchJson<OwnedSong>(`/api/sleeves/${encodeURIComponent(sleeveId)}/open`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
    } catch {
      await delay(400);

      const sleeve = MOCK_SLEEVES.find((s) => s.id === sleeveId);
      if (!sleeve) throw new Error("Sleeve not found");
      if (!sleeve.contents.length) throw new Error("Sleeve is empty");

      const rolled = pickWeightedByRarity(sleeve.contents);
      const owned = toOwnedSong(rolled);

      mockInventory = [owned, ...mockInventory];
      return owned;
    }
  },

  async getSession(): Promise<AuthUser | null> {
    try {
      const data = await fetchJson<{ user: AuthUser | null }>("/api/auth/session/");
      return data.user;
    } catch {
      return null;
    }
  },

  async login(input: LoginInput): Promise<AuthUser> {
    const data = await fetchJson<{ user: AuthUser; walletIncrease?: number }>("/api/auth/login/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return {
      ...data.user,
      walletIncrease: data.walletIncrease ?? 0,
    } as AuthUser;
  },

  async register(input: LoginInput): Promise<AuthUser> {
    const data = await fetchJson<{ user: AuthUser }>("/api/auth/register/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return data.user;
  },

  async logout(): Promise<void> {
    await fetch("/api/auth/logout/", {
      method: "POST",
      credentials: "include",
    });
  },

    async getMarketListings(): Promise<MarketListing[]> {
    try {
      return await fetchJson<MarketListing[]>("/api/market/listings/");
    } catch {
      await delay(200);
      return [];
    }
  },

  async createMarketListing(input: { ownedSongId: number; price: number }): Promise<MarketListing> {
    return await fetchJson<MarketListing>("/api/market/listings/create/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  },

  async buyMarketListing(listingId: number): Promise<MarketListing> {
    return await fetchJson<MarketListing>(`/api/market/listings/${listingId}/buy/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
  },


  async getInventoryByOwner(username: string): Promise<OwnedSong[]> {
    try {
      return await fetchJson<OwnedSong[]>(`/api/inventory/?owner=${encodeURIComponent(username)}`);
    } catch {
      await delay(200);
      return mockInventory;
    }
  },

    async rerollInventorySongs(input: { ownedSongIds: number[]; artistKeyword: string }): Promise<RerollInventoryResponse> {
    return await fetchJson<RerollInventoryResponse>("/api/inventory/reroll/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  },

  async getProfile(username: string): Promise<ProfileView> {
    return await fetchJson<ProfileView>(`/api/profiles/${encodeURIComponent(username)}/`);
  },

  async updateProfile(
    username: string,
    input: { bio?: string; themeColor?: string; avatarFile?: File | null },
  ): Promise<ProfileView> {
    const formData = new FormData();
    if (typeof input.bio === "string") formData.append("bio", input.bio);
    if (typeof input.themeColor === "string") formData.append("themeColor", input.themeColor);
    if (input.avatarFile) formData.append("avatar", input.avatarFile);

    const res = await fetch(`/api/profiles/${encodeURIComponent(username)}/edit/`, {
      method: "PATCH",
      credentials: "include",
      body: formData,
    });
    if (!res.ok) {
      let detail = "";
      try {
        const data = await res.json();
        detail = data.detail || data.message || "";
      } catch {
        detail = await res.text().catch(() => "");
      }
      throw new Error(detail || `Request failed ${res.status} ${res.statusText}`);
    }
    return (await res.json()) as ProfileView;
  },

  __resetMocks() {
    mockInventory = [...MOCK_INVENTORY];
  },
};