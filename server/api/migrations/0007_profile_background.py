from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0006_profile_friends_friendrequests"),
    ]

    operations = [
        migrations.AddField(
            model_name="profile",
            name="profile_background",
            field=models.CharField(blank=True, default="", max_length=255),
        ),
    ]