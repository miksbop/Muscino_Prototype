import random
import re
import base64
from pathlib import Path
from django.db import transaction
from django.conf import settings
from django.shortcuts import get_object_or_404
from django.utils import timezone
from datetime import date
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth.models import User
from django.contrib.auth import authenticate, login, logout
from .models import Sleeve, SleeveSong, OwnedSong, Song, MarketListing, Profile, FriendRequest
from .serializers import (
    SleeveSerializer,
    OwnedSongSerializer,
    SongSerializer,
    UserSerializer,
    MarketListingSerializer,
    FriendUserSerializer,
    FriendRequestSerializer,
)
from .spotify import SpotifyClient, hydrate_songs_from_spotify
from .preview import search_track_genre

DAILY_LOGIN_BONUS = 100
MAX_PROFILE_AVATAR_BYTES = 5 * 1024 * 1024
ALLOWED_AVATAR_MIME_TYPES = {
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
}
HEX_COLOR_RE = re.compile(r'^#[0-9a-fA-F]{6}$')


def _profile_background_dirs() -> list[Path]:
    repo_root = Path(__file__).resolve().parents[2]
    configured_dir = getattr(settings, 'PROFILE_BACKGROUNDS_DIR', None)

    candidates = [
        configured_dir,
        repo_root / 'public' / 'backgrounds',
        repo_root.parent / 'muscino-frontend' / 'public' / 'backgrounds',
        Path.home() / 'OneDrive' / 'Documents' / 'backups' / 'MuscinoGit' / 'muscino-frontend' / 'public' / 'backgrounds',
    ]

    seen: set[Path] = set()
    resolved_dirs: list[Path] = []
    for candidate in candidates:
        if not candidate:
            continue

        candidate_path = Path(candidate).expanduser()
        if candidate_path in seen:
            continue

        seen.add(candidate_path)
        if candidate_path.exists() and candidate_path.is_dir():
            resolved_dirs.append(candidate_path)

    return resolved_dirs


def _available_profile_backgrounds() -> list[str]:
    allowed_extensions = {'.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif'}
    filenames: set[str] = set()

    for backgrounds_dir in _profile_background_dirs():
        for path in backgrounds_dir.iterdir():
            if path.is_file() and path.suffix.lower() in allowed_extensions:
                filenames.add(path.name)

    return sorted(filenames, key=str.lower)


def _profile_background_url(filename: str) -> str | None:
    cleaned = (filename or '').strip()
    if not cleaned:
        return None
    return f"/backgrounds/{cleaned}"

RARITY_WEIGHT = {
    'Common': 35,
    'Uncommon': 25,
    'Rare': 20,
    'Epic': 15,
    'Legendary': 5,
}


RARITY_RANK = {
    'Common': 1,
    'Uncommon': 2,
    'Rare': 3,
    'Epic': 4,
    'Legendary': 5,
}


def _roll_rarity_from_inputs(input_rarities: list[str]) -> str:
    bonus = max(0, sum(RARITY_RANK.get(r, 1) for r in input_rarities) - 3)
    weights = {
        'Common': max(5.0, 50.0 - (3.0 * bonus)),
        'Uncommon': max(8.0, 25.0 - (1.2 * bonus)),
        'Rare': 15.0 + (1.5 * bonus),
        'Epic': 8.0 + (1.7 * bonus),
        'Legendary': 2.0 + (1.0 * bonus),
    }

    total = sum(weights.values())
    roll = random.random() * total
    chosen = 'Common'
    for rarity, weight in weights.items():
        roll -= weight
        if roll <= 0:
            chosen = rarity
            break
    return chosen


