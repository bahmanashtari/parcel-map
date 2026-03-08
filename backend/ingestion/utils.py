"""Shared helpers for ingestion tasks.

This module intentionally keeps helpers small and generic so they can be
reused by parcel, zoning, and future ingestion pipelines.
"""

from pathlib import Path


def resolve_local_path(filepath: str) -> Path:
    """Return a normalized path and validate that it exists.

    Args:
        filepath: Local path to an input artifact (for example, GeoJSON).

    Returns:
        A resolved ``Path`` instance.

    Raises:
        FileNotFoundError: If the file does not exist.
    """
    path = Path(filepath).expanduser().resolve()
    if not path.exists():
        raise FileNotFoundError(f"Input file does not exist: {path}")
    return path

