"""
Generate weekly genre sleeves from Spotify WITHOUT touching player inventory.

Product rules for each generated sleeve:
- exactly 8 songs
- 2 Legendary
- 2 Epic
- 4 Common

This script intentionally updates only Song/Sleeve/SleeveSong data.
It does not delete OwnedSong, User, or Profile rows.
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
import os
import re
from dataclasses import dataclass
from datetime import date, datetime
from typing import Any
from urllib import error, parse, request

import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backend.settings")
django.setup()

from api.models import Song, Sleeve, SleeveSong  # noqa: E402

SPOTIFY_AUTH_URL = "https://accounts.spotify.com/api/token"
SPOTIFY_API_BASE = "https://api.spotify.com/v1"

TARGET_DISTRIBUTION: dict[str, int] = {
    "Legendary": 2,
    "Epic": 2,
    "Common": 4,
}

GENRE_CONFIG: dict[str, dict[str, Any]] = {
    "Pop": {
        "seed_artists": [
            "Taylor Swift", "The Weeknd", "Ariana Grande", "Dua Lipa", "Olivia Rodrigo",
            "Billie Eilish", "Bruno Mars", "Justin Bieber", "Ed Sheeran", "Rihanna",
            "Lady Gaga", "Katy Perry", "Miley Cyrus", "Selena Gomez", "Shawn Mendes",
            "Harry Styles", "Sabrina Carpenter", "Charli xcx", "Adele", "Sia",
            "Post Malone", "Lana Del Rey", "Doja Cat", "Khalid", "Camila Cabello",
            "Halsey", "Lorde", "Troye Sivan", "Benson Boone", "Conan Gray",
            "Tate McRae", "PinkPantheress", "Bebe Rexha", "Zara Larsson", "Ellie Goulding",
            "Ava Max", "Meghan Trainor", "Niall Horan", "OneRepublic", "Maroon 5",
            "Kesha", "P!nk", "Sam Smith", "Anne-Marie", "SZA",
            "ROSÉ", "BLACKPINK", "KATSEYE", "Gracie Abrams", "Madison Beer",
        ],
    },
    "Rock": {
        "seed_artists": [
            "Foo Fighters", "Arctic Monkeys", "The Killers", "Red Hot Chili Peppers", "Green Day",
            "Nirvana", "Linkin Park", "Metallica", "Queen", "The Rolling Stones",
            "The Beatles", "Led Zeppelin", "AC/DC", "Guns N' Roses", "Pearl Jam",
            "Imagine Dragons", "My Chemical Romance", "Paramore", "Fall Out Boy", "Evanescence",
            "Blink-182", "The Smashing Pumpkins", "The Strokes", "Radiohead", "Muse",
            "U2", "Bon Jovi", "Journey", "Weezer", "The Offspring",
            "Kings of Leon", "The White Stripes", "Oasis", "Coldplay", "Three Days Grace",
            "Breaking Benjamin", "Shinedown", "System Of A Down", "Avenged Sevenfold", "Bring Me The Horizon",
            "The Cranberries", "Fleetwood Mac", "The Goo Goo Dolls", "Stone Temple Pilots", "Alice In Chains",
            "R.E.M.", "Panic! At The Disco", "The Black Keys", "Twenty One Pilots", "Franz Ferdinand",
        ],
    },
    "Rap": {
        "seed_artists": [
            "A Tribe Called Quest", "Nas", "The Notorious B.I.G.", "2Pac", "Wu-Tang Clan",
            "Dr. Dre", "Snoop Dogg", "Ice Cube", "OutKast", "Jay-Z",
            "Eminem", "50 Cent", "Missy Elliott", "Busta Rhymes", "Common",
            "Kendrick Lamar", "J. Cole", "Drake", "Travis Scott", "Future",
            "Tyler, The Creator", "Pusha T", "Baby Keem", "Denzel Curry", "A$AP Rocky",
        ],
    },
    "Indie": {
        "seed_artists": [
            "Tame Impala", "Phoebe Bridgers", "Mitski", "beabadoobee", "Clairo",
            "The 1975", "The Neighbourhood", "Cage The Elephant", "Vampire Weekend", "The xx",
            "Bon Iver", "The National", "Mac DeMarco", "Rex Orange County", "Wallows",
            "Japanese Breakfast", "Beach House", "Alvvays", "Arlo Parks", "girl in red",
            "Faye Webster", "Soccer Mommy", "Snail Mail", "Men I Trust", "Khruangbin",
            "MGMT", "Foster The People", "Alt-J", "Two Door Cinema Club", "Glass Animals",
            "Death Cab for Cutie", "The Postal Service", "Father John Misty", "Sufjan Stevens", "Bright Eyes",
            "The Strokes", "Interpol", "Yeah Yeah Yeahs", "Wolf Alice", "The Last Shadow Puppets",
            "Mac Miller", "Dominic Fike", "Dayglow", "The Japanese House", "boygenius",
            "TV Girl", "Alex G", "Current Joys", "Still Woozy", "Peach Pit",
        ],
    },
}


@dataclass
class Candidate:
    track_id: str
    title: str
    artist: str
    artist_id: str | None
    cover_url: str | None
    spotify_url: str | None
    popularity: int | None
    release_date: str | None
    source_type: str
    source_query: str


@dataclass
class ScoredCandidate:
    candidate: Candidate
    relevance: float
    legendary_fit: float
    epic_fit: float
    common_fit: float
    artist_repeat_penalty: float


def _stable_jitter(key: str) -> float:
    digest = hashlib.md5(key.encode("utf-8")).hexdigest()[:8]
    return int(digest, 16) / 0xFFFFFFFF


def _normalize_artist_name(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", value.lower())


def _fallback_popularity(track_id: str) -> int:
    # Deterministic fallback when Spotify popularity is unavailable.
    return int(35 + 45 * _stable_jitter(track_id))


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

    with request.urlopen(req, timeout=20) as response:
        data = json.load(response)
    return data["access_token"]


def spotify_get(path: str, token: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
    query = f"?{parse.urlencode(params)}" if params else ""
    req = request.Request(
        f"{SPOTIFY_API_BASE}{path}{query}",
        headers={"Authorization": f"Bearer {token}"},
    )
    with request.urlopen(req, timeout=25) as response:
        return json.load(response)


def _parse_release_date(value: str | None) -> date | None:
    if not value:
        return None
    try:
        if len(value) == 4:
            return datetime.strptime(value, "%Y").date()
        if len(value) == 7:
            return datetime.strptime(value, "%Y-%m").date()
        return datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError:
        return None


def _release_recency_score(release_date: str | None) -> float:
    parsed = _parse_release_date(release_date)
    if not parsed:
        return 0.35

    days_old = max(0, (date.today() - parsed).days)
    if days_old <= 30:
        return 1.0
    if days_old <= 180:
        return 0.8
    if days_old <= 365:
        return 0.65
    if days_old <= 365 * 2:
        return 0.45
    return 0.25


def _map_track(item: dict[str, Any], *, source_type: str, source_query: str) -> Candidate | None:
    track_id = item.get("id")
    if not track_id:
        return None

    artists = item.get("artists", [])
    primary_artist = artists[0] if artists else {}
    artist_id = primary_artist.get("id")
    artist_name = ", ".join(a.get("name", "") for a in artists if a.get("name")) or "Unknown artist"

    images = item.get("album", {}).get("images", [])
    cover = images[0].get("url") if images else None

    return Candidate(
        track_id=track_id,
        title=item.get("name") or "",
        artist=artist_name,
        artist_id=artist_id,
        cover_url=cover,
        spotify_url=item.get("external_urls", {}).get("spotify"),
        popularity=item.get("popularity"),
        release_date=item.get("album", {}).get("release_date"),
        source_type=source_type,
        source_query=source_query,
    )


def _search_tracks(token: str, query_text: str, limit: int, market: str) -> list[dict[str, Any]]:
    """
    Spotify Feb 2026: /search max limit is 10. We paginate with offset.
    """
    page_size = min(10, max(1, limit))
    collected: list[dict[str, Any]] = []
    offset = 0

    while len(collected) < limit:
        payload = spotify_get(
            "/search",
            token,
            {
                "q": query_text,
                "type": "track",
                "limit": page_size,
                "offset": offset,
                "market": market,
            },
        )
        items = payload.get("tracks", {}).get("items", [])
        if not items:
            break
        collected.extend(items)
        if len(items) < page_size:
            break
        offset += page_size

    return collected[:limit]


def _local_candidates_for_genre(genre: str, limit: int) -> list[Candidate]:
    rows = (
        Song.objects.filter(genre__icontains=genre)
        .order_by("id")[: max(limit * 5, 60)]
    )
    if not rows:
        rows = Song.objects.all().order_by("id")[: max(limit * 5, 60)]

    output: list[Candidate] = []
    for row in rows:
        output.append(
            Candidate(
                track_id=row.spotify_track_id or row.id,
                title=row.title or "",
                artist=row.artist or "Unknown artist",
                artist_id=None,
                cover_url=row.cover_url,
                spotify_url=row.spotify_url,
                popularity=None,
                release_date=None,
                source_type="local_catalog",
                source_query=genre,
            )
        )
    return output


def fetch_candidates_for_genre(token: str, genre: str, limit: int, market: str) -> list[Candidate]:
    cfg = GENRE_CONFIG.get(genre, {"seed_artists": []})

    by_track_id: dict[str, Candidate] = {}

    try:
        # Source A: hard-curated top artists per genre (search-only).
        # This intentionally prioritizes recognisable mainstream catalog over raw genre search noise.
        for artist_name in cfg["seed_artists"][:50]:
            artist_key = _normalize_artist_name(artist_name)
            artist_hits = 0
            for query_text in (f'artist:\"{artist_name}\" genre:{genre.lower()}', f'artist:\"{artist_name}\"'):
                for item in _search_tracks(token, query_text=query_text, limit=min(limit, 3), market=market):
                    item_artists = item.get("artists", [])
                    primary_artist_name = item_artists[0].get("name", "") if item_artists else ""
                    if _normalize_artist_name(primary_artist_name) != artist_key:
                        continue
                    mapped = _map_track(item, source_type="artist_search", source_query=query_text)
                    if mapped and mapped.track_id not in by_track_id:
                        by_track_id[mapped.track_id] = mapped
                        artist_hits += 1
                if artist_hits > 0:
                    break
    except error.HTTPError as exc:
        if exc.code == 403:
            print(f"Spotify forbidden for genre={genre}; falling back to local catalog candidates.")
            return _local_candidates_for_genre(genre=genre, limit=limit)
        raise

    return list(by_track_id.values())


def _recent_artists_for_genre(genre: str, max_sleeves: int = 2) -> set[str]:
    sleeves = list(
        Sleeve.objects.filter(genre__iexact=genre)
        .order_by("-id")[:max_sleeves]
    )
    if not sleeves:
        return set()

    recent_artists: set[str] = set()
    for entry in SleeveSong.objects.filter(sleeve__in=sleeves).select_related("song"):
        recent_artists.add((entry.song.artist or "").lower().strip())
    return recent_artists


def score_candidates(candidates: list[Candidate], genre: str) -> list[ScoredCandidate]:
    recent_artists = _recent_artists_for_genre(genre)
    scored: list[ScoredCandidate] = []

    for c in candidates:
        popularity_value = c.popularity if c.popularity is not None else _fallback_popularity(c.track_id)
        popularity_norm = max(0.0, min(1.0, popularity_value / 100.0))
        recency = _release_recency_score(c.release_date)
        source_boost = {
            "genre_search": 1.0,
            "artist_search": 0.9,
            "local_catalog": 0.82,
        }.get(c.source_type, 0.85)
        jitter = _stable_jitter(f"{genre}:{c.track_id}")

        artist_key = c.artist.lower().strip()
        artist_repeat_penalty = 0.18 if artist_key in recent_artists else 0.0

        relevance = (
            0.55 * popularity_norm
            + 0.22 * recency
            + 0.18 * source_boost
            + 0.05 * jitter
            - artist_repeat_penalty
        )

        # Rarity-fit stays separate from relevance.
        legendary_fit = relevance + 0.25 * popularity_norm + 0.10 * recency
        epic_fit = relevance + 0.20 * (1 - abs(popularity_norm - 0.72))
        common_fit = relevance + 0.22 * (1 - abs(popularity_norm - 0.45)) + 0.07 * source_boost

        scored.append(
            ScoredCandidate(
                candidate=c,
                relevance=relevance,
                legendary_fit=legendary_fit,
                epic_fit=epic_fit,
                common_fit=common_fit,
                artist_repeat_penalty=artist_repeat_penalty,
            )
        )

    return sorted(scored, key=lambda x: x.relevance, reverse=True)


def _select_bucket(
    pool: list[ScoredCandidate],
    already_used_track_ids: set[str],
    already_used_artists: set[str],
    target_count: int,
    fit_attr: str,
) -> list[ScoredCandidate]:
    selected: list[ScoredCandidate] = []

    ranked = sorted(pool, key=lambda x: (getattr(x, fit_attr), x.relevance), reverse=True)
    for item in ranked:
        if len(selected) >= target_count:
            break

        track_id = item.candidate.track_id
        artist_key = item.candidate.artist.lower().strip()

        if track_id in already_used_track_ids:
            continue
        if artist_key in already_used_artists:
            continue

        selected.append(item)
        already_used_track_ids.add(track_id)
        already_used_artists.add(artist_key)

    return selected


def select_final_sleeve(scored: list[ScoredCandidate]) -> list[tuple[ScoredCandidate, str]]:
    used_tracks: set[str] = set()
    used_artists: set[str] = set()

    chosen: list[tuple[ScoredCandidate, str]] = []

    for rarity, fit_attr in (("Legendary", "legendary_fit"), ("Epic", "epic_fit"), ("Common", "common_fit")):
        picks = _select_bucket(
            pool=scored,
            already_used_track_ids=used_tracks,
            already_used_artists=used_artists,
            target_count=TARGET_DISTRIBUTION[rarity],
            fit_attr=fit_attr,
        )
        chosen.extend((p, rarity) for p in picks)

    # Backfill if constraints made us short (still enforce unique tracks; relax artist uniqueness only if needed).
    if len(chosen) < 8:
        for item in sorted(scored, key=lambda x: x.relevance, reverse=True):
            if len(chosen) >= 8:
                break
            if item.candidate.track_id in used_tracks:
                continue
            used_tracks.add(item.candidate.track_id)
            fallback_rarity = "Common"
            chosen.append((item, fallback_rarity))

    # Keep deterministic order by rarity bands then score
    rarity_rank = {"Legendary": 0, "Epic": 1, "Common": 2}
    chosen.sort(key=lambda x: (rarity_rank[x[1]], -x[0].relevance))

    return chosen[:8]


def upsert_sleeve_entries(genre: str, chosen: list[tuple[ScoredCandidate, str]]) -> None:
    sleeve = (
        Sleeve.objects.filter(genre__iexact=genre, refreshed_weekly=True).first()
        or Sleeve.objects.filter(genre__iexact=genre).first()
    )

    if not sleeve:
        sleeve = Sleeve.objects.create(
            id=f"sleeve_{genre.lower()}_weekly",
            name=f"{genre} Sleeve",
            genre=genre,
            cost=20,
            refreshed_weekly=True,
        )
    elif not sleeve.refreshed_weekly:
        sleeve.refreshed_weekly = True
        sleeve.save(update_fields=["refreshed_weekly"])

    SleeveSong.objects.filter(sleeve=sleeve).delete()

    rarity_counts = {"Legendary": 0, "Epic": 0, "Common": 0}

    for item, rarity in chosen:
        c = item.candidate
        song_id = f"spotify_track_{c.track_id}"
        song, _ = Song.objects.update_or_create(
            id=song_id,
            defaults={
                "title": c.title,
                "artist": c.artist,
                "cover_url": c.cover_url,
                "genre": genre,
                "spotify_track_id": c.track_id,
                "spotify_url": c.spotify_url,
            },
        )
        SleeveSong.objects.create(sleeve=sleeve, song=song, rarity=rarity)
        rarity_counts[rarity] += 1

    print(
        f"Updated {sleeve.name}: "
        f"Legendary={rarity_counts['Legendary']} Epic={rarity_counts['Epic']} Common={rarity_counts['Common']}"
    )


def refresh_genre_sleeve(token: str, genre: str, limit: int, market: str) -> None:
    candidates = fetch_candidates_for_genre(token, genre=genre, limit=limit, market=market)
    if not candidates:
        print(f"No candidates returned for genre={genre}; skipping")
        return

    scored = score_candidates(candidates, genre=genre)
    chosen = select_final_sleeve(scored)

    if len(chosen) < 8:
        print(f"Not enough candidates for full sleeve in genre={genre}; got={len(chosen)}")
        return

    upsert_sleeve_entries(genre=genre, chosen=chosen)


def main() -> None:
    parser = argparse.ArgumentParser(description="Refresh weekly sleeves from Spotify")
    parser.add_argument("--genres", nargs="+", default=["Pop", "Rock", "Rap"])
    parser.add_argument("--limit", type=int, default=30, help="per-source search limit")
    parser.add_argument("--market", default="US")
    args = parser.parse_args()

    client_id = os.environ.get("SPOTIFY_CLIENT_ID")
    client_secret = os.environ.get("SPOTIFY_CLIENT_SECRET")
    if not client_id or not client_secret:
        raise RuntimeError("SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET are required")

    try:
        token = spotify_token(client_id, client_secret)
    except error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="ignore")
        raise RuntimeError(f"Spotify token request failed: {exc.code} {detail}") from exc

    for genre in args.genres:
        refresh_genre_sleeve(token, genre=genre, limit=args.limit, market=args.market)


if __name__ == "__main__":
    main()