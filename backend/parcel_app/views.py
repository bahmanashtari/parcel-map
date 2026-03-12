import json

from django.contrib.gis.geos import Polygon
from django.shortcuts import get_object_or_404
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status

from .models import Document, ExtractedConstraint, Parcel
from .serializers import ExtractedConstraintSerializer, ParcelSerializer


@api_view(["GET"])
def parcel_bbox(request):
    bbox_param = request.query_params.get("bbox")
    if not bbox_param:
        return Response(
            {"detail": "Missing bbox query parameter. Use west,south,east,north."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        west, south, east, north = map(float, bbox_param.split(","))
    except (TypeError, ValueError):
        return Response(
            {"detail": "Invalid bbox format. Use west,south,east,north."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    bbox_polygon = Polygon.from_bbox((west, south, east, north))
    bbox_polygon.srid = 4326

    parcels = Parcel.objects.filter(
        geom__bboverlaps=bbox_polygon,
        geom__intersects=bbox_polygon,
    )
    serializer = ParcelSerializer(parcels, many=True)

    features = []
    for parcel, properties in zip(parcels, serializer.data):
        features.append(
            {
                "type": "Feature",
                "geometry": json.loads(parcel.geom.geojson),
                "properties": properties,
            }
        )

    return Response(
        {
            "type": "FeatureCollection",
            "features": features,
        }
    )


@api_view(["GET"])
def document_constraints(request, document_id):
    get_object_or_404(Document, id=document_id)

    constraints = ExtractedConstraint.objects.filter(document_id=document_id).order_by("-created_at")
    serializer = ExtractedConstraintSerializer(constraints, many=True)
    return Response(serializer.data)
