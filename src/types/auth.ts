export type AuthUser = {
  id: string;
  username: string;
  displayName: string;
  wallet: number;
  level: number;
  xp: number;
  xpToNextLevel: number;
  dailyCoins: number;
  avatarUrl?: string;
  walletIncrease?: number;
};

export type LoginInput = {
  username: string;
  password: string;
};