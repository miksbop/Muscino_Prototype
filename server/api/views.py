import random
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from datetime import date
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth.models import User
from django.contrib.auth import authenticate, login, logout
from .models import Sleeve, SleeveSong, OwnedSong, Song, MarketListing, Profile
from .serializers import SleeveSerializer, OwnedSongSerializer, SongSerializer, UserSerializer, MarketListingSerializer
from .spotify import SpotifyClient, hydrate_songs_from_spotify

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
    defaults = {
        'title': track.title or track.track_id,
        'artist': track.artist or 'Unknown Artist',
        'cover_url': track.cover_url,
        'genre': 'Unknown',
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
            if value and getattr(song, field) != value:
                setattr(song, field, value)
                changed_fields.append(field)
        if changed_fields:
            song.save(update_fields=changed_fields)

    return song


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

    if not isinstance(owned_song_ids, list) or len(owned_song_ids) != 3:
        return Response({'detail': 'exactly 3 ownedSongIds are required'}, status=status.HTTP_400_BAD_REQUEST)

    if not artist_keyword:
        return Response({'detail': 'artistKeyword is required'}, status=status.HTTP_400_BAD_REQUEST)

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

    candidates = spotify_client.search_artist_tracks(artist_keyword, limit=10)
    if not candidates:
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
def profile_detail(request, username):
    user = get_object_or_404(User.objects.select_related('profile'), username=username)

    owned_qs = OwnedSong.objects.filter(owner=user).select_related('song').order_by('-obtained_at')
    songs_collected = owned_qs.count()

    showcase_items = list(owned_qs[:20])
    showcase_data = OwnedSongSerializer(showcase_items, many=True).data
    hydrate_songs_from_spotify(showcase_data)

    favorite_song = showcase_data[0] if showcase_data else None

    try:
        profile = user.profile
        display_name = profile.display_name or user.username
        wallet = profile.wallet
        avatar_url = profile.avatar_url
    except Profile.DoesNotExist:
        display_name = user.username
        wallet = 0
        avatar_url = None

    joined_date = user.date_joined.date()
    days_registered = max((date.today() - joined_date).days, 0)

    return Response({
        'id': str(user.id),
        'username': user.username,
        'displayName': display_name,
        'wallet': wallet,
        'avatarUrl': avatar_url,
        'joinedAt': user.date_joined.isoformat(),
        'daysRegistered': days_registered,
        'songsCollected': songs_collected,
        'bio': '',
        'favoriteSong': favorite_song,
        'showcaseSongs': showcase_data,
    })


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
    return Response({'user': serializer.data})


@api_view(['GET'])
def auth_session(request):
    if request.user.is_authenticated:
        serializer = UserSerializer(request.user)
        return Response({'user': serializer.data})
    return Response({'user': None})


@api_view(['POST'])
def auth_logout(request):
    logout(request)
    return Response({'ok': True}, status=status.HTTP_200_OK)


@api_view(['GET'])
def market_listings(request):
    listings = (
        MarketListing.objects
        .filter(status='active')
        .select_related('seller', 'buyer', 'owned_song__song')
        .order_by('-created_at')
    )
    serializer = MarketListingSerializer(listings, many=True)
    data = hydrate_songs_from_spotify(list(serializer.data))
    return Response(data)


@api_view(['POST'])
def market_create_listing(request):
    if not request.user.is_authenticated:
        return Response({'detail': 'authentication required'}, status=status.HTTP_401_UNAUTHORIZED)

    try:
        owned_song_id = int(request.data.get('ownedSongId'))
    except (TypeError, ValueError):
        return Response({'detail': 'valid ownedSongId required'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        price = int(request.data.get('price'))
    except (TypeError, ValueError):
        return Response({'detail': 'valid price required'}, status=status.HTTP_400_BAD_REQUEST)

    if price <= 0:
        return Response({'detail': 'price must be greater than zero'}, status=status.HTTP_400_BAD_REQUEST)

    owned = get_object_or_404(OwnedSong.objects.select_related('owner'), pk=owned_song_id)
    if owned.owner_id != request.user.id:
        return Response({'detail': 'you do not own this song'}, status=status.HTTP_403_FORBIDDEN)

    listing = MarketListing.objects.filter(owned_song=owned).first()
    if listing and listing.status == 'active':
        return Response({'detail': 'song is already listed'}, status=status.HTTP_400_BAD_REQUEST)

    if listing:
        listing.seller = request.user
        listing.buyer = None
        listing.price = price
        listing.status = 'active'
        listing.sold_at = None
        listing.created_at = timezone.now()
        listing.save(update_fields=['seller', 'buyer', 'price', 'status', 'sold_at', 'created_at'])
    else:
        listing = MarketListing.objects.create(
            owned_song=owned,
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
        listing = get_object_or_404(
            MarketListing.objects.select_for_update().select_related('seller', 'owned_song'),
            pk=listing_id,
        )

        if listing.status != 'active':
            return Response({'detail': 'listing is no longer active'}, status=status.HTTP_400_BAD_REQUEST)

        if listing.seller_id == request.user.id:
            return Response({'detail': 'cannot buy your own listing'}, status=status.HTTP_400_BAD_REQUEST)

        buyer_profile = Profile.objects.select_for_update().get(user=request.user)
        seller_profile = Profile.objects.select_for_update().get(user=listing.seller)
        owned_song = OwnedSong.objects.select_for_update().get(pk=listing.owned_song_id)

        if owned_song.owner_id != listing.seller_id:
            return Response({'detail': 'listing owner mismatch'}, status=status.HTTP_409_CONFLICT)

        if buyer_profile.wallet < listing.price:
            return Response({'detail': 'not enough money in wallet'}, status=status.HTTP_400_BAD_REQUEST)

        buyer_profile.wallet -= listing.price
        seller_profile.wallet += listing.price
        buyer_profile.save(update_fields=['wallet'])
        seller_profile.save(update_fields=['wallet'])

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