import { createContext } from "react";
import type { AuthUser, LoginInput } from "../types/auth";

export type AuthStatus = "loading" | "ready";

export type AuthContextValue = {
  user: AuthUser | null;
  status: AuthStatus;
  isSignedIn: boolean;
  walletIncreaseSignal: { id: number; amount: number } | null;
  xpGainSignal: {
    id: number;
    amount: number;
    leveledUp: boolean;
    fromProgress?: number;
    toProgress?: number;
  } | null;
  signIn: (input: LoginInput) => Promise<void>;
  signUp: (input: LoginInput) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
  triggerXpGainSignal: (
    amount: number,
    options?: { leveledUp?: boolean; fromProgress?: number; toProgress?: number },
  ) => void;
};

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);