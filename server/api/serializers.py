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
    spotifyTrackId = serializers.CharField(source='song.spotify_track_id', allow_null=True)
    spotifyUrl = serializers.CharField(source='song.spotify_url', allow_null=True)

    class Meta:
        model = SleeveSong
        fields = ['id', 'title', 'artist', 'coverUrl', 'genre', 'rarity', 'weight', 'spotifyTrackId', 'spotifyUrl']


class SleeveSerializer(serializers.ModelSerializer):
    contents = SleeveSongSerializer(many=True, source='contents')
    refreshedWeekly = serializers.BooleanField(source='refreshed_weekly')

    class Meta:
        model = Sleeve
        fields = ['id', 'name', 'genre', 'cost', 'refreshedWeekly', 'contents']


class OwnedSongSerializer(serializers.ModelSerializer):
    songId = serializers.CharField(source='song.id')
    title = serializers.CharField(source='song.title')
    artist = serializers.CharField(source='song.artist')
    coverUrl = serializers.CharField(source='song.cover_url')
    genre = serializers.CharField(source='song.genre')
    rarity = serializers.CharField()
    obtainedAt = serializers.DateTimeField(source='obtained_at')
    owner = serializers.CharField(source='owner.username', allow_null=True)
    spotifyTrackId = serializers.CharField(source='song.spotify_track_id', allow_null=True)
    spotifyUrl = serializers.CharField(source='song.spotify_url', allow_null=True)

    class Meta:
        model = OwnedSong
        fields = ['id', 'title', 'artist', 'coverUrl', 'genre', 'rarity', 'obtainedAt', 'owner', 'spotifyTrackId', 'spotifyUrl']


class UserSerializer(serializers.ModelSerializer):
    displayName = serializers.SerializerMethodField()
    wallet = serializers.SerializerMethodField()
    avatarUrl = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'displayName', 'wallet', 'avatarUrl']

    def get_displayName(self, obj):
        try:
            return obj.profile.display_name or obj.username
        except Exception:
            return obj.username

    def get_wallet(self, obj):
        try:
            return obj.profile.wallet
        except Exception:
            return 0

    def get_avatarUrl(self, obj):
        try:
            return obj.profile.avatar_url
        except Exception:
            return None
