export type Rarity = "Common" | "Uncommon" | "Rare" | "Epic" | "Legendary";

/**
 * Canonical music identity (source-of-truth fields).
 * Spotify lives here.
 * NO game rarity here.
 */
export type Song = {
  id: string;          // your internal ID (can be spotify track id later)
  title: string;
  artist: string;
  coverUrl: string;
  genre: string;

  // --- Source metadata (optional but recommended) ---
  spotifyTrackId?: string;   // e.g. "4iV5W9uYEdYUVa79Axb7Rh"
  spotifyUrl?: string;       // external URL (from Spotify API)
};

/**
 * Ownership is game-layer data.
 */
export type OwnedSong = Song & {
  obtainedAt: string; // ISO date string
  rarity: Rarity;     // what rarity THIS owned instance has
};

/**
 * Optional: YouTube-derived stats (backend can populate).
 * Keep it separate from Song so you don’t “pollute” identity.
 */
export type YouTubeStats = {
  youtubeVideoId?: string;
  viewCount?: number;
  likeCount?: number;
  commentCount?: number;
  updatedAt?: string; // ISO
};