def _upsert_song_from_spotify_track(track) -> Song:
    apple_genre = search_track_genre(track.title or "", track.artist)
    resolved_genre = apple_genre or 'Unknown'
    defaults = {
        'title': track.title or track.track_id,
        'artist': track.artist or 'Unknown Artist',
        'cover_url': track.cover_url,
        'genre': resolved_genre,
        'spotify_track_id': track.track_id,
        'spotify_url': track.spotify_url,
    }

    song, created = Song.objects.get_or_create(
        id=f"spotify:{track.track_id}",
        defaults=defaults,
    )

    if not created:
        changed_fields = []
        for field, value in defaults.items():
            if field == 'genre' and value == 'Unknown':
                continue
            if value and getattr(song, field) != value:
                setattr(song, field, value)
                changed_fields.append(field)
        if changed_fields:
            song.save(update_fields=changed_fields)

    return song


def _profile_avatar_url(profile: Profile):
    avatar_image = getattr(profile, 'avatar_image', None)
    avatar_mime_type = getattr(profile, 'avatar_mime_type', None)
    if avatar_image and avatar_mime_type:
        try:
            raw = bytes(avatar_image)
            encoded = base64.b64encode(raw).decode('ascii')
            return f"data:{avatar_mime_type};base64,{encoded}"
        except Exception:
            return profile.avatar_url
    return profile.avatar_url


def _serialize_profile_response(user: User):
    owned_qs = OwnedSong.objects.filter(owner=user).select_related('song').order_by('-obtained_at')
    songs_collected = owned_qs.count()

    showcase_items = list(owned_qs[:20])
    showcase_data = OwnedSongSerializer(showcase_items, many=True).data
    hydrate_songs_from_spotify(showcase_data)

    profile, _ = Profile.objects.get_or_create(user=user, defaults={'display_name': user.username})
    display_name = profile.display_name or user.username
    wallet = profile.wallet
    avatar_url = _profile_avatar_url(profile)
    bio = getattr(profile, 'bio', '') or ''
    theme_color = getattr(profile, 'theme_color', '#737373') or '#737373'

    profile_background = getattr(profile, 'profile_background', '') or ''
    profile_background_opacity = getattr(profile, 'profile_background_opacity', 1.0) or 1.0

    favorite_song = None
    favorite_song_inventory_count = 0
    favorite_song_id = getattr(profile, 'favorite_song_id', None)
    if favorite_song_id:
        favorite_owned_qs = owned_qs.filter(song_id=favorite_song_id)
        favorite_song_inventory_count = favorite_owned_qs.count()
        favorite_owned_song = favorite_owned_qs.first()
        if favorite_owned_song:
            favorite_payload = OwnedSongSerializer(favorite_owned_song).data
            hydrate_songs_from_spotify([favorite_payload])
            favorite_song = favorite_payload

    joined_date = user.date_joined.date()
    days_registered = max((date.today() - joined_date).days, 0)

    return {
        'id': str(user.id),
        'username': user.username,
        'displayName': display_name,
        'wallet': wallet,
        'avatarUrl': avatar_url,
        'joinedAt': user.date_joined.isoformat(),
        'daysRegistered': days_registered,
        'songsCollected': songs_collected,
        'bio': bio,
        'themeColor': theme_color,
        'profileBackground': profile_background,
        'profileBackgroundUrl': _profile_background_url(profile_background),
        'profileBackgroundOpacity': max(0.5, min(float(profile_background_opacity), 1.0)),
        'favoriteSong': favorite_song,
        'favoriteSongInventoryCount': favorite_song_inventory_count,
        'showcaseSongs': showcase_data,
    }


@api_view(['GET'])
def songs_list(request):
    songs = Song.objects.all()
    serializer = SongSerializer(songs, many=True)
    data = hydrate_songs_from_spotify(list(serializer.data))
    return Response(data)

@api_view(['GET'])
def sleeves_list(request):
    sleeves = Sleeve.objects.prefetch_related('contents__song').all()
    serializer = SleeveSerializer(sleeves, many=True)
    data = list(serializer.data)
    for sleeve in data:
        contents = sleeve.get('contents', [])
        hydrate_songs_from_spotify(contents)
    return Response(data)


