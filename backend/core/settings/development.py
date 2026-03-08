"""
Development-specific Django settings.
Used when DJANGO_ENV=development (default).
"""

import os
from .base import *

DEBUG = True
DEBUG_PROPAGATE_EXCEPTIONS = True

# Allow all hosts in development
ALLOWED_HOSTS = ['*']

# Development email backend (outputs to console)
EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'

# Enhanced development logging
LOGGING['loggers']['django.db.backends']['level'] = 'DEBUG'

# Development cache (simple in-memory)
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
    }
}

# CORS - Allow all in development
CORS_ALLOW_ALL_ORIGINS = True

# Security settings relaxed for development
SECURE_SSL_REDIRECT = False
SESSION_COOKIE_SECURE = False
CSRF_COOKIE_SECURE = False
SECURE_HSTS_SECONDS = 0

# Installed apps - add debug toolbar for development
#INSTALLED_APPS += [
#    'debug_toolbar',
#]

#MIDDLEWARE += [
#    'debug_toolbar.middleware.DebugToolbarMiddleware',
#]

INTERNAL_IPS = ['127.0.0.1', 'localhost']

# REST Framework - verbose errors
REST_FRAMEWORK.update({
    'DEFAULT_RENDERER_CLASSES': [
        'rest_framework.renderers.JSONRenderer',
        'rest_framework.renderers.BrowsableAPIRenderer',
    ],
    'EXCEPTION_HANDLER': 'rest_framework.views.exception_handler',
})

# Database - add verbose output
DATABASES['default']['OPTIONS'].update({
    'connect_timeout': 10,
})

# Simplified connection pooling in development
DATABASES['default']['CONN_MAX_AGE'] = 0  # Don't persist connections

print(f"Django running in DEVELOPMENT mode")
