import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE','backend.settings')
django.setup()
from api.models import OwnedSong

print('jx count =', OwnedSong.objects.filter(owner__username='jx').count())
print('justin count =', OwnedSong.objects.filter(owner__username='justin').count())
print('demo count =', OwnedSong.objects.filter(owner__username='demo').count())

print('\nList of jx items:')
for o in OwnedSong.objects.filter(owner__username='jx').select_related('song'):
    print(o.id, o.song.id, o.song.title, o.rarity, o.obtained_at)