@api_view(['GET'])
def inventory_list(request):
    username = request.query_params.get('owner')

    # If owner query is passed, allow profile inventory lookup by username.
    if username:
        user = get_object_or_404(User, username=username)
        items = OwnedSong.objects.filter(owner=user).select_related('song').order_by('-obtained_at')
    elif request.user.is_authenticated:
        items = OwnedSong.objects.filter(owner=request.user).select_related('song').order_by('-obtained_at')
    else:
        items = []

    serializer = OwnedSongSerializer(items, many=True)
    data = hydrate_songs_from_spotify(list(serializer.data))
    return Response(data)


@api_view(['POST'])
def open_sleeve(request, sleeve_id):
    sleeve = get_object_or_404(Sleeve, pk=sleeve_id)
    contents = list(SleeveSong.objects.filter(sleeve=sleeve).select_related('song'))
    if not contents:
        return Response({'detail': 'Sleeve is empty'}, status=status.HTTP_400_BAD_REQUEST)

    bag = []
    for item in contents:
        w = item.weight if item.weight is not None else RARITY_WEIGHT.get(item.rarity, 1)
        bag.append((item, w))

    total = sum(w for _, w in bag)
    roll = random.random() * total
    chosen = bag[-1][0]
    for item, w in bag:
        roll -= w
        if roll <= 0:
            chosen = item
            break

    # Require authentication for opening a sleeve.
    if not request.user.is_authenticated:
        return Response({'detail': 'authentication required to open sleeve'}, status=status.HTTP_401_UNAUTHORIZED)

    profile = request.user.profile
    if profile.wallet < sleeve.cost:
        return Response({'detail': 'not enough money in wallet'}, status=status.HTTP_400_BAD_REQUEST)

    profile.wallet -= sleeve.cost
    profile.save()

    owned = OwnedSong.objects.create(song=chosen.song, rarity=chosen.rarity, owner=request.user)
    serializer = OwnedSongSerializer(owned)
    data = serializer.data
    hydrate_songs_from_spotify([data])
    return Response(data, status=status.HTTP_201_CREATED)


