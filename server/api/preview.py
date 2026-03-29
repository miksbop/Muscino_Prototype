import json
from dataclasses import dataclass
from urllib import error, parse, request


ITUNES_SEARCH_URL = "https://itunes.apple.com/search"


@dataclass
class PreviewSnippet:
    preview_url: str
    source: str = "itunes"


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