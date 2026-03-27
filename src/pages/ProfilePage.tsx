import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { LoadingSpinner } from "../components/LoadingSpinner";
import { SafeImage } from "../components/SafeImage";
import { useAuth } from "../context/useAuth";
import { api } from "../services/api";
import type { ProfileView } from "../types/profile";

const BASE_PROFILE_WIDTH = 1560;
const BASE_PROFILE_HEIGHT = 860;
const VIEWPORT_GUTTER_X = 112;
const VIEWPORT_GUTTER_Y = 112;

export function ProfilePage() {
  const { username = "" } = useParams();
  const { user } = useAuth();

  const [profile, setProfile] = useState<ProfileView | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await api.getProfile(username);
        if (!cancelled) setProfile(data);
      } catch (err) {
        if (!cancelled) {
          const message =
            err instanceof Error ? err.message : "Could not load profile.";
          setError(message || "Could not load profile.");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [username]);

  const isOwner = useMemo(
    () => !!profile && !!user && user.username === profile.username,
    [profile, user],
  );

  const [fitScale, setFitScale] = useState(1);

  useEffect(() => {
    const computeScale = () => {
      const navHeight = 56;

      const availableWidth = window.innerWidth - VIEWPORT_GUTTER_X;
      const availableHeight =
        window.innerHeight - navHeight - VIEWPORT_GUTTER_Y;

      const scaleX = availableWidth / BASE_PROFILE_WIDTH;
      const scaleY = availableHeight / BASE_PROFILE_HEIGHT;

      setFitScale(Math.min(scaleX, scaleY, 1));
    };

    computeScale();
    window.addEventListener("resize", computeScale);
    return () => window.removeEventListener("resize", computeScale);
  }, []);

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <LoadingSpinner label="Loading profile..." />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="h-full flex items-center justify-center px-6">
        <div className="rounded-xl border border-red-300/20 bg-red-950/30 p-6 text-sm text-red-200">
          {error ?? "Profile not found."}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full items-center justify-center overflow-hidden bg-neutral-950 px-8 py-8">
      <div
        style={{
          width: `${BASE_PROFILE_WIDTH * fitScale}px`,
          height: `${BASE_PROFILE_HEIGHT * fitScale}px`,
        }}
      >
        <div
          className="origin-top-left"
          style={{
            width: `${BASE_PROFILE_WIDTH}px`,
            height: `${BASE_PROFILE_HEIGHT}px`,
            transform: `scale(${fitScale})`,
          }}
        >
          <div className="h-full w-full rounded-2xl border border-white/10 bg-gradient-to-r from-neutral-700/70 via-neutral-800/80 to-neutral-700/70 p-8">
            <div className="mb-6 flex items-center justify-between">
              <h1 className="text-4xl font-light text-neutral-100">
                {profile.displayName}&apos;s Profile
              </h1>
              {isOwner ? (
                <button
                  type="button"
                  className="rounded-md border border-white/20 bg-white/5 px-4 py-2 text-sm text-neutral-100 hover:bg-white/10"
                >
                  Edit Profile
                </button>
              ) : null}
            </div>

            <div className="grid h-[calc(100%-4.5rem)] gap-6 lg:grid-cols-[1.05fr_0.9fr_2fr]">
              <section className="rounded-xl bg-neutral-900/35 p-4 min-h-0">
                <h2 className="mb-4 text-2xl text-neutral-100">
                  {profile.displayName}&apos;s Profile:
                </h2>
                <SafeImage
                  src={
                    profile.avatarUrl ??
                    "https://avatars.fastly.steamstatic.com/dafbf49a3013de1a9528e06e796f49b8a8bdfef2_full.jpg"
                  }
                  alt={`${profile.displayName} avatar`}
                  className="mb-4 h-[360px] w-full rounded-xl object-cover"
                />
                <div className="space-y-3 rounded-lg bg-white/5 p-4 text-[0.95rem] leading-snug text-neutral-200">
                  <p>Days Registered: {profile.daysRegistered}</p>
                  <p>Songs Collected: {profile.songsCollected}</p>
                  <p className="whitespace-pre-line">
                    Bio: {profile.bio || "No bio set yet."}
                  </p>
                </div>
              </section>

              <section className="rounded-xl bg-neutral-900/35 p-4 min-h-0">
                <h2 className="mb-4 text-2xl text-neutral-100">
                  Favorite Song:
                </h2>
                {profile.favoriteSong ? (
                  <div className="flex h-[calc(100%-3.5rem)] flex-col gap-3 text-[0.95rem] leading-snug text-neutral-200">
                    <SafeImage
                      src={profile.favoriteSong.coverUrl || ""}
                      alt={`${profile.favoriteSong.title} cover`}
                      className="h-[320px] w-full rounded-xl object-cover"
                    />
                    <p className="break-words leading-tight">
                      {profile.favoriteSong.title} -{" "}
                      {profile.favoriteSong.artist}
                    </p>
                    <p>Times Streamed: 500</p>
                    <p>
                      Found in Inventory? {profile.favoriteSong ? "✔" : "✖"}
                    </p>
                  </div>
                ) : (
                  <p className="text-neutral-400">No songs collected yet.</p>
                )}
              </section>

              <section className="rounded-xl bg-neutral-900/35 p-4 min-h-0">
                <h2 className="mb-4 text-2xl text-neutral-100">
                  Song Collection Showcase:
                </h2>
                <div className="grid h-[calc(100%-3.5rem)] grid-cols-5 gap-2 rounded-lg bg-black/30 p-3">
                  {Array.from({ length: 20 }).map((_, index) => {
                    const song = profile.showcaseSongs[index];
                    return song ? (
                      <Link key={song.id} to="/collection" className="block">
                        <SafeImage
                          src={song.coverUrl || ""}
                          alt={song.title}
                          className="aspect-square w-full rounded-md object-cover ring-1 ring-white/10"
                        />
                      </Link>
                    ) : (
                      <div
                        key={`empty-${index}`}
                        className="aspect-square rounded-md bg-black/35"
                      />
                    );
                  })}
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}