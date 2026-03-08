"""ArcGIS client helpers for Alameda County parcel GeoJSON."""

from __future__ import annotations

from typing import Iterator

import requests


class InvalidArcGISPayloadError(ValueError):
    """Raised when ArcGIS response payload is not valid GeoJSON."""


class AlamedaParcelClient:
    """Small client for Alameda County parcels ArcGIS FeatureServer."""

    BASE_URL = (
        "https://services5.arcgis.com/ROBnTHSNjoZ2Wm1P/ArcGIS/rest/services/"
        "Parcels/FeatureServer/0/query"
    )

    def __init__(self, timeout: int = 30) -> None:
        self.timeout = timeout

    def fetch_parcel_page(self, offset: int, limit: int = 500) -> dict:
        """Fetch one GeoJSON page filtered to Fremont parcels."""
        params = {
            "where": "SitusCity='FREMONT'",
            "outFields": "APN,SitusAddress,SitusCity",
            "returnGeometry": "true",
            "outSR": 4326,
            "orderByFields": "OBJECTID ASC",
            "resultOffset": max(0, int(offset)),
            "resultRecordCount": max(1, int(limit)),
            "f": "geojson",
        }

        response = requests.get(self.BASE_URL, params=params, timeout=self.timeout)
        response.raise_for_status()
        payload = response.json()

        if payload.get("type") != "FeatureCollection":
            raise InvalidArcGISPayloadError(
                "ArcGIS payload is not a GeoJSON FeatureCollection."
            )

        features = payload.get("features")
        if not isinstance(features, list):
            raise InvalidArcGISPayloadError(
                "ArcGIS payload is missing a valid 'features' list."
            )

        return payload

    def iter_parcel_features(self, page_size: int = 500) -> Iterator[dict]:
        """Yield raw GeoJSON parcel features page by page."""
        offset = 0
        while True:
            page = self.fetch_parcel_page(offset=offset, limit=page_size)
            features = page.get("features", [])
            if not features:
                break

            for feature in features:
                yield feature

            if len(features) < page_size:
                break

            offset += page_size

