import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, ChangeEvent, FormEvent } from "react";
import { Link, useParams } from "react-router-dom";

import { LoadingSpinner } from "../components/LoadingSpinner";
import { SafeImage } from "../components/SafeImage";
import { useAuth } from "../context/useAuth";
import { api, type ProfileBackgroundOption } from "../services/api";
import { playSongPreview, stopSongPreview } from "../services/songPreview";
import { rarityRgb } from "../types/rarity";
import type { ProfileView } from "../types/profile";

const BASE_PROFILE_WIDTH = 1560;
const BASE_PROFILE_HEIGHT = 860;
const VIEWPORT_GUTTER_X = 112;
const VIEWPORT_GUTTER_Y = 112;
const MAX_PROFILE_AVATAR_BYTES = 5 * 1024 * 1024;
const PROFILE_PREVIEW_VOLUME = 0.3;
const PROFILE_PREVIEW_FADE_IN_MS = 1600;

function hexToRgb(hexColor: string): { r: number; g: number; b: number } {
  const normalized = hexColor.replace("#", "").slice(0, 6);
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  };
}

export function ProfilePage() {
  const { username = "" } = useParams();
  const { user, refreshUser } = useAuth();

  const [profile, setProfile] = useState<ProfileView | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [editBio, setEditBio] = useState("");
  const [editThemeColor, setEditThemeColor] = useState("#737373");
  const [editAvatarFile, setEditAvatarFile] = useState<File | null>(null);
  const [editAvatarPreviewUrl, setEditAvatarPreviewUrl] = useState<string | null>(null);
  const [editFavoriteSongId, setEditFavoriteSongId] = useState("");
  const [editInventorySongs, setEditInventorySongs] = useState<ProfileView["showcaseSongs"]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [backgroundOptions, setBackgroundOptions] = useState<ProfileBackgroundOption[]>([]);
  const [isLoadingBackgroundOptions, setIsLoadingBackgroundOptions] = useState(false);
  const [editProfileBackground, setEditProfileBackground] = useState("");
  const [editProfileBackgroundOpacity, setEditProfileBackgroundOpacity] = useState(1);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSendingFriendRequest, setIsSendingFriendRequest] = useState(false);
  const [friendRequestMessage, setFriendRequestMessage] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (editAvatarPreviewUrl) {
        URL.revokeObjectURL(editAvatarPreviewUrl);
      }
    };
  }, [editAvatarPreviewUrl]);

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

      useEffect(() => {
    if (!profile?.favoriteSong) {
      stopSongPreview();
      return;
    }

    void playSongPreview(profile.favoriteSong, {
      fadeInMs: PROFILE_PREVIEW_FADE_IN_MS,
      volume: PROFILE_PREVIEW_VOLUME,
    });

    return () => {
      stopSongPreview();
    };
  }, [profile?.favoriteSong]);



  const isOwner = useMemo(
    () => !!profile && !!user && user.username === profile.username,
    [profile, user],
  );

  const activeThemeColor = profile?.themeColor || "#737373";
  const themeRgb = useMemo(() => hexToRgb(activeThemeColor), [activeThemeColor]);
  const profileCardOpacity = useMemo(
    () => Math.max(0.5, Math.min(profile?.profileBackgroundOpacity ?? 1, 1)),
    [profile?.profileBackgroundOpacity],
  );

  const profileShellStyle = useMemo(
    () => ({
            background: `linear-gradient(90deg, rgba(${themeRgb.r},${themeRgb.g},${themeRgb.b},${profileCardOpacity}) 0%, rgba(${Math.max(themeRgb.r - 60, 0)},${Math.max(themeRgb.g - 60, 0)},${Math.max(themeRgb.b - 60, 0)},${profileCardOpacity}) 45%, rgba(${themeRgb.r},${themeRgb.g},${themeRgb.b},${profileCardOpacity}) 100%)`,
      borderColor: `rgb(${themeRgb.r},${themeRgb.g},${themeRgb.b})`,
      boxShadow: `inset 0 0 0 1px rgba(0,0,0,0.25)`,
    }),
    [profileCardOpacity, themeRgb],
  );

  const paneStyle = useMemo(
    () => ({
      background: `rgba(${Math.max(themeRgb.r - 38, 0)},${Math.max(themeRgb.g - 38, 0)},${Math.max(themeRgb.b - 38, 0)},${profileCardOpacity})`,
      border: `1px solid rgb(${Math.max(themeRgb.r - 20, 0)},${Math.max(themeRgb.g - 20, 0)},${Math.max(themeRgb.b - 20, 0)})`,
    }),
    [profileCardOpacity, themeRgb],
  );

  const pageBackgroundStyle = useMemo(() => {
    if (!profile?.profileBackgroundUrl) return undefined;
    return {
      backgroundImage: `url(${profile.profileBackgroundUrl})`,
      backgroundSize: "cover",
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat",
    } as CSSProperties;
  }, [profile?.profileBackgroundUrl]);

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

  const openEditModal = () => {
    if (!profile) return;
    setEditBio(profile.bio || "");
    setEditThemeColor(profile.themeColor || "#737373");
    setEditFavoriteSongId(profile.favoriteSong?.songId || "");
    setEditProfileBackground(profile.profileBackground || "");
    setEditProfileBackgroundOpacity(Math.max(0.5, Math.min(profile.profileBackgroundOpacity ?? 1, 1)));
    setEditInventorySongs(profile.showcaseSongs);
    setEditAvatarFile(null);
    if (editAvatarPreviewUrl) URL.revokeObjectURL(editAvatarPreviewUrl);
    setEditAvatarPreviewUrl(null);
    setSaveError(null);
    setIsEditing(true);
  };

  useEffect(() => {
    let cancelled = false;
    if (!isEditing || !profile || !isOwner) return;

    (async () => {
      try {
        const songs = await api.getInventoryByOwner(profile.username);
        if (!cancelled) setEditInventorySongs(songs);
      } catch {
        if (!cancelled) setEditInventorySongs(profile.showcaseSongs);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isEditing, isOwner, profile]);

  useEffect(() => {
    let cancelled = false;
    if (!isEditing || !isOwner) return;

    (async () => {
      setIsLoadingBackgroundOptions(true);
      try {
        const options = await api.getProfileBackgroundOptions();
        if (!cancelled) setBackgroundOptions(options);
      } catch {
        if (!cancelled) setBackgroundOptions([]);
      } finally {
        if (!cancelled) setIsLoadingBackgroundOptions(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isEditing, isOwner]);

  const onAvatarChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) {
      setEditAvatarFile(null);
      setEditAvatarPreviewUrl(null);
      return;
    }

    if (file.size > MAX_PROFILE_AVATAR_BYTES) {
      setSaveError("Profile pictures must be 5MB or less.");
      event.target.value = "";
      return;
    }

    if (!file.type.startsWith("image/")) {
      setSaveError("Please choose a valid image file.");
      event.target.value = "";
      return;
    }

    setSaveError(null);
    setEditAvatarFile(file);
    if (editAvatarPreviewUrl) URL.revokeObjectURL(editAvatarPreviewUrl);
    setEditAvatarPreviewUrl(URL.createObjectURL(file));
  };

  const onSubmitEdit = async (event: FormEvent) => {
    event.preventDefault();
    if (!profile) return;

    setIsSaving(true);
    setSaveError(null);
    try {
      const updated = await api.updateProfile(profile.username, {
        bio: editBio,
        themeColor: editThemeColor,
        favoriteSongId: editFavoriteSongId,
        avatarFile: editAvatarFile,
        profileBackground: editProfileBackground,
        profileBackgroundOpacity: editProfileBackgroundOpacity,
      });
      setProfile(updated);
      await refreshUser();
      setIsEditing(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Could not update profile.");
    } finally {
      setIsSaving(false);
    }
  };

  

  const onAddFriend = async () => {
    if (!profile) return;
    setIsSendingFriendRequest(true);
    setFriendRequestMessage(null);
    try {
      await api.sendFriendRequest(profile.username);
      setFriendRequestMessage("Friend request sent.");
    } catch (err) {
      setFriendRequestMessage(err instanceof Error ? err.message : "Could not send friend request.");
    } finally {
      setIsSendingFriendRequest(false);
    }
  };


  const favoriteSongOptions = useMemo(() => {
    if (!profile) return [];

    const bySongId = new Map<string, { songId: string; label: string; count: number }>();
    for (const song of editInventorySongs) {
      const existing = bySongId.get(song.songId);
      if (existing) {
        existing.count += 1;
        continue;
      }

      bySongId.set(song.songId, {
        songId: song.songId,
        label: `${song.title} — ${song.artist}`,
        count: 1,
      });
    }

    const favoriteSong = profile.favoriteSong;
    if (favoriteSong && !bySongId.has(favoriteSong.songId)) {
      bySongId.set(favoriteSong.songId, {
        songId: favoriteSong.songId,
        label: `${favoriteSong.title} — ${favoriteSong.artist}`,
        count: profile.favoriteSongInventoryCount,
      });
    }

    return Array.from(bySongId.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [editInventorySongs, profile]);

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

  const currentAvatarSrc =
    editAvatarPreviewUrl ||
    profile.avatarUrl ||
    "https://avatars.fastly.steamstatic.com/dafbf49a3013de1a9528e06e796f49b8a8bdfef2_full.jpg";

  return (
    <div className="flex h-full items-center justify-center overflow-hidden bg-neutral-950 px-8 py-8" style={pageBackgroundStyle}>
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
          <div
            className="profile-shell-animated h-full w-full rounded-2xl border p-8"
            style={{
              ...profileShellStyle,
              ["--profile-theme-rgb" as const]: `${themeRgb.r} ${themeRgb.g} ${themeRgb.b}`,
            } as CSSProperties}
          >
            <div className="mb-6 flex items-center justify-between">
              <h1 className="text-4xl font-light text-neutral-100">
                {profile.displayName}&apos;s Profile
              </h1>
              {isOwner ? (
                <button
                  type="button"
                  onClick={openEditModal}
                  className="rounded-md border border-white/20 bg-white/5 px-4 py-2 text-sm text-neutral-100 hover:bg-white/10"
                >
                  Edit Profile
                </button>
              ) : (
                <div className="flex flex-col items-end gap-2">
                  <button
                    type="button"
                    onClick={() => { void onAddFriend(); }}
                    disabled={isSendingFriendRequest}
                    className="rounded-md border border-sky-300/30 bg-sky-500/10 px-4 py-2 text-sm text-sky-100 hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSendingFriendRequest ? "Sending..." : "Add Friend"}
                  </button>
                  {friendRequestMessage ? (
                    <p className="text-xs text-sky-100/85">{friendRequestMessage}</p>
                  ) : null}
                </div>
              )}
            </div>

            <div className="grid h-[calc(100%-4.5rem)] gap-6 lg:grid-cols-[1.05fr_0.9fr_2fr]">
              <section className="rounded-xl p-4 min-h-0" style={paneStyle as CSSProperties}>
                <div
                  className="profile-level-block mb-4"
                  style={{ ["--level-glow" as const]: String(Math.min(Math.max(profile.level, 1), 5) / 5) } as CSSProperties}
                >
                  <h2 className="profile-level-display">Level: {profile.level}</h2>
                  <div className="profile-level-xp-wrap" aria-label={`XP ${profile.xp} of ${profile.xpToNextLevel}`}>
                    <div
                      className="profile-level-xp-fill"
                      style={{ width: `${Math.min(100, Math.max(0, (profile.xp / Math.max(1, profile.xpToNextLevel)) * 100))}%` }}
                    />
                  </div>
                  <p className="profile-level-xp-text">
                    XP: {profile.xp} / {profile.xpToNextLevel}
                  </p>
                </div>
                <SafeImage
                  src={
                    profile.avatarUrl ??
                    "https://avatars.fastly.steamstatic.com/dafbf49a3013de1a9528e06e796f49b8a8bdfef2_full.jpg"
                  }
                  alt={`${profile.displayName} avatar`}
                  className="mb-4 h-[360px] w-full rounded-xl object-cover"
                />
                <div className="space-y-3 rounded-lg bg-white/5 p-4 text-[0.95rem] leading-snug text-neutral-200">
                    {/* <MyComponent /><p>Days Registered: {profile.daysRegistered}</p>
                  <p>Songs Collected: {profile.songsCollected}</p>
                  <p className="whitespace-pre-line">
                    Bio: {profile.bio || "No bio set yet."}
                    
                  </p>
                   */}
                                     <p className="whitespace-pre-line">
                    {profile.bio || "No bio set yet."}
                    
                  </p>
                </div>
              </section>

              <section className="rounded-xl p-4 min-h-0" style={paneStyle as CSSProperties}>
                <h2 className="mb-4 text-2xl text-neutral-100">
                  Favorite Song:
                </h2>
                {profile.favoriteSong ? (
                  <div className="flex h-[calc(100%-3.5rem)] flex-col gap-3 text-[0.95rem] leading-snug text-neutral-200">
                    <SafeImage
                      src={profile.favoriteSong.coverUrl || ""}
                      alt={`${profile.favoriteSong.title} cover`}
                      className="rarity-thin-border h-[320px] w-full rounded-xl object-cover"
                      style={{ ["--rarity-rgb" as const]: rarityRgb(profile.favoriteSong.rarity) } as CSSProperties}
                    />
                    <p className="break-words leading-tight">
                      {profile.favoriteSong.title} -{" "}
                      {profile.favoriteSong.artist}
                    </p>
                    <p>In Inventory: {profile.favoriteSongInventoryCount}</p>
                    <p>
                      Found in Inventory? {profile.favoriteSong ? "✔" : "✖"}
                    </p>
                  </div>
                ) : (
                  <p className="text-neutral-400">No songs collected yet.</p>
                )}
              </section>

              <section className="rounded-xl p-4 min-h-0" style={paneStyle as CSSProperties}>
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
                          className="rarity-thin-border aspect-square w-full rounded-md object-cover"
                          style={{ ["--rarity-rgb" as const]: rarityRgb(song.rarity) } as CSSProperties}
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

      {isEditing ? (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 p-4">
          <form
            onSubmit={onSubmitEdit}
            className="profile-subtle-scrollbar w-full max-w-2xl max-h-[calc(100vh-5rem)] overflow-y-auto rounded-xl border border-white/20 bg-neutral-900 p-6 text-neutral-100 shadow-2xl"
          >
            <h2 className="mb-4 text-2xl font-medium">Edit Profile</h2>

            <label className="mb-3 block text-sm font-medium" htmlFor="profile-bio-input">
              Bio
            </label>
            <textarea
              id="profile-bio-input"
              value={editBio}
              onChange={(e) => setEditBio(e.target.value)}
              maxLength={600}
              rows={4}
              className="mb-4 w-full rounded-md border border-white/20 bg-black/30 p-3 text-sm outline-none focus:border-white/40"
            />

            <label className="mb-2 block text-sm font-medium" htmlFor="profile-avatar-input">
              Profile picture (max 5MB)
            </label>
            <input
              id="profile-avatar-input"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={onAvatarChange}
              className="mb-3 block w-full text-sm text-neutral-200"
            />
            <SafeImage
              src={currentAvatarSrc}
              alt="Avatar preview"
              className="mb-5 h-36 w-36 rounded-full object-cover border border-white/20"
            />

            <label className="mb-2 block text-sm font-medium" htmlFor="profile-theme-input">
              Profile color scheme
            </label>
            <div className="mb-5 flex items-center gap-3">
              <input
                id="profile-theme-input"
                type="color"
                value={editThemeColor}
                onChange={(e) => setEditThemeColor(e.target.value)}
                className="h-11 w-16 cursor-pointer rounded-md border border-white/20 bg-transparent"
              />
              <span className="text-sm text-neutral-300">{editThemeColor}</span>
            </div>

            <label className="mb-2 block text-sm font-medium" htmlFor="profile-favorite-song-input">
              Favorite song
            </label>
            <select
              id="profile-favorite-song-input"
              value={editFavoriteSongId}
              onChange={(e) => setEditFavoriteSongId(e.target.value)}
              className="mb-5 w-full rounded-md border border-white/20 bg-black/30 p-3 text-sm outline-none focus:border-white/40"
            >
              <option value="">No favorite song</option>
              {favoriteSongOptions.map((song) => (
                <option key={song.songId} value={song.songId}>
                  {song.label} (Owned: {song.count})
                </option>
              ))}
            </select>

            <label className="mb-2 block text-sm font-medium">Change background</label>
            {isLoadingBackgroundOptions ? (
              <p className="mb-4 text-sm text-neutral-300">Loading available backgrounds...</p>
            ) : backgroundOptions.length > 0 ? (
              <div className="mb-5 grid max-h-56 grid-cols-3 gap-3 overflow-y-auto rounded-md border border-white/15 bg-black/20 p-3">
                <button
                  type="button"
                  onClick={() => setEditProfileBackground("")}
                  className={`rounded-md border p-2 text-xs transition ${
                    editProfileBackground === ""
                      ? "border-emerald-300/80 bg-emerald-500/20 text-emerald-100"
                      : "border-white/20 bg-black/30 text-neutral-200 hover:bg-white/10"
                  }`}
                >
                  Default
                </button>
                {backgroundOptions.map((background) => (
                  <button
                    key={background.filename}
                    type="button"
                    onClick={() => setEditProfileBackground(background.filename)}
                    className={`rounded-md border p-1 transition ${
                      editProfileBackground === background.filename
                        ? "border-emerald-300/80 bg-emerald-500/20"
                        : "border-white/20 bg-black/30 hover:bg-white/10"
                    }`}
                    title={background.filename}
                  >
                    {background.url ? (
                      <SafeImage
                        src={background.url}
                        alt={background.filename}
                        className="h-16 w-full rounded object-cover"
                      />
                    ) : (
                      <div className="flex h-16 items-center justify-center rounded bg-black/40 text-xs text-neutral-300">
                        {background.filename}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <p className="mb-4 text-sm text-neutral-400">
                No background files found in <code>/public/backgrounds</code>.
              </p>
            )}

            <label className="mb-2 block text-sm font-medium" htmlFor="profile-card-opacity-input">
              Profile card opacity ({Math.round(editProfileBackgroundOpacity * 100)}%)
            </label>
            <input
              id="profile-card-opacity-input"
              type="range"
              min={50}
              max={100}
              step={1}
              value={Math.round(editProfileBackgroundOpacity * 100)}
              onChange={(e) => {
                const value = Number(e.target.value);
                setEditProfileBackgroundOpacity(Math.max(0.5, Math.min(value / 100, 1)));
              }}
              className="mb-5 w-full accent-emerald-400"
            />

            {saveError ? (
              <p className="mb-4 rounded-md border border-red-400/50 bg-red-900/30 px-3 py-2 text-sm text-red-200">
                {saveError}
              </p>
            ) : null}

            <div className="flex justify-end gap-3">
              <button
                type="button"
                className="rounded-md border border-white/20 px-4 py-2 text-sm hover:bg-white/10"
                onClick={() => setIsEditing(false)}
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-md border border-emerald-300/40 bg-emerald-500/20 px-4 py-2 text-sm text-emerald-100 hover:bg-emerald-500/30 disabled:opacity-60"
                disabled={isSaving}
              >
                {isSaving ? "Saving..." : "Save Profile"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}