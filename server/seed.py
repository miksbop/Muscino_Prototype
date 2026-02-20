"""
Seed script for the Django backend. Run after migrations:

  python -m venv .venv
  .\.venv\Scripts\Activate.ps1
  pip install -r requirements.txt
  python manage.py makemigrations api
  python manage.py migrate
  python seed.py

This script creates Songs, Sleeves, SleeveSong relationships and some OwnedSong entries
based on the frontend mock data.
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api.models import Song, Sleeve, SleeveSong, OwnedSong
from django.contrib.auth.models import User

MOCK_SLEEVES = [
    {
        'id': 'sleeve_pop_01',
        'name': 'Pop Sleeve',
        'genre': 'Pop',
        'cost': 20,
        'refreshed_weekly': True,
        'contents': [
            {
                'id': 'song_pop_gabriella',
                'title': 'Gabriella',
                'artist': 'Katseye',
                'cover_url': 'https://i.scdn.co/image/ab67616d0000b273f8d4d00ffe09373efb13ce29',
                'genre': 'Pop',
                'rarity': 'Legendary',
            },
            {
                'id': 'song_pop_espresso',
                'title': 'Espresso',
                'artist': 'Sabrina Carpenter',
                'cover_url': "https://upload.wikimedia.org/wikipedia/en/f/fd/Short_n%27_Sweet_-_Sabrina_Carpenter.png",
                'genre': 'Pop',
                'rarity': 'Epic',
            },
            {
                'id': 'song_pop_apt',
                'title': 'APT.',
                'artist': 'ROSÉ, Bruno Mars',
                'cover_url': 'https://upload.wikimedia.org/wikipedia/en/5/52/Ros%C3%A9_and_Bruno_Mars_-_Apt..png',
                'genre': 'Pop',
                'rarity': 'Rare',
            },
            {
                'id': 'song_pop_animals',
                'title': 'Animals',
                'artist': 'Maroon 5',
                'cover_url': 'https://i.ytimg.com/vi/LTem11kie-k/maxresdefault.jpg',
                'genre': 'Pop',
                'rarity': 'Rare',
            },
            {
                'id': 'song_pop_dont_mine_at_night',
                'title': "Don't Mine At Night",
                'artist': 'Bebop Vox',
                'cover_url': 'https://i.scdn.co/image/ab67616d0000b273424da79bb4d058749f13d7e6',
                'genre': 'Pop',
                'rarity': 'Rare',
            },
            {
                'id': 'song_pop_baby',
                'title': 'Baby',
                'artist': 'Justin Bieber',
                'cover_url': 'https://upload.wikimedia.org/wikipedia/en/d/d1/Babycoverart.jpg',
                'genre': 'Pop',
                'rarity': 'Uncommon',
            },
            {
                'id': 'song_pop_sunflower',
                'title': 'Sunflower',
                'artist': 'Post Malone, Swae Lee',
                'cover_url': 'https://i.scdn.co/image/ab67616d00001e02e2e352d89826aef6dbd5ff8f',
                'genre': 'Pop',
                'rarity': 'Uncommon',
            },
            {
                'id': 'song_pop_happy',
                'title': 'Happy',
                'artist': 'Pharell Williams',
                'cover_url': 'https://upload.wikimedia.org/wikipedia/en/2/23/Pharrell_Williams_-_Happy.jpg',
                'genre': 'Pop',
                'rarity': 'Common',
            },
        ],
    },
    {
        'id': 'sleeve_rock_01',
        'name': 'Rock Sleeve',
        'genre': 'Rock',
        'cost': 20,
        'refreshed_weekly': True,
        'contents': [
            {
                'id': 'song_rock_buddy_holly',
                'title': 'Buddy Holly',
                'artist': 'Weezer',
                'cover_url': 'https://www.weezerpedia.com/w/images/4/43/Weezer_The_Blue_Album.jpg',
                'genre': 'Rock',
                'rarity': 'Legendary',
            },
            {
                'id': 'song_rock_faint',
                'title': 'Faint',
                'artist': 'Linkin Park',
                'cover_url': 'https://i1.sndcdn.com/artworks-000153667132-7qckxk-t500x500.jpg',
                'genre': 'Rock',
                'rarity': 'Epic',
            },
            {
                'id': 'song_rock_bring_me_to_life',
                'title': 'Bring Me To Life',
                'artist': 'Evanescence',
                'cover_url': 'https://upload.wikimedia.org/wikipedia/en/2/25/Evanescence_-_Fallen.png',
                'genre': 'Rock',
                'rarity': 'Epic',
            },
            {
                'id': 'song_rock_good_life',
                'title': 'The Good Life',
                'artist': 'Weezer',
                'cover_url': 'https://www.weezerpedia.com/w/images/f/ff/Weezer_Pinkerton.jpg',
                'genre': 'Rock',
                'rarity': 'Rare',
            },
            {
                'id': 'song_rock_island_sun',
                'title': 'Island In The Sun',
                'artist': 'Weezer',
                'cover_url': 'https://www.weezerpedia.com/w/images/0/0d/Weezer_The_Green_Album.jpg',
                'genre': 'Rock',
                'rarity': 'Uncommon',
            },
            {
                'id': 'song_rock_fell_in_love_with_a_girl',
                'title': 'Fell In Love With A Girl',
                'artist': 'White Stripes',
                'cover_url': 'https://i.scdn.co/image/ab67616d0000b273ce400791df807dc75c702bed',
                'genre': 'Rock',
                'rarity': 'Uncommon',
            },
            {
                'id': 'song_rock_everlong',
                'title': 'Everlong',
                'artist': 'Foo Fighters',
                'cover_url': 'https://i.scdn.co/image/ab67616d0000b2734bc9bcdbdc9ac34e37d8b6bb',
                'genre': 'Rock',
                'rarity': 'Common',
            },
            {
                'id': 'song_rock_chop_suey',
                'title': 'Chop Suey',
                'artist': 'System Of A Down',
                'cover_url': 'https://upload.wikimedia.org/wikipedia/en/6/64/SystemofaDownToxicityalbumcover.jpg',
                'genre': 'Rock',
                'rarity': 'Common',
            },
        ],
    },
    {
        'id': 'sleeve_rap_01',
        'name': 'Rap Sleeve',
        'genre': 'Rap',
        'cost': 24,
        'refreshed_weekly': True,
        'contents': [
            {
                'id': 'spotify_track_6DCZcSspjsKoFjzjrWoCdn',
                'title': "God's Plan",
                'artist': 'Drake',
                'cover_url': 'https://i.scdn.co/image/ab67616d0000b273f6adf0f908ae0f6d5f2f6cf0',
                'genre': 'Rap',
                'rarity': 'Legendary',
                'spotify_track_id': '6DCZcSspjsKoFjzjrWoCdn',
                'spotify_url': 'https://open.spotify.com/track/6DCZcSspjsKoFjzjrWoCdn',
            },
            {
                'id': 'spotify_track_2xLMifQCjDGFmkHkpNLD9h',
                'title': 'SICKO MODE',
                'artist': 'Travis Scott',
                'cover_url': 'https://i.scdn.co/image/ab67616d0000b273c024ad6f84fb2e9b00b2d6a5',
                'genre': 'Rap',
                'rarity': 'Epic',
                'spotify_track_id': '2xLMifQCjDGFmkHkpNLD9h',
                'spotify_url': 'https://open.spotify.com/track/2xLMifQCjDGFmkHkpNLD9h',
            },
            {
                'id': 'spotify_track_7KXjTSCq5nL1LoYtL7XAwS',
                'title': 'HUMBLE.',
                'artist': 'Kendrick Lamar',
                'cover_url': 'https://i.scdn.co/image/ab67616d0000b273197f08f6d8ebf9b0f83b8d6e',
                'genre': 'Rap',
                'rarity': 'Epic',
                'spotify_track_id': '7KXjTSCq5nL1LoYtL7XAwS',
                'spotify_url': 'https://open.spotify.com/track/7KXjTSCq5nL1LoYtL7XAwS',
            },
            {
                'id': 'spotify_track_2HbKqm4o0w5wEeEFXm2sD4',
                'title': 'Money Trees',
                'artist': 'Kendrick Lamar, Jay Rock',
                'cover_url': 'https://i.scdn.co/image/ab67616d0000b2732e6d7d2f2cae4d4f8a1f40c3',
                'genre': 'Rap',
                'rarity': 'Rare',
                'spotify_track_id': '2HbKqm4o0w5wEeEFXm2sD4',
                'spotify_url': 'https://open.spotify.com/track/2HbKqm4o0w5wEeEFXm2sD4',
            },
            {
                'id': 'spotify_track_0VgkVdmE4gld66l8iyGjgx',
                'title': 'Mask Off',
                'artist': 'Future',
                'cover_url': 'https://i.scdn.co/image/ab67616d0000b27385f7d8f2f1df10375ef9f65f',
                'genre': 'Rap',
                'rarity': 'Rare',
                'spotify_track_id': '0VgkVdmE4gld66l8iyGjgx',
                'spotify_url': 'https://open.spotify.com/track/0VgkVdmE4gld66l8iyGjgx',
            },
            {
                'id': 'spotify_track_3ee8Jmje8o58CHK66QrVC2',
                'title': 'Mo Bamba',
                'artist': 'Sheck Wes',
                'cover_url': 'https://i.scdn.co/image/ab67616d0000b2736f8bd7ef5b650f7d54c9f8de',
                'genre': 'Rap',
                'rarity': 'Uncommon',
                'spotify_track_id': '3ee8Jmje8o58CHK66QrVC2',
                'spotify_url': 'https://open.spotify.com/track/3ee8Jmje8o58CHK66QrVC2',
            },
            {
                'id': 'spotify_track_7wGoVu4Dady5GV0Sv4UIsx',
                'title': 'First Class',
                'artist': 'Jack Harlow',
                'cover_url': 'https://i.scdn.co/image/ab67616d0000b273f8ad57c14e680f33bd9f654d',
                'genre': 'Rap',
                'rarity': 'Uncommon',
                'spotify_track_id': '7wGoVu4Dady5GV0Sv4UIsx',
                'spotify_url': 'https://open.spotify.com/track/7wGoVu4Dady5GV0Sv4UIsx',
            },
            {
                'id': 'spotify_track_4IowQDUoz5ucz7jQBKYG0R',
                'title': 'Bodak Yellow',
                'artist': 'Cardi B',
                'cover_url': 'https://i.scdn.co/image/ab67616d0000b273c22016db4ea5d0e65695f687',
                'genre': 'Rap',
                'rarity': 'Common',
                'spotify_track_id': '4IowQDUoz5ucz7jQBKYG0R',
                'spotify_url': 'https://open.spotify.com/track/4IowQDUoz5ucz7jQBKYG0R',
            },
        ],
    },
    {
        'id': 'sleeve_indie_01',
        'name': 'Indie Sleeve',
        'genre': 'Indie',
        'cost': 22,
        'refreshed_weekly': True,
        'contents': [
            {
                'id': 'song_indie_see_you_40',
                'title': "I'll See You In 40",
                'artist': 'Joji',
                'cover_url': 'https://upload.wikimedia.org/wikipedia/en/6/6a/Joji_%E2%80%93_Ballads_1.png',
                'genre': 'Indie',
                'rarity': 'Epic',
            }
        ],
    },
]

MOCK_INVENTORY = [
    {
        'id': 's1',
        'title': 'Do Ya',
        'artist': 'ericdoa',
        'cover_url': 'https://assets.crownnote.com/s3fs-public/2024-11/1000x1000bb%20%2816%29.png',
        'genre': 'Hyperpop',
        'rarity': 'Rare',
    },
    {
        'id': 's2',
        'title': 'L.A. Girls',
        'artist': 'Weezer',
        'cover_url': 'https://www.weezerpedia.com/w/images/7/72/Weezer_The_White_Album.jpg',
        'genre': 'Rock',
        'rarity': 'Common',
    },
]


def run():
    print('Seeding DB...')
    # Clear
    OwnedSong.objects.all().delete()
    SleeveSong.objects.all().delete()
    Sleeve.objects.all().delete()
    Song.objects.all().delete()

    # create a demo user for seeded inventory ownership
    demo_user, _ = User.objects.get_or_create(username='demo')

    for s in MOCK_SLEEVES:
        sleeve = Sleeve.objects.create(
            id=s['id'], name=s['name'], genre=s['genre'], cost=s['cost'], refreshed_weekly=s.get('refreshed_weekly', False)
        )
        for c in s['contents']:
            song, _ = Song.objects.get_or_create(
                id=c['id'],
                defaults={
                    'title': c['title'],
                    'artist': c['artist'],
                    'cover_url': c.get('cover_url'),
                    'genre': c.get('genre'),
                    'spotify_track_id': c.get('spotify_track_id'),
                    'spotify_url': c.get('spotify_url'),
                },
            )
            SleeveSong.objects.create(sleeve=sleeve, song=song, rarity=c.get('rarity', 'Common'))

    # seed inventory
    for it in MOCK_INVENTORY:
        song, _ = Song.objects.get_or_create(
            id=it['id'],
            defaults={'title': it['title'], 'artist': it['artist'], 'cover_url': it.get('cover_url'), 'genre': it.get('genre'), 'spotify_track_id': it.get('spotify_track_id'), 'spotify_url': it.get('spotify_url')},
        )
        OwnedSong.objects.create(song=song, rarity=it.get('rarity', 'Common'), owner=demo_user)

    print('Seed complete.')


if __name__ == '__main__':
    run()
