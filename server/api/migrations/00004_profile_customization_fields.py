from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0003_profile_last_daily_bonus_claimed_at'),
    ]

    operations = [
        migrations.AddField(
            model_name='profile',
            name='avatar_image',
            field=models.BinaryField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='profile',
            name='avatar_mime_type',
            field=models.CharField(blank=True, max_length=100, null=True),
        ),
        migrations.AddField(
            model_name='profile',
            name='bio',
            field=models.TextField(blank=True, default=''),
        ),
        migrations.AddField(
            model_name='profile',
            name='theme_color',
            field=models.CharField(blank=True, default='#737373', max_length=7),
        ),
    ]