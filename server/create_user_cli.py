#!/usr/bin/env python
"""Interactive script to create a Django user + Profile from the command line.

Usage: activate your venv and run from the `server` directory:

  .\.venv\Scripts\Activate.ps1
  python create_user_cli.py

The script will prompt for username, password (hidden), display name and starting wallet.
"""
import os
import sys
import django
import getpass


def main():
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
    django.setup()

    from django.contrib.auth import get_user_model
    User = get_user_model()
    from api.models import Profile

    print('Create a new user')
    username = input('username: ').strip()
    if not username:
        print('username required')
        sys.exit(1)

    password = getpass.getpass('password (leave blank to set unusable password): ')
    # keep defaults for now; frontend will handle display name, wallet and avatar
    display_name = username
    wallet = 100
    avatar_url = None

    user, created = User.objects.get_or_create(username=username)
    if created:
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save()
        print(f"Created user '{username}'")
    else:
        print(f"User '{username}' already exists; updating profile and password if provided")
        if password:
            user.set_password(password)
            user.save()

    # Ensure profile exists and update fields
    try:
        profile = user.profile
    except Profile.DoesNotExist:
        profile = Profile.objects.create(user=user, display_name=display_name, wallet=wallet, avatar_url=avatar_url)
        print('Created profile')
    else:
        profile.display_name = display_name
        profile.wallet = wallet
        profile.avatar_url = avatar_url
        profile.save()
        print('Updated profile')

    print('Done. User: ', user.username)


if __name__ == '__main__':
    main()
