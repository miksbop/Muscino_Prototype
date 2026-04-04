import base64
import math
import json
import os
import time
from dataclasses import dataclass
from typing import Any
from urllib import error, parse, request


from django.core.cache import cache

SPOTIFY_AUTH_URL = "https://accounts.spotify.com/api/token"
SPOTIFY_TRACKS_URL = "https://api.spotify.com/v1/tracks"
SPOTIFY_SEARCH_URL = "https://api.spotify.com/v1/search"
SPOTIFY_ARTIST_TOP_TRACKS_URL_TEMPLATE = "https://api.spotify.com/v1/artists/{artist_id}/top-tracks"
TOKEN_CACHE_KEY = "spotify:client-token"
THROTTLE_UNTIL_CACHE_KEY = "spotify:throttle-until"
THROTTLE_LAST_PROBE_CACHE_KEY = "spotify:throttle-last-probe"
DEFAULT_TRACK_CACHE_TTL = int(os.environ.get("SPOTIFY_TRACK_CACHE_TTL_SECONDS", "3600"))
SPOTIFY_CLIENT_MIN_INTERVAL_SECONDS = float(os.environ.get("SPOTIFY_CLIENT_MIN_INTERVAL_SECONDS", "0.25"))
SPOTIFY_MAX_RETRIES = int(os.environ.get("SPOTIFY_MAX_RETRIES", "2"))
SPOTIFY_MAX_BACKOFF_SECONDS = int(os.environ.get("SPOTIFY_MAX_BACKOFF_SECONDS", "120"))
SPOTIFY_BACKOFF_PROBE_INTERVAL_SECONDS = int(os.environ.get("SPOTIFY_BACKOFF_PROBE_INTERVAL_SECONDS", "15"))


@dataclass
class SpotifyTrackData:
    track_id: str
    title: str | None
    artist: str | None
    cover_url: str | None
    spotify_url: str | None


@dataclass
class SpotifyArtistData:
    artist_id: str
    name: str
    image_url: str | None
    spotify_url: str | None

