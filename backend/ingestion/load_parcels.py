"""Simple first-pass ingestion for a small Fremont parcel sample."""

from __future__ import annotations

import json

from django.contrib.gis.geos import GEOSGeometry, MultiPolygon

from ingestion.client import AlamedaParcelClient
from parcel_app.models import Jurisdiction, Parcel, Source


def _parse_geom_as_multipolygon(geometry: dict) -> MultiPolygon:
    """Parse GeoJSON geometry into a MultiPolygon for the Parcel model."""
    geom = GEOSGeometry(json.dumps(geometry), srid=4326)

    if geom.geom_type == "Polygon":
        return MultiPolygon(geom, srid=4326)

    if geom.geom_type == "MultiPolygon":
        return geom

    raise ValueError(f"Expected Polygon/MultiPolygon, got {geom.geom_type}")


def load_parcel_geojson() -> int:
    """Ingest a small Fremont parcel GeoJSON sample into Parcel."""
    # Fetching is now delegated to a reusable ArcGIS client.
    client = AlamedaParcelClient(timeout=30)
    feature_collection = client.fetch_parcel_page(offset=0, limit=5)

    jurisdiction = Jurisdiction.objects.get(name="Fremont")
    source = Source.objects.get(
        jurisdiction=jurisdiction,
        name="Fremont Parcels GeoJSON",
    )

    created_count = 0

    for feature in feature_collection.get("features", []):
        properties = feature.get("properties", {})
        geometry = feature.get("geometry")

        apn = (properties.get("APN") or "").strip()
        address = properties.get("SitusAddress")

        if not apn or not geometry:
            continue

        if Parcel.objects.filter(source=source, apn=apn).exists():
            continue

        parcel_geom = _parse_geom_as_multipolygon(geometry)

        Parcel.objects.create(
            jurisdiction=jurisdiction,
            source=source,
            apn=apn,
            address=address,
            geom=parcel_geom,
            source_crs="EPSG:4326",
        )
        created_count += 1

    return created_count
