from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model


class Command(BaseCommand):
    help = 'Create a local user (and profile) with optional password.'

    def add_arguments(self, parser):
        parser.add_argument('username', type=str, help='Username for the new user')
        parser.add_argument('--password', type=str, help='Password for the new user (optional)')

    def handle(self, *args, **options):
        username = options['username']
        password = options.get('password')
        User = get_user_model()
        user, created = User.objects.get_or_create(username=username)
        if created:
            if password:
                user.set_password(password)
            else:
                # create unusable password to force setting later if omitted
                user.set_unusable_password()
            user.save()
            self.stdout.write(self.style.SUCCESS(f"Created user '{username}'"))
        else:
            self.stdout.write(self.style.WARNING(f"User '{username}' already exists"))

        # Ensure profile created by signals
        try:
            profile = user.profile
            self.stdout.write(self.style.SUCCESS(f"Profile exists for '{username}' (wallet={profile.wallet})"))
        except Exception:
            self.stdout.write(self.style.WARNING(f"Profile for '{username}' not found; you may need to run migrations"))
