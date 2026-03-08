"""Parcel ingestion entry points.

This module is intentionally minimal for now.
"""


def load_parcel_geojson(filepath_or_url: str) -> None:
    """Placeholder for parcel GeoJSON ingestion.

    Future implementation will:
    - fetch GeoJSON (from local path or URL),
    - map source fields to Parcel model fields,
    - normalize geometry/CRS for project storage,
    - insert Parcel records into PostGIS via Django models.

    Args:
        filepath_or_url: Local file path or remote URL to parcel GeoJSON.
    """
    raise NotImplementedError(
        "TODO: implement parcel GeoJSON ingestion pipeline."
    )
