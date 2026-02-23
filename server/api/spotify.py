import base64
import json
import os
import time
from dataclasses import dataclass
from typing import Any
from urllib import error, parse, request

from django.core.cache import cache

SPOTIFY_AUTH_URL = "https://accounts.spotify.com/api/token"
SPOTIFY_TRACKS_URL = "https://api.spotify.com/v1/tracks"
TOKEN_CACHE_KEY = "spotify:client-token"
DEFAULT_TRACK_CACHE_TTL = int(os.environ.get("SPOTIFY_TRACK_CACHE_TTL_SECONDS", "3600"))


@dataclass
class SpotifyTrackData:
    track_id: str
    title: str | None
    artist: str | None
    cover_url: str | None
    spotify_url: str | None


class SpotifyClient:
    def __init__(self) -> None:
        self.client_id = os.environ.get("SPOTIFY_CLIENT_ID")
        self.client_secret = os.environ.get("SPOTIFY_CLIENT_SECRET")

    @property
    def is_configured(self) -> bool:
        return bool(self.client_id and self.client_secret)

    def _token_from_spotify(self) -> tuple[str, int]:
        creds = f"{self.client_id}:{self.client_secret}".encode("utf-8")
        auth = base64.b64encode(creds).decode("ascii")
        payload = parse.urlencode({"grant_type": "client_credentials"}).encode("utf-8")
        req = request.Request(
            SPOTIFY_AUTH_URL,
            data=payload,
            headers={
                "Authorization": f"Basic {auth}",
                "Content-Type": "application/x-www-form-urlencoded",
            },
            method="POST",
        )
        with request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        return data["access_token"], int(data.get("expires_in", 3600))

    def access_token(self) -> str | None:
        if not self.is_configured:
            return None

        cached = cache.get(TOKEN_CACHE_KEY)
        if cached:
            return cached

        try:
            token, expires_in = self._token_from_spotify()
        except (error.HTTPError, error.URLError, TimeoutError, KeyError, ValueError):
            return None

        ttl = max(30, expires_in - 60)
        cache.set(TOKEN_CACHE_KEY, token, timeout=ttl)
        return token

    def get_tracks(self, track_ids: list[str]) -> dict[str, SpotifyTrackData]:
        token = self.access_token()
        if not token or not track_ids:
            return {}

        deduped_ids = list(dict.fromkeys(track_ids))
        results: dict[str, SpotifyTrackData] = {}

        for i in range(0, len(deduped_ids), 50):
            chunk = deduped_ids[i:i + 50]
            params = parse.urlencode({"ids": ",".join(chunk)})
            req = request.Request(
                f"{SPOTIFY_TRACKS_URL}?{params}",
                headers={"Authorization": f"Bearer {token}"},
                method="GET",
            )
            try:
                with request.urlopen(req, timeout=20) as resp:
                    payload = json.loads(resp.read().decode("utf-8"))
            except (error.HTTPError, error.URLError, TimeoutError, ValueError):
                continue

            for track in payload.get("tracks", []):
                if not track:
                    continue
                tid = track.get("id")
                if not tid:
                    continue
                artists = ", ".join(a.get("name", "") for a in track.get("artists", []) if a.get("name"))
                images = track.get("album", {}).get("images", [])
                cover = images[0].get("url") if images else None
                results[tid] = SpotifyTrackData(
                    track_id=tid,
                    title=track.get("name"),
                    artist=artists or None,
                    cover_url=cover,
                    spotify_url=track.get("external_urls", {}).get("spotify"),
                )

        return results


def _song_cache_key(song_id: str) -> str:
    return f"spotify:song:{song_id}"


def hydrate_songs_from_spotify(song_rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    Fill human-readable song fields from Spotify and cache the resolved payload in Django cache.
    Cache entries are intentionally short-lived to avoid persistent storage of Spotify metadata.
    """
    if not song_rows:
        return song_rows

    client = SpotifyClient()
    if not client.is_configured:
        return song_rows

    to_lookup: list[str] = []
    positions_by_track_id: dict[str, list[int]] = {}

    for idx, song in enumerate(song_rows):
        song_id = song.get("id")
        track_id = song.get("spotifyTrackId")
        if not song_id or not track_id:
            continue

        cached_song = cache.get(_song_cache_key(song_id))
        if cached_song:
            song.update(cached_song)
            continue

        positions_by_track_id.setdefault(track_id, []).append(idx)
        to_lookup.append(track_id)

    fetched = client.get_tracks(to_lookup)
    now = int(time.time())
    timeout = DEFAULT_TRACK_CACHE_TTL

    for track_id, indices in positions_by_track_id.items():
        data = fetched.get(track_id)
        if not data:
            continue

        for idx in indices:
            song = song_rows[idx]
            hydrated = {
                "title": data.title or song.get("title"),
                "artist": data.artist or song.get("artist"),
                "coverUrl": data.cover_url or song.get("coverUrl"),
                "spotifyUrl": data.spotify_url or song.get("spotifyUrl"),
                "spotifyTrackId": data.track_id,
                "_spotifyCachedAt": now,
            }
            song.update(hydrated)
            cache.set(_song_cache_key(song["id"]), hydrated, timeout=timeout)

    return song_rows