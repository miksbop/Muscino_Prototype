"""
Generate weekly genre sleeves from Spotify WITHOUT touching player inventory.

Product rules for each generated sleeve:
- exactly 12 songs
- 1 Legendary
- 2 Epic
- 2 Rare
- 3 Uncommon
- 4 Common

This script intentionally updates only Song/Sleeve/SleeveSong data.
It does not delete OwnedSong, User, or Profile rows.
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
import os
import re
import time
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Any
from urllib import error, parse, request

import django
from django.db import transaction

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backend.settings")
django.setup()

from api.models import Song, Sleeve, SleeveSong  # noqa: E402

SPOTIFY_AUTH_URL = "https://accounts.spotify.com/api/token"
SPOTIFY_API_BASE = "https://api.spotify.com/v1"
MAX_SPOTIFY_RETRIES = 3
MAX_SPOTIFY_RETRY_AFTER_SECONDS = int(os.environ.get("SPOTIFY_MAX_RETRY_AFTER_SECONDS", "20"))
MAX_SEED_ARTISTS_PER_GENRE = int(os.environ.get("SPOTIFY_WEEKLY_MAX_SEED_ARTISTS", "12"))
SPOTIFY_MIN_REQUEST_INTERVAL_SECONDS = float(os.environ.get("SPOTIFY_MIN_REQUEST_INTERVAL_SECONDS", "0.80"))
SPOTIFY_ARTIST_QUERY_DELAY_SECONDS = float(os.environ.get("SPOTIFY_ARTIST_QUERY_DELAY_SECONDS", "0.30"))
MAX_REMOTE_SEARCH_CALLS_PER_GENRE = int(os.environ.get("SPOTIFY_WEEKLY_MAX_SEARCH_CALLS_PER_GENRE", "60"))

TARGET_DISTRIBUTION: dict[str, int] = {
    "Legendary": 1,
    "Epic": 2,
    "Rare": 2,
    "Uncommon": 3,
    "Common": 4,
}
TOTAL_SLEEVE_SIZE = sum(TARGET_DISTRIBUTION.values())
_LAST_SPOTIFY_REQUEST_TS = 0.0

LOCAL_NOTABLE_CATALOG: dict[str, list[dict[str, str | None]]] = {
    "Pop": [
        {"track_id": "local_pop_blinding_lights", "title": "Blinding Lights", "artist": "The Weeknd", "cover_url": "https://upload.wikimedia.org/wikipedia/en/c/c1/The_Weeknd_-_After_Hours.png"},
        {"track_id": "local_pop_shape_of_you", "title": "Shape of You", "artist": "Ed Sheeran", "cover_url": "https://upload.wikimedia.org/wikipedia/en/4/45/Divide_cover.png"},
        {"track_id": "local_pop_levitating", "title": "Levitating", "artist": "Dua Lipa", "cover_url": "https://upload.wikimedia.org/wikipedia/en/f/f5/Dua_Lipa_-_Future_Nostalgia_%28Official_Album_Cover%29.png"},
        {"track_id": "local_pop_bad_guy", "title": "bad guy", "artist": "Billie Eilish", "cover_url": "https://upload.wikimedia.org/wikipedia/en/0/09/Billie_Eilish_-_When_We_All_Fall_Asleep%2C_Where_Do_We_Go%3F.png"},
        {"track_id": "local_pop_uptown_funk", "title": "Uptown Funk", "artist": "Mark Ronson, Bruno Mars", "cover_url": "https://upload.wikimedia.org/wikipedia/en/4/47/Mark_Ronson_-_Uptown_Funk_%28feat._Bruno_Mars%29.png"},
        {"track_id": "local_pop_rolling_in_the_deep", "title": "Rolling in the Deep", "artist": "Adele", "cover_url": "https://upload.wikimedia.org/wikipedia/en/1/1b/Adele_-_21.png"},
        {"track_id": "local_pop_firework", "title": "Firework", "artist": "Katy Perry", "cover_url": "https://upload.wikimedia.org/wikipedia/en/8/8f/Teenage_Dream_Katy_Perry.png"},
        {"track_id": "local_pop_thank_u_next", "title": "thank u, next", "artist": "Ariana Grande", "cover_url": "https://upload.wikimedia.org/wikipedia/en/9/9e/Thank_U%2C_Next_Ariana_Grande.png"},
        {"track_id": "local_pop_as_it_was", "title": "As It Was", "artist": "Harry Styles", "cover_url": "https://upload.wikimedia.org/wikipedia/en/b/b7/Harry_Styles_-_Harry%27s_House.png"},
        {"track_id": "local_pop_toxic", "title": "Toxic", "artist": "Britney Spears", "cover_url": "https://upload.wikimedia.org/wikipedia/en/9/9a/Britney_Spears_-_In_the_Zone.png"},
        {"track_id": "local_pop_halo", "title": "Halo", "artist": "Beyoncé", "cover_url": "https://upload.wikimedia.org/wikipedia/en/b/b7/I_Am..._Sasha_Fierce.png"},
        {"track_id": "local_pop_call_me_maybe", "title": "Call Me Maybe", "artist": "Carly Rae Jepsen", "cover_url": "https://upload.wikimedia.org/wikipedia/en/8/8b/Carly_Rae_Jepsen_-_Kiss.png"},
    ],
    "Rock": [
        {"track_id": "local_rock_smells_like_teen_spirit", "title": "Smells Like Teen Spirit", "artist": "Nirvana", "cover_url": "https://upload.wikimedia.org/wikipedia/en/b/b7/NirvanaNevermindalbumcover.jpg"},
        {"track_id": "local_rock_bohemian_rhapsody", "title": "Bohemian Rhapsody", "artist": "Queen", "cover_url": "https://upload.wikimedia.org/wikipedia/en/e/e3/Queen_A_Night_At_The_Opera.png"},
        {"track_id": "local_rock_in_the_end", "title": "In the End", "artist": "Linkin Park", "cover_url": "https://upload.wikimedia.org/wikipedia/en/2/2f/Linkin_Park_Hybrid_Theory_Album_Cover.jpg"},
        {"track_id": "local_rock_sweet_child_o_mine", "title": "Sweet Child o' Mine", "artist": "Guns N' Roses", "cover_url": "https://upload.wikimedia.org/wikipedia/en/6/60/GunsnRosesAppetiteforDestructionalbumcover.jpg"},
        {"track_id": "local_rock_mr_brightside", "title": "Mr. Brightside", "artist": "The Killers", "cover_url": "https://upload.wikimedia.org/wikipedia/en/1/17/HotFussalbumcover.jpg"},
        {"track_id": "local_rock_everlong", "title": "Everlong", "artist": "Foo Fighters", "cover_url": "https://upload.wikimedia.org/wikipedia/en/0/0d/Foo_Fighters-The_Colour_and_the_Shape.jpg"},
        {"track_id": "local_rock_chop_suey", "title": "Chop Suey!", "artist": "System Of A Down", "cover_url": "https://upload.wikimedia.org/wikipedia/en/6/64/SystemofaDownToxicityalbumcover.jpg"},
        {"track_id": "local_rock_boulevard_of_broken_dreams", "title": "Boulevard of Broken Dreams", "artist": "Green Day", "cover_url": "https://upload.wikimedia.org/wikipedia/en/a/ae/Green_Day_-_American_Idiot_album_cover.png"},
        {"track_id": "local_rock_seven_nation_army", "title": "Seven Nation Army", "artist": "The White Stripes", "cover_url": "https://upload.wikimedia.org/wikipedia/en/0/02/Elephant_album_cover.png"},
        {"track_id": "local_rock_bring_me_to_life", "title": "Bring Me to Life", "artist": "Evanescence", "cover_url": "https://upload.wikimedia.org/wikipedia/en/2/25/Evanescence_-_Fallen.png"},
        {"track_id": "local_rock_dont_stop_believin", "title": "Don't Stop Believin'", "artist": "Journey", "cover_url": "https://upload.wikimedia.org/wikipedia/en/0/09/JourneyEscapealbumcover.jpg"},
        {"track_id": "local_rock_another_brick_in_the_wall", "title": "Another Brick in the Wall, Pt. 2", "artist": "Pink Floyd", "cover_url": "https://upload.wikimedia.org/wikipedia/en/1/13/PinkFloydWallCoverOriginalNoText.jpg"},
    ],
    "Rap": [
        {"track_id": "local_rap_lose_yourself", "title": "Lose Yourself", "artist": "Eminem", "cover_url": "https://upload.wikimedia.org/wikipedia/en/a/ad/8MileSoundtrack.jpg"},
        {"track_id": "local_rap_humble", "title": "HUMBLE.", "artist": "Kendrick Lamar", "cover_url": "https://upload.wikimedia.org/wikipedia/en/5/51/Kendrick_Lamar_-_Damn.png"},
        {"track_id": "local_rap_gods_plan", "title": "God's Plan", "artist": "Drake", "cover_url": "https://upload.wikimedia.org/wikipedia/en/9/90/Scorpion_by_Drake.jpg"},
        {"track_id": "local_rap_sicko_mode", "title": "SICKO MODE", "artist": "Travis Scott", "cover_url": "https://upload.wikimedia.org/wikipedia/en/0/0b/Travis_Scott_-_Astroworld.png"},
        {"track_id": "local_rap_juicy", "title": "Juicy", "artist": "The Notorious B.I.G.", "cover_url": "https://upload.wikimedia.org/wikipedia/en/1/13/Ready_to_Die.jpg"},
        {"track_id": "local_rap_protect_ya_neck", "title": "Protect Ya Neck", "artist": "Wu-Tang Clan", "cover_url": "https://upload.wikimedia.org/wikipedia/en/7/7d/Wu-TangClanEntertheWu-Tangalbumcover.jpg"},
        {"track_id": "local_rap_no_role_modelz", "title": "No Role Modelz", "artist": "J. Cole", "cover_url": "https://upload.wikimedia.org/wikipedia/en/3/32/J._Cole_-_2014_Forest_Hills_Drive.png"},
        {"track_id": "local_rap_it_was_a_good_day", "title": "It Was a Good Day", "artist": "Ice Cube", "cover_url": "https://upload.wikimedia.org/wikipedia/en/1/11/Ice_Cube-The_Predator_%28album_cover%29.jpg"},
        {"track_id": "local_rap_empire_state_of_mind", "title": "Empire State of Mind", "artist": "Jay-Z, Alicia Keys", "cover_url": "https://upload.wikimedia.org/wikipedia/en/0/09/Jay-Z_-_The_Blueprint_3.jpg"},
        {"track_id": "local_rap_mo_bamba", "title": "Mo Bamba", "artist": "Sheck Wes", "cover_url": "https://upload.wikimedia.org/wikipedia/en/2/2d/Sheck_Wes_-_Mudboy.png"},
        {"track_id": "local_rap_bodak_yellow", "title": "Bodak Yellow", "artist": "Cardi B", "cover_url": "https://upload.wikimedia.org/wikipedia/en/7/7f/Cardi_B_Invasion_of_Privacy.jpg"},
        {"track_id": "local_rap_still_dre", "title": "Still D.R.E.", "artist": "Dr. Dre, Snoop Dogg", "cover_url": "https://upload.wikimedia.org/wikipedia/en/0/01/Dr._Dre_-_2001.png"},
    ],
    "Country": [
        {"track_id": "local_country_tennessee_whiskey", "title": "Tennessee Whiskey", "artist": "Chris Stapleton", "cover_url": "https://upload.wikimedia.org/wikipedia/en/6/67/Chris_Stapleton_-_Traveller.png"},
        {"track_id": "local_country_jolene", "title": "Jolene", "artist": "Dolly Parton", "cover_url": "https://upload.wikimedia.org/wikipedia/en/6/69/Jolene_%28Dolly_Parton_album%29.jpg"},
        {"track_id": "local_country_friends_in_low_places", "title": "Friends in Low Places", "artist": "Garth Brooks", "cover_url": "https://upload.wikimedia.org/wikipedia/en/8/81/No_Fences.jpg"},
        {"track_id": "local_country_the_gambler", "title": "The Gambler", "artist": "Kenny Rogers", "cover_url": "https://upload.wikimedia.org/wikipedia/en/5/5a/The_Gambler_%28album%29.jpg"},
        {"track_id": "local_country_cruise", "title": "Cruise", "artist": "Florida Georgia Line", "cover_url": "https://upload.wikimedia.org/wikipedia/en/8/8b/Here%27s_to_the_Good_Times.jpg"},
        {"track_id": "local_country_humble_and_kind", "title": "Humble and Kind", "artist": "Tim McGraw", "cover_url": "https://upload.wikimedia.org/wikipedia/en/f/fd/Damn_Country_Music.jpg"},
        {"track_id": "local_country_die_a_happy_man", "title": "Die a Happy Man", "artist": "Thomas Rhett", "cover_url": "https://upload.wikimedia.org/wikipedia/en/f/f2/Tangled_Up_album_cover.jpg"},
        {"track_id": "local_country_wagon_wheel", "title": "Wagon Wheel", "artist": "Darius Rucker", "cover_url": "https://upload.wikimedia.org/wikipedia/en/1/1f/True_Believers_album_cover.jpg"},
        {"track_id": "local_country_cowgirls", "title": "Cowgirls", "artist": "Morgan Wallen, ERNEST", "cover_url": "https://upload.wikimedia.org/wikipedia/en/6/6b/One_Thing_at_a_Time_%28album%29.jpg"},
        {"track_id": "local_country_heart_like_a_truck", "title": "Heart Like a Truck", "artist": "Lainey Wilson", "cover_url": "https://upload.wikimedia.org/wikipedia/en/e/ef/Bell_Bottom_Country.png"},
        {"track_id": "local_country_feathered_indians", "title": "Feathered Indians", "artist": "Tyler Childers", "cover_url": "https://upload.wikimedia.org/wikipedia/en/2/22/Purgatory_%28Tyler_Childers_album%29.png"},
        {"track_id": "local_country_girl_crush", "title": "Girl Crush", "artist": "Little Big Town", "cover_url": "https://upload.wikimedia.org/wikipedia/en/8/85/Pain_Killer_album_cover.jpg"},
    ],
    "K-Pop": [
        {"track_id": "local_kpop_dynamite", "title": "Dynamite", "artist": "BTS", "cover_url": "https://upload.wikimedia.org/wikipedia/en/7/76/BTS_-_Dynamite.png"},
        {"track_id": "local_kpop_how_you_like_that", "title": "How You Like That", "artist": "BLACKPINK", "cover_url": "https://upload.wikimedia.org/wikipedia/en/7/77/Blackpink_-_How_You_Like_That.png"},
        {"track_id": "local_kpop_love_dive", "title": "LOVE DIVE", "artist": "IVE", "cover_url": "https://upload.wikimedia.org/wikipedia/en/5/50/Ive_-_Love_Dive.png"},
        {"track_id": "local_kpop_gods_menu", "title": "God's Menu", "artist": "Stray Kids", "cover_url": "https://upload.wikimedia.org/wikipedia/en/f/f9/Stray_Kids_-_Go_Live.png"},
        {"track_id": "local_kpop_attention", "title": "Attention", "artist": "NewJeans", "cover_url": "https://upload.wikimedia.org/wikipedia/en/0/00/NewJeans_-_New_Jeans.png"},
        {"track_id": "local_kpop_love_shot", "title": "Love Shot", "artist": "EXO", "cover_url": "https://upload.wikimedia.org/wikipedia/en/0/05/Exo_-_Love_Shot.png"},
        {"track_id": "local_kpop_maniac", "title": "MANIAC", "artist": "Stray Kids", "cover_url": "https://upload.wikimedia.org/wikipedia/en/f/fb/Stray_Kids_-_Oddinary.png"},
        {"track_id": "local_kpop_likey", "title": "LIKEY", "artist": "TWICE", "cover_url": "https://upload.wikimedia.org/wikipedia/en/e/e8/Twicetagram.png"},
        {"track_id": "local_kpop_fearless", "title": "FEARLESS", "artist": "LE SSERAFIM", "cover_url": "https://upload.wikimedia.org/wikipedia/en/e/eb/Le_Sserafim_-_Fearless.png"},
        {"track_id": "local_kpop_queencard", "title": "Queencard", "artist": "(G)I-DLE", "cover_url": "https://upload.wikimedia.org/wikipedia/en/4/48/%28G%29I-dle_-_I_Feel.png"},
        {"track_id": "local_kpop_love_119", "title": "Love 119", "artist": "RIIZE", "cover_url": "https://upload.wikimedia.org/wikipedia/en/6/67/Riize_-_Love_119.png"},
        {"track_id": "local_kpop_drama", "title": "Drama", "artist": "aespa", "cover_url": "https://upload.wikimedia.org/wikipedia/en/8/89/Aespa_-_Drama.png"},
    ],
    "Dance/Electronic": [
        {"track_id": "local_edm_titanium", "title": "Titanium", "artist": "David Guetta, Sia", "cover_url": "https://upload.wikimedia.org/wikipedia/en/0/0f/Nothing_But_the_Beat_2.0.png"},
        {"track_id": "local_edm_levels", "title": "Levels", "artist": "Avicii", "cover_url": "https://upload.wikimedia.org/wikipedia/en/8/8f/Avicii_Levels_cover.png"},
        {"track_id": "local_edm_one_more_time", "title": "One More Time", "artist": "Daft Punk", "cover_url": "https://upload.wikimedia.org/wikipedia/en/3/3c/Daft_Punk_-_Discovery.jpg"},
        {"track_id": "local_edm_animals", "title": "Animals", "artist": "Martin Garrix", "cover_url": "https://upload.wikimedia.org/wikipedia/en/6/68/Martin_Garrix_-_Animals.png"},
        {"track_id": "local_edm_clarity", "title": "Clarity", "artist": "Zedd, Foxes", "cover_url": "https://upload.wikimedia.org/wikipedia/en/1/10/Clarity_Zedd_album.png"},
        {"track_id": "local_edm_strobe", "title": "Strobe", "artist": "deadmau5", "cover_url": "https://upload.wikimedia.org/wikipedia/en/f/f6/For_Lack_of_a_Better_Name.jpg"},
        {"track_id": "local_edm_language", "title": "Language", "artist": "Porter Robinson", "cover_url": "https://upload.wikimedia.org/wikipedia/en/f/f1/Porter_Robinson_-_Language.png"},
        {"track_id": "local_edm_shelter", "title": "Shelter", "artist": "Porter Robinson, Madeon", "cover_url": "https://upload.wikimedia.org/wikipedia/en/9/90/Porter_Robinson_and_Madeon_Shelter_art.jpg"},
        {"track_id": "local_edm_midnight_city", "title": "Midnight City", "artist": "M83", "cover_url": "https://upload.wikimedia.org/wikipedia/en/5/5f/M83-Hurry_Up%2C_We%27re_Dreaming.jpg"},
        {"track_id": "local_edm_lean_on", "title": "Lean On", "artist": "Major Lazer, DJ Snake, MØ", "cover_url": "https://upload.wikimedia.org/wikipedia/en/f/f8/Major_Lazer_-_Peace_Is_the_Mission.png"},
        {"track_id": "local_edm_dont_you_worry_child", "title": "Don't You Worry Child", "artist": "Swedish House Mafia", "cover_url": "https://upload.wikimedia.org/wikipedia/en/e/e7/Until_Now_album_cover.jpg"},
        {"track_id": "local_edm_scary_monsters", "title": "Scary Monsters and Nice Sprites", "artist": "Skrillex", "cover_url": "https://upload.wikimedia.org/wikipedia/en/8/80/Skrillex_-_Scary_Monsters_and_Nice_Sprites.png"},
    ],
    "Game Soundtrack": [
        {"track_id": "local_game_megalovania", "title": "MEGALOVANIA", "artist": "Toby Fox", "cover_url": "https://upload.wikimedia.org/wikipedia/en/3/37/Undertale_soundtrack_cover.jpg"},
        {"track_id": "local_game_sweden", "title": "Sweden", "artist": "C418", "cover_url": "https://upload.wikimedia.org/wikipedia/en/3/3a/Minecraft_-_Volume_Alpha_cover.jpg"},
        {"track_id": "local_game_pigstep", "title": "Pigstep", "artist": "Lena Raine", "cover_url": "https://upload.wikimedia.org/wikipedia/en/5/5f/Minecraft_Nether_Update_cover_art.png"},
        {"track_id": "local_game_open_your_heart", "title": "Open Your Heart", "artist": "SEGA SOUND TEAM", "cover_url": "https://upload.wikimedia.org/wikipedia/en/8/84/Sonic_Adventure_Original_Sound_Track.jpg"},
        {"track_id": "local_game_hopes_and_dreams", "title": "Hopes and Dreams", "artist": "Toby Fox", "cover_url": "https://upload.wikimedia.org/wikipedia/en/3/37/Undertale_soundtrack_cover.jpg"},
        {"track_id": "local_game_wet_hands", "title": "Wet Hands", "artist": "C418", "cover_url": "https://upload.wikimedia.org/wikipedia/en/3/3a/Minecraft_-_Volume_Alpha_cover.jpg"},
        {"track_id": "local_game_resurrections", "title": "Resurrections", "artist": "Lena Raine", "cover_url": "https://upload.wikimedia.org/wikipedia/en/b/b1/Celeste_soundtrack_cover.png"},
        {"track_id": "local_game_escape_from_the_city", "title": "Escape from the City", "artist": "SEGA SOUND TEAM", "cover_url": "https://upload.wikimedia.org/wikipedia/en/5/55/Sonic_Adventure_2_Multi-Dimensional_Original_Soundtrack_cover.jpg"},
        {"track_id": "local_game_field_of_hopes_and_dreams", "title": "Field of Hopes and Dreams", "artist": "Toby Fox", "cover_url": "https://upload.wikimedia.org/wikipedia/en/3/31/Deltarune_Chapter_1_OST_cover.jpg"},
        {"track_id": "local_game_subwoofer_lullaby", "title": "Subwoofer Lullaby", "artist": "C418", "cover_url": "https://upload.wikimedia.org/wikipedia/en/3/3a/Minecraft_-_Volume_Alpha_cover.jpg"},
        {"track_id": "local_game_reach_for_the_stars", "title": "Reach for the Stars", "artist": "SEGA SOUND TEAM", "cover_url": "https://upload.wikimedia.org/wikipedia/en/6/67/Sonic_Colors_Original_Soundtrack_cover.jpg"},
        {"track_id": "local_game_my_dearest_friends", "title": "My Dearest Friends", "artist": "Lena Raine", "cover_url": "https://upload.wikimedia.org/wikipedia/en/4/46/Chicory_soundtrack_cover.jpg"},
    ],
    "Indie": [
        {"track_id": "local_indie_the_less_i_know_the_better", "title": "The Less I Know the Better", "artist": "Tame Impala", "cover_url": "https://upload.wikimedia.org/wikipedia/en/9/9a/Tame_Impala_-_Currents.png"},
        {"track_id": "local_indie_do_i_wanna_know", "title": "Do I Wanna Know?", "artist": "Arctic Monkeys", "cover_url": "https://upload.wikimedia.org/wikipedia/en/2/26/Arctic_Monkeys_-_AM.png"},
        {"track_id": "local_indie_somebody_else", "title": "Somebody Else", "artist": "The 1975", "cover_url": "https://upload.wikimedia.org/wikipedia/en/9/9b/The_1975_-_I_Like_It_When_You_Sleep%2C_for_You_Are_So_Beautiful_yet_So_Unaware_of_It.png"},
        {"track_id": "local_indie_sweater_weather", "title": "Sweater Weather", "artist": "The Neighbourhood", "cover_url": "https://upload.wikimedia.org/wikipedia/en/0/0d/I_Love_You._%28The_Neighbourhood_album%29.png"},
        {"track_id": "local_indie_space_song", "title": "Space Song", "artist": "Beach House", "cover_url": "https://upload.wikimedia.org/wikipedia/en/0/0c/Beach_House_-_Depression_Cherry.png"},
        {"track_id": "local_indie_heat_waves", "title": "Heat Waves", "artist": "Glass Animals", "cover_url": "https://upload.wikimedia.org/wikipedia/en/b/b0/Glass_Animals_-_Dreamland.png"},
        {"track_id": "local_indie_chamber_of_reflection", "title": "Chamber of Reflection", "artist": "Mac DeMarco", "cover_url": "https://upload.wikimedia.org/wikipedia/en/8/83/MacDemarcoSaladDays.jpg"},
        {"track_id": "local_indie_new_slang", "title": "New Slang", "artist": "The Shins", "cover_url": "https://upload.wikimedia.org/wikipedia/en/c/c2/The_Shins_-_Oh%2C_Inverted_World.jpg"},
        {"track_id": "local_indie_first_day_of_my_life", "title": "First Day of My Life", "artist": "Bright Eyes", "cover_url": "https://upload.wikimedia.org/wikipedia/en/4/4f/Bright_Eyes_-_I%27m_Wide_Awake%2C_It%27s_Morning.jpg"},
        {"track_id": "local_indie_riptide", "title": "Riptide", "artist": "Vance Joy", "cover_url": "https://upload.wikimedia.org/wikipedia/en/c/c5/Vance_Joy_Dream_Your_Life_Away_album_cover.jpg"},
        {"track_id": "local_indie_pumped_up_kicks", "title": "Pumped Up Kicks", "artist": "Foster the People", "cover_url": "https://upload.wikimedia.org/wikipedia/en/8/87/Foster_the_People_-_Torches.png"},
        {"track_id": "local_indie_take_me_out", "title": "Take Me Out", "artist": "Franz Ferdinand", "cover_url": "https://upload.wikimedia.org/wikipedia/en/0/04/Franz_Ferdinand_-_Franz_Ferdinand.png"},
    ],
}

GENRE_CONFIG: dict[str, dict[str, Any]] = {
    "Pop": {
        "seed_artists": [
            "Taylor Swift", "The Weeknd", "Ariana Grande", "Dua Lipa", "Olivia Rodrigo",
            "Billie Eilish", "Bruno Mars", "Justin Bieber", "Ed Sheeran", "Rihanna",
            "Lady Gaga", "Katy Perry", "Miley Cyrus", "Selena Gomez", "Shawn Mendes",
            "Harry Styles", "Sabrina Carpenter", "Charli xcx", "Adele", "Sia",
            "Post Malone", "Lana Del Rey", "Doja Cat", "Khalid", "Camila Cabello",
            "Halsey", "Lorde", "Troye Sivan", "Benson Boone", "Conan Gray",
            "Tate McRae", "PinkPantheress", "Bebe Rexha", "Zara Larsson", "Ellie Goulding",
            "Ava Max", "Meghan Trainor", "Niall Horan", "OneRepublic", "Maroon 5",
            "Kesha", "P!nk", "Sam Smith", "Anne-Marie", "SZA",
            "ROSÉ", "BLACKPINK", "KATSEYE", "Gracie Abrams", "Madison Beer",
        ],
    },
    "Rock": {
        "seed_artists": [
            "Foo Fighters", "Arctic Monkeys", "The Killers", "Red Hot Chili Peppers", "Green Day",
            "Nirvana", "Linkin Park", "Metallica", "Queen", "The Rolling Stones",
            "The Beatles", "Led Zeppelin", "AC/DC", "Guns N' Roses", "Pearl Jam",
            "Imagine Dragons", "My Chemical Romance", "Paramore", "Fall Out Boy", "Evanescence",
            "Blink-182", "The Smashing Pumpkins", "The Strokes", "Radiohead", "Muse",
            "U2", "Bon Jovi", "Journey", "Weezer", "The Offspring",
            "Kings of Leon", "The White Stripes", "Oasis", "Coldplay", "Three Days Grace",
            "Breaking Benjamin", "Shinedown", "System Of A Down", "Avenged Sevenfold", "Bring Me The Horizon",
            "The Cranberries", "Fleetwood Mac", "The Goo Goo Dolls", "Stone Temple Pilots", "Alice In Chains",
            "R.E.M.", "Panic! At The Disco", "The Black Keys", "Twenty One Pilots", "Franz Ferdinand",
        ],
    },
    "Rap": {
        "seed_artists": [
            "A Tribe Called Quest", "Nas", "The Notorious B.I.G.", "2Pac", "Wu-Tang Clan",
            "Dr. Dre", "Snoop Dogg", "Ice Cube", "OutKast", "Jay-Z",
            "Eminem", "50 Cent", "Missy Elliott", "Busta Rhymes", "Common",
            "Kendrick Lamar", "J. Cole", "Drake", "Travis Scott", "Future",
            "Tyler, The Creator", "Pusha T", "Baby Keem", "Denzel Curry", "A$AP Rocky",
        ],
    },
        "Country": {
        "seed_artists": [
            "Morgan Wallen", "Luke Combs", "Zach Bryan", "Chris Stapleton", "Lainey Wilson",
            "Dolly Parton", "Johnny Cash", "Kacey Musgraves", "Kenny Chesney", "Garth Brooks",
            "Carrie Underwood", "Shania Twain", "Tim McGraw", "Keith Urban", "Miranda Lambert",
            "Alan Jackson", "George Strait", "Brad Paisley", "Blake Shelton", "Maren Morris",
            "Old Dominion", "Thomas Rhett", "Kelsea Ballerini", "Dierks Bentley", "Tyler Childers",
        ],
    },
    "K-Pop": {
        "seed_artists": [
            "BTS", "BLACKPINK", "TWICE", "Stray Kids", "SEVENTEEN",
            "NewJeans", "aespa", "LE SSERAFIM", "IVE", "EXO",
            "NCT 127", "ENHYPEN", "ITZY", "(G)I-DLE", "Red Velvet",
            "ATEEZ", "TXT", "SHINee", "BIGBANG", "Girls' Generation",
            "RIIZE", "BABYMONSTER", "ILLIT", "KISS OF LIFE", "BOYNEXTDOOR",
        ],
    },
    "Dance/Electronic": {
        "seed_artists": [
            "David Guetta", "Calvin Harris", "Avicii", "Skrillex", "Martin Garrix",
            "Zedd", "Kygo", "Marshmello", "Tiësto", "deadmau5",
            "Fred again..", "Porter Robinson", "Madeon", "Flume", "Disclosure",
            "Daft Punk", "The Chainsmokers", "Swedish House Mafia", "Alesso", "Kaskade",
            "Diplo", "Major Lazer", "RL Grime", "NERO", "ODESZA",
        ],
    },
    "Game Soundtrack": {
        "seed_artists": [
            "Toby Fox", "C418", "Lena Raine", "SEGA SOUND TEAM", "Koji Kondo",
            "Yoko Shimomura", "Nobuo Uematsu", "Yasunori Mitsuda", "Gareth Coker", "Darren Korb",
            "Mick Gordon", "Grant Kirkhope", "Shoji Meguro", "Masayoshi Soken", "Disasterpeace",
            "Marcin Przybyłowicz", "Yuka Kitamura", "Jun Senoue", "Motoi Sakuraba", "Yasunori Nishiki",
            "Kazuma Jinnouchi", "Takeharu Ishimoto", "Akira Yamaoka", "Hideki Naganuma", "Austin Wintory",
        ],
    },
    "Indie": {
        "seed_artists": [
            "Tame Impala", "Phoebe Bridgers", "Mitski", "beabadoobee", "Clairo",
            "The 1975", "The Neighbourhood", "Cage The Elephant", "Vampire Weekend", "The xx",
            "Bon Iver", "The National", "Mac DeMarco", "Rex Orange County", "Wallows",
            "Japanese Breakfast", "Beach House", "Alvvays", "Arlo Parks", "girl in red",
            "Faye Webster", "Soccer Mommy", "Snail Mail", "Men I Trust", "Khruangbin",
            "MGMT", "Foster The People", "Alt-J", "Two Door Cinema Club", "Glass Animals",
            "Death Cab for Cutie", "The Postal Service", "Father John Misty", "Sufjan Stevens", "Bright Eyes",
            "The Strokes", "Interpol", "Yeah Yeah Yeahs", "Wolf Alice", "The Last Shadow Puppets",
            "Mac Miller", "Dominic Fike", "Dayglow", "The Japanese House", "boygenius",
            "TV Girl", "Alex G", "Current Joys", "Still Woozy", "Peach Pit",
        ],
    },
}


@dataclass
class Candidate:
    track_id: str
    title: str
    artist: str
    artist_id: str | None
    cover_url: str | None
    spotify_url: str | None
    popularity: int | None
    release_date: str | None
    source_type: str
    source_query: str


@dataclass
class ScoredCandidate:
    candidate: Candidate
    relevance: float
    legendary_fit: float
    epic_fit: float
    rare_fit: float
    uncommon_fit: float
    common_fit: float
    artist_repeat_penalty: float


def _stable_jitter(key: str) -> float:
    digest = hashlib.md5(key.encode("utf-8")).hexdigest()[:8]
    return int(digest, 16) / 0xFFFFFFFF


def _normalize_artist_name(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", value.lower())


def _fallback_popularity(track_id: str) -> int:
    # Deterministic fallback when Spotify popularity is unavailable.
    return int(35 + 45 * _stable_jitter(track_id))


def _pace_spotify_requests() -> None:
    global _LAST_SPOTIFY_REQUEST_TS
    elapsed = time.monotonic() - _LAST_SPOTIFY_REQUEST_TS
    if elapsed < SPOTIFY_MIN_REQUEST_INTERVAL_SECONDS:
        time.sleep(SPOTIFY_MIN_REQUEST_INTERVAL_SECONDS - elapsed)
    _LAST_SPOTIFY_REQUEST_TS = time.monotonic()


def spotify_token(client_id: str, client_secret: str) -> str:
    credentials = f"{client_id}:{client_secret}".encode("utf-8")
    auth_header = base64.b64encode(credentials).decode("utf-8")

    payload = parse.urlencode({"grant_type": "client_credentials"}).encode("utf-8")
    req = request.Request(
        SPOTIFY_AUTH_URL,
        data=payload,
        headers={
            "Authorization": f"Basic {auth_header}",
            "Content-Type": "application/x-www-form-urlencoded",
        },
        method="POST",
    )

    _pace_spotify_requests()
    with request.urlopen(req, timeout=20) as response:
        data = json.load(response)
    return data["access_token"]


def spotify_get(path: str, token: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
    query = f"?{parse.urlencode(params)}" if params else ""
    req = request.Request(
        f"{SPOTIFY_API_BASE}{path}{query}",
        headers={"Authorization": f"Bearer {token}"},
    )
    for attempt in range(MAX_SPOTIFY_RETRIES):
        try:
            _pace_spotify_requests()
            with request.urlopen(req, timeout=25) as response:
                return json.load(response)
        except error.HTTPError as exc:
            if exc.code == 429 and attempt < MAX_SPOTIFY_RETRIES - 1:
                retry_after = exc.headers.get("Retry-After")
                try:
                    retry_after_seconds = int(retry_after) if retry_after else (2 ** attempt)
                except (TypeError, ValueError):
                    retry_after_seconds = 2 ** attempt

                if retry_after_seconds > MAX_SPOTIFY_RETRY_AFTER_SECONDS:
                    print(
                        f"Spotify rate limited on {path}; Retry-After={retry_after_seconds}s "
                        f"(max wait is {MAX_SPOTIFY_RETRY_AFTER_SECONDS}s), skipping remote fetch."
                    )
                    raise

                sleep_seconds = max(1, retry_after_seconds)
                print(f"Spotify rate limited on {path}; retrying in {sleep_seconds}s (attempt {attempt + 1}/{MAX_SPOTIFY_RETRIES})")
                time.sleep(sleep_seconds)
                continue
            raise
    raise RuntimeError("spotify_get retry loop exhausted unexpectedly")


def _parse_release_date(value: str | None) -> date | None:
    if not value:
        return None
    try:
        if len(value) == 4:
            return datetime.strptime(value, "%Y").date()
        if len(value) == 7:
            return datetime.strptime(value, "%Y-%m").date()
        return datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError:
        return None


def _release_recency_score(release_date: str | None) -> float:
    parsed = _parse_release_date(release_date)
    if not parsed:
        return 0.35

    days_old = max(0, (date.today() - parsed).days)
    if days_old <= 30:
        return 1.0
    if days_old <= 180:
        return 0.8
    if days_old <= 365:
        return 0.65
    if days_old <= 365 * 2:
        return 0.45
    return 0.25


def _map_track(item: dict[str, Any], *, source_type: str, source_query: str) -> Candidate | None:
    track_id = item.get("id")
    if not track_id:
        return None

    artists = item.get("artists", [])
    primary_artist = artists[0] if artists else {}
    artist_id = primary_artist.get("id")
    artist_name = ", ".join(a.get("name", "") for a in artists if a.get("name")) or "Unknown artist"

    images = item.get("album", {}).get("images", [])
    cover = images[0].get("url") if images else None

    return Candidate(
        track_id=track_id,
        title=item.get("name") or "",
        artist=artist_name,
        artist_id=artist_id,
        cover_url=cover,
        spotify_url=item.get("external_urls", {}).get("spotify"),
        popularity=item.get("popularity"),
        release_date=item.get("album", {}).get("release_date"),
        source_type=source_type,
        source_query=source_query,
    )


def _search_tracks(token: str, query_text: str, limit: int, market: str) -> list[dict[str, Any]]:
    """
    Spotify Feb 2026: /search max limit is 10. We paginate with offset.
    """
    page_size = min(10, max(1, limit))
    collected: list[dict[str, Any]] = []
    offset = 0

    while len(collected) < limit:
        payload = spotify_get(
            "/search",
            token,
            {
                "q": query_text,
                "type": "track",
                "limit": page_size,
                "offset": offset,
                "market": market,
            },
        )
        items = payload.get("tracks", {}).get("items", [])
        if not items:
            break
        collected.extend(items)
        if len(items) < page_size:
            break
        offset += page_size

    return collected[:limit]


def _local_candidates_for_genre(genre: str, limit: int) -> list[Candidate]:
    curated = LOCAL_NOTABLE_CATALOG.get(genre, [])
    if curated:
        return [
            Candidate(
                track_id=str(row["track_id"]),
                title=str(row["title"]),
                artist=str(row["artist"]),
                artist_id=None,
                cover_url=row.get("cover_url"),
                spotify_url=None,
                popularity=None,
                release_date=None,
                source_type="local_curated",
                source_query=genre,
            )
            for row in curated[:max(limit, TOTAL_SLEEVE_SIZE)]
        ]

    rows = (
        Song.objects.filter(genre__icontains=genre)
        .order_by("id")[: max(limit * 5, 60)]
    )
    if not rows:
        rows = Song.objects.all().order_by("id")[: max(limit * 5, 60)]

    output: list[Candidate] = []
    for row in rows:
        output.append(
            Candidate(
                track_id=row.spotify_track_id or row.id,
                title=row.title or "",
                artist=row.artist or "Unknown artist",
                artist_id=None,
                cover_url=row.cover_url,
                spotify_url=row.spotify_url,
                popularity=None,
                release_date=None,
                source_type="local_catalog",
                source_query=genre,
            )
        )
    return output


def fetch_candidates_for_genre(token: str, genre: str, limit: int, market: str) -> list[Candidate]:
    cfg = GENRE_CONFIG.get(genre, {"seed_artists": []})

    by_track_id: dict[str, Candidate] = {}
    search_calls = 0

    try:
        # Source A: hard-curated top artists per genre (search-only).
        # This intentionally prioritizes recognisable mainstream catalog over raw genre search noise.
        for artist_name in cfg["seed_artists"][:MAX_SEED_ARTISTS_PER_GENRE]:
            artist_key = _normalize_artist_name(artist_name)
            artist_hits = 0
            for query_text in (f'artist:\"{artist_name}\" genre:{genre.lower()}', f'artist:\"{artist_name}\"'):
                if search_calls >= MAX_REMOTE_SEARCH_CALLS_PER_GENRE:
                    break
                search_calls += 1
                for item in _search_tracks(token, query_text=query_text, limit=min(limit, 3), market=market):
                    item_artists = item.get("artists", [])
                    primary_artist_name = item_artists[0].get("name", "") if item_artists else ""
                    if _normalize_artist_name(primary_artist_name) != artist_key:
                        continue
                    mapped = _map_track(item, source_type="artist_search", source_query=query_text)
                    if mapped and mapped.track_id not in by_track_id:
                        by_track_id[mapped.track_id] = mapped
                        artist_hits += 1
                if artist_hits > 0:
                    break
                time.sleep(max(0.0, SPOTIFY_ARTIST_QUERY_DELAY_SECONDS))
            if search_calls >= MAX_REMOTE_SEARCH_CALLS_PER_GENRE:
                print(
                    f"Reached max Spotify search calls for genre={genre} "
                    f"({MAX_REMOTE_SEARCH_CALLS_PER_GENRE}); using collected candidates so far."
                )
                break
            if len(by_track_id) >= max(limit * 2, TOTAL_SLEEVE_SIZE):
                break
    except error.HTTPError as exc:
        if exc.code in (403, 429):
            reason = "forbidden" if exc.code == 403 else "rate-limited"
            print(f"Spotify {reason} for genre={genre}; falling back to local catalog candidates.")
            return _local_candidates_for_genre(genre=genre, limit=limit)
        raise

    return list(by_track_id.values())


def _recent_artists_for_genre(genre: str, max_sleeves: int = 2) -> set[str]:
    sleeves = list(
        Sleeve.objects.filter(genre__iexact=genre)
        .order_by("-id")[:max_sleeves]
    )
    if not sleeves:
        return set()

    recent_artists: set[str] = set()
    for entry in SleeveSong.objects.filter(sleeve__in=sleeves).select_related("song"):
        recent_artists.add((entry.song.artist or "").lower().strip())
    return recent_artists


def score_candidates(candidates: list[Candidate], genre: str) -> list[ScoredCandidate]:
    recent_artists = _recent_artists_for_genre(genre)
    scored: list[ScoredCandidate] = []

    for c in candidates:
        popularity_value = c.popularity if c.popularity is not None else _fallback_popularity(c.track_id)
        popularity_norm = max(0.0, min(1.0, popularity_value / 100.0))
        recency = _release_recency_score(c.release_date)
        source_boost = {
            "genre_search": 1.0,
            "artist_search": 0.9,
            "local_curated": 0.92,
            "local_catalog": 0.82,
        }.get(c.source_type, 0.85)
        jitter = _stable_jitter(f"{genre}:{c.track_id}")

        artist_key = c.artist.lower().strip()
        artist_repeat_penalty = 0.18 if artist_key in recent_artists else 0.0

        relevance = (
            0.55 * popularity_norm
            + 0.22 * recency
            + 0.18 * source_boost
            + 0.05 * jitter
            - artist_repeat_penalty
        )

        # Rarity-fit stays separate from relevance.
        legendary_fit = relevance + 0.25 * popularity_norm + 0.10 * recency
        epic_fit = relevance + 0.20 * (1 - abs(popularity_norm - 0.72))
        rare_fit = relevance + 0.19 * (1 - abs(popularity_norm - 0.60))
        uncommon_fit = relevance + 0.20 * (1 - abs(popularity_norm - 0.52)) + 0.04 * source_boost
        common_fit = relevance + 0.22 * (1 - abs(popularity_norm - 0.45)) + 0.07 * source_boost

        scored.append(
            ScoredCandidate(
                candidate=c,
                relevance=relevance,
                legendary_fit=legendary_fit,
                epic_fit=epic_fit,
                rare_fit=rare_fit,
                uncommon_fit=uncommon_fit,
                common_fit=common_fit,
                artist_repeat_penalty=artist_repeat_penalty,
            )
        )

    return sorted(scored, key=lambda x: x.relevance, reverse=True)


def _select_bucket(
    pool: list[ScoredCandidate],
    already_used_track_ids: set[str],
    already_used_artists: set[str],
    target_count: int,
    fit_attr: str,
) -> list[ScoredCandidate]:
    selected: list[ScoredCandidate] = []

    ranked = sorted(pool, key=lambda x: (getattr(x, fit_attr), x.relevance), reverse=True)
    for item in ranked:
        if len(selected) >= target_count:
            break

        track_id = item.candidate.track_id
        artist_key = item.candidate.artist.lower().strip()

        if track_id in already_used_track_ids:
            continue
        if artist_key in already_used_artists:
            continue

        selected.append(item)
        already_used_track_ids.add(track_id)
        already_used_artists.add(artist_key)

    return selected


def select_final_sleeve(scored: list[ScoredCandidate]) -> list[tuple[ScoredCandidate, str]]:
    used_tracks: set[str] = set()
    used_artists: set[str] = set()

    chosen: list[tuple[ScoredCandidate, str]] = []

    for rarity, fit_attr in (
        ("Legendary", "legendary_fit"),
        ("Epic", "epic_fit"),
        ("Rare", "rare_fit"),
        ("Uncommon", "uncommon_fit"),
        ("Common", "common_fit"),
    ):
        picks = _select_bucket(
            pool=scored,
            already_used_track_ids=used_tracks,
            already_used_artists=used_artists,
            target_count=TARGET_DISTRIBUTION[rarity],
            fit_attr=fit_attr,
        )
        chosen.extend((p, rarity) for p in picks)

    # Backfill if constraints made us short (still enforce unique tracks; relax artist uniqueness only if needed).
    if len(chosen) < TOTAL_SLEEVE_SIZE:
        for item in sorted(scored, key=lambda x: x.relevance, reverse=True):
            if len(chosen) >= TOTAL_SLEEVE_SIZE:
                break
            if item.candidate.track_id in used_tracks:
                continue
            used_tracks.add(item.candidate.track_id)
            fallback_rarity = "Common"
            chosen.append((item, fallback_rarity))

    # Keep deterministic order by rarity bands then score
    rarity_rank = {"Legendary": 0, "Epic": 1, "Rare": 2, "Uncommon": 3, "Common": 4}
    chosen.sort(key=lambda x: (rarity_rank[x[1]], -x[0].relevance))

    return chosen[:TOTAL_SLEEVE_SIZE]


def upsert_sleeve_entries(genre: str, chosen: list[tuple[ScoredCandidate, str]]) -> None:
    sleeve = (
        Sleeve.objects.filter(genre__iexact=genre, refreshed_weekly=True).first()
        or Sleeve.objects.filter(genre__iexact=genre).first()
    )

    if not sleeve:
        sleeve = Sleeve.objects.create(
            id=f"sleeve_{genre.lower()}_weekly",
            name=f"{genre} Sleeve",
            genre=genre,
            cost=20,
            refreshed_weekly=True,
        )
    else:
        update_fields: list[str] = []
        if sleeve.cost != 20:
            sleeve.cost = 20
            update_fields.append("cost")
        if not sleeve.refreshed_weekly:
            sleeve.refreshed_weekly = True
            update_fields.append("refreshed_weekly")
        if update_fields:
            sleeve.save(update_fields=update_fields)

    SleeveSong.objects.filter(sleeve=sleeve).delete()

    rarity_counts = {"Legendary": 0, "Epic": 0, "Rare": 0, "Uncommon": 0, "Common": 0}

    for item, rarity in chosen:
        c = item.candidate
        song_id = f"spotify_track_{c.track_id}"
        song, _ = Song.objects.update_or_create(
            id=song_id,
            defaults={
                "title": c.title,
                "artist": c.artist,
                "cover_url": c.cover_url,
                "genre": genre,
                "spotify_track_id": c.track_id,
                "spotify_url": c.spotify_url,
            },
        )
        SleeveSong.objects.create(sleeve=sleeve, song=song, rarity=rarity)
        rarity_counts[rarity] += 1

    print(
        f"Updated {sleeve.name}: "
        f"Legendary={rarity_counts['Legendary']} "
        f"Epic={rarity_counts['Epic']} "
        f"Rare={rarity_counts['Rare']} "
        f"Uncommon={rarity_counts['Uncommon']} "
        f"Common={rarity_counts['Common']}"
    )


def refresh_genre_sleeve(token: str | None, genre: str, limit: int, market: str, *, local_only: bool = False) -> None:
    if local_only:
        candidates = _local_candidates_for_genre(genre=genre, limit=max(limit, TOTAL_SLEEVE_SIZE))
    else:
        if not token:
            raise RuntimeError("Spotify token is required unless --local-only is used")
        candidates = fetch_candidates_for_genre(token, genre=genre, limit=limit, market=market)

    if not candidates:
        print(f"No candidates returned for genre={genre}; skipping")
        return

    scored = score_candidates(candidates, genre=genre)
    chosen = select_final_sleeve(scored)

    if len(chosen) < TOTAL_SLEEVE_SIZE:
        print(f"Not enough candidates for full sleeve in genre={genre}; got={len(chosen)}")
        return

    upsert_sleeve_entries(genre=genre, chosen=chosen)


def _next_daily_run(target_hhmm: str) -> datetime:
    try:
        hour_str, minute_str = target_hhmm.strip().split(":", maxsplit=1)
        hour = int(hour_str)
        minute = int(minute_str)
    except ValueError as exc:
        raise ValueError(f"Invalid --daily-at value '{target_hhmm}'. Expected HH:MM (24-hour clock).") from exc

    if hour < 0 or hour > 23 or minute < 0 or minute > 59:
        raise ValueError(f"Invalid --daily-at value '{target_hhmm}'. Expected HH:MM (24-hour clock).")

    now = datetime.now()
    run_at = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
    if run_at <= now:
        run_at = run_at + timedelta(days=1)
    return run_at


def _maybe_get_token(local_only: bool) -> str | None:
    if local_only:
        print("Running weekly sleeve refresh in local-only mode (no Spotify requests).")
        return None

    client_id = os.environ.get("SPOTIFY_CLIENT_ID")
    client_secret = os.environ.get("SPOTIFY_CLIENT_SECRET")
    if not client_id or not client_secret:
        raise RuntimeError("SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET are required unless --local-only is used")

    try:
        return spotify_token(client_id, client_secret)
    except error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="ignore")
        raise RuntimeError(f"Spotify token request failed: {exc.code} {detail}") from exc


def refresh_all_genres(
    *,
    genres: list[str],
    limit: int,
    market: str,
    local_only: bool,
    delay_between_genres_seconds: float,
) -> None:
    token = _maybe_get_token(local_only=local_only)

    with transaction.atomic():
        for i, genre in enumerate(genres):
            refresh_genre_sleeve(token, genre=genre, limit=limit, market=market, local_only=local_only)
            if i < len(genres) - 1 and delay_between_genres_seconds > 0:
                time.sleep(delay_between_genres_seconds)



def main() -> None:
    parser = argparse.ArgumentParser(description="Refresh weekly sleeves from Spotify")
    parser.add_argument(
        "--genres",
        nargs="+",
        default=["Pop", "Rock", "Rap", "Country", "K-Pop", "Dance/Electronic", "Game Soundtrack", "Indie"],
    )
    parser.add_argument("--limit", type=int, default=20, help="per-source search limit")
    parser.add_argument("--market", default="US")
    parser.add_argument(
        "--daily",
        action="store_true",
        help="run once per day at --daily-at time",
    )
    parser.add_argument(
        "--daily-at",
        default="10:00",
        help="daily run time in HH:MM (24-hour clock, server local time), default: 10:00",
    )
    parser.add_argument(
        "--delay-between-genres-seconds",
        type=float,
        default=20.0,
        help="delay between each genre refresh to spread Spotify requests",
    )
    parser.add_argument(
        "--local-only",
        action="store_true",
        help="skip Spotify entirely and refresh sleeves from local Song catalog only",
    )
    args = parser.parse_args()

    if args.daily:
        while True:
            next_run = _next_daily_run(args.daily_at)
            seconds_until = max((next_run - datetime.now()).total_seconds(), 0.0)
            print(f"Next daily sleeve refresh run at {next_run.isoformat()} (in {int(seconds_until)}s)")
            time.sleep(seconds_until)
            refresh_all_genres(
                genres=args.genres,
                limit=args.limit,
                market=args.market,
                local_only=args.local_only,
                delay_between_genres_seconds=args.delay_between_genres_seconds,
            )
    else:
        refresh_all_genres(
            genres=args.genres,
            limit=args.limit,
            market=args.market,
            local_only=args.local_only,
            delay_between_genres_seconds=args.delay_between_genres_seconds,
        )


if __name__ == "__main__":
    main()