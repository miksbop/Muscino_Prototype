# Muscino — Continuation Plan (Frontend/Backend Alignment + Next Build Targets)

> **Purpose**: This update captures the *current implemented state* of Muscino and defines the next implementation constraints so the team can continue building without layout regressions or architecture drift.

---

## 1) Current State (Validated Snapshot)

### Frontend architecture currently in place
- Routing is live with `createBrowserRouter` and wrapped in a shared `AppLayout` + global `TopNav`.
- Current routes:
  - `/` → Home
  - `/collection` → Collection
  - `/Play` → Play
- CSS is now organized by drawers loaded in `main.tsx`:
  - `styles/index.css`
  - `styles/shared/ui.css`
  - `styles/shared/effects.css`
  - `styles/pages/home.css`
  - `styles/pages/collection.css`

### Data access contract currently honored
- Frontend calls data through `services/api.ts` (`getInventory`, `getSleeves`, `openSleeve`) with backend-first + mock fallback behavior.
- Mock sources are only consumed inside the API service, not directly by page components.

### Visual status from latest mockup/current screenshots
- Home: hero-focused, top nav persistent, moving album-cover band at lower fold.
- Collection: left detail panel + right scrollable card grid are visually stable and aligned.
- Play: sleeve-oriented layout with left feature panel + right contents grid, matching the established glass style language.

---

## 2) Locked Rules (Do Not Break)

1. **All UI data access stays behind `services/api.ts`.**
2. **No direct mock imports inside pages/components.**
3. **Rarity styling logic remains centralized in `src/types/rarity.ts`.**
4. **No inline rarity color math in components.**
5. **Small, incremental CSS moves only** while cleaning style drawers.
6. **No accidental layout metrics drift** (left panel alignment, right-panel scroll, bottom card safety padding, sticky behavior).

---

## 3) Backend Reality Check (Must Be Considered by Frontend)

### Confirmed backend entities and fields
- `Song` now includes:
  - `genre`
  - `spotify_track_id`
  - `spotify_url`
- `OwnedSong` includes optional `owner` (`username` in serializer) and `obtainedAt`.
- `SleeveSong` includes optional `weight` override in addition to rarity-based weighting.

### Confirmed API endpoints
- `GET /api/songs/`
- `GET /api/sleeves/`
- `GET /api/inventory/`
- `POST /api/sleeves/<sleeve_id>/open`

### Frontend implications
- Keep API typings aligned with backend serializer casing (`coverUrl`, `spotifyTrackId`, `spotifyUrl`, `obtainedAt`, `owner`).
- Treat `owner` as nullable and plan for authenticated inventory filtering later.
- Preserve compatibility with weighted sleeve opening (rarity + optional explicit `weight`).

---

## 4) AI Genre-Categorization Requirement (Team Objective)

### Product context
Spotify/YouTube metadata may be insufficient for genre consistency in Muscino. Team requires an internal AI-assisted genre categorization workflow.

### Implementation guidance (phased)
**Phase A — Data pipeline prep (now)**
- Ensure backend song records keep source fields needed for enrichment (`title`, `artist`, external IDs/URLs).
- Add explicit placeholder state for unknown genre (`null` or `"Uncategorized"`) and never block UI rendering.

**Phase B — Classifier integration (later backend task)**
- Add backend job/task to assign normalized app genres (e.g., Pop, Rock, Hip-Hop, R&B, Electronic, etc.).
- Store:
  - predicted genre
  - confidence score
  - model/version metadata
  - timestamp of classification

**Phase C — Frontend usage**
- Frontend consumes finalized genre labels through API only.
- No client-side genre inference logic in React pages.
- Add admin/debug views later for low-confidence items and manual overrides.

---

## 5) Upcoming Login Page (Preparation Notes)

### Why now
Profile is currently placeholder/fake; auth-enabled user flows are the next major unlock for real inventory ownership and progression.

### Pre-login constraints to preserve
- Keep `TopNav` global and page-agnostic.
- Keep routes clean under shared layout.
- Avoid introducing global state library before auth requirements are clear.

### Login page acceptance criteria (next build phase)
1. New route for login page under existing router.
2. Visual style matches current glass + spacing system.
3. Form states: idle, validating, submitting, error, success.
4. API integration remains isolated in service layer (future `api.login`, `api.me`, etc.).
5. Supports future protected routes without breaking current public pages.

---

## 6) Display/Text Scaling Problem (Important UX Track)

### Observed issue
The app looks "correct" at the current Windows accessibility text scaling (~139%), but visual proportions diverge when OS text scale changes.

### Non-destructive strategy
- Prefer resilient sizing tokens over one-off pixel locks:
  - use `rem`/`clamp()` for typography
  - isolate decorative transforms from text flow
  - avoid relying on a single viewport/text-scale coincidence
- Build a scale-validation matrix for major pages (Home/Collection/Play):
  - 100%
  - 125%
  - 139%
  - 150%
- Validate for each scale:
  - nav wrap/overlap
  - panel clipping
  - card title overflow
  - scrollbars/dual-scroll regressions

### Guardrail
Do **not** use forced global CSS transforms/zoom hacks to "fake" consistency. Fix layout and typography systems directly.

---

## 7) Immediate Next Steps (Documentation-Driven Execution)

1. Finish CSS drawer cleanup comments and deduplicate repeated section headers.
2. Run a layout regression pass on Home/Collection/Play after every CSS move.
3. Draft backend contract extension for genre-classifier metadata fields.
4. Define login page wireframe + state model before coding.
5. Introduce typography sizing tokens for scale resilience (small PR, page by page).

---

## 8) Definition of Success for This Stage

Success now means:
- Clean architecture continuity
- Stable layouts at multiple text-scale settings
- Backend-aware frontend planning
- Clear path to auth and genre AI integration

Not yet:
- Full auth implementation
- Full market/profile completion
- Final animation polish pass

---

**This file is intended to be committed as a living continuation brief for the next development cycle.**