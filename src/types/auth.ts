export type AuthUser = {
  id: string;
  username: string;
  displayName: string;
  wallet: number;
  avatarUrl?: string;
};

export type LoginInput = {
  username: string;
  password: string;
};