import { NavLink } from "react-router-dom";
import { useAuth } from "../context/useAuth";

export function TopNav() {
  const { user, status, isSignedIn, signOut } = useAuth();

  const linkBase = "hover:text-white cursor-pointer transition-colors";
  const linkInactive = "text-neutral-300";
  const linkActiveGlow =
    "text-white drop-shadow-[0_0_10px_rgba(59,130,246,0.45)]";

  return (
    <div className="relative z-50 w-full h-14 border-b border-white/10 bg-neutral-900">
      <div className="max-w-6xl mx-auto h-full px-6 flex items-center justify-between">
        <div className="flex items-center gap-6 text-sm text-neutral-300 min-w-0">
          <NavLink
            to="/play"
            className={({ isActive }) =>
              [linkBase, isActive ? linkActiveGlow : linkInactive].join(" ")
            }
          >
            Play
          </NavLink>

          <NavLink
            to="/collection"
            className={({ isActive }) =>
              [linkBase, isActive ? linkActiveGlow : linkInactive].join(" ")
            }
          >
            Collection
          </NavLink>

          <span className="opacity-50 cursor-not-allowed select-none">Market</span>

          <NavLink
            to="/"
            className={({ isActive }) =>
              [linkBase, isActive ? "text-white" : linkInactive].join(" ")
            }
          >
            Home
          </NavLink>
        </div>

        <div className="flex items-center gap-3 text-sm text-neutral-300 min-w-0">
          {status === "loading" ? (
            <span className="text-neutral-400">Loading session...</span>
          ) : isSignedIn && user ? (
            <>
              <div className="flex items-center gap-1 min-w-0">
                <span className="text-neutral-400 truncate">{user.displayName}</span>
                <span className="text-blue-400 font-medium shrink-0">{user.wallet}</span>
              </div>

              <img
                src={
                  user.avatarUrl ??
                  "https://avatars.fastly.steamstatic.com/dafbf49a3013de1a9528e06e796f49b8a8bdfef2_full.jpg"
                }
                alt="Profile avatar"
                className="w-8 h-8 rounded-full object-cover border border-white/20 bg-white/10"
              />

              <button
                type="button"
                onClick={() => {
                  void signOut();
                }}
                className="rounded-md border border-white/15 px-2 py-1 text-xs text-neutral-200 hover:text-white hover:border-white/30 transition"
              >
                Sign out
              </button>
            </>
          ) : (
            <NavLink
              to="/login"
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
