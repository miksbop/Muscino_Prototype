# Muscino: Algorithm-Driven Music Collection Site

**Course:** CIS 485 — Directed Research in CIS  
**Authors:** Michael Pastora, Aidan Cameron, and Justin Liang

## Project Overview
Muscino is a full-stack social e-commerce web application that treats real-world songs as collectible items. The platform gamifies music engagement through sleeve opening mechanics, rarity tiers, a user inventory, reroll systems, and a player-driven marketplace.

The core technical goal is not only to deliver collectible-music gameplay, but also to support **algorithm-driven maintainability**: new content can be curated and introduced by automated systems rather than purely manual developer updates.

## Abstract (Condensed)
Modern streaming services prioritize convenience over ownership. Muscino reintroduces ownership by letting users collect songs through game-like systems. We developed key algorithms for sleeve opening, sleeve curation, and inventory rerolling to balance engagement, fairness, and long-term system sustainability. Despite API deprecations (notably from Spotify), the project adapted by integrating Apple API flows and fallback strategies.

## Core Features
### Functional Features
- Sleeve opening to acquire songs with rarity outcomes.
- Inventory and profile systems tied to user ownership.
- Song reroll mechanic (exchange 3 owned songs for a randomized artist-based result).
- In-app economy with user marketplace and virtual currency.

### Non-Functional Features
- Responsive frontend behavior across viewports.
- Predictable and fair user outcomes (e.g., open sleeve => guaranteed song).
- Ongoing content freshness via automated curation logic.

## System Architecture
### Frontend
- React + TypeScript SPA built with Vite.
- React Router for route-based navigation.
- Tailwind CSS/PostCSS and custom CSS for styling and UI polish.
- Shared global session state via auth context plus page-local interactive state.

### Backend
- Django + Django REST Framework.
- SQLite for development and testing persistence.
- Typed API boundaries between client and server (`src/services/api.ts`).

## Algorithms Implemented
1. **Sleeve Opening Algorithm**
   - Validates user/session and currency requirements.
   - Applies rarity-based selection probabilities.
   - Grants ownership + XP with default rarity fallback behavior.

2. **Sleeve Curation Algorithm**
   - Builds fixed-size sleeves (12 songs) with rarity mix constraints.
   - Sources and scores candidates by weighted relevance signals.
   - Enforces song uniqueness and artist diversity with controlled backfill.

3. **Inventory Reroll Algorithm**
   - Requires exactly 3 unique, owned, non-listed songs.
   - Uses Apple API as primary artist-track source (Spotify fallback).
   - Applies rarity logic from search position, with weighted boosts from consumed song rarities.
   - Executes atomically to preserve data integrity.

## Roadblocks and Solutions
- **Spotify API deprecations (Feb 2026):** migrated key retrieval flows toward Apple API while maintaining fallback logic.
- **Rarity without popularity endpoints:** switched to index-based and weighted rarity mapping.
- **Artist mismatch during reroll:** added tokenized name matching to improve correctness.
- **Preview accuracy issues:** added normalization, query strategy tiers, scoring, and caching for robust 30-second preview retrieval.

## Current Status
The application is mostly feature complete and currently focused on:
- tightening automated curation quality,
- improving UX polish,
- hardening security for production-readiness,
- continuing iterative play-testing.

## Local Development
### Prerequisites
- Node.js + npm
- Python 3.x

### Frontend
```bash
npm install
npm run dev
npm run build
```

### Backend
```bash
cd server
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

## Repository Structure (High-Level)
- `src/` — React frontend (pages, components, context, services, styles)
- `server/` — Django backend (API models/views/serializers/management)
- `public/` — static assets (icons, fonts, sounds, backgrounds)
- `markdownplans/` — internal planning/implementation notes

## References
- Django Documentation: https://docs.djangoproject.com/en/6.0/ref/
- Spotify Developer Update (Feb 2026): https://developer.spotify.com/blog/2026-02-06-update-on-developer-access-and-platform-security
- Spotify Developer Terms: https://developer.spotify.com/terms

(Additional literature references are documented in the project paper.)
