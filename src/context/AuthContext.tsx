import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { api } from "../services/api";
import { AuthContext } from "./auth-context";
import type { AuthContextValue } from "./auth-context";
import type { AuthUser, LoginInput } from "../types/auth";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<"loading" | "ready">("loading");
  const [walletIncreaseSignal, setWalletIncreaseSignal] = useState<{ id: number; amount: number } | null>(null);
  const [xpGainSignal, setXpGainSignal] = useState<{
    id: number;
    amount: number;
    leveledUp: boolean;
    fromProgress?: number;
    toProgress?: number;
  } | null>(null);
  const walletStorageKey = "muscino:last-seen-wallet-by-user";

  const getStoredWalletByUser = useCallback((): Record<string, number> => {
    try {
      const raw = window.localStorage.getItem(walletStorageKey);
      if (!raw) return {};
      const parsed = JSON.parse(raw) as Record<string, number>;
      return typeof parsed === "object" && parsed ? parsed : {};
    } catch {
      return {};
    }
  }, []);

  const setStoredWalletForUser = useCallback((userId: string, wallet: number) => {
    const next = getStoredWalletByUser();
    next[userId] = wallet;
    try {
      window.localStorage.setItem(walletStorageKey, JSON.stringify(next));
    } catch {
      // no-op: localStorage unavailable
    }
  }, [getStoredWalletByUser]);

  const emitWalletIncreaseSignal = useCallback((amount: number) => {
    if (amount <= 0) return;
    setWalletIncreaseSignal({
      id: Date.now() + Math.floor(Math.random() * 1000),
      amount,
    });
  }, []);

  const triggerXpGainSignal = useCallback((
    amount: number,
    options?: { leveledUp?: boolean; fromProgress?: number; toProgress?: number },
  ) => {
    if (amount <= 0) return;
    setXpGainSignal({
      id: Date.now() + Math.floor(Math.random() * 1000),
      amount,
      leveledUp: Boolean(options?.leveledUp),
      fromProgress: options?.fromProgress,
      toProgress: options?.toProgress,
    });
  }, []);

  const updateUserAndSignal = useCallback(
    (next: AuthUser | null, explicitIncrease = 0) => {
      setUser((prev) => {
        let amountToSignal = Math.max(explicitIncrease, 0);

        if (next) {
          if (amountToSignal > 0) {
            // explicit server-side reward payload takes precedence to avoid double counting
          } else if (prev && next.id === prev.id && next.wallet > prev.wallet) {
            amountToSignal += next.wallet - prev.wallet;
          } else if (!prev) {
            const previousSeenWallet = getStoredWalletByUser()[next.id];
            if (typeof previousSeenWallet === "number" && next.wallet > previousSeenWallet) {
              amountToSignal += next.wallet - previousSeenWallet;
            }
          }
        }

        if (amountToSignal > 0) {
          emitWalletIncreaseSignal(amountToSignal);
        }

        if (!next) return null;
        const { walletIncrease: _walletIncrease, ...rest } = next;
        setStoredWalletForUser(rest.id, rest.wallet);
        return rest;
      });
    },
    [emitWalletIncreaseSignal, getStoredWalletByUser, setStoredWalletForUser],
  );

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const current = await api.getSession();
        if (!cancelled) updateUserAndSignal(current);
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
    updateUserAndSignal(next, next.walletIncrease ?? 0);
  }, [updateUserAndSignal]);

  const signUp = useCallback(async (input: LoginInput) => {
    const next = await api.register(input);
    updateUserAndSignal(next);
  }, [updateUserAndSignal]);

  const signOut = useCallback(async () => {
    await api.logout();
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const current = await api.getSession();
    updateUserAndSignal(current);
  }, [updateUserAndSignal]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      status,
      isSignedIn: !!user,
      walletIncreaseSignal,
      xpGainSignal,
      signIn,
      signUp,
      signOut,
      refreshUser,
      triggerXpGainSignal,
    }),
    [user, status, walletIncreaseSignal, xpGainSignal, signIn, signUp, signOut, refreshUser, triggerXpGainSignal],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}