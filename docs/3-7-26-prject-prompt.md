Use this single copy/paste prompt:

```markdown
You are ChatGPT in deep-analysis mode.  
Use long-form internal reasoning, but present outputs clearly and practically.  
Treat this as a real codebase review + architecture understanding task.

## Objective
I want you to fully understand my project and then help me analyze/design next steps with high accuracy.

Please do this in two phases:
1. Build an accurate mental model of the project from the context below.
2. Produce a high-quality technical analysis and roadmap based on the actual current implementation.

---

## Project Identity
- Name: `parcel-map`
- Type: California GIS web platform (parcel-first, zoning next)
- Pilot geography: Fremont, CA (Alameda County)
- Current goal: real parcel ingestion + map rendering loop working end-to-end

---

## Current Tech Stack (as implemented)
### Backend
- Django `5.2.12`
- GeoDjango + PostGIS backend engine
- Django REST Framework `3.16.1`
- `django-cors-headers`
- `requests`
- App structure:
  - `backend/core/` (settings, urls, wsgi/asgi)
  - `backend/parcel_app/` (models, views, serializers, admin)
  - `backend/ingestion/` (manual ingestion script/function)

### Frontend
- React `19`
- TypeScript + Vite
- MapLibre GL (`maplibre-gl`)
- Main map code in `frontend/src/App.tsx`

### Database / Infra
- PostGIS via Docker Compose
- Image: `postgis/postgis:15-3.4`
- Local DB port `5432`
- Compose currently defines DB service only

---

## Current Data Model (implemented in Django)
### `Jurisdiction`
- `name`
- `state` (default `"CA"`)

### `Source`
- FK to `Jurisdiction`
- `name`
- `source_type`
- `url`

### `Parcel`
- FK to `Jurisdiction`
- FK to `Source`
- `apn` (indexed)
- `address`
- `owner_name` (nullable)
- `lot_size_sqft` (nullable)
- `land_use_code` (nullable)
- `geom` = `MultiPolygonField(srid=4326, spatial_index=True)`
- `source_crs` (nullable)
- `data_hash` (nullable)
- unique constraint: `(source, apn)`

---

## Current Backend API (implemented)
### Endpoint
`GET /api/parcels/?bbox=west,south,east,north`

### Behavior
- Parses bbox into polygon (`srid=4326`)
- Filters parcels by:
  - `geom__bboverlaps=bbox_polygon`
  - `geom__intersects=bbox_polygon`
- Returns GeoJSON `FeatureCollection`:
  - `geometry` from model geom
  - `properties` from serializer fields:
    - `id`
    - `apn`
    - `address`
    - `owner_name`
    - `lot_size_sqft`
    - `land_use_code`

---

## Current Ingestion (implemented, manual first pass)
File: `backend/ingestion/load_parcels.py`

Function: `load_parcel_geojson()`

What it does now:
1. Fetches 5 Fremont features from Alameda ArcGIS query endpoint:
   - `where=SitusCity='FREMONT'`
   - `outFields=APN,SitusAddress,SitusCity`
   - `returnGeometry=true`
   - `outSR=4326`
   - `resultRecordCount=5`
   - `f=geojson`
2. Validates response is FeatureCollection.
3. Looks up existing records:
   - `Jurisdiction(name="Fremont")`
   - `Source(name="Fremont Parcels GeoJSON", jurisdiction=Fremont)`
4. For each feature:
   - `APN -> apn`
   - `SitusAddress -> address`
   - `geometry -> GEOSGeometry -> MultiPolygon`
5. Creates Parcel rows.
6. Skips duplicates for same `(source, apn)`.
7. Sets `source_crs="EPSG:4326"`.

Current limitations:
- Hardcoded source URL
- Hardcoded jurisdiction/source names
- No pagination beyond 5 sample rows
- No ingestion run tracking
- No robust retry/error reporting
- No hash/provenance workflow yet

---

## Current Frontend Map Flow (implemented)
File: `frontend/src/App.tsx`

1. Initializes MapLibre map with OSM raster base.
2. On map `load`, triggers one initial parcel fetch.
3. On every `moveend`:
   - computes bbox from map bounds
   - fetches backend `/api/parcels/?bbox=...`
4. Adds or updates GeoJSON source `parcels`.
5. Adds layers:
   - `parcels-fill`
   - `parcels-outline`
6. If features exist, computes overall bounds from all feature coordinates and calls `map.fitBounds(..., { padding: 24 })`.
7. Uses a guard ref to avoid a fitBounds -> moveend infinite loop.

Known current detail:
- API URL is hardcoded to `http://127.0.0.1:8000/api/parcels/?bbox=...`.

---

## Important Docs Context
There is a large architecture plan doc:
- `docs/ca_gis_platform_unified_plan.md`

It describes broader target state (zones, ingestion runs, AI/rules pipeline, PMTiles, cloud deployment).  
Important: treat this as **target architecture**, not fully implemented state.

There is also source evaluation:
- `docs/research/parcel_source_evaluation.md`
- Recommended source: Alameda County ArcGIS parcels FeatureServer.

---

## What I want from you now
Please generate the following sections in order:

1. **As-Built System Understanding**
- Summarize what is truly implemented today (backend, frontend, ingestion, DB).
- Clearly separate “implemented now” vs “planned in docs”.

2. **Architecture Diagram (text/mermaid)**
- High-level component diagram
- Data-flow sequence from source ingestion to map rendering

3. **Technical Gap Analysis**
- Compare current implementation to a production-ready parcel GIS platform.
- Prioritize gaps by severity and impact.

4. **Risk Register**
- GIS correctness risks (CRS, geometry validity, spatial query semantics)
- Data risks (dupes, partial ingestion, schema drift)
- Runtime/ops risks (hardcoded URLs, error handling, observability)

5. **Incremental Roadmap**
- Phase 1 (next 2-3 days): concrete steps
- Phase 2 (next 1-2 weeks)
- Phase 3 (hardening/scaling)

6. **Code-Level Refactor Plan**
- Suggested module boundaries and responsibilities:
  - ingestion client/fetcher
  - mapping/transform
  - persistence/upsert
  - validation
- Keep changes pragmatic and minimal-churn.

7. **Validation + Testing Plan**
- What to test at unit, integration, and E2E levels
- Include spatial assertions (bbox overlap/intersection correctness)

8. **Learning Plan**
- Teach me what to learn in order (GeoDjango/PostGIS/MapLibre concepts)
- Use this project as the learning path anchor.

---

## Output constraints
- Be concrete and actionable.
- Use short examples/snippets where useful.
- Explicitly call out assumptions.
- Prefer practical next steps over abstract theory.
- Do not suggest large rewrites unless absolutely necessary.
```