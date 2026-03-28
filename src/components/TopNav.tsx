import { NavLink } from "react-router-dom";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, MouseEvent } from "react";
import { useAuth } from "../context/useAuth";

export function TopNav() {
  const { user, status, isSignedIn, signOut, walletIncreaseSignal } = useAuth();
  const [hoveredLink, setHoveredLink] = useState<string | null>(null);
  const [hoverIntensity, setHoverIntensity] = useState<Record<string, number>>(
    {},
  );
  const [profileIntensity, setProfileIntensity] = useState(0);
  const [walletPopAmount, setWalletPopAmount] = useState<number | null>(null);
  const [walletTravelUp, setWalletTravelUp] = useState(false);
  const [walletPulse, setWalletPulse] = useState(false);
  const [walletPeakGlow, setWalletPeakGlow] = useState(false);
  const [animatedWallet, setAnimatedWallet] = useState<number>(user?.wallet ?? 0);
  const walletAnimationFrameRef = useRef<number | null>(null);
  const animatedWalletRef = useRef<number>(user?.wallet ?? 0);
  const walletDisplayStorageKey = "muscino:last-displayed-wallet-by-user";

  const linkBase = "hover:text-white cursor-pointer transition-colors";
  const linkInactive = "text-neutral-300";
  const linkActiveGlow =
    "text-white drop-shadow-[0_0_10px_rgba(59,130,246,0.45)]";
  const navLinks: Array<{ to: string; label: string }> = [
    { to: "/play", label: "Play" },
    { to: "/collection", label: "Collection" },
    { to: "/market", label: "Market" },
    { to: "/", label: "Home" },
  ];

  const getIntensityFromPointer = (
    event: MouseEvent<HTMLAnchorElement>,
  ) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const distanceToCenter = Math.abs(
      event.clientX - (bounds.left + bounds.width / 2),
    );
    const normalizedDistance = Math.min(distanceToCenter / (bounds.width / 2), 1);
    return 1 - normalizedDistance;
  };

  const getStoredDisplayedWallet = useCallback((userId: string): number | null => {
    try {
      const raw = window.localStorage.getItem(walletDisplayStorageKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Record<string, number>;
      const value = parsed?.[userId];
      return typeof value === "number" ? value : null;
    } catch {
      return null;
    }
  }, []);

  const persistDisplayedWallet = useCallback((userId: string, value: number) => {
    try {
      const raw = window.localStorage.getItem(walletDisplayStorageKey);
      const next = raw ? (JSON.parse(raw) as Record<string, number>) : {};
      next[userId] = value;
      window.localStorage.setItem(walletDisplayStorageKey, JSON.stringify(next));
    } catch {
      // no-op
    }
  }, []);

  useEffect(() => {
    if (!user) {
      animatedWalletRef.current = 0;
      setAnimatedWallet(0);
      return;
    }

    const hasIncreaseSignal =
      typeof walletIncreaseSignal?.amount === "number" &&
      walletIncreaseSignal.amount > 0 &&
      user.wallet >= walletIncreaseSignal.amount;
    const fallbackPrevious = getStoredDisplayedWallet(user.id);
    const baseline = hasIncreaseSignal
      ? user.wallet - (walletIncreaseSignal?.amount ?? 0)
      : (typeof fallbackPrevious === "number" ? fallbackPrevious : user.wallet);
    const nextDisplay = Math.min(Math.max(0, baseline), user.wallet);

    animatedWalletRef.current = nextDisplay;
    setAnimatedWallet(nextDisplay);
  }, [user?.id, walletIncreaseSignal?.id, walletIncreaseSignal?.amount, getStoredDisplayedWallet]);

  useEffect(() => {
    return () => {
      if (walletAnimationFrameRef.current) {
        cancelAnimationFrame(walletAnimationFrameRef.current);
      }
    };
  }, []);

  const animateWalletTo = useCallback((target: number, durationMs = 640, onComplete?: () => void) => {
    const start = animatedWalletRef.current;
    if (start === target) {
      onComplete?.();
      return;
    }

    if (walletAnimationFrameRef.current) {
      cancelAnimationFrame(walletAnimationFrameRef.current);
    }

    const startAt = performance.now();
    const easeOut = (t: number) => 1 - (1 - t) ** 3;

    const animate = (now: number) => {
      const progress = Math.min((now - startAt) / durationMs, 1);
      const eased = easeOut(progress);
      const nextValue = Math.round(start + (target - start) * eased);
      animatedWalletRef.current = nextValue;
      setAnimatedWallet(nextValue);
      if (progress < 1) {
        walletAnimationFrameRef.current = requestAnimationFrame(animate);
      } else {
        walletAnimationFrameRef.current = null;
        if (user?.id) {
          persistDisplayedWallet(user.id, target);
        }
        onComplete?.();
      }
    };

    walletAnimationFrameRef.current = requestAnimationFrame(animate);
  }, [persistDisplayedWallet, user?.id]);

  useEffect(() => {
    if (!user) return;
    if (walletPopAmount) return;
    animateWalletTo(user.wallet, user.wallet > animatedWalletRef.current ? 680 : 380);
  }, [user?.wallet, user?.id, walletPopAmount, animateWalletTo]);

  useEffect(() => {
    if (!walletIncreaseSignal?.amount) return;
    if (!user) return;

    setWalletPopAmount(walletIncreaseSignal.amount);
    setWalletTravelUp(false);
    setWalletPulse(false);
    setWalletPeakGlow(false);

    const lingerTimer = window.setTimeout(() => {
      setWalletTravelUp(true);
    }, 2000);
    const countTimer = window.setTimeout(() => {
      setWalletPopAmount(null);
      setWalletTravelUp(false);
      setWalletPulse(true);
      animateWalletTo(user.wallet, 760, () => {
        setWalletPeakGlow(true);
        window.setTimeout(() => setWalletPeakGlow(false), 430);
        window.setTimeout(() => setWalletPulse(false), 560);
      });
    }, 2840);

    return () => {
      window.clearTimeout(lingerTimer);
      window.clearTimeout(countTimer);
    };
  }, [walletIncreaseSignal?.id, walletIncreaseSignal?.amount, animateWalletTo, user]);

  return (
    <div className="relative z-50 w-full h-14 border-b border-white/10 bg-neutral-900">
      <div className="max-w-6xl mx-auto h-full px-6 flex items-center justify-between">
        <div className="flex h-full items-stretch gap-6 text-sm text-neutral-300 min-w-0">
          {navLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              onMouseEnter={(event) => {
                const intensity = getIntensityFromPointer(event);
                setHoveredLink(link.to);
                setHoverIntensity((prev) => ({
                  ...prev,
                  [link.to]: intensity,
                }));
              }}
              onMouseMove={(event) => {
                const intensity = getIntensityFromPointer(event);
                setHoverIntensity((prev) => ({
                  ...prev,
                  [link.to]: intensity,
                }));
              }}
              onMouseLeave={() => {
                setHoveredLink((prev) => (prev === link.to ? null : prev));
                setHoverIntensity((prev) => ({ ...prev, [link.to]: 0 }));
              }}
              onFocus={() => {
                setHoveredLink(link.to);
                setHoverIntensity((prev) => ({ ...prev, [link.to]: 1 }));
              }}
              onBlur={() => {
                setHoveredLink((prev) => (prev === link.to ? null : prev));
                setHoverIntensity((prev) => ({ ...prev, [link.to]: 0 }));
              }}
              className={({ isActive }) =>
                [
                  "nav-interactive-link relative isolate inline-flex h-full items-center px-1",
                  linkBase,
                  isActive ? linkActiveGlow : linkInactive,
                ].join(" ")
              }
              style={({ isActive }) =>
                ({
                  "--eq-intensity": String(
                    hoveredLink === link.to
                      ? hoverIntensity[link.to] ?? 0
                      : isActive
                        ? 0.5
                        : 0,
                  ),
                }) as CSSProperties
              }
            >
              <span className="nav-interactive-link__baseline" aria-hidden="true" />
              <span className="nav-interactive-link__bars" aria-hidden="true">
                {Array.from({ length: 13 }).map((_, index) => (
                  <span
                    key={`${link.to}-bar-${index}`}
                    className="nav-interactive-link__bar"
                    style={
                      {
                        "--bar-index": index,
                      } as CSSProperties
                    }
                  />
                ))}
              </span>
              <span className="relative z-10">{link.label}</span>
            </NavLink>
          ))}
        </div>

        <div className="flex h-full items-stretch gap-3 text-sm text-neutral-300 min-w-0">
          {status === "loading" ? (
            <span className="text-neutral-400 self-center">Loading session...</span>
          ) : isSignedIn && user ? (
            <>
              <div className="flex items-center gap-1 min-w-0 h-full">
                <NavLink
                  to={`/profile/${encodeURIComponent(user.username)}`}
                  onMouseEnter={(event) => {
                    setProfileIntensity(getIntensityFromPointer(event));
                  }}
                  onMouseMove={(event) => {
                    setProfileIntensity(getIntensityFromPointer(event));
                  }}
                  onMouseLeave={() => {
                    setProfileIntensity(0);
                  }}
                  onFocus={() => {
                    setProfileIntensity(1);
                  }}
                  onBlur={() => {
                    setProfileIntensity(0);
                  }}
                  className="nav-interactive-link relative isolate inline-flex h-full items-center px-1 text-neutral-300 hover:text-white truncate"
                  style={{ "--eq-intensity": String(profileIntensity) } as CSSProperties}
                >
                  <span className="nav-interactive-link__baseline" aria-hidden="true" />
                  <span className="nav-interactive-link__bars" aria-hidden="true">
                    {Array.from({ length: 13 }).map((_, index) => (
                      <span
                        key={`profile-bar-${index}`}
                        className="nav-interactive-link__bar"
                        style={
                          {
                            "--bar-index": index,
                          } as CSSProperties
                        }
                      />
                    ))}
                  </span>
                  <span className="relative z-10">{user.displayName}</span>
                </NavLink>
                <span className="wallet-balance-wrap shrink-0">
                  {walletPopAmount ? (
                    <span
                      key={walletIncreaseSignal?.id}
                      className={`wallet-balance-float ${walletTravelUp ? "wallet-balance-float--travel" : "wallet-balance-float--linger"}`}
                    >
                      +{walletPopAmount}
                    </span>
                  ) : null}
                  <span
                    className={[
                      "wallet-balance-value",
                      walletPulse ? "wallet-balance-value--pulse" : "",
                      walletPeakGlow ? "wallet-balance-value--peak" : "",
                    ].join(" ")}
                  >
                    {animatedWallet}
                  </span>
                </span>
              </div>

              <img
                src={
                  user.avatarUrl ??
                  "https://avatars.fastly.steamstatic.com/dafbf49a3013de1a9528e06e796f49b8a8bdfef2_full.jpg"
                }
                alt="Profile avatar"
                className="self-center w-8 h-8 rounded-full object-cover border border-white/20 bg-white/10"
              />

              <button
                type="button"
                onClick={() => {
                  void signOut();
                }}
                className="self-center rounded-md border border-white/15 px-2 py-1 text-xs text-neutral-200 hover:text-white hover:border-white/30 transition"
              >
                Sign out
              </button>
            </>
          ) : (
            <NavLink
              to="/login"
              style={{ alignSelf: "center" }}
              className={({ isActive }) =>
                [
                  "rounded-md border px-3 py-1.5 text-xs transition",
                  isActive
                    ? "border-blue-400/50 bg-blue-500/20 text-blue-100"
                    : "border-white/15 text-neutral-200 hover:text-white hover:border-white/35",
                ].join(" ")
              }
            >
              Sign in
            </NavLink>
          )}
        </div>
      </div>
    </div>
  );
}