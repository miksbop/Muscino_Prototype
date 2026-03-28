from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0002_marketlisting'),
    ]

    operations = [
        migrations.AddField(
            model_name='profile',
            name='last_daily_bonus_claimed_at',
            field=models.DateField(blank=True, null=True),
        ),
    ]