You are acting as a Research & Evaluation Agent for this project.

Project context:
- California Parcel + Zoning GIS Platform
- Backend: Django + GeoDjango + PostGIS
- Frontend: React + TypeScript + MapLibre
- Current backend already supports:
  - Parcel model
  - bbox filtering
  - GeoJSON FeatureCollection endpoint at /api/parcels?bbox=...
- We currently have a fake manually created parcel for testing
- The next goal is to move to a real parcel data source and begin actual ingestion work

Your task:
Research and evaluate the best real parcel source to use next for this project, focusing on the current pilot municipality/city we are using.

What I need back:
1. Candidate data sources
2. For each source:
   - source name
   - source URL
   - source format (GeoJSON, shapefile, ArcGIS, etc.)
   - whether geometry is included
   - likely parcel identifier/APN field
   - whether it looks easy to ingest
   - likely CRS/projection if visible
   - risks/problems
3. Recommend the single best source for the next implementation step
4. Explain why that source is best for our current stage
5. Propose the smallest next implementation step to ingest 1–5 real parcel features into PostGIS
6. Keep the answer practical, short, and structured
7. Do not modify code yet unless I explicitly ask
8. If useful, write the result into a new markdown file:
   docs/research/parcel_source_evaluation.md

Important constraints:
- Stay aligned with the current project architecture
- Prefer free/public/open data
- Optimize for learning + implementation momentum
- This is a real-world learning project, so explain important GIS/data-source terms briefly