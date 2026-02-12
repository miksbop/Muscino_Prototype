from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Song, Sleeve, SleeveSong, OwnedSong


class SongSerializer(serializers.ModelSerializer):
    coverUrl = serializers.CharField(source='cover_url', allow_null=True)
    spotifyTrackId = serializers.CharField(source='spotify_track_id', allow_null=True)
    spotifyUrl = serializers.CharField(source='spotify_url', allow_null=True)

    class Meta:
        model = Song
        fields = ['id', 'title', 'artist', 'coverUrl', 'genre', 'spotifyTrackId', 'spotifyUrl']


class SleeveSongSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source='song.id')
    title = serializers.CharField(source='song.title')
    artist = serializers.CharField(source='song.artist')
    coverUrl = serializers.CharField(source='song.cover_url')
    genre = serializers.CharField(source='song.genre')
    rarity = serializers.CharField()

    class Meta:
        model = SleeveSong
        fields = ['id', 'title', 'artist', 'coverUrl', 'genre', 'rarity', 'weight']


class SleeveSerializer(serializers.ModelSerializer):
    contents = SleeveSongSerializer(many=True, source='contents')
    refreshedWeekly = serializers.BooleanField(source='refreshed_weekly')

    class Meta:
        model = Sleeve
        fields = ['id', 'name', 'genre', 'cost', 'refreshedWeekly', 'contents']


class OwnedSongSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source='song.id')
    title = serializers.CharField(source='song.title')
    artist = serializers.CharField(source='song.artist')
    coverUrl = serializers.CharField(source='song.cover_url')
    genre = serializers.CharField(source='song.genre')
    rarity = serializers.CharField()
    obtainedAt = serializers.DateTimeField(source='obtained_at')
    owner = serializers.CharField(source='owner.username', allow_null=True)

    class Meta:
        model = OwnedSong
        fields = ['id', 'title', 'artist', 'coverUrl', 'genre', 'rarity', 'obtainedAt', 'owner']


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username']
