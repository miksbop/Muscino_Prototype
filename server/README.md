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
