# Parcel Source Evaluation (Pilot: Fremont, CA)

## Scope
Pilot city is **Fremont (Alameda County)**. Goal is to pick the best **real parcel source** for immediate ingestion into Django + PostGIS.

## Candidate Sources

| Source | URL | Format | Geometry | Likely APN field | Ingestion ease | Likely CRS | Risks / Problems |
|---|---|---|---|---|---|---|---|
| Alameda County Parcels (ArcGIS FeatureServer) | https://services5.arcgis.com/ROBnTHSNjoZ2Wm1P/ArcGIS/rest/services/Parcels/FeatureServer/0 | ArcGIS REST (`JSON`, `geoJSON`, `PBF`) | Yes (polygon) | `APN` (also `APN_SORT`) | **High**: direct `query` endpoint, supports GeoJSON, pagination | Web Mercator `EPSG:3857` | Includes many attributes (including mailing/owner data fields) so we should only ingest the minimum needed fields first. |
| Alameda County Parcel Boundaries (Open Data portal dataset) | https://data.acgov.org/Geospatial-Data/Alameda-County-Parcel-Boundaries/2m43-xsic | Socrata dataset (CSV/GML/GeoJSON/JSON/KML/KMZ/SHP noted) | Yes | Unknown from current metadata view | Medium | Not clearly stated on page snapshot | Metadata indicates this boundaries file may lack assessor detail; field mapping uncertainty until API schema is inspected. |
| Oakland-hosted Alameda parcel layer (derived county data) | https://gismaps.oaklandca.gov/server/rest/services/Accela/Parcels/MapServer/0 | ArcGIS REST (`JSON`, `geoJSON`, `PBF`) | Yes (polygon) | `APN_AIR`, `APN_1`, `APN_GROUND` | Medium | `EPSG:2227` (CA State Plane III, feet) | Hosted by another city and appears tuned for Oakland workflows/scales; less ideal as canonical Fremont pilot source. |

## Recommendation (Single Best Source)
Use **Alameda County Parcels FeatureServer**:
- https://services5.arcgis.com/ROBnTHSNjoZ2Wm1P/ArcGIS/rest/services/Parcels/FeatureServer/0

### Why this is best for current stage
- Public and directly queryable with no auth in observed metadata.
- Contains both **parcel geometry** and a clean parcel identifier (`APN`).
- Supports **GeoJSON output**, which matches current Django/GeoDjango ingestion momentum.
- CRS is straightforward (`EPSG:3857`), and PostGIS can transform to your canonical storage SRID.
- Metadata shows a very recent edit timestamp, so this appears actively maintained.

## Smallest Next Implementation Step (1-5 real features)
1. Pull **5 Fremont parcels** from the ArcGIS query endpoint as GeoJSON.
2. Map only minimal fields first: `APN`, `SitusAddress` (or compose from situs parts), geometry.
3. Insert into existing `Parcel` model in PostGIS.
4. Verify via `/api/parcels?bbox=...` and click-to-details.

Suggested starter query pattern:

```text
https://services5.arcgis.com/ROBnTHSNjoZ2Wm1P/ArcGIS/rest/services/Parcels/FeatureServer/0/query
  ?where=SitusCity%3D%27FREMONT%27
  &outFields=APN,SitusAddress,SitusCity
  &outSR=4326
  &f=geojson
  &resultRecordCount=5
```

## Brief GIS/Data Terms
- **CRS (Coordinate Reference System):** defines how coordinates map to real locations (example: `EPSG:3857` web map coordinates).
- **APN (Assessor's Parcel Number):** county parcel identifier; your primary external lookup key.
- **FeatureServer/MapServer:** ArcGIS web services; both can expose queryable parcel features, but FeatureServer is usually cleaner for ingestion workflows.
