import { createContext } from "react";
import type { AuthUser, LoginInput } from "../types/auth";

export type AuthStatus = "loading" | "ready";

export type AuthContextValue = {
  user: AuthUser | null;
  status: AuthStatus;
  isSignedIn: boolean;
  signIn: (input: LoginInput) => Promise<void>;
  signUp: (input: LoginInput) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
