from django.urls import path

from .views import document_constraints, parcel_bbox

urlpatterns = [
    path("parcels/", parcel_bbox, name="parcel-bbox"),
    path("documents/<int:document_id>/constraints/", document_constraints, name="document-constraints"),
]
