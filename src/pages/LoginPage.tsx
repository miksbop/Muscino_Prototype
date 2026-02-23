import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import GlassPanel from "../components/GlassPanel";
import { useAuth } from "../context/useAuth";

export function LoginPage() {
  const navigate = useNavigate();
  const { isSignedIn, signIn, signUp } = useAuth();

  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    try {
      setSubmitting(true);
      if (mode === "login") {
        await signIn({ username, password });
      } else {
        await signUp({ username, password });
      }
      navigate("/collection");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to process request");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="h-full overflow-y-auto muscino-scroll px-4 py-8 sm:px-6 md:px-8 lg:px-10">
      <div className="mx-auto w-full max-w-md">
        <GlassPanel className="rounded-3xl border border-white/15 bg-white/[0.03] p-6 sm:p-8">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight text-white">
              {mode === "login" ? "Sign in" : "Create account"}
            </h1>
            <p className="text-sm text-neutral-300">
              {mode === "login"
                ? "Sign in to access your collection across devices."
                : "Join Muscino to start collecting your favorite tracks."}
            </p>
          </div>

          {isSignedIn ? (
            <div className="mt-6 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">
              You are currently signed in.
            </div>
          ) : null}

          <form className="mt-6 space-y-4" onSubmit={onSubmit}>
            <label className="block text-sm text-neutral-200">
              Username
              <input
                className="mt-1 w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-white outline-none transition focus:border-blue-400/70"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                placeholder="your_username"
              />
            </label>

            <label className="block text-sm text-neutral-200">
              Password
              <input
                type="password"
                className="mt-1 w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-white outline-none transition focus:border-blue-400/70"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="••••••••"
              />
            </label>

            {error ? (
              <div className="rounded-xl border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl border border-blue-400/40 bg-blue-500/20 px-4 py-2.5 text-sm font-medium text-blue-100 transition hover:bg-blue-500/30 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting
                ? mode === "login"
                  ? "Signing in..."
                  : "Creating account..."
                : mode === "login"
                  ? "Sign in"
                  : "Create account"}
            </button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => setMode(mode === "login" ? "register" : "login")}
                className="text-xs text-neutral-400 hover:text-white transition"
              >
                {mode === "login"
                  ? "Don't have an account? Create one"
                  : "Already have an account? Sign in"}
              </button>
            </div>
          </form>
        </GlassPanel>
      </div>
    </div>
  );
}
