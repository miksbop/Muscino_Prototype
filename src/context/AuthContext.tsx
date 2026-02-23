import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { api } from "../services/api";
import { AuthContext } from "./auth-context";
import type { AuthContextValue } from "./auth-context";
import type { AuthUser, LoginInput } from "../types/auth";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<"loading" | "ready">("loading");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const current = await api.getSession();
        if (!cancelled) setUser(current);
      } finally {
        if (!cancelled) setStatus("ready");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (input: LoginInput) => {
    const next = await api.login(input);
    setUser(next);
  }, []);

  const signUp = useCallback(async (input: LoginInput) => {
    const next = await api.register(input);
    setUser(next);
  }, []);

  const signOut = useCallback(async () => {
    await api.logout();
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const current = await api.getSession();
    setUser(current);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      status,
      isSignedIn: !!user,
      signIn,
      signUp,
      signOut,
      refreshUser,
    }),
    [user, status, signIn, signUp, signOut, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
