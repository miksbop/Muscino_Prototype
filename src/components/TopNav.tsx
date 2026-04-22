import { Link, NavLink } from "react-router-dom";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, MouseEvent } from "react";
import { useAuth } from "../context/useAuth";
import { MarqueeText } from "./MarqueeText";
import { api } from "../services/api";
import type { FriendRequest, FriendUser } from "../types/friends";

const fallbackAvatar =
  "https://avatars.fastly.steamstatic.com/dafbf49a3013de1a9528e06e796f49b8a8bdfef2_full.jpg";

export function TopNav() {
  const { user, status, isSignedIn, signOut, refreshUser, walletIncreaseSignal, xpGainSignal } = useAuth();
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
  const [xpGainAmount, setXpGainAmount] = useState<number | null>(null);
  const [xpTravelUp, setXpTravelUp] = useState(false);
  const [xpProgressPulse, setXpProgressPulse] = useState(false);
  const [xpOverlayVisible, setXpOverlayVisible] = useState(false);
  const [xpDisplayProgress, setXpDisplayProgress] = useState(0);
  const walletAnimationFrameRef = useRef<number | null>(null);
  const xpCountAnimationFrameRef = useRef<number | null>(null);
  const levelUpAudioRef = useRef<HTMLAudioElement | null>(null);
  const lastHandledXpSignalIdRef = useRef<number | null>(null);
  const animatedWalletRef = useRef<number>(user?.wallet ?? 0);
  const previousWalletRef = useRef<number>(user?.wallet ?? 0);
  const walletDisplayStorageKey = "muscino:last-displayed-wallet-by-user";
  const xpProgressPercent = Math.max(
    0,
    Math.min(
      1,
      user && user.xpToNextLevel > 0 ? user.xp / user.xpToNextLevel : 0,
    ),
  );
  const effectiveXpProgress = Math.max(
    0,
    Math.min(1, xpOverlayVisible ? xpDisplayProgress : xpProgressPercent),
  );

  const [isFriendsOpen, setIsFriendsOpen] = useState(false);
  const [isRequestsExpanded, setIsRequestsExpanded] = useState(false);
  const [friends, setFriends] = useState<FriendUser[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [friendSearchQuery, setFriendSearchQuery] = useState("");
  const [friendSearchResults, setFriendSearchResults] = useState<FriendUser[]>([]);
  const [isSearchingFriends, setIsSearchingFriends] = useState(false);
  const [friendSearchMessage, setFriendSearchMessage] = useState<string | null>(null);
  const [isSendingSearchRequest, setIsSendingSearchRequest] = useState<string | null>(null);
  const friendSearchContainerRef = useRef<HTMLDivElement | null>(null);

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
      previousWalletRef.current = 0;
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
    previousWalletRef.current = user.wallet;
    setAnimatedWallet(nextDisplay);
  }, [user?.id, walletIncreaseSignal?.id, walletIncreaseSignal?.amount, getStoredDisplayedWallet]);


  useEffect(() => {
    if (!user) return;

    const previousWallet = previousWalletRef.current;
    if (user.wallet < previousWallet) {
      setWalletPopAmount(null);
      setWalletTravelUp(false);
      setWalletPulse(false);
      setWalletPeakGlow(false);
    }

    previousWalletRef.current = user.wallet;
  }, [user?.id, user?.wallet]);

  useEffect(() => {
    return () => {
      if (walletAnimationFrameRef.current) {
        cancelAnimationFrame(walletAnimationFrameRef.current);
      }
      if (xpCountAnimationFrameRef.current) {
        cancelAnimationFrame(xpCountAnimationFrameRef.current);
      }
      if (levelUpAudioRef.current) {
        levelUpAudioRef.current.pause();
        levelUpAudioRef.current = null;
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

  useEffect(() => {
    if (!xpGainSignal?.amount) return;
    if (lastHandledXpSignalIdRef.current === xpGainSignal.id) return;
    lastHandledXpSignalIdRef.current = xpGainSignal.id;

    if (xpGainSignal.leveledUp) {
      const levelUpAudio = levelUpAudioRef.current ?? new Audio("/sounds/level.mp3");
      levelUpAudioRef.current = levelUpAudio;
      levelUpAudio.currentTime = 0;
      void levelUpAudio.play().catch(() => {
        // ignored: browser autoplay restrictions / missing file
      });
    }

    const fromProgress = Math.max(0, Math.min(1, xpGainSignal.fromProgress ?? xpProgressPercent));
    const toProgress = Math.max(0, Math.min(1, xpGainSignal.toProgress ?? xpProgressPercent));
    setXpGainAmount(null);
    setXpTravelUp(false);
    setXpProgressPulse(true);
    setXpOverlayVisible(true);
    setXpDisplayProgress(fromProgress);

    const jumpTimer = window.setTimeout(() => {
      if (xpGainSignal.leveledUp) {
        setXpDisplayProgress(1);
        window.setTimeout(() => {
          setXpDisplayProgress(toProgress);
        }, 220);
        return;
      }

      setXpDisplayProgress(toProgress);
    }, 120);

    const progressSettleMs = xpGainSignal.leveledUp ? 660 : 440;
    const floatAppearDelayMs = progressSettleMs + 40;
    const countUpDurationMs = 620;
    const lingerAfterCountMs = 1000;
    const floatTravelDelayMs = floatAppearDelayMs + countUpDurationMs + lingerAfterCountMs;
    const clearDelayMs = floatTravelDelayMs + 760;

    const floatAppearTimer = window.setTimeout(() => {
      const targetAmount = Math.max(1, Math.trunc(xpGainSignal.amount));
      setXpGainAmount(1);
      setXpTravelUp(false);
      const countStartAt = performance.now();
      const countStep = (now: number) => {
        const progress = Math.min(1, (now - countStartAt) / countUpDurationMs);
        const nextAmount = Math.max(1, Math.round(1 + (targetAmount - 1) * progress));
        setXpGainAmount(nextAmount);
        if (progress < 1) {
          xpCountAnimationFrameRef.current = window.requestAnimationFrame(countStep);
          return;
        }
        xpCountAnimationFrameRef.current = null;
      };
      xpCountAnimationFrameRef.current = window.requestAnimationFrame(countStep);
    }, floatAppearDelayMs);


    const travelTimer = window.setTimeout(() => {
      setXpTravelUp(true);
    }, floatTravelDelayMs);
    const clearTimer = window.setTimeout(() => {
      setXpGainAmount(null);
      setXpTravelUp(false);
      setXpProgressPulse(false);
      setXpOverlayVisible(false);
      setXpDisplayProgress(toProgress);
    }, clearDelayMs);

    return () => {
      window.clearTimeout(jumpTimer);
      window.clearTimeout(floatAppearTimer);
      window.clearTimeout(travelTimer);
      window.clearTimeout(clearTimer);
      if (xpCountAnimationFrameRef.current) {
        window.cancelAnimationFrame(xpCountAnimationFrameRef.current);
        xpCountAnimationFrameRef.current = null;
      }
    };
  }, [xpGainSignal?.id, xpGainSignal?.amount, xpGainSignal?.fromProgress, xpGainSignal?.toProgress, xpGainSignal?.leveledUp, xpProgressPercent]);

  useEffect(() => {
    if (!isSignedIn || !isFriendsOpen) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await api.getFriendsOverview();
        if (cancelled) return;
        setFriends(data.friends);
        setFriendRequests(data.incomingRequests);
      } catch {
        if (cancelled) return;
        setFriends([]);
        setFriendRequests([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isSignedIn, isFriendsOpen]);

  useEffect(() => {
    if (!isSignedIn || !isFriendsOpen) return;
    const query = friendSearchQuery.trim();
    if (query.length < 2) {
      setFriendSearchResults([]);
      setFriendSearchMessage(null);
      setIsSearchingFriends(false);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      setIsSearchingFriends(true);
      setFriendSearchMessage(null);
      void api
        .searchFriendProfiles(query)
        .then((results) => {
          if (cancelled) return;
          setFriendSearchResults(results);
          if (results.length === 0) {
            setFriendSearchMessage("No profiles found.");
          }
        })
        .catch((error) => {
          if (cancelled) return;
          setFriendSearchResults([]);
          setFriendSearchMessage(error instanceof Error ? error.message : "Could not search profiles.");
        })
        .finally(() => {
          if (cancelled) return;
          setIsSearchingFriends(false);
        });
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [friendSearchQuery, isFriendsOpen, isSignedIn]);

  const handleAcceptRequest = async (requestId: number) => {
    const data = await api.acceptFriendRequest(requestId);
    setFriends(data.friends);
    setFriendRequests(data.incomingRequests);
  };

  const handleDenyRequest = async (requestId: number) => {
    const data = await api.denyFriendRequest(requestId);
    setFriends(data.friends);
    setFriendRequests(data.incomingRequests);
  };

  const handleSendRequestFromSearch = async (username: string) => {
    setIsSendingSearchRequest(username);
    setFriendSearchMessage(null);
    try {
      const data = await api.sendFriendRequest(username);
      setFriends(data.friends);
      setFriendRequests(data.incomingRequests);
      setFriendSearchResults((prev) => prev.filter((candidate) => candidate.username !== username));
      setFriendSearchMessage(`Friend request sent to @${username}.`);
    } catch (error) {
      setFriendSearchMessage(error instanceof Error ? error.message : "Could not send friend request.");
    } finally {
      setIsSendingSearchRequest(null);
    }
  };

    const resetFriendSearch = useCallback(() => {
    setFriendSearchQuery("");
    setFriendSearchResults([]);
    setFriendSearchMessage(null);
    setIsSearchingFriends(false);
    setIsSendingSearchRequest(null);
  }, []);

  const closeFriendsPanel = useCallback(() => {
    setIsFriendsOpen(false);
    setIsRequestsExpanded(false);
  }, []);

  useEffect(() => {
    if (!isFriendsOpen) return;

    const handleClickOutsideSearch = (event: globalThis.MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;

      const clickedInsideSearch = !!friendSearchContainerRef.current?.contains(target);
      const selectedSearchProfile = !!target.closest("[data-friend-search-select='true']");
      if (clickedInsideSearch || selectedSearchProfile) return;
      resetFriendSearch();
    };

    document.addEventListener("mousedown", handleClickOutsideSearch);
    return () => {
      document.removeEventListener("mousedown", handleClickOutsideSearch);
    };
  }, [isFriendsOpen, resetFriendSearch]);

    const handleWalletClick = async () => {
    try {
      await api.addTestGold();
      await refreshUser();
    } catch {
      // no-op for temporary test helper
    }
  };


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
              <div className="flex items-center min-w-0 h-full">
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
                    <button
                    type="button"
                    onClick={() => void handleWalletClick()}
                    className={[
                      "wallet-balance-value",
                      walletPulse ? "wallet-balance-value--pulse" : "",
                      walletPeakGlow ? "wallet-balance-value--peak" : "",
                    ].join(" ")}
                    title="Add 100 gold (test)"
                  >
                    {animatedWallet}
                  </button>
                </span>
              </div>

              <NavLink
                to={`/profile/${encodeURIComponent(user.username)}`}
                className="self-center"
                aria-label="Open my profile"
                title="My profile"
              >
                <img
                  src={
                    user.avatarUrl ??
                    fallbackAvatar
                  }
                  alt="Profile avatar"
                  className="w-8 h-8 rounded-full object-cover border border-white/20 bg-white/10"
                />
              </NavLink>

              <button
                type="button"
                onClick={() => {
                  setIsFriendsOpen((prev) => {
                    const next = !prev;
                    if (!next) {
                      setIsRequestsExpanded(false);
                      resetFriendSearch();
                    }
                    return next;
                  });
                }}
                className={[
                  "friends-toggle-button self-center rounded-md border px-2.5 py-1.5 text-xs font-medium transition",
                  isFriendsOpen
                    ? "border-sky-300/50 bg-sky-500/10 text-sky-100"
                    : "border-white/15 text-neutral-200 hover:text-white hover:border-white/30",
                ].join(" ")}
                aria-expanded={isFriendsOpen}
                aria-controls="friends-panel"
                aria-label="Friends"
                title="Friends"
              >
                <img src="/icons/friends.png" alt="" className="h-4 w-4 object-contain" aria-hidden="true" />
              </button>

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
      <div className={`nav-xp-overlay ${xpOverlayVisible ? "is-visible" : ""}`} aria-hidden="true">
        <div className="nav-xp-overlay__track" />
        <div
          className={[
            "nav-xp-overlay__fill",
            xpProgressPulse ? "nav-xp-overlay__fill--pulse" : "",
          ].join(" ")}
          style={{ width: `${(effectiveXpProgress * 100).toFixed(2)}%` }}
        />
        <div
          className={[
            "nav-xp-overlay__cursor",
            xpProgressPulse ? "nav-xp-overlay__cursor--pulse" : "",
          ].join(" ")}
          style={{ left: `${(effectiveXpProgress * 100).toFixed(2)}%` }}
        />
        {xpGainAmount ? (
          <div
            className={`nav-xp-overlay__float ${xpTravelUp ? "nav-xp-overlay__float--travel" : "nav-xp-overlay__float--linger"}`}
            style={{ left: `${(effectiveXpProgress * 100).toFixed(2)}%` }}
          >
            +{xpGainAmount}xp
          </div>
        ) : null}
      </div>

      <aside
        id="friends-panel"
        className={`friends-panel ${isFriendsOpen ? "friends-panel--open" : ""}`}
        aria-hidden={!isFriendsOpen}
      >
        <div className="friends-panel__header">
          <span>Friends</span>
          <div className="friends-search" ref={friendSearchContainerRef}>
            <input
              type="text"
              value={friendSearchQuery}
              onChange={(event) => setFriendSearchQuery(event.target.value)}
              className="friends-search__input"
              placeholder="Search profiles"
              aria-label="Search profiles"
              autoComplete="off"
            />
            {(isSearchingFriends || friendSearchQuery.trim().length >= 2) ? (
              <div className="friends-search__dropdown" role="listbox" aria-label="Profile search results">
                {isSearchingFriends ? <p className="friends-search__status">Searching…</p> : null}
                {!isSearchingFriends && friendSearchMessage ? (
                  <p className="friends-search__status">{friendSearchMessage}</p>
                ) : null}
                {!isSearchingFriends &&
                  !friendSearchMessage &&
                  friendSearchResults.map((candidate) => (
                    <div key={candidate.id} className="friends-search__item">
                      <Link
                        to={`/profile/${encodeURIComponent(candidate.username)}`}
                        className="friends-search__profile"
                        data-friend-search-select="true"
                        onClick={closeFriendsPanel}
                      >
                        <img
                          src={candidate.avatarUrl ?? fallbackAvatar}
                          alt={`${candidate.displayName} avatar`}
                          className="friends-search__avatar"
                        />
                        <span>
                          {candidate.displayName}
                          <small>@{candidate.username}</small>
                        </span>
                      </Link>
                      <button
                        type="button"
                        className="friends-search__add"
                        onClick={() => void handleSendRequestFromSearch(candidate.username)}
                        disabled={isSendingSearchRequest === candidate.username}
                      >
                        {isSendingSearchRequest === candidate.username ? "Sending..." : "Add"}
                      </button>
                    </div>
                  ))}
              </div>
            ) : null}
          </div>
        </div>
        <div className="friends-panel__list" role="list" aria-label="Friends list">
          {friends.map((friend, index) => (
            <article
              key={friend.id}
              className={`friends-card ${isFriendsOpen ? "friends-card--open" : ""}`}
              style={{ "--friend-index": String(index) } as CSSProperties}
              role="listitem"
            >
              <Link
                to={`/profile/${encodeURIComponent(friend.username)}`}
                className="friends-card__main"
                onClick={closeFriendsPanel}
              >
                <div className="friends-card__row">
                  <div className="friends-card__meta">
                    <p className="friends-card__name">{friend.displayName}</p>
                    <MarqueeText
                      text={friend.bio}
                      className="friends-card__bio"
                      speedPxPerSec={26}
                      delayMs={700}
                    />
                  </div>
                  <span className="friends-card__wallet">{friend.wallet}</span>
                  <img src={friend.avatarUrl ?? fallbackAvatar} alt={`${friend.displayName} avatar`} className="friends-card__avatar" />
                </div>
              </Link>
            </article>
          ))}
        </div>

        <div className="friends-panel__footer">
          <button
            type="button"
            onClick={() => setIsRequestsExpanded((prev) => !prev)}
            className="friends-requests-toggle"
            aria-expanded={isRequestsExpanded}
          >
            Friend Requests
            <span className="friends-requests-toggle__badge">{friendRequests.length}</span>
          </button>

          <div
            className={`friends-requests-panel ${isRequestsExpanded ? "friends-requests-panel--open" : ""}`}
          >
            {friendRequests.length === 0 ? (
              <p className="friends-requests-empty">No pending requests.</p>
            ) : (
              friendRequests.map((request) => (
                <div key={request.id} className="friends-requests-card">
                  <Link
                    to={`/profile/${encodeURIComponent(request.fromUser.username)}`}
                    className="friends-requests-card__profile"
                    onClick={closeFriendsPanel}
                  >
                    <img src={request.fromUser.avatarUrl ?? fallbackAvatar} alt={`${request.fromUser.displayName} avatar`} className="friends-requests-card__avatar" />
                    <div className="friends-requests-card__meta">
                      <p>{request.fromUser.displayName}</p>
                      <span>@{request.fromUser.username}</span>
                    </div>
                  </Link>
                  <div className="friends-requests-card__actions">
                    <button type="button" onClick={() => void handleAcceptRequest(request.id)}>Accept</button>
                    <button type="button" onClick={() => void handleDenyRequest(request.id)}>Deny</button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}