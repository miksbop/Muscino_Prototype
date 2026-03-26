# Muscino Backend Implementation Summary made with the help of Gemini CLI

This document summarizes the changes made to transition the Muscino prototype from a mock-based system to a fully functional, persistent Django backend.

## 1. Authentication & Security
- **Global CSRF Disable:** Implemented `DisableCSRFMiddleware` in `settings.py` to bypass CSRF checks for the prototype environment, resolving "CSRF Failed" errors during login and sleeve opening.
- **Session-Based Auth:** Re-enabled `SessionAuthentication` in REST Framework to allow the backend to recognize logged-in users via cookies.
- **CORS Policy:** Configured `CORS_ALLOW_CREDENTIALS = True` and set `CORS_ALLOWED_ORIGINS` to include Vite development ports, allowing the frontend to maintain a persistent session.
- **Auth Endpoints:** 
    - `POST /api/auth/register/`: Creates a new user and signs them in immediately.
    - `POST /api/auth/login/`: Validates credentials and establishes a session.
    - `POST /api/auth/logout/`: Clears the session cookie.
    - `GET /api/auth/session/`: Returns the currently logged-in user's profile and wallet.

## 2. Database & Models
- **Automated Profiles:** Added a Django `post_save` signal to automatically create a `Profile` (with a default wallet of 100) whenever a new User is created.
- **Inventory Persistence:** Updated `OwnedSong` to correctly link to the `auth.User` model.
- **Unique Identification:** Modified serializers to return the `OwnedSong` primary key as `id` and the catalog song ID as `songId`, ensuring unique keys for frontend rendering.

## 3. Game Logic (Sleeve Opening)
- **Authentication Check:** The `open_sleeve` endpoint now requires a valid session.
- **Wallet Deduction:** 
    - Checks if `user.profile.wallet >= sleeve.cost`.
    - Deducts cost from the profile and saves the change to the database.
- **Inventory Addition:** Creates a new `OwnedSong` record tied to the specific user who opened the sleeve.

## 4. Frontend Integration
- **Auth Hook:** Added `signUp` and `refreshUser` to the `useAuth` hook.
- **UI Feedback:**
    - The `LoginPage` now toggles between "Sign In" and "Create Account".
    - The `PlayPage` calls `refreshUser` immediately after a successful sleeve opening to update the wallet balance in the navigation bar.
- **Session Support:** Updated `fetchJson` in `api.ts` to use `credentials: "include"`, ensuring browser cookies are sent with every request.

## 5. Development Utilities
- **Seed Script:** Initialized the database with the full catalog of songs and sleeves.
- **Verification Scripts:** Created temporary tools to verify user data and reset wallet balances for testing (e.g., setting 'justin' to 10,000 wallet balance).
