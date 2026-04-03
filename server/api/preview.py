import json
import re
from dataclasses import dataclass
from urllib import error, parse, request


ITUNES_SEARCH_URL = "https://itunes.apple.com/search"


@dataclass
class PreviewSnippet:
    preview_url: str
    source: str = "itunes"


def _artist_tokens(artist: str) -> list[str]:
    return [
        token.strip()
        for token in re.split(r",|&| feat\.?| featuring ", (artist or "").strip(), flags=re.IGNORECASE)
        if token.strip()
    ]


def _itunes_song_candidates(query_text: str, *, limit: int = 10) -> list[dict]:
    params = parse.urlencode(
        {
            "term": query_text,
            "media": "music",
            "entity": "song",
            "limit": limit,
            "country": "US",
        }
    )
    req = request.Request(f"{ITUNES_SEARCH_URL}?{params}", method="GET")
    with request.urlopen(req, timeout=15) as resp:
        payload = json.loads(resp.read().decode("utf-8"))
    return payload.get("results", [])


def search_track_genre(title: str, artist: str | None = None) -> str | None:
    """Find the most likely Apple/iTunes genre label for a track."""
    normalized_title = (title or "").strip()
    normalized_artist = (artist or "").strip()
    if not normalized_title:
        return None

    wanted_title = normalized_title.casefold()
    artist_tokens = [token.casefold() for token in _artist_tokens(normalized_artist)]
    query_candidates = []
    if normalized_artist:
        query_candidates.append(f"{normalized_title} {normalized_artist}")
    if artist_tokens:
        query_candidates.append(f"{normalized_title} {artist_tokens[0]}")
    query_candidates.append(normalized_title)

    seen_queries: set[str] = set()
    for query_text in query_candidates:
        key = query_text.casefold()
        if key in seen_queries:
            continue
        seen_queries.add(key)

        try:
            candidates = _itunes_song_candidates(query_text, limit=20)
        except (error.HTTPError, error.URLError, TimeoutError, ValueError):
            continue
        if not candidates:
            continue

        best_score = -1
        best_genre: str | None = None

        for item in candidates:
            genre_name = (item.get("primaryGenreName") or "").strip()
            if not genre_name:
                continue

            score = 0
            track_name = str(item.get("trackName", "")).casefold()
            artist_name = str(item.get("artistName", "")).casefold()

            if track_name == wanted_title:
                score += 5
            elif wanted_title and wanted_title in track_name:
                score += 2

            matched_artist = False
            for token in artist_tokens:
                if artist_name == token:
                    score += 4
                    matched_artist = True
                elif token in artist_name:
                    score += 2
                    matched_artist = True

            if artist_tokens and not matched_artist:
                continue

            if score > best_score:
                best_score = score
                best_genre = genre_name

        if best_genre:
            return best_genre

    return None



def search_preview_snippet(title: str, artist: str | None = None) -> PreviewSnippet | None:
    """Find an external preview clip for a track using Apple's iTunes Search API."""
    normalized_title = (title or "").strip()
    normalized_artist = (artist or "").strip()

    if not normalized_title:
        return None

    query_text = normalized_title if not normalized_artist else f"{normalized_title} {normalized_artist}"
    params = parse.urlencode(
        {
            "term": query_text,
            "media": "music",
            "entity": "song",
            "limit": 10,
        }
    )

    req = request.Request(f"{ITUNES_SEARCH_URL}?{params}", method="GET")
    try:
        with request.urlopen(req, timeout=15) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
    except (error.HTTPError, error.URLError, TimeoutError, ValueError):
        return None

    candidates = payload.get("results", [])
    if not candidates:
        return None

    wanted_title = normalized_title.casefold()
    wanted_artist = normalized_artist.casefold()

    best_score = -1
    best_preview_url: str | None = None

    for item in candidates:
        preview_url = item.get("previewUrl")
        if not preview_url:
            continue

        score = 0
        track_name = str(item.get("trackName", "")).casefold()
        artist_name = str(item.get("artistName", "")).casefold()

        if track_name == wanted_title:
            score += 4
        elif wanted_title and wanted_title in track_name:
            score += 2

        if wanted_artist and artist_name == wanted_artist:
            score += 4
        elif wanted_artist and wanted_artist in artist_name:
            score += 2

        if score > best_score:
            best_score = score
            best_preview_url = preview_url

    if not best_preview_url:
        return None

    return PreviewSnippet(preview_url=best_preview_url)