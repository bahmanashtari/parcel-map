"""
Django settings module with environment-based configuration.
Auto-selects settings based on DJANGO_ENV variable.
"""

import os
from django.core.management.utils import get_random_secret_key

DJANGO_ENV = os.getenv('DJANGO_ENV', 'development')

if DJANGO_ENV == 'production':
    from .production import *
else:
    from .development import *
