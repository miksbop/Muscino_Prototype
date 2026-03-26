import type { Rarity } from "./song";

export type MarketListingStatus = "active" | "sold" | "cancelled";

export type MarketListing = {
  id: number;
  ownedSongId: number;
  songId: string;
  title: string;
  artist: string;
  coverUrl: string;
  genre: string;
  rarity: Rarity;
  seller: string;
  buyer?: string | null;
  price: number;
  status: MarketListingStatus;
  createdAt: string;
  soldAt?: string | null;
};