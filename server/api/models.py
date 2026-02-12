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
