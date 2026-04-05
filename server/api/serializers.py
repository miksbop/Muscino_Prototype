import base64
from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Song, Sleeve, SleeveSong, OwnedSong, MarketListing, FriendRequest


def _profile_avatar_data_url(profile):
    if profile.avatar_image and profile.avatar_mime_type:
        try:
            raw = bytes(profile.avatar_image)
            encoded = base64.b64encode(raw).decode('ascii')
            return f"data:{profile.avatar_mime_type};base64,{encoded}"
        except Exception:
            return profile.avatar_url
    return profile.avatar_url


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
    coverUrl = serializers.CharField(source='song.cover_url', allow_null=True)
    genre = serializers.CharField(source='song.genre')
    rarity = serializers.CharField()
    spotifyTrackId = serializers.CharField(source='song.spotify_track_id', allow_null=True)
    spotifyUrl = serializers.CharField(source='song.spotify_url', allow_null=True)

    class Meta:
        model = SleeveSong
        fields = ['id', 'title', 'artist', 'coverUrl', 'genre', 'rarity', 'weight', 'spotifyTrackId', 'spotifyUrl']


class SleeveSerializer(serializers.ModelSerializer):
    contents = SleeveSongSerializer(many=True)
    refreshedWeekly = serializers.BooleanField(source='refreshed_weekly')

    class Meta:
        model = Sleeve
        fields = ['id', 'name', 'genre', 'cost', 'refreshedWeekly', 'contents']


class OwnedSongSerializer(serializers.ModelSerializer):
    songId = serializers.CharField(source='song.id')
    title = serializers.CharField(source='song.title')
    artist = serializers.CharField(source='song.artist')
    coverUrl = serializers.CharField(source='song.cover_url', allow_null=True)
    genre = serializers.CharField(source='song.genre')
    rarity = serializers.CharField()
    obtainedAt = serializers.DateTimeField(source='obtained_at')
    owner = serializers.CharField(source='owner.username', allow_null=True)
    spotifyTrackId = serializers.CharField(source='song.spotify_track_id', allow_null=True)
    spotifyUrl = serializers.CharField(source='song.spotify_url', allow_null=True)

    class Meta:
        model = OwnedSong
        fields = ['id', 'songId', 'title', 'artist', 'coverUrl', 'genre', 'rarity', 'obtainedAt', 'owner', 'spotifyTrackId', 'spotifyUrl']


class UserSerializer(serializers.ModelSerializer):
    displayName = serializers.SerializerMethodField()
    wallet = serializers.SerializerMethodField()
    avatarUrl = serializers.SerializerMethodField()
    level = serializers.SerializerMethodField()
    xp = serializers.SerializerMethodField()
    xpToNextLevel = serializers.SerializerMethodField()
    dailyCoins = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'displayName', 'wallet', 'avatarUrl', 'level', 'xp', 'xpToNextLevel', 'dailyCoins']

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
            return _profile_avatar_data_url(obj.profile)
        except Exception:
            return None
        

    def get_level(self, obj):
        try:
            return max(1, int(obj.profile.level or 1))
        except Exception:
            return 1

    def get_xp(self, obj):
        try:
            return max(0, int(obj.profile.xp or 0))
        except Exception:
            return 0

    def get_xpToNextLevel(self, obj):
        level = self.get_level(obj)
        return max(500, 500 * level)

    def get_dailyCoins(self, obj):
        level = self.get_level(obj)
        return 100 + max(0, level - 1) * 40



class FriendUserSerializer(serializers.ModelSerializer):
    displayName = serializers.SerializerMethodField()
    wallet = serializers.SerializerMethodField()
    avatarUrl = serializers.SerializerMethodField()
    bio = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'displayName', 'wallet', 'avatarUrl', 'bio']

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
            return _profile_avatar_data_url(obj.profile)
        except Exception:
            return None

    def get_bio(self, obj):
        try:
            return obj.profile.bio or ''
        except Exception:
            return ''


class FriendRequestSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(read_only=True)
    fromUser = FriendUserSerializer(source='from_user', read_only=True)
    toUser = FriendUserSerializer(source='to_user', read_only=True)
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)

    class Meta:
        model = FriendRequest
        fields = ['id', 'status', 'fromUser', 'toUser', 'createdAt']



class MarketListingSerializer(serializers.ModelSerializer):
    ownedSongId = serializers.IntegerField(source='owned_song.id')
    songId = serializers.CharField(source='owned_song.song.id')
    title = serializers.CharField(source='owned_song.song.title')
    artist = serializers.CharField(source='owned_song.song.artist')
    coverUrl = serializers.CharField(source='owned_song.song.cover_url')
    genre = serializers.CharField(source='owned_song.song.genre')
    rarity = serializers.CharField(source='owned_song.rarity')
    seller = serializers.CharField(source='seller.username')
    sellerAvatarUrl = serializers.SerializerMethodField()
    buyer = serializers.CharField(source='buyer.username', allow_null=True)
    createdAt = serializers.DateTimeField(source='created_at')
    soldAt = serializers.DateTimeField(source='sold_at', allow_null=True)

    def get_sellerAvatarUrl(self, obj):
        try:
            return _profile_avatar_data_url(obj.seller.profile)
        except Exception:
            return None
        
    class Meta:
        model = MarketListing
        fields = [
            'id',
            'ownedSongId',
            'songId',
            'title',
            'artist',
            'coverUrl',
            'genre',
            'rarity',
            'seller',
            'sellerAvatarUrl',
            'buyer',
            'price',
            'status',
            'createdAt',
            'soldAt',
        ]