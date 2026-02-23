"""Seed script for the Django backend using a Spotify-only catalog.

Run after migrations:

  cd server
  python manage.py migrate
  python seed.py

Required env vars (in `server/.env` or process env):
  SPOTIFY_CLIENT_ID=...
  SPOTIFY_CLIENT_SECRET=...

Optional env vars:
  SPOTIFY_SEED_MARKET=US
  SPOTIFY_SEED_TRACKS_PER_GENRE=8
"""

from __future__ import annotations

import json
import os
from urllib import parse, request

import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backend.settings")
django.setup()

from django.contrib.auth.models import User

from api.models import OwnedSong, Sleeve, SleeveSong, Song
from api.spotify import SpotifyClient

SPOTIFY_SEARCH_URL = "https://api.spotify.com/v1/search"
GENRE_TO_QUERY = {
    "Pop": "genre:pop",
    "Rock": "genre:rock",
    "Rap": "genre:rap",
}


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


def spotify_search_tracks(client: SpotifyClient, query: str, limit: int, market: str) -> list[dict]:
    token = client.access_token()
    if not token:
        raise RuntimeError("Spotify client is not configured or token request failed.")

    params = parse.urlencode(
        {
            "q": query,
            "type": "track",
            "limit": max(1, min(limit, 50)),
            "market": market,
        }
    )
    req = request.Request(
        f"{SPOTIFY_SEARCH_URL}?{params}",
        headers={"Authorization": f"Bearer {token}"},
        method="GET",
    )
    with request.urlopen(req, timeout=20) as resp:
        payload = json.loads(resp.read().decode("utf-8"))

    return payload.get("tracks", {}).get("items", [])


def build_song_defaults(track: dict, genre: str) -> tuple[str, dict]:
    track_id = track["id"]
    artists = ", ".join(a.get("name", "") for a in track.get("artists", []) if a.get("name"))
    images = track.get("album", {}).get("images", [])
    cover = images[0].get("url") if images else None

    return (
        f"spotify_track_{track_id}",
        {
            "title": track.get("name", ""),
            "artist": artists,
            "cover_url": cover,
            "genre": genre,
            "spotify_track_id": track_id,
            "spotify_url": track.get("external_urls", {}).get("spotify"),
            "rarity": rarity_from_popularity(track.get("popularity")),
        },
    )


def run() -> None:
    market = os.environ.get("SPOTIFY_SEED_MARKET", "US")
    per_genre = int(os.environ.get("SPOTIFY_SEED_TRACKS_PER_GENRE", "8"))

    client = SpotifyClient()
    if not client.is_configured:
        raise RuntimeError("Missing SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET. Add them to server/.env")

    print("Seeding DB with Spotify-only sleeves...")

    OwnedSong.objects.all().delete()
    SleeveSong.objects.all().delete()
    Sleeve.objects.all().delete()
    Song.objects.all().delete()

    demo_user, _ = User.objects.get_or_create(username="demo")

    seeded_count = 0

    for genre, query in GENRE_TO_QUERY.items():
        print(f"Fetching {per_genre} tracks for {genre} ({query})...")
        tracks = spotify_search_tracks(client, query=query, limit=per_genre, market=market)
        sleeve = Sleeve.objects.create(
            id=f"sleeve_{genre.lower()}_spotify",
            name=f"{genre} Sleeve",
            genre=genre,
            cost=20,
            refreshed_weekly=True,
        )

        for track in tracks:
            track_id = track.get("id")
            images = track.get("album", {}).get("images", [])
            cover = images[0].get("url") if images else None
            if not track_id or not cover:
                continue

            song_id, defaults = build_song_defaults(track, genre)
            rarity = defaults.pop("rarity")
            song, _ = Song.objects.update_or_create(id=song_id, defaults=defaults)
            SleeveSong.objects.create(sleeve=sleeve, song=song, rarity=rarity)
            seeded_count += 1

    # Seed a small owned inventory from the first sleeve's top songs
    starter_songs = Song.objects.filter(genre="Rap")[:2]
    for song in starter_songs:
        OwnedSong.objects.create(song=song, rarity="Rare", owner=demo_user)

    print(f"Spotify-only seed complete. Seeded {seeded_count} songs.")


if __name__ == "__main__":
    run()
