# Django backend (prototype)

This folder contains a minimal Django + Django REST Framework backend scaffold using SQLite.

Quick setup (PowerShell)

```powershell
# create venv
python -m venv .venv
.\.venv\Scripts\Activate.ps1

# install deps
pip install -r requirements.txt

# create migrations & migrate
python manage.py makemigrations api
python manage.py migrate

# seed initial data (copies frontend mock)
python seed.py

# run dev server
python manage.py runserver 8000
```

API endpoints

- GET /api/songs/ -> list songs
- GET /api/sleeves/ -> list sleeves and contents
- GET /api/inventory/ -> list owned songs (if authenticated, returns only the user's inventory; supports ?owner=username)
- POST /api/sleeves/<id>/open -> open a sleeve and receive an OwnedSong

Notes

- The seed script creates a `demo` user and attaches initial inventory to that account.
- For production, replace SQLite with Postgres and add proper auth (Token or JWT) and permissions.








## Spotify API prototype (track + artist genre)

Use `spotify_probe.py` to inspect exactly which Spotify JSON fields you can map into the current `Song` model, including normalized app genres.

1) Create a Spotify app (Dashboard) and copy client credentials.
2) Export credentials:

```bash
export SPOTIFY_CLIENT_ID="your_client_id"
export SPOTIFY_CLIENT_SECRET="your_client_secret"
```

3) Run a probe query:

```bash
cd server
python spotify_probe.py --query "hyperpop" --limit 10 --output spotify_probe_hyperpop.json
```

Example output item shape:

```json
{
  "id": "spotify_...",
  "title": "...",
  "artist": "...",
  "cover_url": "...",
  "genre": "Pop",
  "genre_source": {
    "spotify_artist_genres": ["hyperpop", "...]
  },
  "spotify_track_id": "...",
  "spotify_url": "..."
}
```

Notes:
- Spotify genre is artist-level metadata, so this script pulls tracks then fetches artist objects to get `genres`.
- `genre` is normalized to a coarse app bucket (Pop/Rock/Hip-Hop/etc.) so subgenres like `hyperpop` map to `Pop` and `math rock` maps to `Rock`.
- If no mapping is found, it falls back to `Uncategorized`.

### Troubleshooting HTTP 403

If you see `HTTP Error 403: Forbidden`, Spotify accepted your connection but rejected the request. Common causes:

- Spotify app configuration/access restrictions in the Developer Dashboard.
- Wrong credentials copied into env vars (using account login info instead of app Client ID/Secret).
- Market-specific restrictions for the search request.

Try this checklist:

1. Create a fresh Spotify app in the Developer Dashboard and use its **Client ID/Client Secret**.
2. Re-export env vars in the same terminal session where you run the script.
3. Retry with explicit market:

```bash
python spotify_probe.py --query "hyperpop" --limit 5 --market US
```

The script now prints Spotify response details for 401/403/429 errors to make diagnosis easier.


If your error is specifically `403 ... during artist lookup`, your token and track search worked, but Spotify blocked the `/v1/artists` batch call for your app context.

The probe now falls back automatically: if `/v1/artists` returns 403, it uses `/v1/search?type=artist` per primary artist name to recover `genres` where possible.

Windows note: set env vars without extra quotes/spaces in the stored value. In `cmd.exe`, prefer:

```bat
set SPOTIFY_CLIENT_ID=your_client_id
set SPOTIFY_CLIENT_SECRET=your_client_secret
python spotify_probe.py --query "hyperpop" --limit 5 --market US
```

If this still returns 403 for both `/artists` and artist-search fallback, test the same credentials in curl/Postman. If those fail too, the issue is Spotify app/account-level rather than this script.


### Genre fallback when Spotify returns empty artist genres

In some app contexts, `/v1/artists` (or artist fallback search) can return no usable `genres`.
The probe now adds a second fallback layer:

- First choice: `spotify_artist_genres` -> normalized bucket.
- Fallback: keyword inference from query + track title + artist + album (`genre_source.method = "text_fallback"`).

This means a query like `hyperpop` can still map to `Pop` even when Spotify genre arrays are empty.

Also, IDs now prefer `spotify_track_<track_id>` so duplicate title/artist pairs don't collide.



### Is this optimal for Muscino? (Short answer: good prototype, not final)

Current strategy is a practical prototype, but production should treat genre as a **tiered decision**:

1. `spotify_artist_genres` (highest trust)
2. `text_fallback` keyword inference (lower trust)
3. `Uncategorized` for manual review

The probe now emits `genre_source.confidence` so the app/backend can decide how to use it:
- `high`: safe to auto-assign into genre collections
- `low`: allow provisional assignment or queue for moderation
- `none`: keep out of genre-locked sleeves until reviewed

### How the app should get genre with this system

At ingest time (or periodic enrichment job), store:
- `Song.genre` from probe output (`Pop`, `Rock`, etc.)
- optional audit metadata from `genre_source` (method/confidence/match)

Then gameplay can simply read `Song.genre` for sleeve/collection eligibility.
If you only persist `Song.genre` today, that still works; adding source/confidence later just improves quality control.



### Popularity -> rarity prototype

Yes — the probe can use Spotify's built-in track `popularity` (0-100) to derive rarity.
Current mapping:

- `> 80` -> `Legendary`
- `60-80` -> `Epic`
- `40-59` -> `Rare`
- `20-39` -> `Uncommon`
- `< 20` -> `Common`

Output now includes:
- `spotify_popularity`
- `rarity`

Note on bias:
- Spotify search often returns already-popular tracks first, so this mapping can skew results toward high rarity if you only use top search results.
- That's acceptable for this phase; later you can balance by mixing query sources, paging deeper (`offset`), or post-normalizing rarity distribution.

## Spotify metadata hydration + cache

To avoid persisting Spotify display metadata in SQLite, API responses can hydrate track details from Spotify at request time and cache them briefly in Django cache.

Set these env vars before running the backend:

```bash
export SPOTIFY_CLIENT_ID="your_client_id"
export SPOTIFY_CLIENT_SECRET="your_client_secret"
# optional, defaults to 3600 seconds
export SPOTIFY_TRACK_CACHE_TTL_SECONDS="3600"
```

When configured, endpoints such as `/api/songs/`, `/api/sleeves/`, and `/api/inventory/` resolve `spotifyTrackId` into fresh `title`, `artist`, and `coverUrl` values from Spotify.
If credentials are absent or Spotify is unavailable, the backend falls back to DB values.