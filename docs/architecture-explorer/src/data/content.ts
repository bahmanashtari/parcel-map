import type { BuildState, Diagram, GlossaryTerm } from '../types'

export type SectionMeta = {
  id: string
  title: string
  state: BuildState
}

export type DesignSystemCard = {
  title: string
  state: BuildState
  items: string[]
}

export const sections: SectionMeta[] = [
  { id: 'overview', title: 'Overview', state: 'implemented' },
  { id: 'architecture', title: 'System Architecture', state: 'partial' },
  { id: 'backend', title: 'Backend', state: 'implemented' },
  { id: 'frontend', title: 'Frontend', state: 'implemented' },
  { id: 'design', title: 'Design System', state: 'partial' },
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
      'Current product center: parcel ingestion, parcel map rendering, and document metadata APIs',
    ],
  },
  {
    title: 'Current Scope (As Built)',
    state: 'implemented' as BuildState,
    items: [
      'GeoDjango parcel model and viewport bbox endpoint at /api/parcels/',
      'Document endpoints at /api/documents/, /api/documents/<id>/, and /api/documents/<id>/constraints/',
      'Manual ingestion path from Alameda ArcGIS (default loader currently ingests a 5-feature sample page)',
      'React map UI fetching parcel GeoJSON by viewport bounds',
      'Service-layer Ollama extraction run that writes ExtractionRun + ExtractedConstraint records',
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
  { area: 'Backend', value: 'Django 5.2.12 + DRF 3.16.1 + GeoDjango + django-cors-headers + requests' },
  { area: 'Database', value: 'PostgreSQL/PostGIS via GeoDjango backend engine with MultiPolygon geometry storage' },
  { area: 'Frontend', value: 'React 19.2 + TypeScript + Vite + MapLibre GL (single map surface today)' },
  { area: 'Ingestion', value: 'ArcGIS FeatureServer client + manual loader script under backend/ingestion/' },
  { area: 'AI local runtime', value: 'Ollama HTTP call to http://localhost:11434/api/generate in extraction service' },
  { area: 'Infra docs', value: 'docker-compose currently provisions PostGIS db service only' },
]

export const systemLanes = [
  {
    lane: 'Frontend lane',
    state: 'implemented' as BuildState,
    now: 'MapLibre map reads viewport bbox and fetches parcel GeoJSON from backend.',
    next: 'No document UI, loading states, or advanced layer controls in frontend app yet.',
  },
  {
    lane: 'API/backend lane',
    state: 'implemented' as BuildState,
    now: 'Function-based DRF endpoints serve parcels and document metadata/constraint reads.',
    next: 'Broader API lanes from unified plan (zoning, search, async AI endpoints) are not implemented.',
  },
  {
    lane: 'Storage/GIS lane',
    state: 'implemented' as BuildState,
    now: 'PostGIS-backed Parcel model plus document/extraction tables in parcel_app models.',
    next: 'Zone datasets, tile-optimized tables, and larger production schema are planned only.',
  },
  {
    lane: 'AI extraction lane',
    state: 'partial' as BuildState,
    now: 'Document/ExtractionRun/ExtractedConstraint models plus Ollama extraction function are implemented.',
    next: 'No async workers, review queue, or API endpoint that triggers extraction runs yet.',
  },
]

export const backendStructure = [
  {
    module: 'backend/core/',
    responsibilities: [
      'Environment-based settings split (development/production + shared base)',
      'Root URL wiring: /admin and /api include(parcel_app.urls)',
      'PostGIS default database engine in shared settings',
    ],
  },
  {
    module: 'backend/parcel_app/',
    responsibilities: [
      'Core models: Jurisdiction, Source, Parcel, Document, ExtractionRun, ExtractedConstraint',
      'Function-based API views for parcels and document metadata routes',
      'Serializers for parcel and document/constraint response shapes',
      'Admin registration for GIS + AI extraction models',
      'Service layer with Ollama constraint extraction path',
    ],
  },
  {
    module: 'backend/ingestion/',
    responsibilities: [
      'AlamedaParcelClient calls ArcGIS query endpoint filtered to Fremont',
      'load_parcel_geojson maps APN/address/geometry and inserts Parcel rows',
      'Geometry parsing helpers enforce Polygon/MultiPolygon -> MultiPolygon conversion',
    ],
  },
]

export const backendBehaviors = [
  'GET /api/parcels/?bbox=west,south,east,north validates bbox and returns GeoJSON FeatureCollection.',
  'Spatial filter uses both geom__bboverlaps and geom__intersects against the bbox polygon.',
  'GET /api/documents/ returns newest-first list with jurisdiction_name and annotated constraint_count.',
  'POST /api/documents/ validates title/document_type/jurisdiction_id (plus optional source/status/url/file_path).',
  'GET /api/documents/<document_id>/ returns document detail with source and constraint_count.',
  'GET /api/documents/<document_id>/constraints/ returns extracted constraints newest-first.',
  'No app-specific auth or throttling customization is wired on these function-based routes.',
]

export const frontendFlow = [
  'Map initializes with OSM raster style, center [-121.9886, 37.5483], zoom 11.',
  'On map load and every moveend, frontend computes bounds and requests /api/parcels/?bbox=... .',
  'GeoJSON source "parcels" is created/updated, then fill + line layers are ensured.',
  'If features exist, app computes feature bounds and runs fitBounds guarded by isAutoFittingRef.',
  'API base URL is currently hardcoded to http://127.0.0.1:8000 in frontend/src/App.tsx.',
]

export const frontendLimits = [
  'No explicit loading/error UI around parcel fetch requests.',
  'No request cancellation/debounce for rapid pan sequences.',
  'No layer toggles, side panels, or document views in the main frontend app.',
  'No env-based API URL abstraction yet.',
]

export const designSystemCards: DesignSystemCard[] = [
  {
    title: 'Main Frontend App (frontend/src)',
    state: 'partial',
    items: [
      'Layout is a single full-screen map shell (.app-shell + .map-container at 100% height/width).',
      'Parcel layer styling is hardcoded in App.tsx: fill #2d6a4f at 0.2 opacity, outline #1b4332.',
      'No active shared typography scale/tokens; frontend uses minimal global CSS in index.css.',
      'Interaction model is mostly stock MapLibre gestures with map-driven fetch/render logic.',
    ],
  },
  {
    title: 'Architecture Explorer App (docs/architecture-explorer)',
    state: 'implemented',
    items: [
      'Uses CSS custom properties (colors, radii, semantic status tones, shadows) in styles.css.',
      'Reusable UI primitives: Sidebar, StatusBadge, Accordion, and Mermaid diagram card wrapper.',
      'Responsive breakpoints at 1200px, 940px, and 640px plus optional comfort-reading mode.',
      'Visual language is card-first with explicit implemented/partial/planned badges.',
    ],
  },
  {
    title: 'Cross-App Design System Reality',
    state: 'partial',
    items: [
      'No shared component library or shared token package across frontend and docs explorer apps.',
      'No unified theme source consumed by both app surfaces.',
      'No automated accessibility checks or visual regression snapshots in this repository.',
      'Design consistency is currently maintained by local CSS and manual review.',
    ],
  },
]

export const designTokenSnapshot = [
  { area: 'Explorer typography', value: 'Manrope / IBM Plex Sans / Segoe UI fallback stack in styles.css' },
  { area: 'Explorer semantic tokens', value: '--accent, --ok, --partial, --planned token groups in :root' },
  { area: 'Map parcel palette', value: '#2d6a4f fill and #1b4332 outline in frontend/src/App.tsx layer paint' },
  { area: 'Layout patterns', value: 'Frontend: map-only canvas; Explorer: sidebar + card-grid documentation UI' },
]

export const designSystemGaps = [
  'No shared button/input/card primitives between frontend map app and explorer app.',
  'No dedicated loading/error design components for parcel fetch states.',
  'No design token export pipeline (for example JSON/CSS module shared across apps).',
]

export const gisModels = [
  {
    model: 'Jurisdiction',
    fields: ['name', 'state (default CA)', 'created_at'],
    notes: 'Top-level area grouping for sources, parcels, and documents.',
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
    notes: 'Primary mapped geometry table currently queried by the map endpoint.',
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
    summary: 'Execution record with extractor/model/status/timestamps/errors + raw_response_text.',
    state: 'implemented' as BuildState,
  },
  {
    model: 'ExtractedConstraint',
    summary: 'Normalized constraint row linked to Document and ExtractionRun.',
    state: 'implemented' as BuildState,
  },
]

export const aiWorkflowFacts = [
  'run_ollama_constraint_extraction(...) persists a running ExtractionRun before calling Ollama.',
  'Default local model name is mistral-small3.2; request sets stream=false, think=false, timeout=120.',
  'Raw model text is stored in ExtractionRun.raw_response_text before parse/normalization.',
  'Normalization maps constraint_type/rule_type into {setback,height_limit,lot_coverage,other}.',
  'Value/unit normalization converts feet/meters into canonical ft output.',
  'Failure path marks ExtractionRun failed and stores error_message.',
]

export const aiBoundaries = {
  implemented: [
    'AI extraction is backend service-level code and not in frontend map render path.',
    'No frontend AI interface exists in the current app.',
    'No asynchronous task queue is wired for extraction runs.',
  ],
  planned: [
    'Unified plan describes broader AI capabilities (review + Q&A + richer workflows).',
    'Those target features are documented but not present in active URL/view wiring.',
  ],
}

export const flowCards = [
  {
    id: 'ingestion',
    title: 'Parcel Ingestion Flow',
    state: 'implemented' as BuildState,
    steps: [
      "AlamedaParcelClient queries ArcGIS FeatureServer with SitusCity='FREMONT'.",
      'load_parcel_geojson fetches offset=0, limit=5 in current default implementation.',
      'Feature mapping validates APN + geometry and normalizes Polygon/MultiPolygon input.',
      'Rows insert only when (source, apn) is new.',
    ],
  },
  {
    id: 'render',
    title: 'Parcel Query + Render Flow',
    state: 'implemented' as BuildState,
    steps: [
      'Map moveend triggers bbox calculation.',
      'Frontend fetches backend /api/parcels/?bbox=west,south,east,north.',
      'Django builds bbox polygon and applies spatial filters.',
      'FeatureCollection response updates MapLibre source/layers and can trigger fitBounds.',
    ],
  },
  {
    id: 'documents',
    title: 'Document API Flow',
    state: 'implemented' as BuildState,
    steps: [
      'GET /api/documents/ returns newest-first document rows with constraint_count.',
      'POST /api/documents/ validates required metadata and creates a Document row.',
      'GET /api/documents/<id>/ returns detail fields (jurisdiction/source names + metadata).',
      'GET /api/documents/<id>/constraints/ returns extracted constraints for that document.',
    ],
  },
  {
    id: 'ai',
    title: 'AI Extraction Flow',
    state: 'partial' as BuildState,
    steps: [
      'Service creates ExtractionRun (running).',
      'Ollama API returns raw response text.',
      'Service stores raw_response_text, then parses + normalizes constraint fields.',
      'ExtractedConstraint is created and run is marked completed (or failed on exception).',
    ],
  },
]

export const folderMap = [
  {
    path: 'backend/core',
    role: 'Django project config, settings, and root routing.',
    interactions: ['Includes parcel_app URLs under /api.', 'Sets PostGIS DB engine and DRF defaults.'],
  },
  {
    path: 'backend/parcel_app',
    role: 'Domain models, API views/serializers, admin, extraction services.',
    interactions: ['Reads/writes PostGIS tables.', 'Serves parcel and document API routes under /api/.'],
  },
  {
    path: 'backend/ingestion',
    role: 'External parcel source retrieval and DB loading helpers.',
    interactions: ['Calls ArcGIS endpoint.', 'Writes Parcel rows into parcel_app models.'],
  },
  {
    path: 'frontend/src',
    role: 'Map UI and bbox request/render flow using MapLibre.',
    interactions: ['Calls /api/parcels endpoint.', 'Renders parcel geometries on map layers.'],
  },
  {
    path: 'docs/architecture-explorer/src',
    role: 'Internal architecture/documentation UI with status-aware sections.',
    interactions: ['Renders hardcoded repo-verified architecture facts.', 'Keeps planned items visually separated.'],
  },
  {
    path: 'docs',
    role: 'Planning artifacts and architecture targets.',
    interactions: ['Contains unified plan used only for planned/target labeling.'],
  },
]

export const statusBoard = {
  built: [
    'PostGIS-capable Django models for parcels plus document/extraction tables.',
    'Parcel viewport GeoJSON API endpoint.',
    'Document list/create/detail/constraints metadata APIs.',
    'MapLibre frontend rendering live parcels by bbox.',
    'Seed ingestion path for Fremont sample records from Alameda ArcGIS.',
    'Ollama extraction service that records raw output + normalized constraint rows.',
  ],
  partial: [
    'AI extraction is implemented as a service call but is not exposed as an API workflow.',
    'Operational visibility is mostly via admin/logging; no dedicated extraction dashboard.',
    'Frontend experience is intentionally minimal (map-only UI with no supporting panels).',
    'Design system is app-local; no shared token/component layer across app surfaces.',
  ],
  missing: [
    'Zone ingestion and zoning map layers.',
    'Async AI orchestration and human review pipeline.',
    'Production-grade request controls (debounce/cancel/retry instrumentation).',
    'PMTiles/vector tile delivery architecture from target docs.',
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
  {
    term: 'ConstraintType',
    definition: 'Current normalized enum on ExtractedConstraint (setback, height_limit, lot_coverage, other).',
  },
  {
    term: 'Raw vs Normalized AI Output',
    definition: 'Raw text preserves model response; normalized fields feed stable database columns.',
  },
]

export const diagrams: Diagram[] = [
  {
    id: 'high-level',
    title: 'High-Level Architecture (As-Built + Planned)',
    description: 'Solid paths are implemented. Dashed paths are planned from docs.',
    mermaid: `flowchart LR
      A[Alameda ArcGIS Parcel Source] --> B[backend/ingestion\\nAlamedaParcelClient + load_parcel_geojson]
      B --> C[(PostGIS\\nParcel + Document + Extraction tables)]
      C --> D[backend/parcel_app\\nGET /api/parcels/?bbox=...]
      D --> E[frontend/src/App.tsx\\nMapLibre map]

      C --> F[backend/parcel_app\\nGET/POST /api/documents and detail routes]
      F --> G[Document clients and admin]

      I[Local Ollama /api/generate] --> H[run_ollama_constraint_extraction]
      H --> C

      E -. planned .-> P[Zone layers + richer map UX]
      F -. planned .-> Q[Broader API lanes from unified plan]
      H -. planned .-> R[Async AI workflows + review pipeline]
    `,
  },
  {
    id: 'ingestion-flow',
    title: 'Parcel Ingestion Flow',
    description: 'Current ingestion script path in backend/ingestion.',
    mermaid: `flowchart TD
      S[ArcGIS query endpoint\\nSitusCity='FREMONT'] --> C1[AlamedaParcelClient.fetch_parcel_page]
      C1 --> C2[load_parcel_geojson offset=0 limit=5]
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
      M->>M: fitBounds(features) with loop guard
    `,
  },
  {
    id: 'ai-flow',
    title: 'AI Extraction Workflow',
    description: 'Current Ollama extraction service behavior.',
    mermaid: `flowchart TD
      D1[run_ollama_constraint_extraction(document_id, source_text,...)] --> D2[Create ExtractionRun status=running]
      D2 --> D3[POST localhost:11434/api/generate]
      D3 --> D4[Store raw_response_text on ExtractionRun]
      D4 --> D5[Extract JSON object from model response]
      D5 --> D6[Normalize constraint_type/value/unit/applies_to]
      D6 --> D7[Create ExtractedConstraint]
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
      DOCUMENT ||--o{ EXTRACTEDCONSTRAINT : has
      EXTRACTIONRUN ||--o{ EXTRACTEDCONSTRAINT : emits
    `,
  },
  {
    id: 'document-api-flow',
    title: 'Document API Workflow',
    description: 'Read/create and constraint retrieval endpoints in parcel_app/views.py.',
    mermaid: `sequenceDiagram
      participant C as Client
      participant A as Django API /api/documents
      participant DB as PostGIS tables

      C->>A: GET /api/documents/
      A->>DB: select docs + annotate constraint_count
      DB-->>A: newest-first rows
      A-->>C: DocumentListSerializer[]

      C->>A: POST /api/documents/
      A->>DB: insert Document row
      A->>DB: select created row + constraint_count
      DB-->>A: annotated document
      A-->>C: 201 DocumentListSerializer

      C->>A: GET /api/documents/:id/constraints/
      A->>DB: filter constraints by document_id
      DB-->>A: newest-first constraints
      A-->>C: ExtractedConstraintSerializer[]
    `,
  },
]

export const sourceTrace = [
  'backend/parcel_app/models.py',
  'backend/parcel_app/urls.py',
  'backend/parcel_app/views.py',
  'backend/parcel_app/serializers.py',
  'backend/parcel_app/admin.py',
  'backend/parcel_app/services/extraction_service.py',
  'backend/ingestion/client.py',
  'backend/ingestion/load_parcels.py',
  'backend/core/settings/base.py',
  'backend/requirements.txt',
  'frontend/src/App.tsx',
  'frontend/src/index.css',
  'frontend/package.json',
  'docs/architecture-explorer/src/styles.css',
  'docker-compose.yml',
  'docs/ca_gis_platform_unified_plan.md (used only for planned/target labeling)',
]
