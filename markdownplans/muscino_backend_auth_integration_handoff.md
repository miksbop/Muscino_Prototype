# Muscino Auth + Account System Handoff (Frontend ↔ Backend)

> Audience: backend engineers implementing real login/account persistence for the current frontend shell.
>
> Goal: replace frontend session stubs with real server auth while preserving the existing API-layer architecture.

---

## 1) Current Frontend Auth State (What Exists Today)

### Implemented in frontend
- `AuthProvider` + `useAuth()` context exists and is globally mounted.
- Login page route exists (`/login`) with username/password form UI.
- TopNav switches between:
  - signed out → `Sign in`
  - signed in → user display + wallet + avatar + `Sign out`
- Frontend auth calls currently go through `services/api.ts` methods:
  - `getSession()`
  - `login(input)`
  - `logout()`

### Important: current auth is a stub
- Session is only in-memory (`sessionUser` variable).
- Refreshing browser loses auth.
- No real database user check or password verification.
- No tokens/cookies yet.

---

## 2) What Backend Must Deliver for Real Auth

## Minimum endpoints (recommended)

### `POST /api/auth/login/`
Request:
```json
{
  "username": "string",
  "password": "string"
}
```

Response `200`:
```json
{
  "user": {
    "id": "string",
    "username": "string",
    "displayName": "string",
    "wallet": 100,
    "avatarUrl": "https://..." 
  }
}
```

Errors:
- `400` invalid payload
- `401` invalid credentials
- `429` rate limit (optional but recommended)

---

### `GET /api/auth/session/`
Returns currently authenticated user or signed-out state.

Response `200` signed-in:
```json
{
  "user": {
    "id": "string",
    "username": "string",
    "displayName": "string",
    "wallet": 100,
    "avatarUrl": "https://..."
  }
}
```

Response `200` signed-out:
```json
{
  "user": null
}
```

---

### `POST /api/auth/logout/`
- Invalidates session/token.
- Returns `204` or `{ "ok": true }`.

---

## Auth strategy options (pick one and lock)

### Option A (recommended first): cookie session auth (Django session)
- Uses HttpOnly secure cookies.
- Simpler for browser-based app.
- Requires CSRF handling for mutating routes.

### Option B: JWT auth
- Access + refresh tokens.
- More explicit for mobile/multi-client use.
- Requires token storage/refresh logic in frontend.

If uncertain, choose **Option A first** for speed and security baseline.

---

## 3) Frontend Changes Required Once Backend Auth Is Ready

These are required edits in `src/services/api.ts` (and only there for network/auth logic):

1. Replace `sessionUser` in-memory implementation.
2. Implement real `fetch` calls:
   - `login()` → `POST /api/auth/login/`
   - `getSession()` → `GET /api/auth/session/`
   - `logout()` → `POST /api/auth/logout/`
3. Add `credentials: "include"` for cookie-based auth.
4. Normalize backend user payload into frontend `AuthUser` shape.
5. Return typed, explicit errors for UI messaging.

### Frontend components should **not** need rewrites
- `AuthContext` should keep working if API contract is stable.
- `LoginPage` should keep working if endpoint errors are consistent.
- `TopNav` should keep working if `AuthUser` response shape is consistent.

---

## 4) Account Features to Support (User Expectations)

User explicitly expects account system to support:
1. Currency balance
2. Owned songs/items
3. Opening collections/sleeves
4. Persistent profile-linked progress

### Backend implications
- Wallet/credits must be persisted per user.
- `OwnedSong` creation on sleeve open must always be tied to authenticated user.
- Inventory endpoint for logged-in users should return only that user’s items.
- Sleeve opening endpoint should reject unauthenticated requests once auth is enforced (or define guest mode explicitly).

---

## 5) Areas Currently Working Against This Goal

1. **Mock fallback may hide backend/auth issues**
   - `getInventory`, `getSleeves`, and `openSleeve` silently fall back to local mock data.
   - During auth rollout this can mask server failures and make QA unreliable.

2. **No protected route behavior yet**
   - `/collection` and `/play` are still public even if user is signed out.
   - Decide product policy (read-only guest vs auth-required) and enforce in router.

3. **Type mismatch risk for ownership fields**
   - Backend `OwnedSongSerializer` includes `owner`.
   - Frontend `OwnedSong` type currently doesn’t model `owner`.
   - Either add optional `owner?: string | null` on frontend or strip in API mapping.

4. **Build/CI hygiene currently degraded**
   - Existing TypeScript errors in unrelated files can block reliable release checks.
   - Fix baseline so auth integration regressions are visible immediately.

5. **Security defaults not production-ready yet**
   - Backend currently allows all CORS origins in dev settings.
   - No auth permission classes enforced yet.

---

## 6) Suggested Backend Implementation Sequence

### Phase 1 — Authentication base
- Add auth endpoints (`login`, `session`, `logout`).
- Return stable `AuthUser` response shape.
- Add session persistence.

### Phase 2 — Attach gameplay to identity
- Require auth on sleeve open endpoint.
- Ensure wallet deduction + inventory creation are atomic DB transaction.
- Ensure inventory endpoint filters by authenticated user.

### Phase 3 — Guardrails + ops
- Add rate limiting for login.
- Add audit logging for sleeve open + wallet changes.
- Add tests for auth/session/inventory ownership boundaries.

---

## 7) Contract Checklist (Definition of Done)

Backend is ready for frontend switch when all are true:
- [ ] `/api/auth/login/` implemented and tested.
- [ ] `/api/auth/session/` implemented and tested.
- [ ] `/api/auth/logout/` implemented and tested.
- [ ] Stable `AuthUser` payload shape matches frontend type.
- [ ] Authenticated inventory filtering works.
- [ ] Sleeve open persists item to authenticated user.
- [ ] Wallet persistence and deduction rules defined.
- [ ] CORS/auth settings tightened beyond dev defaults.

Frontend switch is done when all are true:
- [ ] `api.ts` auth methods call real backend.
- [ ] Cookie/token strategy implemented correctly.
- [ ] Signed-in state survives refresh.
- [ ] Sign-out clears server session and UI state.
- [ ] Mock fallback policy explicitly adjusted for auth-sensitive endpoints.

---

## 8) Non-Goals for This Handoff

- Full registration/signup UX
- Password reset UX
- Role-based admin panel
- OAuth provider login

These can come next, but are intentionally out of scope for first real auth integration.

---

**Owner note:** This document intentionally isolates auth contract decisions so frontend UI can continue evolving without backend-integration churn.