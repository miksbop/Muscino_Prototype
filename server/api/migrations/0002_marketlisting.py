from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='MarketListing',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('price', models.PositiveIntegerField()),
                ('status', models.CharField(choices=[('active', 'active'), ('sold', 'sold'), ('cancelled', 'cancelled')], default='active', max_length=20)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('sold_at', models.DateTimeField(blank=True, null=True)),
                ('buyer', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='market_purchases', to=settings.AUTH_USER_MODEL)),
                ('owned_song', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='market_listing', to='api.ownedsong')),
                ('seller', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='market_listings', to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.AddIndex(
            model_name='marketlisting',
            index=models.Index(fields=['status', '-created_at'], name='api_marketl_status_e89e8b_idx'),
        ),
        migrations.AddIndex(
            model_name='marketlisting',
            index=models.Index(fields=['seller', 'status'], name='api_marketl_seller__f1df53_idx'),
        ),
    ]