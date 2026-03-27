import { NavLink } from "react-router-dom";
import { useState } from "react";
import type { CSSProperties, MouseEvent } from "react";
import { useAuth } from "../context/useAuth";

export function TopNav() {
  const { user, status, isSignedIn, signOut } = useAuth();
  const [hoveredLink, setHoveredLink] = useState<string | null>(null);
  const [hoverIntensity, setHoverIntensity] = useState<Record<string, number>>(
    {},
  );
  const [profileIntensity, setProfileIntensity] = useState(0);

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
                <span className="text-blue-400 font-medium shrink-0">{user.wallet}</span>
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