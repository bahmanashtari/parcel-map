from django.urls import path

from .views import parcel_bbox

urlpatterns = [
    path("parcels/", parcel_bbox, name="parcel-bbox"),
]
