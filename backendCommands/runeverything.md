Clean fix (copy/paste exactly)
Run this from repo root (muscino-frontend), not inside server:

# 0) leave broken env
deactivate 2>/dev/null || true

# 1) delete old/bad venvs (both possible locations)
rm -rf .venv
rm -rf server/.venv

# 2) create ONE fresh venv at repo root
python -m venv .venv

# 3) activate (Git Bash on Windows)
source .venv/Scripts/activate

# 4) verify interpreter path
python -c "import sys; print(sys.executable)"

# 5) always use python -m pip (avoids bad pip launcher shims)
python -m pip install --upgrade pip
python -m pip install -r server/requirements.txt

# 6) migrate DB
cd server
python manage.py migrate

# 7) run backend
python manage.py runserver 8000
Open a second terminal for frontend:

cd /c/Users/mikey/OneDrive/Documents/backups/MuscinoGit/muscino-frontend
npm install
npm run dev