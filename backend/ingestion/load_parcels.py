"""Helpers for loading small parcel GeoJSON samples into PostGIS."""

from __future__ import annotations

import json

import requests
from django.contrib.gis.geos import GEOSGeometry, MultiPolygon

from parcel_app.models import Jurisdiction, Parcel, Source

# Alameda County Parcels FeatureServer query endpoint.
DEFAULT_PARCEL_QUERY_URL = (
    "https://services5.arcgis.com/ROBnTHSNjoZ2Wm1P/ArcGIS/rest/services/"
    "Parcels/FeatureServer/0/query"
)


def _to_multipolygon(geometry_dict: dict) -> MultiPolygon:
    """Convert a GeoJSON geometry object to MultiPolygon."""
    geom = GEOSGeometry(json.dumps(geometry_dict), srid=4326)
    if geom.geom_type == "Polygon":
        return MultiPolygon(geom, srid=4326)
    if geom.geom_type == "MultiPolygon":
        return geom
    raise ValueError(f"Unsupported geometry type: {geom.geom_type}")


def load_parcel_geojson(filepath_or_url: str | None = None, limit: int = 5) -> int:
    """Fetch and ingest a small parcel sample into the Parcel model.

    This intentionally focuses on a tiny pilot ingest:
    - fetch GeoJSON from Alameda County ArcGIS,
    - map APN + situs address + geometry,
    - create/update a few Parcel rows for testing.

    Args:
        filepath_or_url: Optional ArcGIS query URL. If omitted, default pilot
            query endpoint is used.
        limit: Maximum number of parcel features to ingest.

    Returns:
        Number of Parcel records created/updated.
    """
    base_url = filepath_or_url or DEFAULT_PARCEL_QUERY_URL

    # 1) Query only Fremont parcels and only fields needed for first ingest.
    params = {
        "where": "SitusCity='FREMONT'",
        "outFields": "APN,SitusAddress,SitusCity",
        "returnGeometry": "true",
        "outSR": 4326,
        "orderByFields": "OBJECTID ASC",
        "resultRecordCount": max(1, int(limit)),
        "f": "geojson",
    }
    response = requests.get(base_url, params=params, timeout=30)
    response.raise_for_status()
    feature_collection = response.json()

    # 2) Ensure parent records exist for this pilot source.
    jurisdiction, _ = Jurisdiction.objects.get_or_create(name="Fremont", state="CA")
    source, _ = Source.objects.get_or_create(
        jurisdiction=jurisdiction,
        name="Alameda County Parcels",
        defaults={
            "source_type": "parcel_geojson",
            "url": response.url,
        },
    )

    # 3) Parse features and write Parcel rows.
    ingested = 0
    for feature in feature_collection.get("features", [])[:limit]:
        properties = feature.get("properties", {})
        geometry = feature.get("geometry")
        apn = (properties.get("APN") or "").strip()

        # Skip rows that cannot be keyed or cannot be mapped.
        if not apn or not geometry:
            continue

        parcel_geom = _to_multipolygon(geometry)
        Parcel.objects.update_or_create(
            source=source,
            apn=apn,
            defaults={
                "jurisdiction": jurisdiction,
                "address": properties.get("SitusAddress"),
                "geom": parcel_geom,
            },
        )
        ingested += 1

    return ingested
