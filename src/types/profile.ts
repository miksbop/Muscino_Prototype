import type { OwnedSong } from "./song";

export type ProfileView = {
  id: string;
  username: string;
  displayName: string;
  wallet: number;
  avatarUrl?: string | null;
  joinedAt: string;
  daysRegistered: number;
  songsCollected: number;
  bio: string;
  favoriteSong: OwnedSong | null;
  showcaseSongs: OwnedSong[];
};