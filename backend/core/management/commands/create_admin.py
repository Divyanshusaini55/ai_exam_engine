"""
Django management command to automatically create a superuser during deployment.

This command is safe to run multiple times and will not create duplicate users.
It reads credentials from environment variables for security.

Usage:
    python manage.py create_admin

Environment Variables Required:
    ADMIN_USERNAME - Username for the admin account (default: admin)
    ADMIN_EMAIL - Email for the admin account (default: admin@example.com)
    ADMIN_PASSWORD - Password for the admin account (required)
"""

import os
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model


class Command(BaseCommand):
    help = 'Creates an admin superuser non-interactively if it does not exist'

    def handle(self, *args, **options):
        User = get_user_model()
        
        # Get credentials from environment variables
        username = os.environ.get('ADMIN_USERNAME', 'admin')
        email = os.environ.get('ADMIN_EMAIL', 'admin@example.com')
        password = os.environ.get('ADMIN_PASSWORD')
        
        # Validate password is provided
        if not password:
            self.stdout.write(
                self.style.WARNING(
                    'ADMIN_PASSWORD not set. Skipping admin user creation.'
                )
            )
            return
        
        # Check if user already exists
        if User.objects.filter(username=username).exists():
            self.stdout.write(
                self.style.SUCCESS(
                    f'Admin user "{username}" already exists. Skipping creation.'
                )
            )
            return
        
        # Create the superuser
        try:
            User.objects.create_superuser(
                username=username,
                email=email,
                password=password
            )
            self.stdout.write(
                self.style.SUCCESS(
                    f'Admin user "{username}" created successfully!'
                )
            )
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(
                    f'Error creating admin user: {str(e)}'
                )
            )
            # Don't raise exception - we don't want to fail the build
            # Just log the error and continue
