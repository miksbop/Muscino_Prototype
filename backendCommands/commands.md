## To start the backend server put in this command:

# from repo root

cd .\server

python -m venv .venv
.\.venv\Scripts\Activate.ps1

pip install -r requirements.txt

python manage.py makemigrations
python manage.py migrate

# optional: seed DB from frontend mock (if seed.py exists)

python seed.py

# start dev server on port 8000

python manage.py runserver 8000

## To create a user, go to the server directory of the project and put this command into the terminal,

.\.venv\Scripts\Activate.ps1
python .\create_user_cli.py

## Once created open a new terminal and start the frontend enviroment with:

npm run dev
