import type { BuildState, Diagram, GlossaryTerm } from '../types'

export type SectionMeta = {
  id: string
  title: string
  state: BuildState
}

export const sections: SectionMeta[] = [
  { id: 'overview', title: 'Overview', state: 'implemented' },
  { id: 'architecture', title: 'System Architecture', state: 'partial' },
  { id: 'backend', title: 'Backend', state: 'implemented' },
  { id: 'frontend', title: 'Frontend', state: 'implemented' },
  { id: 'gis', title: 'GIS / Data Layer', state: 'implemented' },
  { id: 'ai', title: 'AI Extraction Lane', state: 'partial' },
  { id: 'flows', title: 'Data Flow Views', state: 'implemented' },
  { id: 'relationships', title: 'Project Map / Relationships', state: 'implemented' },
  { id: 'status', title: 'Current Status / Roadmap', state: 'partial' },
  { id: 'glossary', title: 'Glossary / Learning', state: 'implemented' },
]

export const overviewCards = [
  {
    title: 'Project Identity',
    state: 'implemented' as BuildState,
    items: [
      'Name: parcel-map',
      'Type: Django + PostGIS + React MapLibre GIS platform',
      'Pilot geography in code/docs: Fremont, California (Alameda County)',
      'Current product center: parcel ingestion and parcel map rendering loop',
    ],
  },
  {
    title: 'Current Scope (As Built)',
    state: 'implemented' as BuildState,
    items: [
      'GeoDjango parcel model and bbox API endpoint',
      'Manual ingestion from Alameda ArcGIS FeatureServer',
      'React map UI fetching /api/parcels by viewport bounds',
      'Early AI document extraction models and service layer',
    ],
  },
  {
    title: 'Target Scope (From docs/ca_gis_platform_unified_plan.md)',
    state: 'planned' as BuildState,
    items: [
      'Zoning layer ingestion and visualization',
      'Richer AI pipeline (review, approval, provenance, Q&A)',
      'PMTiles lane and cloud deployment hardening',
      'Expanded operational workflows beyond pilot parcel loop',
    ],
  },
]

export const stackSnapshot = [
  { area: 'Backend', value: 'Django 5.2.12, DRF 3.16.1, GeoDjango, django-cors-headers, requests' },
  { area: 'Database', value: 'PostgreSQL + PostGIS (docker-compose currently provisions db service only)' },
  { area: 'Frontend', value: 'React 19 + TypeScript + Vite + MapLibre GL' },
  { area: 'AI local runtime', value: 'Ollama via http://localhost:11434/api/generate in extraction service' },
  { area: 'Infra docs', value: 'Large target-state architecture plan in docs/ca_gis_platform_unified_plan.md' },
]

export const systemLanes = [
  {
    lane: 'Frontend lane',
    state: 'implemented' as BuildState,
    now: 'MapLibre map reads viewport bbox and fetches GeoJSON parcels from backend.',
    next: 'Richer layer controls, details panel UX, and map-request optimization not yet implemented.',
  },
  {
    lane: 'API/backend lane',
    state: 'implemented' as BuildState,
    now: 'Single parcel bbox endpoint and Django admin over core models.',
    next: 'Additional endpoints in unified plan (zones, search, AI APIs) are not implemented in this repo.',
  },
  {
    lane: 'Storage/GIS lane',
    state: 'implemented' as BuildState,
    now: 'PostGIS-backed Parcel model with MultiPolygon SRID 4326 and spatial queries.',
    next: 'Zone datasets, tileset tables, and larger production schema are planned only.',
  },
  {
    lane: 'AI extraction lane',
    state: 'partial' as BuildState,
    now: 'Document/ExtractionRun/ExtractedRule models + manual and Ollama extraction service functions.',
    next: 'No async workers, no review workflows, and no AI API endpoints wired yet.',
  },
]