class SpotifyClient:
    def __init__(self) -> None:
        self.client_id = os.environ.get("SPOTIFY_CLIENT_ID")
        self.client_secret = os.environ.get("SPOTIFY_CLIENT_SECRET")
        self.last_error_code: int | None = None
        self.last_retry_after_seconds: int | None = None
        self._last_request_ts = 0.0

    @property
    def is_configured(self) -> bool:
        return bool(self.client_id and self.client_secret)

    def _clear_last_error(self) -> None:
        self.last_error_code = None
        self.last_retry_after_seconds = None

    def _capture_http_error(self, exc: error.HTTPError) -> None:
        self.last_error_code = exc.code
        retry_after = exc.headers.get("Retry-After")
        try:
            self.last_retry_after_seconds = int(retry_after) if retry_after else None
        except (TypeError, ValueError):
            self.last_retry_after_seconds = None

    def _pace_requests(self) -> None:
        elapsed = time.monotonic() - self._last_request_ts
        if elapsed < SPOTIFY_CLIENT_MIN_INTERVAL_SECONDS:
            time.sleep(SPOTIFY_CLIENT_MIN_INTERVAL_SECONDS - elapsed)
        self._last_request_ts = time.monotonic()

    def _global_backoff_remaining_seconds(self) -> int:
        throttle_until = cache.get(THROTTLE_UNTIL_CACHE_KEY)
        if throttle_until is None:
            return 0
        try:
            throttle_until = float(throttle_until)
        except (TypeError, ValueError):
            return 0

        delay = throttle_until - time.time()
        if delay <= 0:
            return 0

        return max(1, int(math.ceil(delay)))

    def _set_global_backoff(self, retry_after_seconds: int | None) -> None:
        seconds = retry_after_seconds if (retry_after_seconds is not None and retry_after_seconds > 0) else 1
        seconds = min(seconds, max(1, SPOTIFY_MAX_BACKOFF_SECONDS))
        throttle_until = time.time() + seconds
        cache.set(THROTTLE_UNTIL_CACHE_KEY, throttle_until, timeout=max(1, seconds))

    def _clear_global_backoff(self) -> None:
        cache.delete(THROTTLE_UNTIL_CACHE_KEY)
        cache.delete(THROTTLE_LAST_PROBE_CACHE_KEY)

    def _can_probe_during_backoff(self) -> bool:
        now = time.time()
        interval = max(1, SPOTIFY_BACKOFF_PROBE_INTERVAL_SECONDS)
        last_probe_at = cache.get(THROTTLE_LAST_PROBE_CACHE_KEY)
        try:
            last_probe_at = float(last_probe_at) if last_probe_at is not None else None
        except (TypeError, ValueError):
            last_probe_at = None

        if last_probe_at is not None and (now - last_probe_at) < interval:
            return False

        cache.set(THROTTLE_LAST_PROBE_CACHE_KEY, now, timeout=interval)
        return True

    def _request_json(self, req: request.Request, timeout: int, *, allow_retry: bool = True) -> dict[str, Any] | None:
        attempts = max(1, SPOTIFY_MAX_RETRIES + 1) if allow_retry else 1
        for attempt in range(attempts):
            backoff_seconds = self._global_backoff_remaining_seconds()
            if backoff_seconds > 0:
                if self._can_probe_during_backoff():
                    backoff_seconds = 0
                else:
                    self.last_error_code = 429
                    self.last_retry_after_seconds = backoff_seconds
                    return None
            if backoff_seconds > 0:
                self.last_error_code = 429
                self.last_retry_after_seconds = backoff_seconds
                return None
            self._pace_requests()
            try:
                with request.urlopen(req, timeout=timeout) as resp:
                    self._clear_global_backoff()
                    return json.loads(resp.read().decode("utf-8"))
            except error.HTTPError as exc:
                self._capture_http_error(exc)
                if exc.code == 429 and attempt < attempts - 1:
                    self._set_global_backoff(self.last_retry_after_seconds)
                    continue
                return None
            except (error.URLError, TimeoutError, ValueError):
                return None
        return None

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
        payload = self._request_json(req, timeout=15, allow_retry=True)
        if not payload or "access_token" not in payload:
            raise ValueError("spotify auth response missing access token")
        data = payload
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
        self._clear_last_error()
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
            payload = self._request_json(req, timeout=20)
            if not payload:
                continue

            for track in payload.get("tracks", []):
                parsed_track = _parse_track_payload(track)
                if parsed_track:
                    results[parsed_track.track_id] = parsed_track

        return results

    def search_artist_tracks(self, artist_keyword: str, limit: int = 10) -> list[SpotifyTrackData]:
        self._clear_last_error()
        token = self.access_token()
        if not token:
            return []

        safe_limit = max(1, min(limit, 50))
        query = f"artist:{artist_keyword.strip()}"
        params = parse.urlencode({"q": query, "type": "track", "limit": safe_limit})
        req = request.Request(
            f"{SPOTIFY_SEARCH_URL}?{params}",
            headers={"Authorization": f"Bearer {token}"},
            method="GET",
        )
        payload = self._request_json(req, timeout=20)
        if not payload:
            return []

        tracks = payload.get("tracks", {}).get("items", [])
        parsed_tracks: list[SpotifyTrackData] = []
        for track in tracks:
            parsed_track = _parse_track_payload(track)
            if parsed_track:
                parsed_tracks.append(parsed_track)
        return parsed_tracks
    
    def search_artists(self, keyword: str, limit: int = 8) -> list[SpotifyArtistData]:
        self._clear_last_error()
        token = self.access_token()
        cleaned_keyword = keyword.strip()
        if not token or not cleaned_keyword:
            return []

        safe_limit = max(1, min(limit, 20))
        params = parse.urlencode({"q": cleaned_keyword, "type": "artist", "limit": safe_limit})
        req = request.Request(
            f"{SPOTIFY_SEARCH_URL}?{params}",
            headers={"Authorization": f"Bearer {token}"},
            method="GET",
        )
        payload = self._request_json(req, timeout=20)
        if not payload:
            return []

        artists = payload.get("artists", {}).get("items", [])
        parsed_artists: list[SpotifyArtistData] = []
        for artist in artists:
            parsed_artist = _parse_artist_payload(artist)
            if parsed_artist:
                parsed_artists.append(parsed_artist)
        return parsed_artists

    def get_artist_top_tracks(self, artist_id: str, market: str = "US", limit: int = 10) -> list[SpotifyTrackData]:
        self._clear_last_error()
        token = self.access_token()
        cleaned_artist_id = artist_id.strip()
        if not token or not cleaned_artist_id:
            return []

        params = parse.urlencode({"market": market})
        req = request.Request(
            f"{SPOTIFY_ARTIST_TOP_TRACKS_URL_TEMPLATE.format(artist_id=parse.quote(cleaned_artist_id))}?{params}",
            headers={"Authorization": f"Bearer {token}"},
            method="GET",
        )
        payload = self._request_json(req, timeout=20)
        if not payload:
            return []

        safe_limit = max(1, min(limit, 50))
        tracks = payload.get("tracks", [])
        parsed_tracks: list[SpotifyTrackData] = []
        for track in tracks[:safe_limit]:
            parsed_track = _parse_track_payload(track)
            if parsed_track:
                parsed_tracks.append(parsed_track)
        return parsed_tracks



def _parse_track_payload(track: dict[str, Any] | None) -> SpotifyTrackData | None:
    if not track:
        return None
    tid = track.get("id")
    if not tid:
        return None

    artists = ", ".join(a.get("name", "") for a in track.get("artists", []) if a.get("name"))
    images = track.get("album", {}).get("images", [])
    cover = images[0].get("url") if images else None

    return SpotifyTrackData(
        track_id=tid,
        title=track.get("name"),
        artist=artists or None,
        cover_url=cover,
        spotify_url=track.get("external_urls", {}).get("spotify"),
    )

def _parse_artist_payload(artist: dict[str, Any] | None) -> SpotifyArtistData | None:
    if not artist:
        return None
    artist_id = artist.get("id")
    name = artist.get("name")
    if not artist_id or not name:
        return None

    images = artist.get("images", [])
    image_url = images[0].get("url") if images else None
    return SpotifyArtistData(
        artist_id=artist_id,
        name=name,
        image_url=image_url,
        spotify_url=artist.get("external_urls", {}).get("spotify"),
    )



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