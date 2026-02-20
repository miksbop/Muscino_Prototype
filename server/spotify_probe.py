#!/usr/bin/env python3
"""Prototype script to inspect Spotify track + artist metadata for Muscino song ingest.

Usage:
  SPOTIFY_CLIENT_ID=... SPOTIFY_CLIENT_SECRET=... \
  python spotify_probe.py --query "hyperpop" --limit 10
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import re
import sys
from typing import Any
from urllib import error, parse, request

SPOTIFY_AUTH_URL = "https://accounts.spotify.com/api/token"
SPOTIFY_API_BASE = "https://api.spotify.com/v1"

# Spotify-provided artist-genre bucket rules (preferred source).
GENRE_BUCKET_RULES: dict[str, tuple[str, ...]] = {
    "Pop": ("pop", "dance pop", "hyperpop", "k-pop", "j-pop", "bedroom pop"),
    "Rock": ("rock", "alt-rock", "alternative", "math rock", "punk", "metal", "grunge"),
    "Hip-Hop": ("hip hop", "trap", "rap", "drill"),
    "R&B": ("r&b", "soul", "neo soul", "funk"),
    "Electronic": ("edm", "electro", "house", "techno", "dubstep", "dnb"),
    "Indie": ("indie", "lo-fi", "shoegaze", "dream pop"),
    "Country": ("country", "americana", "bluegrass"),
    "Latin": ("latin", "reggaeton", "salsa", "bachata"),
    "Classical": ("classical", "orchestral", "opera"),
    "Jazz": ("jazz", "bebop", "swing"),
}

# Text fallback rules (query/title/artist/album) when Spotify artist genres are unavailable.
TEXT_FALLBACK_RULES: dict[str, tuple[str, ...]] = {
    "Pop": ("pop", "hyperpop", "dance", "synthpop"),
    "Rock": ("rock", "alt", "punk", "metal", "grunge"),
    "Hip-Hop": ("hip hop", "rap", "trap", "drill"),
    "R&B": ("r&b", "soul", "neo soul", "funk"),
    "Electronic": ("edm", "electro", "house", "techno", "dubstep", "dnb"),
    "Indie": ("indie", "lofi", "lo-fi", "shoegaze"),
    "Country": ("country", "americana", "bluegrass"),
    "Latin": ("latin", "reggaeton", "salsa", "bachata"),
    "Classical": ("classical", "orchestra", "opera", "piano"),
    "Jazz": ("jazz", "bebop", "swing"),
}


def match_bucket(terms: list[str], rules: dict[str, tuple[str, ...]]) -> tuple[str, str | None]:
    lowered = [t.lower() for t in terms if t]
    for bucket, keywords in rules.items():
        for term in lowered:
            for keyword in keywords:
                if keyword in term:
                    return bucket, keyword
    return "Uncategorized", None


def normalize_artist_genre(artist_genres: list[str]) -> tuple[str, str | None]:
    return match_bucket(artist_genres, GENRE_BUCKET_RULES)


def infer_genre_from_text(query: str, track: dict[str, Any]) -> tuple[str, str | None]:
    artists = ", ".join([a.get("name", "") for a in track.get("artists", [])])
    album = track.get("album", {}).get("name", "")
    terms = [query, track.get("name", ""), artists, album]
    return match_bucket(terms, TEXT_FALLBACK_RULES)


def spotify_token(client_id: str, client_secret: str) -> str:
    credentials = f"{client_id}:{client_secret}".encode("utf-8")
    auth_header = base64.b64encode(credentials).decode("utf-8")

    payload = parse.urlencode({"grant_type": "client_credentials"}).encode("utf-8")
    req = request.Request(
        SPOTIFY_AUTH_URL,
        data=payload,
        headers={
            "Authorization": f"Basic {auth_header}",
            "Content-Type": "application/x-www-form-urlencoded",
        },
        method="POST",
    )

    with request.urlopen(req) as response:
        data = json.load(response)
    return data["access_token"]


def spotify_get(path: str, token: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
    query = f"?{parse.urlencode(params)}" if params else ""
    req = request.Request(
        f"{SPOTIFY_API_BASE}{path}{query}",
        headers={"Authorization": f"Bearer {token}"},
    )
    with request.urlopen(req) as response:
        return json.load(response)


def explain_spotify_http_error(exc: error.HTTPError, step: str) -> RuntimeError:
    body = ""
    try:
        body = exc.read().decode("utf-8")
    except Exception:  # noqa: BLE001
        body = ""

    if exc.code == 401:
        hint = (
            "401 Unauthorized. Check SPOTIFY_CLIENT_ID/SPOTIFY_CLIENT_SECRET and make sure "
            "you copied the app credentials (not account login credentials)."
        )
    elif exc.code == 403:
        hint = (
            f"403 Forbidden from Spotify during {step}. "
            "Your token is likely valid, but this app/request context is not allowed for that endpoint. "
            "This can happen for app/API restrictions in Spotify Dashboard, or endpoint-level deny rules."
        )
    elif exc.code == 429:
        hint = "429 Too Many Requests. Slow down and retry after the Spotify rate limit window."
    else:
        hint = f"Spotify HTTP {exc.code} during {step}."

    detail = f" Response body: {body}" if body else ""
    return RuntimeError(f"{hint}{detail}")


def sanitize_id(text: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "_", text.lower()).strip("_")
    return slug[:200]


def resolve_genre(track: dict[str, Any], artist_genres: list[str], query: str) -> tuple[str, str, str | None, str]:
    artist_bucket, artist_match = normalize_artist_genre(artist_genres)
    if artist_bucket != "Uncategorized":
        return artist_bucket, "spotify_artist_genres", artist_match, "high"

    text_bucket, text_match = infer_genre_from_text(query, track)
    if text_bucket != "Uncategorized":
        return text_bucket, "text_fallback", text_match, "low"

    return "Uncategorized", "none", None, "none"




def rarity_from_popularity(popularity: int | None) -> str:
    if popularity is None:
        return "Common"
    if popularity > 80:
        return "Legendary"
    if popularity >= 60:
        return "Epic"
    if popularity >= 40:
        return "Rare"
    if popularity >= 20:
        return "Uncommon"
    return "Common"


def build_song_payload(track: dict[str, Any], artist_genres: list[str], query: str) -> dict[str, Any]:
    artist_names = ", ".join([artist["name"] for artist in track.get("artists", [])])
    images = track.get("album", {}).get("images", [])
    cover = images[0]["url"] if images else None

    final_genre, source_method, source_match, confidence = resolve_genre(track, artist_genres, query)

    track_id = track.get("id")
    popularity = track.get("popularity")
    if track_id:
        song_id = f"spotify_track_{track_id}"
    else:
        song_id = f"spotify_{sanitize_id(track.get('name', ''))}_{sanitize_id(artist_names)[:60]}"

    return {
        "id": song_id,
        "title": track.get("name", ""),
        "artist": artist_names,
        "cover_url": cover,
        "genre": final_genre,
        "genre_source": {
            "method": source_method,
            "confidence": confidence,
            "matched_keyword": source_match,
            "spotify_artist_genres": artist_genres,
            "query": query,
        },
        "spotify_track_id": track_id,
        "spotify_url": track.get("external_urls", {}).get("spotify"),
        "spotify_popularity": popularity,
        "rarity": rarity_from_popularity(popularity),
    }


def fetch_artist_genres_with_fallback(
    token: str, tracks: list[dict[str, Any]], market: str
) -> dict[str, list[str]]:
    artist_ids = [t["artists"][0]["id"] for t in tracks if t.get("artists") and t["artists"][0].get("id")]
    unique_artist_ids = list(dict.fromkeys(artist_ids))
    genres_by_id: dict[str, list[str]] = {}

    try:
        for i in range(0, len(unique_artist_ids), 50):
            chunk = unique_artist_ids[i : i + 50]
            artist_response = spotify_get("/artists", token, {"ids": ",".join(chunk)})
            for artist in artist_response.get("artists", []):
                if artist and artist.get("id"):
                    genres_by_id[artist["id"]] = artist.get("genres", [])
        return genres_by_id
    except error.HTTPError as exc:
        if exc.code != 403:
            raise explain_spotify_http_error(exc, "artist lookup") from exc
        print(
            "Warning: /artists lookup was forbidden (403). Falling back to artist search by name for genres.",
            file=sys.stderr,
        )

    for track in tracks:
        artists = track.get("artists", [])
        if not artists:
            continue
        primary = artists[0]
        artist_id = primary.get("id")
        artist_name = primary.get("name")
        if not artist_id or not artist_name:
            continue
        if artist_id in genres_by_id:
            continue

        try:
            search = spotify_get(
                "/search",
                token,
                {
                    "q": f'artist:"{artist_name}"',
                    "type": "artist",
                    "limit": 5,
                    "market": market,
                },
            )
        except error.HTTPError as exc:
            if exc.code == 403:
                continue
            raise explain_spotify_http_error(exc, f"artist search fallback ({artist_name})") from exc

        items = search.get("artists", {}).get("items", [])
        selected = None
        for item in items:
            if item.get("name", "").lower() == artist_name.lower():
                selected = item
                break
        if not selected and items:
            selected = items[0]

        genres_by_id[artist_id] = selected.get("genres", []) if selected else []

    return genres_by_id


def run(query: str, limit: int, market: str, output_file: str | None) -> None:
    client_id = os.getenv("SPOTIFY_CLIENT_ID")
    client_secret = os.getenv("SPOTIFY_CLIENT_SECRET")

    if not client_id or not client_secret:
        raise RuntimeError("Missing SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET environment variables.")

    try:
        token = spotify_token(client_id, client_secret)
    except error.HTTPError as exc:
        raise explain_spotify_http_error(exc, "token request") from exc

    try:
        results = spotify_get(
            "/search",
            token,
            {
                "q": query,
                "type": "track",
                "limit": limit,
                "market": market,
            },
        )
    except error.HTTPError as exc:
        raise explain_spotify_http_error(exc, "track search") from exc

    tracks = results.get("tracks", {}).get("items", [])
    artist_genres_by_id = fetch_artist_genres_with_fallback(token, tracks, market)

    payload = []
    for track in tracks:
        primary_artist_id = track.get("artists", [{}])[0].get("id")
        artist_genres = artist_genres_by_id.get(primary_artist_id, [])
        payload.append(build_song_payload(track, artist_genres, query))

    text = json.dumps(payload, indent=2)
    if output_file:
        with open(output_file, "w", encoding="utf-8") as f:
            f.write(text)
        print(f"Saved {len(payload)} songs to {output_file}")
    else:
        print(text)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Prototype Spotify JSON ingest for Muscino.")
    parser.add_argument("--query", required=True, help="Spotify search query, e.g. 'math rock'.")
    parser.add_argument("--limit", type=int, default=10, help="Max tracks to pull (default: 10).")
    parser.add_argument("--market", default="US", help="Market code (default: US).")
    parser.add_argument("--output", default=None, help="Optional output file path.")
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    try:
        run(args.query, args.limit, args.market, args.output)
    except Exception as exc:  # noqa: BLE001
        print(f"Error: {exc}", file=sys.stderr)
        sys.exit(1)