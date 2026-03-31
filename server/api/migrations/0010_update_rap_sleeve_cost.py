from django.db import migrations


RAP_SLEEVE_ID = "sleeve_rap_01"
RAP_SLEEVE_COST = 20


def set_rap_sleeve_cost(apps, schema_editor):
    Sleeve = apps.get_model("api", "Sleeve")
    Sleeve.objects.filter(id=RAP_SLEEVE_ID).update(cost=RAP_SLEEVE_COST)


def noop_reverse(apps, schema_editor):
    """No-op reverse migration."""
    return


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0009_profile_profile_background_opacity"),
    ]

    operations = [
        migrations.RunPython(set_rap_sleeve_cost, noop_reverse),
    ]