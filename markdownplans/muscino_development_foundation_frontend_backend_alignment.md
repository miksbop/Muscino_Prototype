# Muscino – Development Foundation & Alignment Document

> **Purpose**: This document captures where the project currently stands, what each side of the team needs to learn, how responsibilities are divided, and the architectural principles we must preserve so that frontend and backend integration remains smooth as development progresses.
>
> This file is intentionally written as a **living reference** for both humans and AI assistants to revisit later in development.

---

## 1. Current Project State (Snapshot)

### Status: **Foundation Phase – Frontend First**

- Frontend environment successfully set up using **React + TypeScript + Vite + Tailwind CSS**
- Core project structure established
- A working **Collection page** is implemented using **mock data**
- Data flow follows a clean **API abstraction pattern** (mock now → real backend later)

### What is already working
- React rendering and hot reload
- Tailwind styling pipeline
- Type-safe data models (`Song`, `OwnedSong`, `Rarity`)
- Mock API (`api.getInventory()`) simulating async backend calls
- Collection UI with:
  - Inventory grid
  - Click-to-select behavior
  - Detail panel

This confirms that the **UI architecture is viable** and that future pages will reuse the same patterns.

---

## 2. Core Architectural Principle (Most Important Rule)

> **All frontend data access MUST go through the API layer.**

### What this means:
- UI components and pages **never import mock data directly**
- UI components only call functions like:
  - `api.getInventory()`
  - `api.openSleeve()` (future)
  - `api.getMarketListings()` (future)

### Why this matters:
- Allows frontend to be fully developed without backend readiness
- Backend integration later only requires swapping implementation inside `services/api.ts`
- Prevents tight coupling and rewrite-heavy integration

This rule must be preserved throughout the entire project.

---

## 3. Frontend Stack & What Each Tool Is Used For

### Frontend Technologies

| Tool | Purpose | Affects Which Parts |
|----|----|----|
| **React** | UI rendering, component structure, state | All pages & components |
| **TypeScript** | Type safety, API contracts | Data models, API responses, props |
| **Vite** | Dev server, bundling | Development speed & hot reload |
| **Tailwind CSS** | Styling & layout | Visual consistency, rapid UI building |
| **React Hooks** | State & lifecycle | Selection logic, loading states |

### Frontend Concepts to Learn (by importance)

1. **Component-based design** (breaking UI into reusable parts)
2. **State management with `useState`**
3. **Side effects with `useEffect`**
4. **Conditional rendering** (loading vs content)
5. **TypeScript interfaces & unions**
6. **Routing (React Router)** – upcoming

---

## 4. Backend Stack (Planned) & Responsibilities

### Backend Technologies (Team Responsibility)

| Tool | Purpose | Affects Which Parts |
|----|----|----|
| **Django** | Core backend framework | Authentication, logic, admin |
| **Django REST Framework** | API layer | All frontend data calls |
| **PostgreSQL** | Relational data storage | Users, inventory, market, sleeves |
| **Celery + Redis** | Background jobs | Daily credits, weekly sleeve refresh |
| **Spotify / YouTube APIs** | External data ingestion | Sleeve contents, popularity metrics |

### Backend Responsibilities

- User authentication & profiles
- Inventory persistence
- Market listings & transactions
- Sleeve opening logic (authoritative odds)
- Weekly sleeve refresh logic
- Credit balances & streaks

The backend owns **truth, validation, and persistence**.

---

## 5. Shared Data Contracts (Critical for Integration)

### Canonical Frontend Models (Already Defined)

- `Song`
- `OwnedSong`
- `Rarity`

These models define the **expected shape of backend responses**.

### Integration Guideline

Backend endpoints should return JSON that **matches these types exactly** (or be explicitly versioned and discussed).

Type mismatches should be considered **integration bugs**, not frontend errors.

---

## 6. Pages & Feature Ownership

### Frontend-Owned (UI & Interaction)

| Page | Frontend Responsibility |
|----|----|
| Home | Layout, animation, personalization display |
| Collection | Inventory grid, selection, actions |
| Sleeve Selection | UI, hover odds, navigation |
| Sleeve Opening | Animation, reveal UX |
| Market | Listings table, search, filters |
| Profile | Layout, showcase, stats |

### Backend-Owned (Logic & Authority)

| Feature | Backend Responsibility |
|----|----|
| Sleeve odds | Authoritative probability |
| Market pricing | Validation & atomic transactions |
| Inventory updates | Persistence & ownership |
| Credits | Balance updates & constraints |
| Personalization | Recommendation logic |

---

## 7. Development Roadmap (High Level)

### Phase 1 – Foundation (Current)
- Frontend scaffolding
- Mock API
- Collection page

### Phase 2 – Component Extraction
- `SongCard`
- `SongDetailPanel`
- `GlassPanel`
- `RarityBadge`

### Phase 3 – Navigation & Routing
- Top navigation bar
- React Router setup
- Page transitions

### Phase 4 – Feature Pages
- Sleeve selection page
- Sleeve opening page
- Market page
- Profile page

### Phase 5 – Backend Integration
- Replace mock API with real endpoints
- Error handling & loading states
- Auth-protected routes

### Phase 6 – Polish & Research Framing
- UX polish
- Performance tuning
- Research discussion & documentation

---

## 8. Things to Keep in Mind (For Future You & AI)

### Always Remember
- **Foundation > features > polish**
- Avoid premature backend assumptions in UI
- Never bypass the API abstraction layer
- Prefer clarity over cleverness

### LLM Usage Guidelines
- Ask for explanations before abstractions
- Validate generated code against existing patterns
- Maintain naming consistency
- Revisit this document when adding major features

---

## 9. Definition of “Good Progress”

At this stage, success is:
- Clean data flow
- Reusable components
- Predictable integration
- Confidence in how pieces fit together

Not:
- Feature completeness
- Final visuals
- Perfect animations

---

**This document represents the architectural spine of Muscino.**
Changes should be intentional and discussed, not accidental.

