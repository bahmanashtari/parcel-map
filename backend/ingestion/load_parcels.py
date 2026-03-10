"""Simple first-pass ingestion for a small Fremont parcel sample."""

from __future__ import annotations

import json
from typing import Any

from django.contrib.gis.geos import GEOSGeometry, MultiPolygon

from ingestion.client import AlamedaParcelClient
from parcel_app.models import Jurisdiction, Parcel, Source


def _read_parcel_properties(feature: dict[str, Any]) -> dict[str, str | None]:
    """Safely read parcel properties from one raw ArcGIS GeoJSON feature."""
    properties = feature.get("properties", {})
    if not isinstance(properties, dict):
        properties = {}

    apn = (properties.get("APN") or "").strip()
    address = properties.get("SitusAddress")

    return {
        "apn": apn or None,
        "address": address,
    }


def _parse_feature_geometry(feature: dict[str, Any]) -> MultiPolygon | None:
    """Parse raw feature geometry into MultiPolygon; return None if invalid."""
    geometry = feature.get("geometry")
    if not geometry or not isinstance(geometry, dict):
        return None

    try:
        return _parse_geom_as_multipolygon(geometry)
    except (TypeError, ValueError):
        return None


def _parse_geom_as_multipolygon(geometry: dict[str, Any]) -> MultiPolygon:
    """Parse GeoJSON geometry into a MultiPolygon for the Parcel model."""
    geom = GEOSGeometry(json.dumps(geometry), srid=4326)

    if geom.geom_type == "Polygon":
        return MultiPolygon(geom, srid=4326)

    if geom.geom_type == "MultiPolygon":
        return geom

    raise ValueError(f"Expected Polygon/MultiPolygon, got {geom.geom_type}")


def _map_feature_to_parcel_payload(feature: dict[str, Any]) -> dict[str, Any] | None:
    """Map one raw feature into normalized parcel payload fields."""
    parsed = _read_parcel_properties(feature)
    apn = parsed["apn"]
    geom = _parse_feature_geometry(feature)

    # Feature is invalid for ingest if APN or geometry is missing/invalid.
    if not apn or geom is None:
        return None

    return {
        "apn": apn,
        "address": parsed["address"],
        "geom": geom,
        "source_crs": "EPSG:4326",
    }


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
        payload = _map_feature_to_parcel_payload(feature)
        if payload is None:
            continue

        if Parcel.objects.filter(source=source, apn=payload["apn"]).exists():
            continue

        Parcel.objects.create(
            jurisdiction=jurisdiction,
            source=source,
            apn=payload["apn"],
            address=payload["address"],
            geom=payload["geom"],
            source_crs=payload["source_crs"],
        )
        created_count += 1

    return created_count