export const backendStructure = [
  {
    module: 'backend/core/',
    responsibilities: [
      'Environment-based settings split (development/production + shared base)',
      'Project URL routing: /admin and /api include(parcel_app.urls)',
      'PostGIS default engine in settings base',
    ],
  },
  {
    module: 'backend/parcel_app/',
    responsibilities: [
      'Core models: Jurisdiction, Source, Parcel, Document, ExtractionRun, ExtractedRule',
      'Parcel bbox endpoint in views.py and serializer for parcel properties',
      'Admin registration for GIS + AI extraction models',
      'AI extraction service module with manual and Ollama paths',
    ],
  },
  {
    module: 'backend/ingestion/',
    responsibilities: [
      'AlamedaParcelClient calls ArcGIS query endpoint filtered to Fremont',
      'load_parcel_geojson maps APN/address/geometry and inserts Parcel rows',
      'Helpers for geometry parsing and lightweight path utility',
    ],
  },
]

export const backendBehaviors = [
  'GET /api/parcels/?bbox=west,south,east,north validates bbox and returns GeoJSON FeatureCollection.',
  'Spatial filter currently uses both geom__bboverlaps and geom__intersects against bbox polygon.',
  'Serializer includes id, apn, address, owner_name, lot_size_sqft, land_use_code.',
  'No authentication or throttling logic specific to parcel endpoint in current code path.',
]

export const frontendFlow = [
  'Map initializes with OSM raster style and default center near Fremont.',
  'On map load and every moveend, frontend computes bounds and requests /api/parcels/?bbox=... .',
  'GeoJSON source "parcels" is created/updated, then fill + line layers are ensured.',
  'If features exist, app computes collection bounds and auto-fitBounds once per fetch cycle.',
  'API base URL is hardcoded to http://127.0.0.1:8000 in App.tsx.',
]

export const frontendLimits = [
  'No explicit loading/error UI around parcel fetch requests.',
  'No request cancellation/debounce for rapid pan sequences.',
  'No layer toggle or side-panel architecture yet; current UI is full-screen map only.',
  'No env-based API URL abstraction yet.',
]

export const gisModels = [
  {
    model: 'Jurisdiction',
    fields: ['name', 'state (default CA)', 'created_at'],
    notes: 'Top-level area grouping for sources and parcels.',
  },
  {
    model: 'Source',
    fields: ['jurisdiction FK', 'name', 'source_type', 'url', 'created_at'],
    notes: 'Tracks provenance per dataset/provider.',
  },
  {
    model: 'Parcel',
    fields: [
      'jurisdiction FK',
      'source FK',
      'apn (indexed)',
      'address / owner_name / lot_size_sqft / land_use_code',
      'geom MultiPolygonField(srid=4326, spatial_index=True)',
      'source_crs / data_hash / timestamps',
      'unique_together(source, apn)',
    ],
    notes: 'Primary mapped geometry table currently used by frontend endpoint.',
  },
]

export const aiModels = [
  {
    model: 'Document',
    summary: 'Input document metadata per jurisdiction/source with document_type and status.',
    state: 'implemented' as BuildState,
  },
  {
    model: 'ExtractionRun',
    summary: 'One execution record with extractor/model/status/timestamps/errors + raw_response_text.',
    state: 'implemented' as BuildState,
  },
  {
    model: 'ExtractedRule',
    summary: 'Normalized extracted rule row linked to Document and ExtractionRun.',
    state: 'implemented' as BuildState,
  },
]

export const aiWorkflowFacts = [
  'LLM path: run_ollama_rule_extraction(...) sends a parcel-first extraction prompt to /api/generate with timeout=120.',
  'Raw model text is stored in ExtractionRun.raw_response_text before JSON normalization/parsing completes.',
  'Normalization maps AI rule labels into current model choices: setback, height_limit, lot_coverage, other.',
  'Dimensional normalization converts feet/meters into canonical ft values.',
  'Failure path marks run as failed and stores error_message.',
]

export const aiBoundaries = {
  implemented: [
    'AI extraction is service-level backend code, not in map hot path.',
    'No frontend AI interface in current app.',
    'No asynchronous task queue for extraction runs in current repo code.',
  ],
  planned: [
    'Unified plan describes richer AI capabilities (review + Q&A + broader pipelines).',
    'Those target features are documented but not present in active URL/view wiring.',
  ],
}

