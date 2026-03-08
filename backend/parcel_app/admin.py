from django.contrib import admin

from .models import Jurisdiction, Parcel, Source

admin.site.register(Jurisdiction)
admin.site.register(Source)
admin.site.register(Parcel)
