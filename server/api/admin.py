from django.contrib import admin
from .models import Song, Sleeve, SleeveSong, OwnedSong


@admin.register(Song)
class SongAdmin(admin.ModelAdmin):
    list_display = ('id', 'title', 'artist', 'genre')
    search_fields = ('title', 'artist', 'id')


@admin.register(Sleeve)
class SleeveAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'genre', 'cost', 'refreshed_weekly')
    search_fields = ('name', 'id')


@admin.register(SleeveSong)
class SleeveSongAdmin(admin.ModelAdmin):
    list_display = ('sleeve', 'song', 'rarity', 'weight')
    search_fields = ('sleeve__id', 'song__title')


@admin.register(OwnedSong)
class OwnedSongAdmin(admin.ModelAdmin):
    list_display = ('song', 'rarity', 'owner', 'obtained_at')
    search_fields = ('song__title', 'owner__username')