export const flowCards = [
  {
    id: 'ingestion',
    title: 'Parcel Ingestion Flow',
    state: 'implemented' as BuildState,
    steps: [
      'AlamedaParcelClient calls ArcGIS FeatureServer query endpoint (FREMONT filter).',
      'load_parcel_geojson reads APN/address and parses geometry to MultiPolygon SRID 4326.',
      'Rows are inserted if (source, apn) does not already exist.',
      'Parcels become queryable by bbox endpoint.',
    ],
  },
  {
    id: 'render',
    title: 'Parcel Query + Render Flow',
    state: 'implemented' as BuildState,
    steps: [
      'Map moveend -> compute bbox string.',
      'Frontend fetches backend /api/parcels endpoint.',
      'Django builds bbox polygon and applies spatial filters.',
      'FeatureCollection response updates MapLibre source/layers and fits map bounds.',
    ],
  },
  {
    id: 'ai',
    title: 'AI Extraction Flow',
    state: 'partial' as BuildState,
    steps: [
      'Service creates ExtractionRun (running).',
      'Ollama API returns raw response text.',
      'Service stores raw_response_text, then parses + normalizes rule fields.',
      'ExtractedRule is created, run is marked completed (or failed on exceptions).',
    ],
  },
]

export const folderMap = [
  {
    path: 'backend/core',
    role: 'Django project config and root routing.',
    interactions: ['Uses parcel_app URLs for API path.', 'Defines environment-based settings and DB engine.'],
  },
  {
    path: 'backend/parcel_app',
    role: 'Domain models, bbox API, admin, extraction services.',
    interactions: ['Reads/writes PostGIS tables.', 'Serves frontend map requests via /api/parcels/.'],
  },
  {
    path: 'backend/ingestion',
    role: 'External parcel source retrieval and DB loading helpers.',
    interactions: ['Calls ArcGIS endpoint.', 'Writes Parcel rows into parcel_app models.'],
  },
  {
    path: 'frontend/src',
    role: 'Map UI and bbox request flow using MapLibre.',
    interactions: ['Calls backend parcel API.', 'Renders parcel geometries on map.'],
  },
  {
    path: 'docs',
    role: 'Planning artifacts and architecture targets.',
    interactions: ['Contains target-state plan used to label planned vs implemented.'],
  },
]

export const statusBoard = {
  built: [
    'PostGIS-capable Django data model for jurisdictions, sources, parcels.',
    'Viewport-based parcel GeoJSON API endpoint.',
    'MapLibre frontend rendering live parcels by bbox.',
    'Seed ingestion path for Fremont sample records from Alameda ArcGIS.',
    'Initial AI extraction schema + manual + Ollama service functions.',
  ],
  partial: [
    'AI normalization now exists but model choice alignment for new rule categories should be reviewed.',
    'Operational visibility is mostly via admin/logging; no dedicated extraction dashboard.',
    'Frontend experience is functional but minimal (no panelized explorer UI in main app).',
  ],
  missing: [
    'Zone ingestion and zoning map layers.',
    'Dedicated AI API endpoints and async task orchestration.',
    'Production-grade request controls (caching/debounce/retry instrumentation).',
    'PMTiles or vector tile delivery architecture from target docs.',
  ],
}

export const glossary: GlossaryTerm[] = [
  { term: 'APN', definition: 'Assessor Parcel Number; external parcel identifier used for dedupe and lookup.' },
  { term: 'SRID 4326', definition: 'WGS84 latitude/longitude coordinate reference used by parcel geom storage.' },
  { term: 'PostGIS', definition: 'PostgreSQL extension for spatial types and queries (geometry, intersects, etc.).' },
  { term: 'BBox', definition: 'Bounding box rectangle (west,south,east,north) used for viewport queries.' },
  { term: 'MapLibre GL', definition: 'Web map renderer used by frontend to draw basemap + parcel layers.' },
  { term: 'FeatureCollection', definition: 'GeoJSON container object returned by parcel endpoint.' },
  { term: 'ExtractionRun', definition: 'Audit row for one extraction attempt including status, error, raw response.' },
  { term: 'Raw vs Normalized AI Output', definition: 'Raw text preserves model response; normalized fields feed stable DB columns.' },
]

