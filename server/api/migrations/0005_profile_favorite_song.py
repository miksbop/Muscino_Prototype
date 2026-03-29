from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('api', '00004_profile_customization_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='profile',
            name='favorite_song',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='favorite_by_profiles',
                to='api.song',
            ),
        ),
    ]