from django.db import models
from django.conf import settings


class Song(models.Model):
    id = models.CharField(max_length=200, primary_key=True)
    title = models.CharField(max_length=500)
    artist = models.CharField(max_length=500)
    cover_url = models.CharField(max_length=1000, blank=True, null=True)
    genre = models.CharField(max_length=200, blank=True, null=True)
    spotify_track_id = models.CharField(max_length=200, blank=True, null=True)
    spotify_url = models.CharField(max_length=1000, blank=True, null=True)

    def __str__(self):
        return f"{self.title} - {self.artist}"


class Sleeve(models.Model):
    id = models.CharField(max_length=200, primary_key=True)
    name = models.CharField(max_length=200)
    genre = models.CharField(max_length=100)
    cost = models.IntegerField(default=0)
    refreshed_weekly = models.BooleanField(default=False)

    def __str__(self):
        return self.name


RARITY_CHOICES = [
    ("Common", "Common"),
    ("Uncommon", "Uncommon"),
    ("Rare", "Rare"),
    ("Epic", "Epic"),
    ("Legendary", "Legendary"),
]


class SleeveSong(models.Model):
    sleeve = models.ForeignKey(Sleeve, related_name='contents', on_delete=models.CASCADE)
    song = models.ForeignKey(Song, on_delete=models.CASCADE)
    rarity = models.CharField(max_length=50, choices=RARITY_CHOICES)
    weight = models.FloatField(blank=True, null=True)

    def __str__(self):
        return f"{self.song} in {self.sleeve} ({self.rarity})"


class Profile(models.Model):
    """Simple profile attached to Django User to store display name, wallet, and avatar."""
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='profile')
    display_name = models.CharField(max_length=200, blank=True)
    wallet = models.IntegerField(default=100)
    last_daily_bonus_claimed_at = models.DateField(blank=True, null=True)
    avatar_url = models.CharField(max_length=1000, blank=True, null=True)
    avatar_image = models.BinaryField(blank=True, null=True)
    avatar_mime_type = models.CharField(max_length=100, blank=True, null=True)
    bio = models.TextField(blank=True, default='')
    theme_color = models.CharField(max_length=7, blank=True, default='#737373')
    favorite_song = models.ForeignKey(
        Song,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='favorite_by_profiles',
    )
    profile_background = models.CharField(max_length=255, blank=True, default='')
    profile_background_opacity = models.FloatField(default=1.0)
    friends = models.ManyToManyField('self', symmetrical=True, blank=True)

    def __str__(self):
        return f"Profile for {self.user.username}"


class FriendRequest(models.Model):
    from_user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='sent_friend_requests')
    to_user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='received_friend_requests')
    status = models.CharField(max_length=20, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)
    responded_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['from_user', 'to_user'], name='unique_friend_request_pair'),
        ]
        indexes = [
            models.Index(fields=['to_user', 'status', '-created_at']),
            models.Index(fields=['from_user', 'status']),
        ]


class OwnedSong(models.Model):
    song = models.ForeignKey(Song, on_delete=models.CASCADE)
    rarity = models.CharField(max_length=50, choices=RARITY_CHOICES)
    obtained_at = models.DateTimeField(auto_now_add=True)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='owned_songs',
        null=True,
        blank=True,
    )

    def __str__(self):
        return f"Owned {self.song} ({self.rarity})"


LISTING_STATUS_CHOICES = [
    ("active", "active"),
    ("sold", "sold"),
    ("cancelled", "cancelled"),
]


class MarketListing(models.Model):
    owned_song = models.OneToOneField(OwnedSong, on_delete=models.CASCADE, related_name='market_listing')
    seller = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='market_listings')
    buyer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name='market_purchases',
        null=True,
        blank=True,
    )
    price = models.PositiveIntegerField()
    status = models.CharField(max_length=20, choices=LISTING_STATUS_CHOICES, default='active')
    created_at = models.DateTimeField(auto_now_add=True)
    sold_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=['status', '-created_at']),
            models.Index(fields=['seller', 'status']),
        ]

    def __str__(self):
        return f"{self.owned_song_id} listed by {self.seller_id} ({self.status})"


# Ensure a Profile exists for each User
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.auth import get_user_model


@receiver(post_save, sender=get_user_model())
def create_or_update_profile(sender, instance, created, **kwargs):
    if created:
        Profile.objects.create(user=instance, display_name=instance.username)
    else:
        # ensure profile exists on subsequent saves in case migrations create users
        try:
            instance.profile
        except Profile.DoesNotExist:
            Profile.objects.create(user=instance, display_name=instance.username)