@api_view(['POST'])
def reroll_inventory_song(request):
    if not request.user.is_authenticated:
        return Response({'detail': 'authentication required'}, status=status.HTTP_401_UNAUTHORIZED)

    owned_song_ids = request.data.get('ownedSongIds')
    artist_keyword = (request.data.get('artistKeyword') or '').strip()
    artist_id = (request.data.get('artistId') or '').strip()

    if not isinstance(owned_song_ids, list) or len(owned_song_ids) != 3:
        return Response({'detail': 'exactly 3 ownedSongIds are required'}, status=status.HTTP_400_BAD_REQUEST)

    if not artist_keyword and not artist_id:
        return Response({'detail': 'artistKeyword or artistId is required'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        owned_song_ids = [int(song_id) for song_id in owned_song_ids]
    except (TypeError, ValueError):
        return Response({'detail': 'ownedSongIds must be integer IDs'}, status=status.HTTP_400_BAD_REQUEST)

    if len(set(owned_song_ids)) != 3:
        return Response({'detail': 'ownedSongIds must be unique'}, status=status.HTTP_400_BAD_REQUEST)

    owned_songs = list(
        OwnedSong.objects
        .select_related('song')
        .filter(id__in=owned_song_ids, owner=request.user)
    )
    if len(owned_songs) != 3:
        return Response({'detail': 'you must own all selected songs'}, status=status.HTTP_400_BAD_REQUEST)

    if MarketListing.objects.filter(owned_song_id__in=owned_song_ids, status='active').exists():
        return Response({'detail': 'listed songs cannot be rerolled'}, status=status.HTTP_400_BAD_REQUEST)

    spotify_client = SpotifyClient()
    if not spotify_client.is_configured:
        return Response({'detail': 'spotify search is not configured'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

    used_top_tracks_lookup = False
    if artist_id:
        used_top_tracks_lookup = True
        candidates = spotify_client.get_artist_top_tracks(artist_id, limit=10)
        if not candidates and artist_keyword:
            # Some Spotify app configurations can reject top-tracks requests with
            # client-credentials auth. Fall back to keyword track search so reroll
            # still works when artist search itself succeeded.
            candidates = spotify_client.search_artist_tracks(artist_keyword, limit=10)
    else:
        candidates = spotify_client.search_artist_tracks(artist_keyword, limit=10)
    if not candidates:
        if spotify_client.last_error_code == 429:
            payload = {'detail': 'spotify rate limited'}
            if spotify_client.last_retry_after_seconds is not None:
                payload['retryAfterSeconds'] = spotify_client.last_retry_after_seconds
            return Response(payload, status=status.HTTP_429_TOO_MANY_REQUESTS)
        if spotify_client.last_error_code == 403:
            detail = 'spotify access forbidden for search'
            if used_top_tracks_lookup:
                detail = 'spotify access forbidden for top tracks and fallback search'
            return Response({'detail': detail}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        return Response({'detail': 'no Spotify tracks found for this artist keyword'}, status=status.HTTP_404_NOT_FOUND)

    chosen_track = random.choice(candidates)
    rolled_rarity = _roll_rarity_from_inputs([song.rarity for song in owned_songs])

    with transaction.atomic():
        OwnedSong.objects.filter(id__in=owned_song_ids, owner=request.user).delete()
        canonical_song = _upsert_song_from_spotify_track(chosen_track)
        rolled_song = OwnedSong.objects.create(song=canonical_song, rarity=rolled_rarity, owner=request.user)

    serializer = OwnedSongSerializer(rolled_song)
    payload = serializer.data
    hydrate_songs_from_spotify([payload])

    return Response({
        'newSong': payload,
        'consumedOwnedSongIds': owned_song_ids,
        'rolledRarity': rolled_rarity,
    }, status=status.HTTP_201_CREATED)

@api_view(['GET'])
def spotify_artist_search(request):
    keyword = (request.GET.get('q') or '').strip()
    if len(keyword) < 2:
        return Response({'artists': []}, status=status.HTTP_200_OK)

    spotify_client = SpotifyClient()
    if not spotify_client.is_configured:
        return Response({'detail': 'spotify search is not configured'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

    artists = spotify_client.search_artists(keyword, limit=8)
    if not artists:
        if spotify_client.last_error_code == 429:
            payload = {'detail': 'spotify rate limited'}
            if spotify_client.last_retry_after_seconds is not None:
                payload['retryAfterSeconds'] = spotify_client.last_retry_after_seconds
            return Response(payload, status=status.HTTP_429_TOO_MANY_REQUESTS)
        if spotify_client.last_error_code == 403:
            return Response({'detail': 'spotify access forbidden for search'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

    return Response({
        'artists': [
            {
                'id': artist.artist_id,
                'name': artist.name,
                'imageUrl': artist.image_url,
                'spotifyUrl': artist.spotify_url,
            }
            for artist in artists
        ]
    }, status=status.HTTP_200_OK)

@api_view(['GET'])
def profile_detail(request, username):
    user = get_object_or_404(User.objects.select_related('profile'), username=username)
    return Response(_serialize_profile_response(user))


@api_view(['GET'])
def profile_backgrounds(request):
    backgrounds = _available_profile_backgrounds()
    return Response({
        'backgrounds': [
            {
                'filename': filename,
                'url': _profile_background_url(filename),
            }
            for filename in backgrounds
        ]
    })


@api_view(['PATCH'])
def profile_update(request, username):
    if not request.user.is_authenticated:
        return Response({'detail': 'authentication required'}, status=status.HTTP_401_UNAUTHORIZED)

    if request.user.username != username:
        return Response({'detail': 'cannot edit another user profile'}, status=status.HTTP_403_FORBIDDEN)

    profile, _ = Profile.objects.get_or_create(user=request.user, defaults={'display_name': request.user.username})

    bio = request.data.get('bio')
    theme_color = request.data.get('themeColor')
    favorite_song_id = request.data.get('favoriteSongId')
    avatar_file = request.FILES.get('avatar')
    profile_background = request.data.get('profileBackground')
    profile_background_opacity = request.data.get('profileBackgroundOpacity')
    updated_fields: list[str] = []

    if bio is not None and hasattr(profile, 'bio'):
        bio = str(bio).strip()
        if len(bio) > 600:
            return Response({'detail': 'bio must be 600 characters or fewer'}, status=status.HTTP_400_BAD_REQUEST)
        profile.bio = bio
        updated_fields.append('bio')

    if theme_color is not None and hasattr(profile, 'theme_color'):
        theme_color = str(theme_color).strip()
        if not HEX_COLOR_RE.fullmatch(theme_color):
            return Response({'detail': 'themeColor must be a hex color like #12AB34'}, status=status.HTTP_400_BAD_REQUEST)
        profile.theme_color = theme_color.lower()
        updated_fields.append('theme_color')

    if favorite_song_id is not None and hasattr(profile, 'favorite_song'):
        favorite_song_id = str(favorite_song_id).strip()
        if favorite_song_id == '':
            profile.favorite_song = None
            updated_fields.append('favorite_song')
        else:
            owned_song_exists = OwnedSong.objects.filter(owner=request.user, song_id=favorite_song_id).exists()
            if not owned_song_exists:
                return Response({'detail': 'favoriteSongId must be a song in your inventory'}, status=status.HTTP_400_BAD_REQUEST)

            favorite_song = Song.objects.filter(id=favorite_song_id).first()
            if not favorite_song:
                return Response({'detail': 'favoriteSongId is invalid'}, status=status.HTTP_400_BAD_REQUEST)

            profile.favorite_song = favorite_song
            updated_fields.append('favorite_song')

    if avatar_file is not None:
        if avatar_file.size > MAX_PROFILE_AVATAR_BYTES:
            return Response({'detail': 'avatar must be 5MB or less'}, status=status.HTTP_400_BAD_REQUEST)
        content_type = getattr(avatar_file, 'content_type', None) or ''
        if content_type not in ALLOWED_AVATAR_MIME_TYPES:
            return Response({'detail': 'avatar must be PNG, JPEG, WEBP, or GIF'}, status=status.HTTP_400_BAD_REQUEST)

        if hasattr(profile, 'avatar_image') and hasattr(profile, 'avatar_mime_type'):
            profile.avatar_image = avatar_file.read()
            profile.avatar_mime_type = content_type
            profile.avatar_url = None
            updated_fields.extend(['avatar_image', 'avatar_mime_type', 'avatar_url'])
        else:
            return Response({'detail': 'binary avatar uploads are not enabled on this server'}, status=status.HTTP_400_BAD_REQUEST)

    if profile_background_opacity is not None and hasattr(profile, 'profile_background_opacity'):
        try:
            profile_background_opacity = float(profile_background_opacity)
        except (TypeError, ValueError):
            return Response({'detail': 'profileBackgroundOpacity must be a number between 0.5 and 1.0'}, status=status.HTTP_400_BAD_REQUEST)

        if profile_background_opacity < 0.5 or profile_background_opacity > 1.0:
            return Response({'detail': 'profileBackgroundOpacity must be between 0.5 and 1.0'}, status=status.HTTP_400_BAD_REQUEST)

        profile.profile_background_opacity = profile_background_opacity
        updated_fields.append('profile_background_opacity')
        
    if profile_background is not None and hasattr(profile, 'profile_background'):
        profile_background = str(profile_background).strip()
        if profile_background == '':
            profile.profile_background = ''
            updated_fields.append('profile_background')
        else:
            available_backgrounds = set(_available_profile_backgrounds())
            if profile_background not in available_backgrounds:
                return Response({'detail': 'profileBackground must match an available background filename'}, status=status.HTTP_400_BAD_REQUEST)
            profile.profile_background = profile_background
            updated_fields.append('profile_background')

    if updated_fields:
        profile.save(update_fields=sorted(set(updated_fields)))

    return Response(_serialize_profile_response(request.user))




def _serialize_friends_payload(user: User):
    profile, _ = Profile.objects.get_or_create(user=user, defaults={'display_name': user.username})

    friend_users = [friend_profile.user for friend_profile in profile.friends.select_related('user').all()]
    friends_data = FriendUserSerializer(friend_users, many=True).data

    incoming_requests = (
        FriendRequest.objects
        .select_related('from_user__profile', 'to_user__profile')
        .filter(to_user=user, status='pending')
        .order_by('-created_at')
    )
    incoming_data = FriendRequestSerializer(incoming_requests, many=True).data

    outgoing_requests = (
        FriendRequest.objects
        .select_related('from_user__profile', 'to_user__profile')
        .filter(from_user=user, status='pending')
        .order_by('-created_at')
    )
    outgoing_data = FriendRequestSerializer(outgoing_requests, many=True).data

    return {
        'friends': friends_data,
        'incomingRequests': incoming_data,
        'outgoingRequests': outgoing_data,
    }


@api_view(['GET'])
def friends_overview(request):
    if not request.user.is_authenticated:
        return Response({'detail': 'authentication required'}, status=status.HTTP_401_UNAUTHORIZED)

    return Response(_serialize_friends_payload(request.user))


@api_view(['POST'])
def send_friend_request(request):
    if not request.user.is_authenticated:
        return Response({'detail': 'authentication required'}, status=status.HTTP_401_UNAUTHORIZED)

    username = (request.data.get('username') or '').strip()
    if not username:
        return Response({'detail': 'username is required'}, status=status.HTTP_400_BAD_REQUEST)

    target_user = User.objects.filter(username=username).select_related('profile').first()
    if target_user is None:
        return Response({'detail': 'target user not found'}, status=status.HTTP_404_NOT_FOUND)

    if target_user.id == request.user.id:
        return Response({'detail': 'cannot send a friend request to yourself'}, status=status.HTTP_400_BAD_REQUEST)

    my_profile, _ = Profile.objects.get_or_create(user=request.user, defaults={'display_name': request.user.username})
    target_profile, _ = Profile.objects.get_or_create(user=target_user, defaults={'display_name': target_user.username})

    if my_profile.friends.filter(id=target_profile.id).exists():
        return Response({'detail': 'already friends'}, status=status.HTTP_400_BAD_REQUEST)

    reverse_pending = FriendRequest.objects.filter(from_user=target_user, to_user=request.user, status='pending').first()
    if reverse_pending:
        with transaction.atomic():
            my_profile.friends.add(target_profile)
            reverse_pending.status = 'accepted'
            reverse_pending.responded_at = timezone.now()
            reverse_pending.save(update_fields=['status', 'responded_at'])
        return Response(_serialize_friends_payload(request.user), status=status.HTTP_200_OK)

    existing = FriendRequest.objects.filter(from_user=request.user, to_user=target_user).first()
    if existing and existing.status == 'pending':
        return Response(_serialize_friends_payload(request.user), status=status.HTTP_200_OK)

    if existing and existing.status in {'denied', 'accepted'}:
        existing.status = 'pending'
        existing.responded_at = None
        existing.save(update_fields=['status', 'responded_at'])
    else:
        FriendRequest.objects.create(from_user=request.user, to_user=target_user, status='pending')

    return Response(_serialize_friends_payload(request.user), status=status.HTTP_201_CREATED)


@api_view(['POST'])
def accept_friend_request(request, request_id):
    if not request.user.is_authenticated:
        return Response({'detail': 'authentication required'}, status=status.HTTP_401_UNAUTHORIZED)

    with transaction.atomic():
        friend_request = FriendRequest.objects.select_for_update().select_related('from_user__profile', 'to_user__profile').filter(id=request_id).first()
        if friend_request is None:
            return Response({'detail': 'friend request not found'}, status=status.HTTP_404_NOT_FOUND)

        if friend_request.to_user_id != request.user.id:
            return Response({'detail': "cannot respond to another user's friend request"}, status=status.HTTP_403_FORBIDDEN)

        if friend_request.status != 'pending':
            return Response({'detail': 'friend request is no longer pending'}, status=status.HTTP_400_BAD_REQUEST)

        sender_profile, _ = Profile.objects.get_or_create(user=friend_request.from_user, defaults={'display_name': friend_request.from_user.username})
        receiver_profile, _ = Profile.objects.get_or_create(user=request.user, defaults={'display_name': request.user.username})
        receiver_profile.friends.add(sender_profile)

        friend_request.status = 'accepted'
        friend_request.responded_at = timezone.now()
        friend_request.save(update_fields=['status', 'responded_at'])

    return Response(_serialize_friends_payload(request.user), status=status.HTTP_200_OK)


@api_view(['POST'])
def deny_friend_request(request, request_id):
    if not request.user.is_authenticated:
        return Response({'detail': 'authentication required'}, status=status.HTTP_401_UNAUTHORIZED)

    friend_request = FriendRequest.objects.filter(id=request_id).first()
    if friend_request is None:
        return Response({'detail': 'friend request not found'}, status=status.HTTP_404_NOT_FOUND)

    if friend_request.to_user_id != request.user.id:
        return Response({'detail': "cannot respond to another user's friend request"}, status=status.HTTP_403_FORBIDDEN)

    if friend_request.status != 'pending':
        return Response({'detail': 'friend request is no longer pending'}, status=status.HTTP_400_BAD_REQUEST)

    friend_request.status = 'denied'
    friend_request.responded_at = timezone.now()
    friend_request.save(update_fields=['status', 'responded_at'])

    return Response(_serialize_friends_payload(request.user), status=status.HTTP_200_OK)


@api_view(['POST'])
def auth_register(request):
    data = request.data
    username = data.get('username')
    password = data.get('password')
    email = data.get('email', '')

    if not username or not password:
        return Response({'detail': 'username and password required'}, status=status.HTTP_400_BAD_REQUEST)

    if User.objects.filter(username=username).exists():
        return Response({'detail': 'username already taken'}, status=status.HTTP_400_BAD_REQUEST)

    user = User.objects.create_user(username=username, password=password, email=email)
    login(request, user)
    serializer = UserSerializer(user)
    return Response({'user': serializer.data}, status=status.HTTP_201_CREATED)


@api_view(['POST'])
def auth_login(request):
    data = request.data
    username = data.get('username')
    password = data.get('password')
    if not username or not password:
        return Response({'detail': 'username and password required'}, status=status.HTTP_400_BAD_REQUEST)

    user = authenticate(request, username=username, password=password)
    if user is None:
        return Response({'detail': 'invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)

    login(request, user)
    serializer = UserSerializer(user)

    wallet_increase = 0
    today = timezone.localdate()
    profile = getattr(user, 'profile', None)
    if profile is not None:
        if profile.last_daily_bonus_claimed_at != today:
            profile.wallet = (profile.wallet or 0) + DAILY_LOGIN_BONUS
            profile.last_daily_bonus_claimed_at = today
            profile.save(update_fields=['wallet', 'last_daily_bonus_claimed_at'])
            wallet_increase = DAILY_LOGIN_BONUS

    return Response({'user': serializer.data, 'walletIncrease': wallet_increase})


@api_view(['GET'])
def auth_session(request):
    if not request.user.is_authenticated:
        return Response({'user': None})
    serializer = UserSerializer(request.user)
    return Response({'user': serializer.data})


@api_view(['POST'])
def auth_logout(request):
    logout(request)
    return Response({'ok': True})



@api_view(['POST'])
def auth_add_test_gold(request):
    if not request.user.is_authenticated:
        return Response({'detail': 'authentication required'}, status=status.HTTP_401_UNAUTHORIZED)

    profile = getattr(request.user, 'profile', None)
    if profile is None:
        return Response({'detail': 'profile not found'}, status=status.HTTP_404_NOT_FOUND)

    profile.wallet = (profile.wallet or 0) + 100
    profile.save(update_fields=['wallet'])

    serializer = UserSerializer(request.user)
    return Response({'user': serializer.data})



@api_view(['GET'])
def market_listings(request):
    listings = (
        MarketListing.objects
        .select_related('owned_song__song', 'seller__profile', 'buyer')
        .filter(status='active')
        .order_by('-created_at')
    )
    serializer = MarketListingSerializer(listings, many=True)
    data = list(serializer.data)
    hydrate_songs_from_spotify(data)
    return Response(data)


@api_view(['POST'])
def market_create_listing(request):
    if not request.user.is_authenticated:
        return Response({'detail': 'authentication required'}, status=status.HTTP_401_UNAUTHORIZED)

    owned_song_id = request.data.get('ownedSongId')
    price = request.data.get('price')

    try:
        owned_song_id = int(owned_song_id)
        price = int(price)
    except (TypeError, ValueError):
        return Response({'detail': 'ownedSongId and price must be integers'}, status=status.HTTP_400_BAD_REQUEST)

    if price <= 0:
        return Response({'detail': 'price must be greater than 0'}, status=status.HTTP_400_BAD_REQUEST)

    owned_song = get_object_or_404(OwnedSong.objects.select_related('song'), id=owned_song_id, owner=request.user)

    if MarketListing.objects.filter(owned_song=owned_song, status='active').exists():
        return Response({'detail': 'song is already listed'}, status=status.HTTP_400_BAD_REQUEST)

    listing = MarketListing.objects.create(
        owned_song=owned_song,
        seller=request.user,
        price=price,
        status='active',
    )
    serializer = MarketListingSerializer(listing)
    data = serializer.data
    hydrate_songs_from_spotify([data])
    return Response(data, status=status.HTTP_201_CREATED)


@api_view(['POST'])
def market_buy_listing(request, listing_id):
    if not request.user.is_authenticated:
        return Response({'detail': 'authentication required'}, status=status.HTTP_401_UNAUTHORIZED)

    with transaction.atomic():
        listing = (
            MarketListing.objects
            .select_for_update()
            .select_related('owned_song', 'seller__profile')
            .filter(id=listing_id)
            .first()
        )
        if listing is None or listing.status != 'active':
            return Response({'detail': 'listing is not available'}, status=status.HTTP_404_NOT_FOUND)

        if listing.seller_id == request.user.id:
            return Response({'detail': 'cannot buy your own listing'}, status=status.HTTP_400_BAD_REQUEST)

        buyer_profile = request.user.profile
        seller_profile = listing.seller.profile

        if buyer_profile.wallet < listing.price:
            return Response({'detail': 'not enough money in wallet'}, status=status.HTTP_400_BAD_REQUEST)

        buyer_profile.wallet -= listing.price
        seller_profile.wallet += listing.price
        buyer_profile.save(update_fields=['wallet'])
        seller_profile.save(update_fields=['wallet'])

        owned_song = listing.owned_song
        owned_song.owner = request.user
        owned_song.save(update_fields=['owner'])

        listing.status = 'sold'
        listing.buyer = request.user
        listing.sold_at = timezone.now()
        listing.save(update_fields=['status', 'buyer', 'sold_at'])

    serializer = MarketListingSerializer(listing)
    data = serializer.data
    hydrate_songs_from_spotify([data])
    return Response(data, status=status.HTTP_200_OK)