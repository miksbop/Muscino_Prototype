import random
from django.shortcuts import get_object_or_404
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth.models import User
from django.contrib.auth import authenticate, login, logout
from .models import Sleeve, SleeveSong, OwnedSong, Song
from .serializers import SleeveSerializer, OwnedSongSerializer, SongSerializer, UserSerializer
from .spotify import hydrate_songs_from_spotify

RARITY_WEIGHT = {
    'Common': 35,
    'Uncommon': 25,
    'Rare': 20,
    'Epic': 15,
    'Legendary': 5,
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
    # If authenticated, return only the user's inventory. Otherwise, support ?owner=username to view others.
    if request.user and request.user.is_authenticated:
        items = OwnedSong.objects.filter(owner=request.user).select_related('song').order_by('-obtained_at')
    else:
        username = request.query_params.get('owner')
        if username:
            user = get_object_or_404(User, username=username)
            items = OwnedSong.objects.filter(owner=user).select_related('song').order_by('-obtained_at')
        else:
            items = OwnedSong.objects.select_related('song', 'owner').order_by('-obtained_at')

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

    # Require authentication for opening a sleeve (dev-safe default).
    if not (request.user and request.user.is_authenticated):
        return Response({'detail': 'authentication required to open sleeve'}, status=status.HTTP_401_UNAUTHORIZED)

    owned = OwnedSong.objects.create(song=chosen.song, rarity=chosen.rarity, owner=request.user)
    serializer = OwnedSongSerializer(owned)
    data = serializer.data
    hydrate_songs_from_spotify([data])
    return Response(data, status=status.HTTP_201_CREATED)


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
    if request.user and request.user.is_authenticated:
        serializer = UserSerializer(request.user)
        return Response({'user': serializer.data})
    return Response({'user': None})


@api_view(['POST'])
def auth_logout(request):
    logout(request)
    # clear session cookie on client side; server responds OK
    return Response({'ok': True}, status=status.HTTP_200_OK)
