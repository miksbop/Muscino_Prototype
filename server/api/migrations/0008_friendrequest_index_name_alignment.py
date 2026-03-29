from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0007_profile_background"),
    ]

    operations = [
        migrations.RenameIndex(
            model_name="friendrequest",
            old_name="api_friendre_to_user_61cf7f_idx",
            new_name="api_friendr_to_user_be5c7b_idx",
        ),
        migrations.RenameIndex(
            model_name="friendrequest",
            old_name="api_friendre_from_us_940c20_idx",
            new_name="api_friendr_from_us_26913b_idx",
        ),
    ]