export const diagrams: Diagram[] = [
  {
    id: 'high-level',
    title: 'High-Level Architecture (As-Built + Planned)',
    description: 'Solid paths are implemented. Dashed paths are planned from docs.',
    mermaid: `flowchart LR
      A[Alameda ArcGIS Parcel Source] --> B[backend/ingestion\\nAlamedaParcelClient + load_parcel_geojson]
      B --> C[(PostGIS\\nJurisdiction/Source/Parcel)]
      C --> D[backend/parcel_app bbox API\\nGET /api/parcels/?bbox=...]
      D --> E[frontend/src/App.tsx\\nMapLibre map]

      F[Document + Extraction Services] --> G[(Document / ExtractionRun / ExtractedRule)]
      H[Local Ollama /api/generate] --> F

      E -. planned .-> P[Zone Layers + richer map UI]
      D -. planned .-> Q[Additional API lanes from unified plan]
      F -. planned .-> R[Async AI workflows + review pipeline]
    `,
  },
  {
    id: 'ingestion-flow',
    title: 'Parcel Ingestion Flow',
    description: 'Current ingestion script path in backend/ingestion.',
    mermaid: `flowchart TD
      S[ArcGIS query endpoint\\nSitusCity='FREMONT'] --> C1[AlamedaParcelClient.fetch_parcel_page]
      C1 --> C2[load_parcel_geojson]
      C2 --> C3[Map APN + address + parse geometry]
      C3 --> C4{Valid APN\\nand geometry?}
      C4 -- no --> C5[Skip feature]
      C4 -- yes --> C6{Duplicate source+APN?}
      C6 -- yes --> C7[Skip insert]
      C6 -- no --> C8[Parcel.objects.create]
      C8 --> C9[(Parcel table)]
    `,
  },
  {
    id: 'map-render',
    title: 'Parcel Map Rendering Flow',
    description: 'Frontend moveend-driven query/render loop.',
    mermaid: `sequenceDiagram
      participant U as User pan/zoom
      participant M as MapLibre (App.tsx)
      participant A as Django API /api/parcels
      participant DB as PostGIS Parcel table

      U->>M: moveend
      M->>A: GET /api/parcels/?bbox=west,south,east,north
      A->>DB: bboverlaps + intersects query
      DB-->>A: matching parcel geoms
      A-->>M: GeoJSON FeatureCollection
      M->>M: update/add source + layers
      M->>M: fitBounds(features) with guard
    `,
  },
  {
    id: 'ai-flow',
    title: 'AI Extraction Workflow',
    description: 'Current Ollama extraction service behavior.',
    mermaid: `flowchart TD
      D1[run_ollama_rule_extraction(document_id, source_text,...)] --> D2[Create ExtractionRun status=running]
      D2 --> D3[POST localhost:11434/api/generate]
      D3 --> D4[Store raw_response_text on ExtractionRun]
      D4 --> D5[Extract JSON object from model response]
      D5 --> D6[Normalize rule_type/value_text/unit/applies_to]
      D6 --> D7[Create ExtractedRule]
      D7 --> D8[Set ExtractionRun status=completed]
      D3 -. exception .-> D9[Set status=failed + error_message]
      D5 -. parse fail .-> D9
      D6 -. validation fail .-> D9
    `,
  },
  {
    id: 'model-rel',
    title: 'Current Data Model Relationships',
    description: 'GIS and AI model links from parcel_app/models.py.',
    mermaid: `erDiagram
      JURISDICTION ||--o{ SOURCE : has
      JURISDICTION ||--o{ PARCEL : has
      SOURCE ||--o{ PARCEL : provides

      JURISDICTION ||--o{ DOCUMENT : owns
      SOURCE |o--o{ DOCUMENT : optional_source
      DOCUMENT ||--o{ EXTRACTIONRUN : has
      DOCUMENT ||--o{ EXTRACTEDRULE : has
      EXTRACTIONRUN ||--o{ EXTRACTEDRULE : emits
    `,
  },
]

export const sourceTrace = [
  'backend/parcel_app/models.py',
  'backend/parcel_app/views.py',
  'backend/parcel_app/serializers.py',
  'backend/parcel_app/services/extraction_service.py',
  'backend/ingestion/client.py',
  'backend/ingestion/load_parcels.py',
  'frontend/src/App.tsx',
  'backend/core/settings/base.py',
  'docker-compose.yml',
  'docs/research/parcel_source_evaluation.md',
  'docs/ca_gis_platform_unified_plan.md (used only for planned/target labeling)',
]
