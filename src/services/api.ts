import type { AuthUser, LoginInput } from "../types/auth";
import { MOCK_SLEEVES } from "../mock/sleeves";
import type { OwnedSong, Rarity } from "../types/song";

export type ProfileBackgroundOption = {
  filename: string;
  url: string | null;
};

export type RerollInventoryResponse = {
  newSong: OwnedSong;
  consumedOwnedSongIds: number[];
  rolledRarity: Rarity;
};

export type SpotifyArtistSearchResult = {
  id: string;
  name: string;
  imageUrl: string | null;
  spotifyUrl: string | null;
};

import type { Sleeve } from "../types/sleeve";
import type { MarketListing } from "../types/market";
import type { ProfileView } from "../types/profile";
import type { FriendsOverview } from "../types/friends";

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

export const api = {
  async getInventory(): Promise<OwnedSong[]> {
    return await fetchJson<OwnedSong[]>("/api/inventory/");
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
    return await fetchJson<OwnedSong>(`/api/sleeves/${encodeURIComponent(sleeveId)}/open`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
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

  async addTestGold(): Promise<AuthUser> {
    const data = await fetchJson<{ user: AuthUser }>("/api/auth/add-test-gold/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    return data.user;
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
    return await fetchJson<OwnedSong[]>(`/api/inventory/?owner=${encodeURIComponent(username)}`);
  },

  async rerollInventorySongs(input: { ownedSongIds: number[]; artistKeyword: string; artistId?: string }): Promise<RerollInventoryResponse> {
    return await fetchJson<RerollInventoryResponse>("/api/inventory/reroll/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  },

  async searchSpotifyArtists(keyword: string): Promise<SpotifyArtistSearchResult[]> {
    const query = keyword.trim();
    if (query.length < 2) return [];
    const data = await fetchJson<{ artists: SpotifyArtistSearchResult[] }>(`/api/spotify/artists/?q=${encodeURIComponent(query)}`);
    return data.artists ?? [];
  },

  
  async getProfile(username: string): Promise<ProfileView> {
    return await fetchJson<ProfileView>(`/api/profiles/${encodeURIComponent(username)}/`);
  },

  async getProfileBackgroundOptions(): Promise<ProfileBackgroundOption[]> {
    const data = await fetchJson<{ backgrounds: ProfileBackgroundOption[] }>("/api/profiles/backgrounds/");
    return data.backgrounds;
  },

  async updateProfile(
    username: string,
    input: {
      bio?: string;
      themeColor?: string;
      favoriteSongId?: string;
      avatarFile?: File | null;
      profileBackground?: string;
      profileBackgroundOpacity?: number;
    },
  ): Promise<ProfileView> {
    const formData = new FormData();
    if (typeof input.bio === "string") formData.append("bio", input.bio);
    if (typeof input.themeColor === "string") formData.append("themeColor", input.themeColor);
    if (typeof input.favoriteSongId === "string") formData.append("favoriteSongId", input.favoriteSongId);
    if (input.avatarFile) formData.append("avatar", input.avatarFile);
    if (typeof input.profileBackground === "string") formData.append("profileBackground", input.profileBackground);
    if (typeof input.profileBackgroundOpacity === "number") formData.append("profileBackgroundOpacity", String(input.profileBackgroundOpacity));

    const res = await fetch(`/api/profiles/${encodeURIComponent(username)}/update/`, {
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

  async getFriendsOverview(): Promise<FriendsOverview> {
    return await fetchJson<FriendsOverview>("/api/friends/");
  },

  async sendFriendRequest(username: string): Promise<FriendsOverview> {
    return await fetchJson<FriendsOverview>("/api/friends/requests/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username }),
    });
  },

  async acceptFriendRequest(requestId: number): Promise<FriendsOverview> {
    return await fetchJson<FriendsOverview>(`/api/friends/requests/${requestId}/accept/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
  },

  async denyFriendRequest(requestId: number): Promise<FriendsOverview> {
    return await fetchJson<FriendsOverview>(`/api/friends/requests/${requestId}/deny/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
  },


  __resetMocks() {
    // no-op now that authenticated endpoints no longer silently fallback to local mock state
  },
};