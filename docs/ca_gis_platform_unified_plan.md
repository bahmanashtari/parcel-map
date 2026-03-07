# California Parcel & Zoning GIS Platform — Unified Final Plan

> **This is the single source of truth.** It supersedes all prior versions (v1–v4). It is self-contained and requires no other document.

---

## Table of Contents

1. Non-Negotiable Outcome (Day-1 Demo Definition)
2. Free Cloud-First Stack
3. Reference Architecture + Data Flow
4. Data Model (PostGIS) + GIS Correctness Rules
5. One-Day MVP Build Runbook
6. AI Features (Incremental, Safe, Useful)
7. Scalability, Reliability, Security, Observability Roadmap
8. AI-Assisted Development: Agents + Workflow
9. Deliverables Recap
10. "If You Only Have 6 Hours" Compressed Runbook

---

## Section 1 — Non-Negotiable Outcome (Day-1 Demo Definition)

**You are done when every acceptance criterion in this table passes.**

| # | Criterion | How to verify |
|---|-----------|--------------|
| 1 | Ingestion succeeds for 1 pilot municipality | `ingestion_runs` table: `status='completed'`, `records_added > 0` |
| 2 | Parcels visible on CA map as polygons | Open public URL, zoom to Fremont, see gold outlines |
| 3 | Zones visible as color-coded polygons | Toggle zone layer on, see residential/commercial colors |
| 4 | Click parcel → details panel opens | APN, address, lot size, land use code shown |
| 5 | Click zone → zone details panel opens | Zone code, type, description shown |
| 6 | Search by APN returns result + map flies to it | Type APN, press Enter, map moves |
| 7 | Public URL live and shareable | Share link with someone not on your machine |
| 8 | Django admin accessible | `/admin/` login, see `IngestionRun` list |
| 9 | Basic logging visible | Railway dashboard shows structlog JSON output |
| 10 | Admin can trigger document extraction | Upload PDF in admin, click "Process" — extractions appear |

**Pilot municipality: City of Fremont, CA (Alameda County)**

- Parcels: Alameda County Assessor GeoJSON via ArcGIS Hub (free, no auth)
- Zones: Fremont open data zoning shapefile (City of Fremont open data portal)
- Both realistic to ingest in under 2 hours

**What AI does on Day-1 (admin-triggered only, never in hot map path):**
- PDF page extraction (pdfplumber — deterministic, not LLM)
- LLM field extraction on uploaded zoning PDF → `extractions` table with `status='pending'`
- Admin reviews extractions before any rule is approved

**What AI does NOT do on Day-1:**
- RAG Q&A (needs embeddings indexed first — Week 1)
- Tile generation (GeoJSON bbox API for Day-1 — PMTiles in Week 2)
- Automated quality checks (need both layers loaded — Week 1)

---

## Section 2 — Free Cloud-First Stack

### Backend Hosting

**Recommended: Railway.app**
- Free: $5/month credit, ~500 hours compute
- Supports Dockerfile, env vars, multi-service (web + worker + cron) in one project
- One-click Postgres addon (but use Supabase for PostGIS)
- Swap path A: Render.com (free web service but sleeps after 15 min inactivity — bad for demos)
- Swap path B: Fly.io (more control, persistent volumes, no sleep, more setup)

**Background worker:** Same Railway project, second service pointing to same repo:
```toml
# railway.toml — worker service
startCommand = "python manage.py qcluster"
```

**Scheduled jobs (cron):** Railway cron service or `django-crontab` in same dyno for Day-1.

### Database

**Recommended: Supabase (free tier)**
- Managed Postgres 15 + PostGIS + pgvector pre-installable
- 500MB storage, connection pooling via PgBouncer built in
- Enable in SQL editor: `CREATE EXTENSION postgis; CREATE EXTENSION vector;`
- Dashboard for quick data inspection during development
- Swap path A: Neon.tech (serverless Postgres, PostGIS + pgvector supported, branching for dev/prod parity)
- Swap path B: Self-hosted PostGIS on Railway volume (free but requires manual backups)

**Migrations:** Django migrations + `django.contrib.gis`

**Backups:** Supabase free tier = 7-day daily backups. Add weekly `pg_dump` to R2 via cron.

### Queue + Workers

**Recommended: Django-Q2 with Postgres broker (zero extra infra)**
```python
Q_CLUSTER = {
    "name": "parcelmap",
    "orm": "default",
    "workers": 2,
    "timeout": 600,
    "retry": 720,
    "max_attempts": 3,
}
```
- Uses existing Postgres — no Redis needed
- Every task visible in DB for debugging
- Swap path A: Upstash Redis (free: 10K commands/day) + Celery when >5 concurrent jobs
- Swap path B: Dramatiq + pg-simple-q (lighter than Celery)

### Object Storage

**Recommended: Cloudflare R2**
- Free: 10GB storage, 1M Class A operations/month, zero egress fees
- Stores: raw PDFs, shapefiles, PMTiles files
- AWS CLI compatible (`--endpoint-url https://<account>.r2.cloudflarestorage.com`)
- Swap path A: Backblaze B2 (free 10GB, cheap egress)
- Swap path B: Supabase Storage (free 1GB, built into Supabase dashboard)

### GIS Tiling

**Day-1: GeoJSON from bbox API** (zero infra, MapLibre renders natively)

**Week-2+: PMTiles on Cloudflare R2 + Worker**
- Generate with `tippecanoe` (open-source, installed locally)
- Upload `.pmtiles` file to R2 (one file per layer per jurisdiction)
- Cloudflare Worker adds CORS + range request support (free: 100K req/day)
- MapLibre consumes via `pmtiles://` protocol — no tile server needed
- Swap path: serve PMTiles from any CDN that supports range requests (Cloudflare Pages, GitHub Pages with cf-worker, Bunny CDN)

### LLM Services

**Local/Dev: Ollama** (recommended default — free, private, offline)
```bash
ollama pull llama3.2           # 3B, fast, fits 8GB RAM
ollama pull llama3.1:8b        # 8B, better quality
ollama pull nomic-embed-text   # embeddings, 768d
# Exposes OpenAI-compatible API at localhost:11434/v1
```

**Free hosted options:**
- Google Gemini API: 15 RPM, 1M tokens/day free (Gemini 1.5 Flash) — best free hosted
- Groq: 14,400 req/day, very fast inference (Llama 3.x models)
- OpenRouter: free models available, unified API across providers

**Vibe-coding tools (for building the project):**
- Aider (open-source, works with Ollama or Gemini)
- Continue.dev VS Code extension (free, works with Ollama)

---

## Section 3 — Reference Architecture + Data Flow

### Component Diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           DATA SOURCES                                    │
│  Alameda County GeoJSON  │  Fremont Zoning SHP  │  Zoning PDFs / HTML   │
└─────────┬────────────────┴──────────┬────────────┴──────────┬────────────┘
          │                           │                        │
          ▼                           ▼                        ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                        INGESTION LAYER (Django)                           │
│                                                                           │
│  RawFetcher ──► ArtifactStore (R2) ──► Parser/Normalizer                │
│  GeoPandas (GIS layers) │ pdfplumber (PDFs) │ BeautifulSoup (HTML)       │
│         │                         │                                       │
│         ▼                         ▼                                       │
│  GeoValidator                DocumentIntelligencePipeline                │
│  (CRS, validity,              (page extract → chunk → embed)             │
│   area checks)                      │                                     │
│         │                           ▼                                     │
│         │                    LLM Extraction ◄── LLMClient (factory)      │
│         │                    (extract_zoning_rules_v1)                   │
│         │                           │                                     │
│         └─────────────────────────► ▼                                    │
│                             PostGIS Loader                                │
│                             ingestion_run log                             │
└─────────────────────────────────┬────────────────────────────────────────┘
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                          STORAGE LAYER                                    │
│                                                                           │
│  PostgreSQL 15 + PostGIS + pgvector (Supabase)                           │
│  ┌─────────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────────┐    │
│  │jurisdictions│ │ parcels  │ │  zones   │ │ documents/pages/     │    │
│  │sources      │ │ (geom)   │ │ (geom)   │ │ chunks/embeddings    │    │
│  │ingestion_   │ └──────────┘ └──────────┘ └──────────────────────┘    │
│  │runs         │                                                          │
│  │ai_runs      │ ┌──────────────────────────────────────────────────┐   │
│  │tilesets     │ │ zoning_rules │ extractions │ rule_provenance     │   │
│  └─────────────┘ └──────────────────────────────────────────────────┘   │
│                                                                           │
│  Cloudflare R2 (raw PDFs, shapefiles, PMTiles files)                    │
└─────────────────────────────────┬────────────────────────────────────────┘
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                          API LAYER (DRF)                                  │
│                                                                           │
│  Geo: /api/parcels/?bbox=  /api/parcels/{id}/                            │
│       /api/zones/?bbox=    /api/zones/{id}/  /api/zones/{id}/rules/      │
│  Meta: /api/search/  /api/ingestion/  /api/tilesets/                     │
│  AI:   /api/ai/ask/  /api/ai/budget/  /api/ai/quality/                   │
│        (all AI endpoints rate-limited + offline-task guarded)            │
│  Admin: /admin/ ingestion triggers, extraction review, rule approval     │
└─────────────────────────────────┬────────────────────────────────────────┘
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                    FRONTEND (React + TS + MapLibre GL)                    │
│                                                                           │
│  Map canvas (MapLibre)                                                    │
│  Left sidebar: Search, Layer toggles, Jurisdiction selector              │
│  Detail panel: Click-to-detail (parcel or zone)                          │
│  AI panel: "Ask about this zone" → RAG Q&A with citations                │
│  Zoning rules panel: Approved rules with quote + page number             │
│                                                                           │
│  Day-1: GeoJSON bbox sources                                              │
│  Week-2: PMTiles sources (VITE_USE_PMTILES=true)                         │
└──────────────────────────────────────────────────────────────────────────┘

TILE PIPELINE (Week-2):
PostGIS → ogr2ogr (GeoJSON) → tippecanoe → .pmtiles → R2 → CF Worker → MapLibre

LLM ABSTRACTION:
BaseLLMClient → OllamaClient | GeminiClient | GroqClient
(swap via LLM_PROVIDER env var, zero code changes)

OBSERVABILITY:
structlog → stdout → Railway logs → Sentry (free tier)
ai_runs table → /api/ai/budget/ dashboard
```

### Sequence: "New Source Discovered → Map Updated"

```
Scheduler / Admin trigger
      │
      ├─1─► IngestionRunner.check_source(source_id)
      │          fetch HEAD, compare ETag/Last-Modified
      │          if unchanged → exit (idempotent)
      │
      ├─2─► RawFetcher.download(url)
      │          stream to temp file, upload to R2 (artifact_key logged)
      │
      ├─3─► Parser.parse(artifact)
      │          GeoPandas reads GeoJSON/shapefile
      │          GeoValidator: detect CRS, reproject to EPSG:4326
      │          make_valid(), drop non-polygon results
      │          cast to MultiPolygon
      │
      ├─4─► PostGISLoader.upsert(gdf)
      │          bulk update_or_create keyed on (source_id, apn)
      │          update ingestion_run: status=completed, counts
      │
      ├─5─► [if records changed] queue generate_tiles task
      │
      └─6─► [Next map request]
                 MapLibre fires bbox query → /api/parcels/?bbox=...
                 Django: ST_Intersects query → GeoJSON response
                 MapLibre re-renders layer

DOCUMENT INTELLIGENCE SEQUENCE (async, admin-triggered):
Admin uploads PDF
      │
      ├─1─► DocumentPage rows created (pdfplumber, per page)
      ├─2─► DocumentChunk rows created (page-anchored, no cross-page splits)
      ├─3─► embed_chunks() → gis_vec_{dim} table (pgvector)
      ├─4─► extract_fields_per_page() → LLM → extractions table
      │          citation enforcement: snippet must appear in page_text
      │          invalid_citation status for unverified snippets
      ├─5─► propose_rules() → zoning_rules (status='pending')
      └─6─► Admin reviews → approve or reject in Django admin
```

### Where AI Is and Is NOT Used

```
AI IS USED:
  ✓ PDF/HTML zoning text → structured field extraction (async worker)
  ✓ Document summarization with cited bullet points (async worker)
  ✓ RAG Q&A over indexed document chunks (user-facing, rate-limited)
  ✓ Data quality explanation (admin-triggered)
  ✓ Ingestion failure diagnosis (admin-triggered)

AI IS NOT USED:
  ✗ CRS reprojection (pure GDAL/GeoPandas — deterministic)
  ✗ Geometry validity checks (ST_IsValid, make_valid — deterministic)
  ✗ Spatial queries / bbox queries (pure PostGIS)
  ✗ Tile generation (tippecanoe — deterministic)
  ✗ Search index (Django full-text search — no embeddings in hot path)
  ✗ Any hot API path (AI is always async or on-demand)
```
---

## Section 4 — Data Model (PostGIS) + GIS Correctness Rules

### Complete SQL Schema

```sql
-- ── Extensions ──────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;   -- fuzzy text search
CREATE EXTENSION IF NOT EXISTS vector;    -- pgvector for embeddings

-- ── Jurisdictions ────────────────────────────────────────────────────────────
CREATE TABLE jurisdictions (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(200) NOT NULL,
    state       CHAR(2) NOT NULL DEFAULT 'CA',
    county      VARCHAR(100),
    slug        VARCHAR(100) UNIQUE,       -- used in tile artifact keys
    geom        GEOMETRY(MULTIPOLYGON, 4326),
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_jurisdictions_geom ON jurisdictions USING GIST(geom);

-- ── Sources ──────────────────────────────────────────────────────────────────
CREATE TABLE sources (
    id              SERIAL PRIMARY KEY,
    jurisdiction_id INTEGER NOT NULL REFERENCES jurisdictions(id),
    name            VARCHAR(200) NOT NULL,
    source_type     VARCHAR(50) NOT NULL,
    -- 'parcel_geojson' | 'zoning_shapefile' | 'pdf' | 'html'
    url             TEXT NOT NULL,
    last_etag       TEXT,
    last_modified   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Ingestion Runs ───────────────────────────────────────────────────────────
CREATE TABLE ingestion_runs (
    id                  SERIAL PRIMARY KEY,
    source_id           INTEGER NOT NULL REFERENCES sources(id),
    status              VARCHAR(20) NOT NULL DEFAULT 'pending',
    -- pending | running | completed | failed
    started_at          TIMESTAMPTZ DEFAULT NOW(),
    completed_at        TIMESTAMPTZ,
    records_added       INTEGER DEFAULT 0,
    records_updated     INTEGER DEFAULT 0,
    records_skipped     INTEGER DEFAULT 0,
    error_message       TEXT,
    raw_artifact_key    TEXT    -- R2 object key to raw download
);
CREATE INDEX idx_ingestion_runs_source ON ingestion_runs(source_id);
CREATE INDEX idx_ingestion_runs_status ON ingestion_runs(status);

-- ── Parcels ──────────────────────────────────────────────────────────────────
CREATE TABLE parcels (
    id              BIGSERIAL PRIMARY KEY,
    jurisdiction_id INTEGER NOT NULL REFERENCES jurisdictions(id),
    source_id       INTEGER NOT NULL REFERENCES sources(id),
    apn             VARCHAR(100) NOT NULL,
    address         TEXT,
    owner_name      TEXT,
    lot_size_sqft   NUMERIC(14,2),
    land_use_code   VARCHAR(50),
    year_built      SMALLINT,
    attributes      JSONB DEFAULT '{}',
    geom            GEOMETRY(MULTIPOLYGON, 4326) NOT NULL,
    source_crs      TEXT,               -- original CRS string for audit
    data_hash       VARCHAR(64),        -- SHA256(geom.wkb) for change detection
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (source_id, apn)
);
CREATE INDEX idx_parcels_geom       ON parcels USING GIST(geom);
CREATE INDEX idx_parcels_apn        ON parcels(apn);
CREATE INDEX idx_parcels_jurisdiction ON parcels(jurisdiction_id);
CREATE INDEX idx_parcels_fts        ON parcels
    USING GIN(to_tsvector('english', COALESCE(address, '') || ' ' || COALESCE(apn, '')));
-- BRIN for time-range queries on large tables
CREATE INDEX idx_parcels_created_brin ON parcels USING BRIN(created_at);

-- ── Zones ────────────────────────────────────────────────────────────────────
CREATE TABLE zones (
    id              BIGSERIAL PRIMARY KEY,
    jurisdiction_id INTEGER NOT NULL REFERENCES jurisdictions(id),
    source_id       INTEGER NOT NULL REFERENCES sources(id),
    zone_code       VARCHAR(50) NOT NULL,
    zone_name       TEXT,
    zone_type       VARCHAR(50),
    -- 'residential' | 'commercial' | 'industrial' | 'mixed' | 'open_space'
    description     TEXT,
    attributes      JSONB DEFAULT '{}',
    geom            GEOMETRY(MULTIPOLYGON, 4326) NOT NULL,
    data_hash       VARCHAR(64),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_zones_geom         ON zones USING GIST(geom);
CREATE INDEX idx_zones_code         ON zones(zone_code);
CREATE INDEX idx_zones_jurisdiction ON zones(jurisdiction_id);

-- ── Documents ────────────────────────────────────────────────────────────────
CREATE TABLE documents (
    id              SERIAL PRIMARY KEY,
    source_id       INTEGER NOT NULL REFERENCES sources(id),
    ingestion_run_id INTEGER REFERENCES ingestion_runs(id),
    filename        TEXT NOT NULL,
    doc_type        VARCHAR(30) NOT NULL,   -- 'pdf' | 'html' | 'text'
    artifact_key    TEXT,                   -- R2 object key
    extracted_text  TEXT,                   -- full concatenated text (for debug)
    page_count      INTEGER,
    summary         TEXT,                   -- LLM-generated
    key_restrictions JSONB DEFAULT '[]',    -- [{text, page}]
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_documents_source ON documents(source_id);

-- ── Document Pages (page-anchored citations) ─────────────────────────────────
CREATE TABLE document_pages (
    id              BIGSERIAL PRIMARY KEY,
    document_id     INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    page_number     INTEGER NOT NULL,       -- 1-indexed
    raw_text        TEXT NOT NULL,
    char_count      INTEGER DEFAULT 0,
    has_tables      BOOLEAN DEFAULT FALSE,
    has_images      BOOLEAN DEFAULT FALSE,
    extraction_method VARCHAR(30) DEFAULT 'pdfplumber',
    -- 'pdfplumber' | 'ocr' | 'html_section'
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (document_id, page_number)
);
CREATE INDEX idx_document_pages_document ON document_pages(document_id);

-- ── Document Chunks (RAG units, never cross page boundaries) ─────────────────
CREATE TABLE document_chunks (
    id              BIGSERIAL PRIMARY KEY,
    document_id     INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    page_id         BIGINT REFERENCES document_pages(id),   -- anchored to page
    chunk_index     INTEGER NOT NULL,                        -- global within document
    chunk_text      TEXT NOT NULL,
    char_start      INTEGER DEFAULT 0,      -- offset within page text
    char_end        INTEGER DEFAULT 0,
    embedding_model VARCHAR(100),           -- which model produced the embedding
    embedding_dim   INTEGER,                -- recorded at write time
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (document_id, chunk_index)
);
CREATE INDEX idx_chunks_document ON document_chunks(document_id);
CREATE INDEX idx_chunks_page     ON document_chunks(page_id);

-- ── Vector Table (pgvector — one table per canonical dimension) ──────────────
-- Created at runtime by ensure_vector_table(); name = gis_vec_{dim}
-- Example for nomic-embed-text (768d):
CREATE TABLE IF NOT EXISTS gis_vec_768 (
    chunk_id    BIGINT PRIMARY KEY REFERENCES document_chunks(id) ON DELETE CASCADE,
    embedding   vector(768) NOT NULL,
    model       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_gis_vec_768_hnsw
    ON gis_vec_768 USING hnsw(embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);
-- Note: for 1024d model, table would be gis_vec_1024 etc.
-- Only one dimension table is active per environment (see embedding config).

-- ── AI Runs (audit log for every LLM call) ───────────────────────────────────
CREATE TABLE ai_runs (
    id                  BIGSERIAL PRIMARY KEY,
    task_type           VARCHAR(50) NOT NULL,
    -- 'extract' | 'summarize' | 'rag' | 'quality' | 'debug'
    provider            VARCHAR(50) NOT NULL,
    model               VARCHAR(100) NOT NULL,
    prompt_version      VARCHAR(50) NOT NULL,
    source_document_id  INTEGER REFERENCES documents(id),
    ingestion_run_id    INTEGER REFERENCES ingestion_runs(id),
    tokens_input        INTEGER DEFAULT 0,
    tokens_output       INTEGER DEFAULT 0,
    confidence_score    NUMERIC(4,3),
    input_hash          VARCHAR(64),    -- SHA256 of (provider+model+version+prompt)
    output_text         TEXT,
    output_data         JSONB,
    duration_ms         INTEGER,
    error               TEXT DEFAULT '',
    created_at          TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_ai_runs_task     ON ai_runs(task_type);
CREATE INDEX idx_ai_runs_provider ON ai_runs(provider);
CREATE INDEX idx_ai_runs_hash     ON ai_runs(input_hash);   -- cache lookups
CREATE INDEX idx_ai_runs_date     ON ai_runs(created_at);
-- BRIN for time-range aggregate queries (budget dashboard)
CREATE INDEX idx_ai_runs_date_brin ON ai_runs USING BRIN(created_at);

-- ── Zoning Rules (validated, human-reviewed) ─────────────────────────────────
CREATE TABLE zoning_rules (
    id                  BIGSERIAL PRIMARY KEY,
    jurisdiction_id     INTEGER NOT NULL REFERENCES jurisdictions(id),
    zone_code           VARCHAR(50) NOT NULL,
    rule_type           VARCHAR(80) NOT NULL,
    -- 'max_height_ft' | 'min_lot_size_sqft' | 'max_lot_coverage_pct'
    -- 'setback_front_ft' | 'setback_rear_ft' | 'setback_side_ft'
    -- 'parking_spaces_per_unit' | 'allowed_uses' | 'special_overlays'
    -- 'floor_area_ratio'
    value_text          TEXT,
    value_numeric       NUMERIC(12,4),
    value_list          JSONB,
    review_status       VARCHAR(20) NOT NULL DEFAULT 'pending',
    -- 'pending' | 'approved' | 'rejected' | 'superseded'
    reviewed_by         VARCHAR(200),
    reviewed_at         TIMESTAMPTZ,
    review_note         TEXT,
    source_extraction_id BIGINT,        -- FK to extractions (set after creation)
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (jurisdiction_id, zone_code, rule_type)
);
CREATE INDEX idx_zoning_rules_jurisdiction ON zoning_rules(jurisdiction_id);
CREATE INDEX idx_zoning_rules_status       ON zoning_rules(review_status);
CREATE INDEX idx_zoning_rules_zone         ON zoning_rules(zone_code);

-- ── Extractions (raw LLM output — never edited) ──────────────────────────────
CREATE TABLE extractions (
    id                  BIGSERIAL PRIMARY KEY,
    document_id         INTEGER NOT NULL REFERENCES documents(id),
    page_number         INTEGER NOT NULL,           -- REQUIRED, never null
    chunk_id            BIGINT REFERENCES document_chunks(id),
    field_name          VARCHAR(80) NOT NULL,
    raw_value           TEXT NOT NULL,
    zone_code           VARCHAR(50),
    quote_snippet       TEXT NOT NULL,              -- required at app layer
    quote_char_start    INTEGER,
    quote_char_end      INTEGER,
    confidence          NUMERIC(4,3) NOT NULL,
    model               VARCHAR(100) NOT NULL,
    provider            VARCHAR(50) NOT NULL,
    prompt_version      VARCHAR(30) NOT NULL,
    ai_run_id           BIGINT REFERENCES ai_runs(id),
    validation_status   VARCHAR(30) NOT NULL DEFAULT 'unvalidated',
    -- 'unvalidated' | 'valid' | 'invalid_citation' | 'low_confidence' | 'duplicate'
    validation_error    TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_extractions_document ON extractions(document_id);
CREATE INDEX idx_extractions_field    ON extractions(field_name);
CREATE INDEX idx_extractions_zone     ON extractions(zone_code);
CREATE INDEX idx_extractions_status   ON extractions(validation_status);

-- ── Rule Provenance (rule ↔ supporting extractions) ──────────────────────────
CREATE TABLE rule_provenance (
    rule_id         BIGINT NOT NULL REFERENCES zoning_rules(id) ON DELETE CASCADE,
    extraction_id   BIGINT NOT NULL REFERENCES extractions(id) ON DELETE CASCADE,
    is_primary      BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (rule_id, extraction_id)
);

-- ── Tilesets ─────────────────────────────────────────────────────────────────
CREATE TABLE tilesets (
    id                  SERIAL PRIMARY KEY,
    jurisdiction_id     INTEGER NOT NULL REFERENCES jurisdictions(id),
    layer_type          VARCHAR(30) NOT NULL,   -- 'parcels' | 'zones'
    artifact_key        TEXT NOT NULL,           -- R2 object key
    r2_etag             TEXT,
    zoom_min            SMALLINT NOT NULL,
    zoom_max            SMALLINT NOT NULL,
    feature_count       INTEGER,
    bounds_west         NUMERIC(10,6),
    bounds_south        NUMERIC(10,6),
    bounds_east         NUMERIC(10,6),
    bounds_north        NUMERIC(10,6),
    file_size_bytes     BIGINT,
    generation_status   VARCHAR(20) DEFAULT 'pending',
    -- 'pending' | 'generating' | 'valid' | 'invalid'
    validation_error    TEXT,
    generated_at        TIMESTAMPTZ DEFAULT NOW(),
    ingestion_run_id    INTEGER REFERENCES ingestion_runs(id)
);
CREATE UNIQUE INDEX idx_tilesets_active
    ON tilesets(jurisdiction_id, layer_type)
    WHERE generation_status = 'valid';
```

### Django Models (complete)

```python
# gis/models.py
from django.contrib.gis.db import models as gis_models
from django.db import models


class Jurisdiction(models.Model):
    name = models.CharField(max_length=200)
    state = models.CharField(max_length=2, default='CA')
    county = models.CharField(max_length=100, blank=True)
    slug = models.SlugField(max_length=100, unique=True)
    geom = gis_models.MultiPolygonField(srid=4326, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self): return self.name


class Source(models.Model):
    SOURCE_TYPES = [
        ('parcel_geojson', 'Parcel GeoJSON'),
        ('zoning_shapefile', 'Zoning Shapefile'),
        ('pdf', 'PDF'),
        ('html', 'HTML'),
    ]
    jurisdiction = models.ForeignKey(Jurisdiction, on_delete=models.CASCADE,
                                     related_name='sources')
    name = models.CharField(max_length=200)
    source_type = models.CharField(max_length=50, choices=SOURCE_TYPES)
    url = models.TextField()
    last_etag = models.TextField(blank=True)
    last_modified = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)


class IngestionRun(models.Model):
    STATUS = [
        ('pending', 'Pending'), ('running', 'Running'),
        ('completed', 'Completed'), ('failed', 'Failed'),
    ]
    source = models.ForeignKey(Source, on_delete=models.CASCADE,
                               related_name='runs')
    status = models.CharField(max_length=20, choices=STATUS, default='pending')
    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    records_added = models.IntegerField(default=0)
    records_updated = models.IntegerField(default=0)
    records_skipped = models.IntegerField(default=0)
    error_message = models.TextField(blank=True)
    raw_artifact_key = models.TextField(blank=True)


class Parcel(models.Model):
    jurisdiction = models.ForeignKey(Jurisdiction, on_delete=models.CASCADE,
                                     related_name='parcels')
    source = models.ForeignKey(Source, on_delete=models.CASCADE)
    apn = models.CharField(max_length=100)
    address = models.TextField(blank=True)
    owner_name = models.TextField(blank=True)
    lot_size_sqft = models.DecimalField(max_digits=14, decimal_places=2,
                                        null=True, blank=True)
    land_use_code = models.CharField(max_length=50, blank=True)
    year_built = models.SmallIntegerField(null=True, blank=True)
    attributes = models.JSONField(default=dict)
    geom = gis_models.MultiPolygonField(srid=4326)
    source_crs = models.TextField(blank=True)
    data_hash = models.CharField(max_length=64, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [('source', 'apn')]


class Zone(models.Model):
    ZONE_TYPES = [
        ('residential', 'Residential'), ('commercial', 'Commercial'),
        ('industrial', 'Industrial'), ('mixed', 'Mixed Use'),
        ('open_space', 'Open Space'), ('other', 'Other'),
    ]
    jurisdiction = models.ForeignKey(Jurisdiction, on_delete=models.CASCADE,
                                     related_name='zones')
    source = models.ForeignKey(Source, on_delete=models.CASCADE)
    zone_code = models.CharField(max_length=50)
    zone_name = models.TextField(blank=True)
    zone_type = models.CharField(max_length=50, choices=ZONE_TYPES, blank=True)
    description = models.TextField(blank=True)
    attributes = models.JSONField(default=dict)
    geom = gis_models.MultiPolygonField(srid=4326)
    data_hash = models.CharField(max_length=64, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


class Document(models.Model):
    source = models.ForeignKey(Source, on_delete=models.CASCADE,
                               related_name='documents')
    ingestion_run = models.ForeignKey(IngestionRun, on_delete=models.SET_NULL,
                                      null=True)
    filename = models.TextField()
    doc_type = models.CharField(max_length=30)
    artifact_key = models.TextField(blank=True)
    extracted_text = models.TextField(blank=True)
    page_count = models.IntegerField(null=True)
    summary = models.TextField(blank=True)
    key_restrictions = models.JSONField(default=list)
    created_at = models.DateTimeField(auto_now_add=True)


class DocumentPage(models.Model):
    """One row per PDF page or HTML section. Every chunk is anchored here."""
    document = models.ForeignKey(Document, on_delete=models.CASCADE,
                                 related_name='pages')
    page_number = models.PositiveIntegerField()
    raw_text = models.TextField()
    char_count = models.IntegerField(default=0)
    has_tables = models.BooleanField(default=False)
    has_images = models.BooleanField(default=False)
    extraction_method = models.CharField(max_length=30, default='pdfplumber')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [('document', 'page_number')]
        ordering = ['document', 'page_number']


class DocumentChunk(models.Model):
    """RAG unit. Never crosses a page boundary. Anchored to DocumentPage."""
    document = models.ForeignKey(Document, on_delete=models.CASCADE,
                                 related_name='chunks')
    page = models.ForeignKey(DocumentPage, on_delete=models.CASCADE,
                             related_name='chunks', null=True)
    chunk_index = models.IntegerField()
    chunk_text = models.TextField()
    char_start = models.IntegerField(default=0)
    char_end = models.IntegerField(default=0)
    embedding_model = models.CharField(max_length=100, blank=True)
    embedding_dim = models.IntegerField(null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [('document', 'chunk_index')]


class AIRun(models.Model):
    TASK_TYPES = [
        ('extract', 'Field Extraction'), ('summarize', 'Summarization'),
        ('rag', 'RAG Q&A'), ('quality', 'Quality Check'),
        ('debug', 'Ingestion Debug'),
    ]
    task_type = models.CharField(max_length=50, choices=TASK_TYPES)
    provider = models.CharField(max_length=50)
    model = models.CharField(max_length=100)
    prompt_version = models.CharField(max_length=50)
    source_document = models.ForeignKey(Document, on_delete=models.SET_NULL,
                                        null=True, blank=True)
    ingestion_run = models.ForeignKey(IngestionRun, on_delete=models.SET_NULL,
                                      null=True, blank=True)
    tokens_input = models.IntegerField(default=0)
    tokens_output = models.IntegerField(default=0)
    confidence_score = models.DecimalField(max_digits=4, decimal_places=3,
                                           null=True)
    input_hash = models.CharField(max_length=64, blank=True)
    output_text = models.TextField(blank=True)
    output_data = models.JSONField(null=True)
    duration_ms = models.IntegerField(null=True)
    error = models.TextField(default='')
    created_at = models.DateTimeField(auto_now_add=True)


class ZoningRule(models.Model):
    REVIEW_STATUS = [
        ('pending', 'Pending Review'), ('approved', 'Approved'),
        ('rejected', 'Rejected'), ('superseded', 'Superseded'),
    ]
    jurisdiction = models.ForeignKey(Jurisdiction, on_delete=models.CASCADE,
                                     related_name='zoning_rules')
    zone_code = models.CharField(max_length=50)
    rule_type = models.CharField(max_length=80)
    value_text = models.TextField(blank=True)
    value_numeric = models.DecimalField(max_digits=12, decimal_places=4,
                                        null=True, blank=True)
    value_list = models.JSONField(null=True, blank=True)
    review_status = models.CharField(max_length=20, choices=REVIEW_STATUS,
                                     default='pending')
    reviewed_by = models.CharField(max_length=200, blank=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    review_note = models.TextField(blank=True)
    source_extraction_id = models.BigIntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [('jurisdiction', 'zone_code', 'rule_type')]


class Extraction(models.Model):
    VALIDATION_STATUS = [
        ('unvalidated', 'Unvalidated'), ('valid', 'Valid'),
        ('invalid_citation', 'Invalid Citation'),
        ('low_confidence', 'Low Confidence'), ('duplicate', 'Duplicate'),
    ]
    document = models.ForeignKey(Document, on_delete=models.CASCADE,
                                 related_name='extractions')
    page_number = models.PositiveIntegerField()    # never null
    chunk = models.ForeignKey(DocumentChunk, on_delete=models.SET_NULL,
                              null=True, blank=True)
    field_name = models.CharField(max_length=80)
    raw_value = models.TextField()
    zone_code = models.CharField(max_length=50, blank=True)
    quote_snippet = models.TextField()             # enforced non-empty at app layer
    quote_char_start = models.IntegerField(null=True)
    quote_char_end = models.IntegerField(null=True)
    confidence = models.DecimalField(max_digits=4, decimal_places=3)
    model = models.CharField(max_length=100)
    provider = models.CharField(max_length=50)
    prompt_version = models.CharField(max_length=30)
    ai_run = models.ForeignKey(AIRun, on_delete=models.SET_NULL, null=True)
    validation_status = models.CharField(max_length=30,
                                         choices=VALIDATION_STATUS,
                                         default='unvalidated')
    validation_error = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)


class RuleProvenance(models.Model):
    rule = models.ForeignKey(ZoningRule, on_delete=models.CASCADE,
                             related_name='provenance')
    extraction = models.ForeignKey(Extraction, on_delete=models.CASCADE)
    is_primary = models.BooleanField(default=True)

    class Meta:
        unique_together = [('rule', 'extraction')]


class Tileset(models.Model):
    GENERATION_STATUS = [
        ('pending', 'Pending'), ('generating', 'Generating'),
        ('valid', 'Valid'), ('invalid', 'Invalid'),
    ]
    jurisdiction = models.ForeignKey(Jurisdiction, on_delete=models.CASCADE,
                                     related_name='tilesets')
    layer_type = models.CharField(max_length=30)   # 'parcels' | 'zones'
    artifact_key = models.TextField()
    r2_etag = models.TextField(blank=True)
    zoom_min = models.SmallIntegerField()
    zoom_max = models.SmallIntegerField()
    feature_count = models.IntegerField(null=True)
    bounds_west = models.DecimalField(max_digits=10, decimal_places=6, null=True)
    bounds_south = models.DecimalField(max_digits=10, decimal_places=6, null=True)
    bounds_east = models.DecimalField(max_digits=10, decimal_places=6, null=True)
    bounds_north = models.DecimalField(max_digits=10, decimal_places=6, null=True)
    file_size_bytes = models.BigIntegerField(null=True)
    generation_status = models.CharField(max_length=20,
                                         choices=GENERATION_STATUS,
                                         default='pending')
    validation_error = models.TextField(blank=True)
    generated_at = models.DateTimeField(auto_now_add=True)
    ingestion_run = models.ForeignKey(IngestionRun, on_delete=models.SET_NULL,
                                      null=True)
```

### CRS Strategy and GIS Correctness Rules

**Rule 1: Store everything in EPSG:4326 (WGS84). Always reproject on ingest, never on query.**

```python
# gis/ingestion/geo_utils.py
import geopandas as gpd
import structlog
from shapely.validation import make_valid

logger = structlog.get_logger()

# Valid bounds for California parcels (with 1° buffer)
CA_BOUNDS = {"west": -125.5, "south": 31.5, "east": -113.0, "north": 43.1}


def normalize_crs(gdf: gpd.GeoDataFrame, source_url: str = "") -> gpd.GeoDataFrame:
    """
    Detect and reproject to EPSG:4326.
    Raises ValueError if CRS is absent (never silently assume 4326).
    """
    if gdf.crs is None:
        raise ValueError(
            f"Source has no CRS metadata — cannot safely reproject. "
            f"Source: {source_url}. "
            "Check .prj file or source documentation for the correct EPSG code."
        )

    original_crs = str(gdf.crs)
    if gdf.crs.to_epsg() != 4326:
        logger.info("reprojecting", from_crs=original_crs, to_crs="EPSG:4326")
        gdf = gdf.to_crs(epsg=4326)

    return gdf


def validate_geometries(gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    """
    1. Apply make_valid() to fix self-intersections
    2. Keep only Polygon and MultiPolygon results (drop GeometryCollection)
    3. Cast all Polygon → MultiPolygon for DB type consistency
    4. Drop null/empty geometries
    """
    original_count = len(gdf)

    # Fix invalid geometries
    gdf["geometry"] = gdf["geometry"].apply(
        lambda g: make_valid(g) if g is not None and not g.is_valid else g
    )

    # Drop after make_valid if still not polygon type
    valid_types = {"Polygon", "MultiPolygon"}
    gdf = gdf[gdf["geometry"].apply(
        lambda g: g is not None and not g.is_empty and g.geom_type in valid_types
    )].copy()

    # Cast Polygon → MultiPolygon
    from shapely.geometry import MultiPolygon
    gdf["geometry"] = gdf["geometry"].apply(
        lambda g: MultiPolygon([g]) if g.geom_type == "Polygon" else g
    )

    dropped = original_count - len(gdf)
    if dropped > 0:
        logger.warning("geometries_dropped", count=dropped,
                       pct=round(dropped / original_count * 100, 1))

    return gdf


def check_ca_bounds(gdf: gpd.GeoDataFrame) -> int:
    """
    Count features whose centroid falls outside California bounds.
    Returns count of out-of-bounds features (0 = good).
    """
    centroids = gdf["geometry"].centroid
    out_of_bounds = (
        (centroids.x < CA_BOUNDS["west"]) |
        (centroids.x > CA_BOUNDS["east"]) |
        (centroids.y < CA_BOUNDS["south"]) |
        (centroids.y > CA_BOUNDS["north"])
    ).sum()

    if out_of_bounds > 0:
        logger.error(
            "crs_drift_detected",
            out_of_bounds=int(out_of_bounds),
            total=len(gdf),
            message="Centroids outside California bbox — likely CRS mismatch",
        )
    return int(out_of_bounds)
```

**Rule 2: Area checks always use `ST_Area(geom::geography)` (metres²), never degree².**

```sql
-- Correct: spheroidal area in m²
SELECT id, apn, ST_Area(geom::geography) AS area_m2
FROM parcels
WHERE ST_Area(geom::geography) < 10          -- < 10 m² → suspect
   OR ST_Area(geom::geography) > 4000000;    -- > 4 km² → suspect

-- Wrong (never do this):
-- WHERE ST_Area(geom) > 0.01   ← degrees², meaningless at California latitudes
```

**Rule 3: Common California CRS pitfalls**

| Situation | CRS | Notes |
|-----------|-----|-------|
| County assessor data | EPSG:2226–2232 (CA State Plane) | Always explicit in .prj |
| Old county data | NAD27 variants | Use NADCON grid shift via PROJ |
| Statewide datasets | EPSG:3310 (CA Albers) | Common for Cal OES / CalFire data |
| Web downloads | EPSG:4326 or 3857 | Always verify, never assume |
| Shapefile .prj missing | Unknown | Log error, require manual CRS entry in Source record |
---

## Section 5 — One-Day MVP Build Runbook

**Time budget: 8 hours. Start 9:00 AM, ship by 5:00 PM.**

### 5.1 Repo + Tooling (9:00–9:30)

**Monorepo structure:**
```
parcel-map/
├── backend/
│   ├── core/                  # Django project (settings, urls, wsgi)
│   │   ├── llm/               # LLM abstraction layer
│   │   │   ├── base.py
│   │   │   ├── factory.py
│   │   │   ├── embedding_config.py
│   │   │   ├── embedding_registry.py
│   │   │   └── providers/
│   │   │       ├── ollama.py
│   │   │       ├── gemini.py
│   │   │       └── groq.py
│   │   └── middleware/
│   │       └── ai_rate_limit.py
│   ├── gis/                   # main app
│   │   ├── models.py
│   │   ├── views.py
│   │   ├── views_ai.py
│   │   ├── serializers.py
│   │   ├── urls.py
│   │   ├── admin.py
│   │   ├── ingestion/
│   │   │   ├── loader.py
│   │   │   └── geo_utils.py
│   │   ├── ai/
│   │   │   ├── extraction_pipeline.py
│   │   │   ├── rag.py
│   │   │   ├── quality.py
│   │   │   ├── quota.py
│   │   │   └── vector_store.py
│   │   ├── tiles/
│   │   │   ├── policy.py
│   │   │   └── validator.py
│   │   └── management/
│   │       └── commands/
│   │           ├── rebuild_embeddings.py
│   │           ├── generate_tiles.py
│   │           └── ai_report.py
│   ├── agents/                # vibe-coding agent markdown files
│   │   ├── architect.md
│   │   ├── backend.md
│   │   ├── frontend.md
│   │   ├── gis_data.md
│   │   ├── devops_sre.md
│   │   └── qa.md
│   ├── tests/
│   │   └── ai/
│   │       ├── golden/        # JSON golden cases
│   │       └── test_extraction_eval.py
│   ├── requirements.txt
│   ├── manage.py
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── AIPanel.tsx
│   │   │   ├── DetailPanel.tsx
│   │   │   └── LayerControls.tsx
│   │   └── hooks/
│   │       └── useMapLayers.ts
│   ├── package.json
│   └── vite.config.ts
├── scripts/
│   ├── generate_tiles.sh
│   ├── daily_loop.sh
│   └── pr_gate.py
├── docs/
│   └── adr/
├── docker-compose.yml
├── .env.example
├── .aider.conf.yml
├── Makefile
└── railway.toml
```

**docker-compose.yml (local parity):**
```yaml
services:
  db:
    image: postgis/postgis:16-3.4
    environment:
      POSTGRES_DB: parcelmap
      POSTGRES_USER: parcelmap
      POSTGRES_PASSWORD: parcelmap
    ports: ["5432:5432"]
    volumes: [pgdata:/var/lib/postgresql/data]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U parcelmap"]
      interval: 5s
      timeout: 5s
      retries: 5

  backend:
    build: ./backend
    command: python manage.py runserver 0.0.0.0:8000
    environment:
      DATABASE_URL: postgis://parcelmap:parcelmap@db:5432/parcelmap
      DEBUG: "true"
      LLM_PROVIDER: ollama
      OLLAMA_BASE_URL: http://host.docker.internal:11434
      EMBEDDING_PROVIDER: ollama
      OLLAMA_EMBED_MODEL: nomic-embed-text
    ports: ["8000:8000"]
    volumes: [./backend:/app]
    depends_on:
      db:
        condition: service_healthy

  worker:
    build: ./backend
    command: python manage.py qcluster
    environment:
      DATABASE_URL: postgis://parcelmap:parcelmap@db:5432/parcelmap
      LLM_PROVIDER: ollama
      OLLAMA_BASE_URL: http://host.docker.internal:11434
    depends_on:
      db:
        condition: service_healthy

  frontend:
    image: node:20-alpine
    working_dir: /app
    command: npm run dev -- --host
    volumes: [./frontend:/app]
    ports: ["5173:5173"]
    environment:
      VITE_API_URL: http://localhost:8000/api
      VITE_USE_PMTILES: "false"

volumes:
  pgdata:
```

**.env.example (complete):**
```bash
# Core Django
DATABASE_URL=postgis://parcelmap:parcelmap@localhost:5432/parcelmap
SECRET_KEY=change-this-to-a-random-50-char-string
DEBUG=true
ALLOWED_HOSTS=localhost,127.0.0.1
CORS_ALLOWED_ORIGINS=http://localhost:5173

# Object Storage (Cloudflare R2)
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=parcelmap-artifacts
R2_ENDPOINT_URL=https://<account_id>.r2.cloudflarestorage.com

# Tile delivery
TILES_PUBLIC_URL=https://tiles.yourdomain.com

# LLM provider (swap with zero code changes)
LLM_PROVIDER=ollama                        # ollama | gemini | groq
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2
EMBEDDING_PROVIDER=ollama                  # ONE canonical embedding provider
OLLAMA_EMBED_MODEL=nomic-embed-text        # 768d
EMBEDDING_DIM=768                          # MUST match model above

# Hosted LLM (use when switching from Ollama)
GEMINI_API_KEY=
GEMINI_MODEL=gemini-1.5-flash
GROQ_API_KEY=
GROQ_MODEL=llama-3.1-8b-instant

# AI quota caps (0 = unlimited)
AI_DAILY_CAP_OLLAMA=0
AI_DAILY_CAP_GEMINI=900000
AI_DAILY_CAP_GROQ=100000
AI_RATE_LIMIT_PER_MINUTE=10

# Observability
SENTRY_DSN=
```

### 5.2 Backend Day-1 Implementation (9:30–12:00)

**Install:**
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install django djangorestframework django-cors-headers \
    djangorestframework-gis django-environ geopandas \
    psycopg2-binary httpx structlog sentry-sdk \
    django-q2 boto3 pdfplumber beautifulsoup4 \
    shapely gunicorn whitenoise ruff
```

**core/settings.py (key parts):**
```python
import environ, sentry_sdk
env = environ.Env()
environ.Env.read_env()

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.gis",           # must precede rest_framework_gis
    "rest_framework",
    "rest_framework_gis",
    "corsheaders",
    "django_q",
    "gis",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "core.middleware.ai_rate_limit.AIRateLimitMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
]

DATABASES = {"default": env.db("DATABASE_URL")}
CORS_ALLOWED_ORIGINS = env.list("CORS_ALLOWED_ORIGINS")

Q_CLUSTER = {
    "name": "parcelmap",
    "orm": "default",
    "workers": 2,
    "timeout": 600,
    "retry": 720,
    "max_attempts": 3,
}

if dsn := env("SENTRY_DSN", default=""):
    sentry_sdk.init(dsn=dsn, traces_sample_rate=0.1)
```

**DRF Endpoints (gis/views.py):**
```python
from django.contrib.gis.geos import Polygon
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status as drf_status
from django.db.models import Q
from .models import Parcel, Zone, IngestionRun, ZoningRule, Tileset
from .serializers import (ParcelListSerializer, ParcelDetailSerializer,
                          ZoneListSerializer, ZoneDetailSerializer,
                          IngestionRunSerializer)
import structlog

logger = structlog.get_logger()


def bbox_to_polygon(bbox_str: str):
    try:
        minx, miny, maxx, maxy = map(float, bbox_str.split(","))
        poly = Polygon.from_bbox((minx, miny, maxx, maxy))
        poly.srid = 4326
        return poly
    except Exception:
        return None


class ParcelListView(APIView):
    """GET /api/parcels/?bbox=minx,miny,maxx,maxy&jurisdiction_id=1"""
    def get(self, request):
        bbox_str = request.query_params.get("bbox")
        jid = request.query_params.get("jurisdiction_id")
        qs = Parcel.objects.select_related("jurisdiction")
        if jid:
            qs = qs.filter(jurisdiction_id=jid)
        if bbox_str:
            bbox = bbox_to_polygon(bbox_str)
            if bbox:
                qs = qs.filter(geom__intersects=bbox)
        qs = qs[:2000]  # hard cap for Day-1
        return Response(ParcelListSerializer(qs, many=True).data)


class ParcelDetailView(APIView):
    """GET /api/parcels/{id}/"""
    def get(self, request, pk):
        try:
            parcel = Parcel.objects.get(pk=pk)
        except Parcel.DoesNotExist:
            return Response(status=drf_status.HTTP_404_NOT_FOUND)
        return Response(ParcelDetailSerializer(parcel).data)


class ZoneListView(APIView):
    """GET /api/zones/?bbox=...&jurisdiction_id=1"""
    def get(self, request):
        bbox_str = request.query_params.get("bbox")
        jid = request.query_params.get("jurisdiction_id")
        qs = Zone.objects.all()
        if jid:
            qs = qs.filter(jurisdiction_id=jid)
        if bbox_str:
            bbox = bbox_to_polygon(bbox_str)
            if bbox:
                qs = qs.filter(geom__intersects=bbox)
        return Response(ZoneListSerializer(qs[:500], many=True).data)


class ZoneDetailView(APIView):
    """GET /api/zones/{id}/"""
    def get(self, request, pk):
        try:
            zone = Zone.objects.get(pk=pk)
        except Zone.DoesNotExist:
            return Response(status=drf_status.HTTP_404_NOT_FOUND)
        return Response(ZoneDetailSerializer(zone).data)


class ZoneRulesView(APIView):
    """GET /api/zones/{id}/rules/ — approved rules only"""
    def get(self, request, pk):
        try:
            zone = Zone.objects.get(pk=pk)
        except Zone.DoesNotExist:
            return Response(status=drf_status.HTTP_404_NOT_FOUND)
        rules = ZoningRule.objects.filter(
            jurisdiction=zone.jurisdiction,
            zone_code=zone.zone_code,
            review_status="approved",
        ).values("rule_type", "value_text", "value_numeric", "value_list",
                 "source_extraction_id")
        return Response(list(rules))


class SearchView(APIView):
    """GET /api/search/?q=APN_OR_ADDRESS"""
    def get(self, request):
        q = request.query_params.get("q", "").strip()
        if not q or len(q) < 2:
            return Response({"results": []})
        parcels = Parcel.objects.filter(
            Q(apn__icontains=q) | Q(address__icontains=q)
        ).select_related("jurisdiction")[:20]
        results = []
        for p in parcels:
            centroid = p.geom.centroid
            results.append({
                "type": "parcel", "id": p.id,
                "label": f"{p.apn} — {p.address or 'No address'}",
                "jurisdiction": p.jurisdiction.name,
                "lng": centroid.x, "lat": centroid.y,
            })
        return Response({"results": results})


class IngestionStatusView(APIView):
    """GET /api/ingestion/"""
    def get(self, request):
        runs = IngestionRun.objects.select_related("source").order_by("-started_at")[:20]
        return Response(IngestionRunSerializer(runs, many=True).data)


class TilesetView(APIView):
    """GET /api/tilesets/?jurisdiction_id=1"""
    def get(self, request):
        jid = request.query_params.get("jurisdiction_id")
        qs = Tileset.objects.filter(generation_status="valid")
        if jid:
            qs = qs.filter(jurisdiction_id=jid)
        data = list(qs.values("jurisdiction_id", "layer_type", "artifact_key",
                               "zoom_min", "zoom_max", "feature_count",
                               "generated_at"))
        return Response(data)


class HealthView(APIView):
    """GET /health/ — uptime monitoring target"""
    def get(self, request):
        from django.db import connection
        try:
            connection.ensure_connection()
            return Response({"status": "ok", "db": "connected"})
        except Exception as e:
            return Response({"status": "error", "db": str(e)}, status=503)
```

**gis/urls.py:**
```python
from django.urls import path
from . import views, views_ai

urlpatterns = [
    path("parcels/",              views.ParcelListView.as_view()),
    path("parcels/<int:pk>/",     views.ParcelDetailView.as_view()),
    path("zones/",                views.ZoneListView.as_view()),
    path("zones/<int:pk>/",       views.ZoneDetailView.as_view()),
    path("zones/<int:pk>/rules/", views.ZoneRulesView.as_view()),
    path("search/",               views.SearchView.as_view()),
    path("ingestion/",            views.IngestionStatusView.as_view()),
    path("tilesets/",             views.TilesetView.as_view()),
    path("ai/ask/",               views_ai.AskView.as_view()),
    path("ai/budget/",            views_ai.BudgetDashboardView.as_view()),
    path("ai/quality/",           views_ai.QualityCheckView.as_view()),
    path("ai/debug/<int:run_id>/",views_ai.IngestionDebugView.as_view()),
]
```

**core/urls.py:**
```python
from django.contrib import admin
from django.urls import path, include
from gis.views import HealthView

urlpatterns = [
    path("admin/", admin.site.urls),
    path("health/", HealthView.as_view()),
    path("api/", include("gis.urls")),
]
```

### 5.3 Ingestion Day-1 Implementation (10:00–12:30)

```python
# gis/ingestion/loader.py
import hashlib, os, tempfile
import geopandas as gpd
import httpx
import structlog
from django.utils import timezone
from .geo_utils import normalize_crs, validate_geometries, check_ca_bounds
from ..models import Source, IngestionRun, Parcel, Zone

logger = structlog.get_logger()


def sha256_wkb(geom) -> str:
    return hashlib.sha256(geom.wkb).hexdigest()


def run_ingestion(source_id: int) -> None:
    """
    Entry point for Django-Q task and management command.
    Idempotent: can be re-run safely (uses update_or_create).
    """
    source = Source.objects.select_related("jurisdiction").get(id=source_id)
    run = IngestionRun.objects.create(source=source, status="running")
    log = logger.bind(source_id=source_id, run_id=run.id)

    try:
        # ── Download ──────────────────────────────────────────────────────────
        log.info("fetching_source", url=source.url)
        suffix = ".geojson" if "geojson" in source.url.lower() else ".zip"

        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as f:
            with httpx.stream("GET", source.url, follow_redirects=True,
                              timeout=120) as r:
                r.raise_for_status()
                for chunk in r.iter_bytes(8192):
                    f.write(chunk)
            tmppath = f.name

        log.info("download_complete", path=tmppath)

        # ── Parse ─────────────────────────────────────────────────────────────
        gdf = gpd.read_file(tmppath)
        log.info("file_read", rows=len(gdf), crs=str(gdf.crs))

        gdf = normalize_crs(gdf, source_url=source.url)
        gdf = validate_geometries(gdf)

        drift_count = check_ca_bounds(gdf)
        if drift_count > len(gdf) * 0.5:
            raise ValueError(
                f"CRS drift: {drift_count}/{len(gdf)} features outside California. "
                "Reprojection likely failed. Check source CRS."
            )

        # ── Load ──────────────────────────────────────────────────────────────
        if source.source_type == "parcel_geojson":
            added, updated, skipped = _load_parcels(source, gdf)
        elif source.source_type == "zoning_shapefile":
            added, updated, skipped = _load_zones(source, gdf)
        else:
            raise ValueError(f"Unsupported source_type: {source.source_type}")

        run.status = "completed"
        run.records_added = added
        run.records_updated = updated
        run.records_skipped = skipped
        run.completed_at = timezone.now()
        run.save()

        log.info("ingestion_complete", added=added, updated=updated, skipped=skipped)

        # ── Queue tile regen ──────────────────────────────────────────────────
        if added + updated > 0:
            from django_q.tasks import async_task
            async_task(
                "django.core.management.call_command",
                "generate_tiles", source.jurisdiction_id,
                task_name=f"tiles_{source.jurisdiction_id}",
            )

    except Exception as e:
        run.status = "failed"
        run.error_message = str(e)
        run.completed_at = timezone.now()
        run.save()
        log.exception("ingestion_failed", error=str(e))
        raise

    finally:
        try:
            os.unlink(tmppath)
        except Exception:
            pass


# ── Alameda County Parcel field mapping ───────────────────────────────────────
# Adjust these to match actual column names in the downloaded file.
# Run: gdf.columns.tolist() to discover them.
PARCEL_FIELD_MAP = {
    "APN":       "apn",
    "SITEADDR":  "address",
    "OWNERNAME": "owner_name",
    "LOTSIZE":   "lot_size_sqft",
    "LANDUSE":   "land_use_code",
    "YEARBUILT": "year_built",
}

ZONE_FIELD_MAP = {
    "ZONE_CODE": "zone_code",
    "ZONE_NAME": "zone_name",
    "ZONE_TYPE": "zone_type",
    "DESCRIP":   "description",
}


def _load_parcels(source: Source, gdf: gpd.GeoDataFrame) -> tuple[int, int, int]:
    added = updated = skipped = 0
    known_fields = set(PARCEL_FIELD_MAP.keys()) | {"geometry"}

    for _, row in gdf.iterrows():
        apn = str(row.get("APN", "")).strip()
        if not apn:
            skipped += 1
            continue

        geom_wkt = row.geometry.wkt
        data_hash = sha256_wkb(row.geometry)

        extra_attrs = {
            k: v for k, v in row.items()
            if k not in known_fields and k != "geometry"
            and v is not None and str(v) != "nan"
        }

        _, created = Parcel.objects.update_or_create(
            source=source, apn=apn,
            defaults={
                "jurisdiction": source.jurisdiction,
                "address": str(row.get("SITEADDR", "") or ""),
                "owner_name": str(row.get("OWNERNAME", "") or ""),
                "lot_size_sqft": _safe_numeric(row.get("LOTSIZE")),
                "land_use_code": str(row.get("LANDUSE", "") or ""),
                "year_built": _safe_int(row.get("YEARBUILT")),
                "attributes": extra_attrs,
                "geom": geom_wkt,
                "source_crs": "EPSG:4326",
                "data_hash": data_hash,
            }
        )
        if created:
            added += 1
        else:
            updated += 1

    return added, updated, skipped


def _load_zones(source: Source, gdf: gpd.GeoDataFrame) -> tuple[int, int, int]:
    added = updated = skipped = 0
    from shapely.geometry import mapping
    import json

    for _, row in gdf.iterrows():
        zone_code = str(row.get("ZONE_CODE", "") or "").strip()
        if not zone_code:
            skipped += 1
            continue

        geom_wkt = row.geometry.wkt
        data_hash = sha256_wkb(row.geometry)

        _, created = Zone.objects.update_or_create(
            source=source, zone_code=zone_code,
            defaults={
                "jurisdiction": source.jurisdiction,
                "zone_name": str(row.get("ZONE_NAME", "") or ""),
                "zone_type": _normalize_zone_type(str(row.get("ZONE_TYPE", "") or "")),
                "description": str(row.get("DESCRIP", "") or ""),
                "geom": geom_wkt,
                "data_hash": data_hash,
            }
        )
        if created: added += 1
        else: updated += 1

    return added, updated, skipped


def _safe_numeric(val):
    try: return float(val) if val is not None else None
    except (ValueError, TypeError): return None

def _safe_int(val):
    try: return int(float(val)) if val is not None else None
    except (ValueError, TypeError): return None

def _normalize_zone_type(raw: str) -> str:
    raw_lower = raw.lower()
    if any(k in raw_lower for k in ["res", "single", "multi", "r-", "r1", "r2"]):
        return "residential"
    if any(k in raw_lower for k in ["com", "retail", "c-", "c1", "c2"]):
        return "commercial"
    if any(k in raw_lower for k in ["ind", "mfg", "light", "heavy", "m-"]):
        return "industrial"
    if any(k in raw_lower for k in ["mix", "mu", "overlay"]):
        return "mixed"
    if any(k in raw_lower for k in ["open", "park", "ag", "os"]):
        return "open_space"
    return "other"
```

### 5.4 LLM Abstraction Layer (complete, drop-in)

```python
# core/llm/base.py
from abc import ABC, abstractmethod
from dataclasses import dataclass, field

@dataclass
class LLMResponse:
    text: str
    model: str
    provider: str
    tokens_input: int = 0
    tokens_output: int = 0

@dataclass
class EmbeddingResponse:
    vector: list[float]
    model: str
    provider: str
    tokens: int = 0

class BaseLLMClient(ABC):
    provider_name: str = "unknown"

    @abstractmethod
    def complete(self, prompt: str, system: str = "",
                 max_tokens: int = 1000, **kwargs) -> LLMResponse: ...

class BaseEmbeddingClient(ABC):
    @abstractmethod
    def embed(self, text: str) -> EmbeddingResponse: ...
```

```python
# core/llm/providers/ollama.py
import httpx
from ..base import BaseLLMClient, BaseEmbeddingClient, LLMResponse, EmbeddingResponse

class OllamaLLMClient(BaseLLMClient):
    provider_name = "ollama"

    def __init__(self, base_url="http://localhost:11434", model="llama3.2"):
        self.base_url = base_url
        self.model = model

    def complete(self, prompt, system="", max_tokens=1000, **kwargs) -> LLMResponse:
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})
        r = httpx.post(f"{self.base_url}/v1/chat/completions",
                       json={"model": self.model, "messages": messages,
                             "max_tokens": max_tokens},
                       timeout=120)
        r.raise_for_status()
        d = r.json()
        u = d.get("usage", {})
        return LLMResponse(
            text=d["choices"][0]["message"]["content"],
            model=self.model, provider="ollama",
            tokens_input=u.get("prompt_tokens", 0),
            tokens_output=u.get("completion_tokens", 0),
        )

class OllamaEmbeddingClient(BaseEmbeddingClient):
    def __init__(self, base_url="http://localhost:11434", model="nomic-embed-text"):
        self.base_url = base_url
        self.model = model

    def embed(self, text: str) -> EmbeddingResponse:
        r = httpx.post(f"{self.base_url}/api/embed",
                       json={"model": self.model, "input": text}, timeout=30)
        r.raise_for_status()
        d = r.json()
        return EmbeddingResponse(vector=d["embeddings"][0],
                                 model=self.model, provider="ollama")
```

```python
# core/llm/providers/gemini.py
import httpx
from ..base import BaseLLMClient, BaseEmbeddingClient, LLMResponse, EmbeddingResponse

class GeminiLLMClient(BaseLLMClient):
    provider_name = "gemini"
    BASE = "https://generativelanguage.googleapis.com/v1beta"

    def __init__(self, api_key: str, model="gemini-1.5-flash"):
        self.api_key = api_key
        self.model = model

    def complete(self, prompt, system="", max_tokens=1000, **kwargs) -> LLMResponse:
        payload = {
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {"maxOutputTokens": max_tokens},
        }
        if system:
            payload["systemInstruction"] = {"parts": [{"text": system}]}
        r = httpx.post(
            f"{self.BASE}/models/{self.model}:generateContent?key={self.api_key}",
            json=payload, timeout=60)
        r.raise_for_status()
        d = r.json()
        u = d.get("usageMetadata", {})
        return LLMResponse(
            text=d["candidates"][0]["content"]["parts"][0]["text"],
            model=self.model, provider="gemini",
            tokens_input=u.get("promptTokenCount", 0),
            tokens_output=u.get("candidatesTokenCount", 0),
        )

class GeminiEmbeddingClient(BaseEmbeddingClient):
    BASE = "https://generativelanguage.googleapis.com/v1beta"

    def __init__(self, api_key: str, model="text-embedding-004"):
        self.api_key = api_key
        self.model = model

    def embed(self, text: str) -> EmbeddingResponse:
        r = httpx.post(
            f"{self.BASE}/models/{self.model}:embedContent?key={self.api_key}",
            json={"model": f"models/{self.model}",
                  "content": {"parts": [{"text": text}]}},
            timeout=30)
        r.raise_for_status()
        d = r.json()
        return EmbeddingResponse(vector=d["embedding"]["values"],
                                 model=self.model, provider="gemini")
```

```python
# core/llm/providers/groq.py
import httpx
from ..base import BaseLLMClient, LLMResponse

class GroqLLMClient(BaseLLMClient):
    provider_name = "groq"
    BASE = "https://api.groq.com/openai/v1"

    def __init__(self, api_key: str, model="llama-3.1-8b-instant"):
        self.api_key = api_key
        self.model = model

    def complete(self, prompt, system="", max_tokens=1000, **kwargs) -> LLMResponse:
        messages = []
        if system: messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})
        r = httpx.post(f"{self.BASE}/chat/completions",
                       headers={"Authorization": f"Bearer {self.api_key}"},
                       json={"model": self.model, "messages": messages,
                             "max_tokens": max_tokens},
                       timeout=30)
        r.raise_for_status()
        d = r.json()
        u = d.get("usage", {})
        return LLMResponse(text=d["choices"][0]["message"]["content"],
                           model=self.model, provider="groq",
                           tokens_input=u.get("prompt_tokens", 0),
                           tokens_output=u.get("completion_tokens", 0))
```

```python
# core/llm/factory.py
import os
from .base import BaseLLMClient, BaseEmbeddingClient

def get_llm_client() -> BaseLLMClient:
    provider = os.environ.get("LLM_PROVIDER", "ollama")
    if provider == "ollama":
        from .providers.ollama import OllamaLLMClient
        return OllamaLLMClient(
            base_url=os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434"),
            model=os.environ.get("OLLAMA_MODEL", "llama3.2"),
        )
    elif provider == "gemini":
        from .providers.gemini import GeminiLLMClient
        return GeminiLLMClient(api_key=os.environ["GEMINI_API_KEY"],
                               model=os.environ.get("GEMINI_MODEL", "gemini-1.5-flash"))
    elif provider == "groq":
        from .providers.groq import GroqLLMClient
        return GroqLLMClient(api_key=os.environ["GROQ_API_KEY"],
                             model=os.environ.get("GROQ_MODEL", "llama-3.1-8b-instant"))
    raise ValueError(f"Unknown LLM_PROVIDER: {provider}")

def get_embedding_client() -> BaseEmbeddingClient:
    provider = os.environ.get("EMBEDDING_PROVIDER", "ollama")
    if provider == "ollama":
        from .providers.ollama import OllamaEmbeddingClient
        return OllamaEmbeddingClient(
            base_url=os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434"),
            model=os.environ.get("OLLAMA_EMBED_MODEL", "nomic-embed-text"),
        )
    elif provider == "gemini":
        from .providers.gemini import GeminiEmbeddingClient
        return GeminiEmbeddingClient(api_key=os.environ["GEMINI_API_KEY"])
    raise ValueError(f"Unknown EMBEDDING_PROVIDER: {provider}")
```

```python
# core/llm/embedding_config.py
"""
Canonical embedding model — ONE model per environment.
Never mix models without running rebuild_embeddings.
"""
import os
from .embedding_registry import get_dimension

def get_canonical_model() -> str:
    provider = os.environ.get("EMBEDDING_PROVIDER", "ollama")
    if provider == "ollama":
        return os.environ.get("OLLAMA_EMBED_MODEL", "nomic-embed-text")
    elif provider == "gemini":
        return os.environ.get("GEMINI_EMBED_MODEL", "text-embedding-004")
    raise ValueError(f"Unknown EMBEDDING_PROVIDER: {provider}")

def get_canonical_dimension() -> int:
    dim_env = os.environ.get("EMBEDDING_DIM")
    if dim_env:
        return int(dim_env)
    return get_dimension(get_canonical_model())

def get_vector_table() -> str:
    return f"gis_vec_{get_canonical_dimension()}"

def assert_model_compatibility(model_name: str) -> None:
    """Reject writes from a model with a different dimension than active config."""
    canonical = get_canonical_model()
    if model_name == canonical:
        return
    expected_dim = get_canonical_dimension()
    incoming_dim = get_dimension(model_name)
    if incoming_dim != expected_dim:
        raise RuntimeError(
            f"Embedding dimension conflict: active model '{canonical}' "
            f"uses {expected_dim}d, but '{model_name}' uses {incoming_dim}d. "
            "Run: python manage.py rebuild_embeddings --confirm to switch."
        )
```

```python
# core/llm/embedding_registry.py
EMBEDDING_DIMENSIONS: dict[str, int] = {
    "nomic-embed-text": 768,
    "mxbai-embed-large": 1024,
    "all-minilm": 384,
    "snowflake-arctic-embed": 1024,
    "text-embedding-004": 768,   # Gemini
    "embedding-001": 768,        # Gemini legacy
    "text-embedding-3-small": 1536,
    "text-embedding-3-large": 3072,
    "text-embedding-ada-002": 1536,
}

def get_dimension(model_name: str) -> int:
    key = model_name.split("/")[-1].lower()
    if key in EMBEDDING_DIMENSIONS:
        return EMBEDDING_DIMENSIONS[key]
    raise ValueError(
        f"Unknown embedding model '{model_name}'. "
        f"Add it to EMBEDDING_DIMENSIONS in embedding_registry.py."
    )
```

### 5.5 Vector Store (complete)

```python
# gis/ai/vector_store.py
import json, structlog
from django.db import connection
from core.llm.factory import get_embedding_client
from core.llm.embedding_config import (
    get_canonical_model, get_vector_table,
    get_canonical_dimension, assert_model_compatibility,
)
from ..models import DocumentChunk

logger = structlog.get_logger()


def ensure_vector_table() -> str:
    table = get_vector_table()
    dim = get_canonical_dimension()
    with connection.cursor() as c:
        c.execute("CREATE EXTENSION IF NOT EXISTS vector;")
        c.execute(f"""
            CREATE TABLE IF NOT EXISTS {table} (
                chunk_id  BIGINT PRIMARY KEY
                          REFERENCES document_chunks(id) ON DELETE CASCADE,
                embedding vector({dim}) NOT NULL,
                model     TEXT NOT NULL
            );
        """)
        c.execute(f"""
            CREATE INDEX IF NOT EXISTS idx_{table}_hnsw
            ON {table} USING hnsw(embedding vector_cosine_ops)
            WITH (m = 16, ef_construction = 64);
        """)
    return table


def store_embedding(chunk: DocumentChunk, vector: list[float],
                    model_name: str) -> None:
    assert_model_compatibility(model_name)
    dim = get_canonical_dimension()
    if len(vector) != dim:
        raise ValueError(f"Vector is {len(vector)}d, expected {dim}d")
    table = ensure_vector_table()
    with connection.cursor() as c:
        c.execute(f"""
            INSERT INTO {table} (chunk_id, embedding, model)
            VALUES (%s, %s::vector, %s)
            ON CONFLICT (chunk_id) DO UPDATE
                SET embedding = EXCLUDED.embedding, model = EXCLUDED.model;
        """, [chunk.id, json.dumps(vector), model_name])
    chunk.embedding_model = model_name
    chunk.embedding_dim = dim
    chunk.save(update_fields=["embedding_model", "embedding_dim"])


def similarity_search(query_vector: list[float], jurisdiction_id: int,
                      limit: int = 5) -> list[dict]:
    expected_dim = get_canonical_dimension()
    if len(query_vector) != expected_dim:
        raise ValueError(
            f"Query vector is {len(query_vector)}d; expected {expected_dim}d. "
            "Check EMBEDDING_PROVIDER / OLLAMA_EMBED_MODEL env vars."
        )
    table = get_vector_table()
    with connection.cursor() as c:
        c.execute(f"""
            SELECT
                dc.id           AS chunk_id,
                dc.chunk_text,
                dc.char_start,
                dp.page_number,
                d.filename,
                d.id            AS doc_id,
                1 - (v.embedding <=> %s::vector) AS similarity
            FROM {table} v
            JOIN document_chunks dc ON dc.id  = v.chunk_id
            JOIN document_pages  dp ON dp.id  = dc.page_id
            JOIN documents        d ON  d.id  = dc.document_id
            JOIN sources          s ON  s.id  = d.source_id
            WHERE s.jurisdiction_id = %s
            ORDER BY v.embedding <=> %s::vector
            LIMIT %s
        """, [json.dumps(query_vector), jurisdiction_id,
               json.dumps(query_vector), limit])
        cols = [desc[0] for desc in c.description]
        return [dict(zip(cols, row)) for row in c.fetchall()]


def embed_chunks(chunks: list[DocumentChunk]) -> int:
    model_name = get_canonical_model()
    client = get_embedding_client()
    ensure_vector_table()
    canon_dim = get_canonical_dimension()
    embedded = 0
    for chunk in chunks:
        if chunk.embedding_model == model_name and chunk.embedding_dim == canon_dim:
            continue
        try:
            response = client.embed(chunk.chunk_text)
            store_embedding(chunk, response.vector, model_name)
            embedded += 1
        except Exception as e:
            logger.error("embed_chunk_failed",
                         chunk_id=chunk.id, model=model_name, error=str(e))
    logger.info("embedding_batch_complete", model=model_name,
                embedded=embedded, skipped=len(chunks) - embedded)
    return embedded
```

### 5.6 Cloud Deployment Day-1 (14:30–17:00)

```dockerfile
# backend/Dockerfile
FROM python:3.12-slim

RUN apt-get update && apt-get install -y \
    gdal-bin libgdal-dev libgeos-dev libproj-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
ENV PYTHONUNBUFFERED=1 GDAL_DATA=/usr/share/gdal

RUN python manage.py collectstatic --noinput

CMD ["gunicorn", "core.wsgi:application", \
     "--bind", "0.0.0.0:$PORT", "--workers", "2", "--timeout", "120"]
```

```toml
# railway.toml
[build]
builder = "DOCKERFILE"
dockerfilePath = "backend/Dockerfile"

[[services]]
name = "web"
startCommand = "gunicorn core.wsgi:application --bind 0.0.0.0:$PORT --workers 2"

[[services]]
name = "worker"
startCommand = "python manage.py qcluster"

[[services]]
name = "tile-cron"
cronSchedule = "0 2 * * *"
startCommand = "python manage.py generate_tiles_all"
```

**Step-by-step deploy:**
```bash
# 1. Supabase
# Go to supabase.com → New project → note DATABASE_URL
# SQL editor: CREATE EXTENSION postgis; CREATE EXTENSION vector;

# 2. Railway
# railway login
# railway new parcelmap
# railway link parcelmap

# 3. Set env vars (Railway dashboard → Variables)
# DATABASE_URL=<supabase connection string>
# SECRET_KEY=$(python -c "import secrets; print(secrets.token_hex(32))")
# ALLOWED_HOSTS=<your-app>.railway.app
# CORS_ALLOWED_ORIGINS=https://<your-frontend>.vercel.app
# LLM_PROVIDER=ollama  (or gemini for production)
# EMBEDDING_PROVIDER=ollama
# EMBEDDING_DIM=768
# ... all other vars from .env.example

# 4. Deploy
git push origin main   # Railway auto-deploys on push

# 5. Run migrations
railway run python manage.py migrate
railway run python manage.py createsuperuser

# 6. Frontend: Vercel
cd frontend && npm run build
# In Vercel dashboard: New Project → import from GitHub → set:
# Build command: npm run build
# Output dir: dist
# Env var: VITE_API_URL=https://<your-app>.railway.app/api

# 7. Seed pilot data (Railway shell)
railway run python manage.py shell << 'EOF'
from gis.models import Jurisdiction, Source
j = Jurisdiction.objects.create(
    name="Fremont", county="Alameda", slug="fremont"
)
Source.objects.create(
    jurisdiction=j,
    name="Alameda County Parcels",
    source_type="parcel_geojson",
    url="https://opendata.acgov.org/datasets/alameda-county-parcels.geojson"
)
print("Created. Go to /admin/ to trigger ingestion.")
EOF
```

### 5.7 React + MapLibre Frontend (Day-1)

```bash
cd frontend
npm create vite@latest . -- --template react-ts
npm install maplibre-gl pmtiles @types/maplibre-gl tailwindcss
npx tailwindcss init
```

```tsx
// src/App.tsx
import { useRef, useEffect, useState, useCallback } from "react";
import maplibregl from "maplibre-gl";
import { Protocol } from "pmtiles";
import "maplibre-gl/dist/maplibre-gl.css";
import { AIPanel } from "./components/AIPanel";
import { DetailPanel } from "./components/DetailPanel";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000/api";
const USE_PMTILES = import.meta.env.VITE_USE_PMTILES === "true";
const TILES_URL = import.meta.env.VITE_TILES_URL || "";

// Register PMTiles protocol globally (noop if not using PMTiles)
if (USE_PMTILES) {
  const protocol = new Protocol();
  maplibregl.addProtocol("pmtiles", protocol.tile);
}

interface SearchResult {
  type: string; id: number; label: string;
  jurisdiction: string; lng: number; lat: number;
}

interface DetailData { type: "parcel" | "zone"; data: Record<string, unknown>; }

export default function App() {
  const mapRef = useRef<maplibregl.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<DetailData | null>(null);
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showParcels, setShowParcels] = useState(true);
  const [showZones, setShowZones] = useState(true);
  const [jurisdictionId, setJurisdictionId] = useState<number>(1);

  const fetchGeoJSON = useCallback(async (map: maplibregl.Map) => {
    if (USE_PMTILES) return;  // PMTiles: no bbox fetching needed
    const zoom = map.getZoom();
    const bounds = map.getBounds();
    const bbox = `${bounds.getWest()},${bounds.getSouth()},${bounds.getEast()},${bounds.getNorth()}`;

    if (zoom >= 12) {
      const r = await fetch(`${API}/parcels/?bbox=${bbox}&jurisdiction_id=${jurisdictionId}`);
      const data = await r.json();
      (map.getSource("parcels") as maplibregl.GeoJSONSource)?.setData(data);
    } else {
      (map.getSource("parcels") as maplibregl.GeoJSONSource)?.setData(
        { type: "FeatureCollection", features: [] }
      );
    }

    if (zoom >= 9) {
      const r = await fetch(`${API}/zones/?bbox=${bbox}&jurisdiction_id=${jurisdictionId}`);
      const data = await r.json();
      (map.getSource("zones") as maplibregl.GeoJSONSource)?.setData(data);
    }
  }, [jurisdictionId]);

  useEffect(() => {
    const map = new maplibregl.Map({
      container: containerRef.current!,
      style: "https://demotiles.maplibre.org/style.json",
      center: [-121.9886, 37.5485],   // Fremont, CA
      zoom: 12,
    });
    mapRef.current = map;

    map.on("load", () => {
      if (USE_PMTILES && TILES_URL) {
        // PMTiles sources
        map.addSource("parcels", {
          type: "vector",
          url: `pmtiles://${TILES_URL}/tiles/fremont/parcels.pmtiles`,
        });
        map.addSource("zones", {
          type: "vector",
          url: `pmtiles://${TILES_URL}/tiles/fremont/zones.pmtiles`,
        });
      } else {
        // GeoJSON sources (Day-1)
        map.addSource("parcels", { type: "geojson",
          data: { type: "FeatureCollection", features: [] } });
        map.addSource("zones", { type: "geojson",
          data: { type: "FeatureCollection", features: [] } });
      }

      const sourceLayer = (name: string) =>
        USE_PMTILES ? { "source-layer": name } : {};

      map.addLayer({ id: "zones-fill", type: "fill",
        source: "zones", ...sourceLayer("zones"), minzoom: 9,
        paint: {
          "fill-color": ["match", ["get", "zone_type"],
            "residential", "#4CAF50", "commercial", "#2196F3",
            "industrial", "#FF5722", "mixed", "#9C27B0", "#aaa"],
          "fill-opacity": 0.3,
        }
      });
      map.addLayer({ id: "zones-outline", type: "line",
        source: "zones", ...sourceLayer("zones"), minzoom: 9,
        paint: { "line-color": "#555", "line-width": 1 }
      });
      map.addLayer({ id: "parcels-fill", type: "fill",
        source: "parcels", ...sourceLayer("parcels"), minzoom: 12,
        paint: { "fill-color": "#FFD700", "fill-opacity": 0.15 }
      });
      map.addLayer({ id: "parcels-outline", type: "line",
        source: "parcels", ...sourceLayer("parcels"), minzoom: 12,
        paint: { "line-color": "#B8860B", "line-width": 0.8 }
      });

      // Click handlers
      map.on("click", "parcels-fill", async (e) => {
        const feat = e.features?.[0];
        if (!feat) return;
        const r = await fetch(`${API}/parcels/${feat.properties?.id}/`);
        const data = await r.json();
        setSelected({ type: "parcel", data: data.properties });
      });

      map.on("click", "zones-fill", async (e) => {
        const feat = e.features?.[0];
        if (!feat) return;
        const r = await fetch(`${API}/zones/${feat.properties?.id}/`);
        const data = await r.json();
        setSelected({ type: "zone", data: data.properties });
      });

      ["parcels-fill", "zones-fill"].forEach(id => {
        map.on("mouseenter", id, () => { map.getCanvas().style.cursor = "pointer"; });
        map.on("mouseleave", id, () => { map.getCanvas().style.cursor = ""; });
      });

      if (!USE_PMTILES) {
        map.on("moveend", () => fetchGeoJSON(map));
        fetchGeoJSON(map);
      }
    });

    return () => map.remove();
  }, [fetchGeoJSON]);

  // Layer visibility toggles
  const toggleLayer = (layerIds: string[], visible: boolean) => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    layerIds.forEach(id => {
      if (map.getLayer(id))
        map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
    });
  };

  const handleSearch = async () => {
    if (!searchQ.trim()) return;
    const r = await fetch(`${API}/search/?q=${encodeURIComponent(searchQ)}`);
    const data = await r.json();
    setSearchResults(data.results);
  };

  return (
    <div className="flex h-screen bg-gray-900 text-white">
      {/* Sidebar */}
      <div className="w-80 flex flex-col bg-gray-800 border-r border-gray-700 z-10 overflow-y-auto">
        <div className="p-4 border-b border-gray-700">
          <h1 className="text-lg font-bold text-yellow-400">🗺 CA Parcel Map</h1>
          <div className="mt-3 flex gap-2">
            <input className="flex-1 bg-gray-700 rounded px-3 py-2 text-sm"
              placeholder="APN or address..." value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSearch()} />
            <button className="bg-yellow-400 text-gray-900 px-3 py-2 rounded text-sm font-medium"
              onClick={handleSearch}>Go</button>
          </div>
          {searchResults.length > 0 && (
            <div className="mt-2 bg-gray-700 rounded overflow-hidden">
              {searchResults.map(r => (
                <button key={r.id}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-600 border-b border-gray-600"
                  onClick={() => {
                    mapRef.current?.flyTo({ center: [r.lng, r.lat], zoom: 16 });
                    setSearchResults([]);
                  }}>
                  {r.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Layer toggles */}
        <div className="p-4 border-b border-gray-700">
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Layers</p>
          <label className="flex items-center gap-2 cursor-pointer mb-2">
            <input type="checkbox" checked={showParcels}
              onChange={e => { setShowParcels(e.target.checked);
                toggleLayer(["parcels-fill","parcels-outline"], e.target.checked); }} />
            <span className="text-sm">Parcels</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={showZones}
              onChange={e => { setShowZones(e.target.checked);
                toggleLayer(["zones-fill","zones-outline"], e.target.checked); }} />
            <span className="text-sm">Zoning</span>
          </label>
        </div>

        {/* Detail + AI panels */}
        {selected && (
          <DetailPanel selected={selected} onClose={() => setSelected(null)} />
        )}
        <AIPanel jurisdictionId={jurisdictionId} />
      </div>

      <div ref={containerRef} className="flex-1" />
    </div>
  );
}
```
---

## Section 6 — AI Features (Incremental, Safe, Useful)

### 6.1 Prompt Templates (versioned, enforced)

```python
# gis/ai/prompts.py
"""
All LLM prompts in one registry.
Version string format: {task}_{v}  e.g. extract_zoning_rules_v1
Increment version when prompt text changes — old cached responses remain valid.
"""

PROMPTS: dict[str, dict] = {

    "extract_zoning_rules_v1": {
        "version": "extract_zoning_rules_v1",
        "system": (
            "You are a zoning code parser. Extract specific rules from municipal zoning text.\n"
            "Rules:\n"
            "1. NEVER invent values not present in the provided text.\n"
            "2. EVERY value MUST include the exact sentence it came from as quote_snippet.\n"
            "3. If a value is absent from the text, OMIT that field entirely — do not output null.\n"
            "4. confidence: 1.0=exact numeric, 0.7=inferred from context, 0.5=ambiguous.\n"
            "   Do not return rules with confidence below 0.5.\n"
            "5. Return ONLY valid JSON. No preamble, no markdown fences."
        ),
        "template": (
            "Page {page_number} of '{filename}':\n\n{page_text}\n\n"
            "Extract all zoning rules on this page. Return JSON:\n"
            '{{"zone_code":"string or null","rules":['
            '{{"field_name":"max_height_ft|min_lot_size_sqft|max_lot_coverage_pct|'
            'setback_front_ft|setback_rear_ft|setback_side_ft|'
            'parking_spaces_per_unit|allowed_uses|special_overlays|floor_area_ratio",'
            '"raw_value":"as written","numeric_value":number_or_omit,'
            '"list_value":[]_or_omit,"quote_snippet":"exact sentence (required)",'
            '"confidence":0.5_to_1.0}}]}}'
        ),
    },

    "summarize_document_v1": {
        "version": "summarize_document_v1",
        "system": (
            "You are a municipal planning analyst. Summarize only from provided text.\n"
            "Every bullet point MUST cite its page number as [p.N].\n"
            "Never write a bullet without a citation. Never invent content."
        ),
        "template": (
            "Summarize this zoning document. Cite page for each restriction: [p.N]\n\n"
            "Pages:\n{pages_text}\n\n"
            "Return JSON only:\n"
            '{{"summary":"2-3 sentence overview",'
            '"key_restrictions":[{{"text":"...","page":N}}],'
            '"zones_mentioned":["list"],'
            '"document_type":"zoning_code|general_plan|overlay|amendment|other"}}'
        ),
    },

    "answer_question_rag_v1": {
        "version": "answer_question_rag_v1",
        "system": (
            "Answer questions about zoning using ONLY the provided context.\n"
            "1. Cite every factual claim: [filename, p.N]\n"
            "2. If context lacks the answer, say exactly: "
            "   'The provided documents do not contain information about this.'\n"
            "3. Never speculate or add information not in context.\n"
            "4. If sources contradict each other, state the contradiction and cite both."
        ),
        "template": (
            "Context:\n\n{context}\n\n---\n"
            "Question: {question}\n\n"
            "Answer with citations [filename, p.N] for every factual claim:"
        ),
    },

    "quality_check_v1": {
        "version": "quality_check_v1",
        "system": "You are a GIS data quality analyst. Explain real problems clearly.",
        "template": (
            "Analyze these GIS data quality issues:\n\n{issues_json}\n\n"
            "For each issue return JSON array:\n"
            '[{{"type":"...","explanation":"plain English",'
            '"likely_cause":"specific","recommended_fix":"exact steps",'
            '"severity":"critical|major|minor"}}]'
        ),
    },

    "debug_ingestion_v1": {
        "version": "debug_ingestion_v1",
        "system": "You are a Django + GeoPandas debugging expert.",
        "template": (
            "Ingestion failed.\n"
            "Error: {error_message}\n"
            "Log: {log_excerpt}\n"
            "Source type: {source_type}\nURL: {source_url}\n\n"
            "Diagnose:\n"
            "1. Root cause (specific function/line if possible)\n"
            "2. Data issue or code bug?\n"
            "3. Exact fix (code if applicable)\n"
            "4. Verification query/command\n"
            "5. Prevention"
        ),
    },
}
```

### 6.2 Document Intelligence Pipeline

```python
# gis/ai/extraction_pipeline.py
import json, re, time
import pdfplumber
from bs4 import BeautifulSoup
import structlog
from ..models import (Document, DocumentPage, DocumentChunk,
                      ZoningRule, Extraction, RuleProvenance)
from .prompts import PROMPTS
from .quota import cached_llm_call, QuotaExceeded
from .vector_store import embed_chunks

logger = structlog.get_logger()

CHUNK_SIZE_CHARS = 1500
CHUNK_OVERLAP_CHARS = 150
MIN_CHUNK_CHARS = 100


# ── Page Extraction ────────────────────────────────────────────────────────────

def extract_pages_from_pdf(filepath: str, document: Document) -> list[DocumentPage]:
    pages = []
    with pdfplumber.open(filepath) as pdf:
        for i, page in enumerate(pdf.pages):
            text = (page.extract_text() or "").strip()
            has_tables = bool(page.extract_tables())
            dp, _ = DocumentPage.objects.update_or_create(
                document=document, page_number=i + 1,
                defaults={
                    "raw_text": text, "char_count": len(text),
                    "has_tables": has_tables, "has_images": False,
                    "extraction_method": "pdfplumber",
                }
            )
            pages.append(dp)
    return pages


def extract_sections_from_html(html: str, document: Document) -> list[DocumentPage]:
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "nav", "footer", "header"]):
        tag.decompose()

    sections, current_title, current_text = [], "Preamble", []
    for el in soup.find_all(["h2", "h3", "p", "li", "td"]):
        if el.name in ["h2", "h3"]:
            if current_text:
                sections.append((current_title, " ".join(current_text).strip()))
            current_title, current_text = el.get_text(strip=True), []
        else:
            t = el.get_text(strip=True)
            if t: current_text.append(t)
    if current_text:
        sections.append((current_title, " ".join(current_text).strip()))

    pages = []
    for i, (title, text) in enumerate(sections):
        dp, _ = DocumentPage.objects.update_or_create(
            document=document, page_number=i + 1,
            defaults={"raw_text": f"[{title}]\n{text}", "char_count": len(text),
                      "extraction_method": "html_section"}
        )
        pages.append(dp)
    return pages


# ── Chunking ───────────────────────────────────────────────────────────────────

def _split_page(page: DocumentPage):
    text = page.raw_text
    if len(text) < MIN_CHUNK_CHARS or page.has_tables:
        yield {"chunk_text": text, "char_start": 0, "char_end": len(text)}
        return
    start = 0
    while start < len(text):
        end = min(start + CHUNK_SIZE_CHARS, len(text))
        if end < len(text):
            boundary = max(text.rfind(". ", start, end), text.rfind("\n", start, end))
            if boundary > start + MIN_CHUNK_CHARS:
                end = boundary + 1
        chunk = text[start:end].strip()
        if chunk:
            yield {"chunk_text": chunk, "char_start": start, "char_end": end}
        start = max(end - CHUNK_OVERLAP_CHARS, end)


def chunk_document_pages(document: Document,
                          pages: list[DocumentPage]) -> list[DocumentChunk]:
    DocumentChunk.objects.filter(document=document).delete()
    chunks, global_idx = [], 0
    for page in pages:
        if not page.raw_text.strip():
            continue
        for cd in _split_page(page):
            chunk = DocumentChunk.objects.create(
                document=document, page=page, chunk_index=global_idx,
                chunk_text=cd["chunk_text"],
                char_start=cd["char_start"], char_end=cd["char_end"],
            )
            chunks.append(chunk)
            global_idx += 1
    return chunks


def process_pdf_document(document: Document, filepath: str) -> list[DocumentChunk]:
    """Pages → chunks → return chunks (caller embeds)."""
    pages = extract_pages_from_pdf(filepath, document)
    return chunk_document_pages(document, pages)


# ── Citation Enforcement (deterministic, not LLM) ─────────────────────────────

def _enforce_citations(rules: list[dict], page_text: str) -> list[dict]:
    """
    Verify every rule has a quote_snippet present in page_text.
    Marks rules citation_valid=True/False. Never deletes rules.
    """
    for rule in rules:
        snippet = rule.get("quote_snippet", "").strip()
        errors = []
        if not snippet:
            errors.append("missing_quote_snippet")
        elif len(snippet) < 10:
            errors.append("quote_snippet_too_short")
        elif snippet[:30].lower() not in page_text.lower():
            errors.append("quote_snippet_not_found_in_page")
        conf = rule.get("confidence", 0)
        if not isinstance(conf, (int, float)) or not (0.5 <= float(conf) <= 1.0):
            errors.append(f"confidence_out_of_range:{conf}")
        rule["citation_valid"] = len(errors) == 0
        rule["citation_errors"] = errors
    return rules


# ── LLM Extraction Per Page ────────────────────────────────────────────────────

def extract_fields_per_page(document: Document,
                             context: str = "worker") -> list[Extraction]:
    pages = document.pages.all().order_by("page_number")
    created = []
    cfg = PROMPTS["extract_zoning_rules_v1"]

    for page in pages:
        if len(page.raw_text.strip()) < 50:
            continue
        prompt = cfg["template"].format(
            page_number=page.page_number,
            filename=document.filename,
            page_text=page.raw_text[:3000],
        )
        try:
            result, _ = cached_llm_call(
                task_type="extract", prompt=prompt,
                system=cfg["system"], prompt_version=cfg["version"],
                max_tokens=1200, document=document, context=context,
            )
        except QuotaExceeded:
            logger.warning("quota_exceeded_extraction",
                           doc_id=document.id, page=page.page_number)
            break
        except Exception as e:
            logger.error("extraction_llm_failed",
                         doc_id=document.id, page=page.page_number, error=str(e))
            continue

        try:
            data = json.loads(result["text"])
        except json.JSONDecodeError:
            logger.warning("extraction_json_failed",
                           doc_id=document.id, page=page.page_number,
                           raw=result["text"][:200])
            continue

        rules = _enforce_citations(data.get("rules", []), page.raw_text)
        zone_code = data.get("zone_code") or ""

        for rule in rules:
            status = "valid" if rule["citation_valid"] else "invalid_citation"
            ext = Extraction.objects.create(
                document=document,
                page_number=page.page_number,
                chunk=_find_chunk(page, rule.get("quote_snippet", "")),
                field_name=rule.get("field_name", "unknown"),
                raw_value=str(rule.get("raw_value", "")),
                zone_code=zone_code,
                quote_snippet=rule.get("quote_snippet", ""),
                confidence=min(max(float(rule.get("confidence", 0.5)), 0), 1),
                model=result["model"], provider=result["provider"],
                prompt_version=cfg["version"],
                validation_status=status,
                validation_error="; ".join(rule.get("citation_errors", [])),
            )
            created.append(ext)

    logger.info("extraction_complete", doc_id=document.id,
                total=len(created),
                valid=sum(1 for e in created if e.validation_status == "valid"))
    return created


def _find_chunk(page: DocumentPage, snippet: str):
    if not snippet:
        return None
    first30 = snippet[:30].lower()
    for chunk in page.chunks.all():
        if first30 in chunk.chunk_text.lower():
            return chunk
    return None


# ── Propose Rules (deterministic) ─────────────────────────────────────────────

def propose_rules_from_extractions(document: Document) -> list[ZoningRule]:
    valid_exts = (Extraction.objects.filter(
        document=document, validation_status="valid", confidence__gte=0.6
    ).order_by("-confidence"))

    best: dict[tuple, Extraction] = {}
    for ext in valid_exts:
        key = (ext.zone_code, ext.field_name)
        if key not in best:
            best[key] = ext

    proposed = []
    for (zone_code, field_name), ext in best.items():
        if not zone_code:
            continue
        rule, _ = ZoningRule.objects.update_or_create(
            jurisdiction=document.source.jurisdiction,
            zone_code=zone_code, rule_type=field_name,
            defaults={"value_text": ext.raw_value,
                      "review_status": "pending",   # NEVER auto-approve
                      "source_extraction_id": ext.id},
        )
        _populate_rule_value(rule, ext)
        RuleProvenance.objects.get_or_create(
            rule=rule, extraction=ext, defaults={"is_primary": True}
        )
        proposed.append(rule)

    return proposed


def _populate_rule_value(rule: ZoningRule, ext: Extraction):
    numeric_fields = {
        "max_height_ft", "min_lot_size_sqft", "max_lot_coverage_pct",
        "setback_front_ft", "setback_rear_ft", "setback_side_ft",
        "parking_spaces_per_unit", "floor_area_ratio",
    }
    if rule.rule_type in numeric_fields:
        nums = re.findall(r"\d+\.?\d*", ext.raw_value)
        if nums: rule.value_numeric = float(nums[0])
    elif rule.rule_type in {"allowed_uses", "special_overlays"}:
        try: rule.value_list = json.loads(ext.raw_value)
        except json.JSONDecodeError:
            rule.value_list = [x.strip() for x in ext.raw_value.split(",") if x.strip()]
    rule.save(update_fields=["value_text", "value_numeric", "value_list",
                              "review_status", "source_extraction_id"])
```

### 6.3 RAG Q&A

```python
# gis/ai/rag.py
import structlog
from .vector_store import similarity_search
from .quota import cached_llm_call, QuotaExceeded
from .prompts import PROMPTS
from core.llm.factory import get_embedding_client

logger = structlog.get_logger()


def answer_question(question: str, jurisdiction_id: int,
                    context: str = "user") -> dict:
    """
    Full RAG: embed question → vector search → build context → LLM answer.
    Always returns citations with page numbers.
    """
    emb_client = get_embedding_client()
    q_emb = emb_client.embed(question)

    rows = similarity_search(q_emb.vector, jurisdiction_id, limit=5)

    if not rows:
        return {
            "answer": "No zoning documents have been indexed for this jurisdiction yet.",
            "sources": [], "confidence": 0.0,
        }

    context_parts = []
    sources = []
    for row in rows:
        citation = f"[{row['filename']}, p.{row['page_number'] or '?'}]"
        context_parts.append(f"{citation}\n{row['chunk_text']}")
        sources.append({
            "filename": row["filename"],
            "page": row["page_number"],
            "doc_id": row["doc_id"],
            "chunk_id": row["chunk_id"],
            "similarity": round(float(row["similarity"]), 3),
        })

    cfg = PROMPTS["answer_question_rag_v1"]
    prompt = cfg["template"].format(
        context="\n\n---\n\n".join(context_parts),
        question=question,
    )

    try:
        result, from_cache = cached_llm_call(
            task_type="rag", prompt=prompt, system=cfg["system"],
            prompt_version=cfg["version"], max_tokens=800, context=context,
        )
    except QuotaExceeded:
        return {"answer": "AI quota exceeded. Try again tomorrow.", "sources": []}

    avg_sim = sum(r["similarity"] for r in sources) / len(sources)
    return {
        "answer": result["text"],
        "sources": sources,
        "confidence": round(avg_sim, 3),
        "model": result["model"],
        "provider": result["provider"],
        "from_cache": from_cache,
    }
```

### 6.4 Quota + Cache (complete, corrected)

```python
# gis/ai/quota.py
import hashlib, json, os, time
import structlog
from datetime import date, timedelta
from django.db.models import Sum, Count
from django.utils import timezone

logger = structlog.get_logger()


class QuotaExceeded(Exception):
    pass


DEFAULT_DAILY_CAPS: dict[str, int] = {
    "ollama": 10_000_000,
    "gemini": 900_000,
    "groq": 100_000,
    "openrouter": 50_000,
}

# These tasks must never run from user HTTP requests
OFFLINE_ONLY_TASKS = {"extract", "summarize", "quality"}


def _get_daily_cap(provider: str) -> int:
    return int(os.environ.get(
        f"AI_DAILY_CAP_{provider.upper()}",
        DEFAULT_DAILY_CAPS.get(provider, 50_000)
    ))


def _compute_input_hash(provider: str, model: str,
                        prompt_version: str, prompt: str) -> str:
    payload = json.dumps(
        {"p": provider, "m": model, "pv": prompt_version, "i": prompt},
        ensure_ascii=True, sort_keys=True,
    )
    return hashlib.sha256(payload.encode()).hexdigest()


def check_cache(input_hash: str):
    from ..models import AIRun
    cutoff = timezone.now() - timedelta(days=7)
    return (
        AIRun.objects
        .filter(input_hash=input_hash, error="", created_at__gte=cutoff)
        .order_by("-created_at")
        .first()
    )


def check_quota(provider: str, estimated_tokens: int = 1500) -> None:
    from ..models import AIRun
    cap = _get_daily_cap(provider)
    if cap <= 0:
        return
    today = date.today()
    agg = AIRun.objects.filter(
        provider=provider, created_at__date=today
    ).aggregate(total_in=Sum("tokens_input"), total_out=Sum("tokens_output"))
    used = (agg["total_in"] or 0) + (agg["total_out"] or 0)
    if used + estimated_tokens > cap:
        raise QuotaExceeded(
            f"Daily token quota exceeded for '{provider}': "
            f"{used:,}/{cap:,} used. Resets midnight UTC."
        )
    if used > cap * 0.9:
        logger.warning("quota_near_limit", provider=provider,
                       used=used, cap=cap, pct=round(used/cap*100, 1))


def assert_offline_task(task_type: str, context: str) -> None:
    if task_type in OFFLINE_ONLY_TASKS and context not in ("admin", "worker", "management"):
        raise RuntimeError(
            f"Task '{task_type}' is offline-only. "
            f"Cannot run from context '{context}'."
        )


def cached_llm_call(
    task_type: str, prompt: str, system: str,
    prompt_version: str, max_tokens: int = 800,
    document=None, ingestion_run=None, context: str = "unknown",
) -> tuple[dict, bool]:
    from ..models import AIRun
    from core.llm.factory import get_llm_client

    assert_offline_task(task_type, context)

    llm = get_llm_client()
    provider = llm.provider_name
    model = getattr(llm, "model", "unknown")
    input_hash = _compute_input_hash(provider, model, prompt_version, prompt)

    # Cache check
    cached = check_cache(input_hash)
    if cached:
        logger.info("cache_hit", task=task_type, hash=input_hash[:12])
        # Log zero-token cache hit for budget tracking
        AIRun.objects.create(
            task_type=task_type, provider=provider, model=model,
            prompt_version=prompt_version, source_document=document,
            tokens_input=0, tokens_output=0,
            input_hash=input_hash, output_text=cached.output_text,
        )
        return {"text": cached.output_text, "provider": provider,
                "model": model, "tokens_input": 0, "tokens_output": 0}, True

    # Quota check
    check_quota(provider, estimated_tokens=max_tokens + 500)

    # LLM call
    t0 = time.time()
    response = llm.complete(prompt=prompt, system=system, max_tokens=max_tokens)
    duration_ms = int((time.time() - t0) * 1000)

    AIRun.objects.create(
        task_type=task_type, provider=response.provider, model=response.model,
        prompt_version=prompt_version, source_document=document,
        ingestion_run=ingestion_run,
        tokens_input=response.tokens_input, tokens_output=response.tokens_output,
        input_hash=input_hash, output_text=response.text, duration_ms=duration_ms,
    )

    return {"text": response.text, "provider": response.provider,
            "model": response.model, "tokens_input": response.tokens_input,
            "tokens_output": response.tokens_output}, False


def get_budget_dashboard() -> dict:
    from ..models import AIRun
    today = date.today()
    week_ago = timezone.now() - timedelta(days=7)

    provider_stats = []
    for prov in DEFAULT_DAILY_CAPS:
        cap = _get_daily_cap(prov)
        agg = AIRun.objects.filter(
            provider=prov, created_at__date=today
        ).aggregate(calls=Count("id"),
                    total_in=Sum("tokens_input"), total_out=Sum("tokens_output"))
        used = (agg["total_in"] or 0) + (agg["total_out"] or 0)
        provider_stats.append({
            "provider": prov, "calls_today": agg["calls"] or 0,
            "tokens_used": used, "cap": cap,
            "remaining": max(0, cap - used),
            "pct_used": round(used / cap * 100, 1) if cap else 0,
        })

    total_7d = AIRun.objects.filter(created_at__gte=week_ago).count()
    cache_hits_7d = AIRun.objects.filter(
        created_at__gte=week_ago, tokens_input=0, tokens_output=0
    ).count()

    top_tasks = list(
        AIRun.objects.filter(created_at__gte=week_ago)
        .values("task_type")
        .annotate(calls=Count("id"),
                  tokens=Sum("tokens_input") + Sum("tokens_output"))
        .order_by("-tokens")[:10]
    )

    return {
        "providers": provider_stats,
        "cache_hit_rate_pct_7d": round(cache_hits_7d / total_7d * 100, 1) if total_7d else 0,
        "total_calls_7d": total_7d,
        "top_tasks_7d": top_tasks,
        "generated_at": timezone.now().isoformat(),
    }
```

### 6.5 AI Rate Limit Middleware

```python
# core/middleware/ai_rate_limit.py
import time
from django.core.cache import cache
from django.http import JsonResponse
import os

AI_ROUTE_PREFIX = "/api/ai/"
LIMIT = int(os.environ.get("AI_RATE_LIMIT_PER_MINUTE", "10"))


class AIRateLimitMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.path.startswith(AI_ROUTE_PREFIX):
            ip = self._get_ip(request)
            key = f"ai_rate:{ip}:{int(time.time() // 60)}"
            count = cache.get(key, 0)
            if count >= LIMIT:
                return JsonResponse({
                    "error": "rate_limited",
                    "retry_after_seconds": 60 - int(time.time() % 60),
                }, status=429)
            cache.set(key, count + 1, timeout=65)
        return self.get_response(request)

    def _get_ip(self, request) -> str:
        xff = request.META.get("HTTP_X_FORWARDED_FOR")
        if xff: return xff.split(",")[0].strip()
        return request.META.get("REMOTE_ADDR", "unknown")
```

### 6.6 AI Views

```python
# gis/views_ai.py
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .models import IngestionRun
from .ai.rag import answer_question
from .ai.quota import get_budget_dashboard, cached_llm_call, QuotaExceeded
from .ai.prompts import PROMPTS


class AskView(APIView):
    def post(self, request):
        q = request.data.get("question", "").strip()
        jid = request.data.get("jurisdiction_id")
        if not q or not jid:
            return Response({"error": "question and jurisdiction_id required"}, status=400)
        result = answer_question(q, jid, context="user")
        return Response(result)


class QualityCheckView(APIView):
    def post(self, request):
        jid = request.data.get("jurisdiction_id")
        if not jid:
            return Response({"error": "jurisdiction_id required"}, status=400)
        if not request.user.is_staff:
            return Response({"error": "admin only"}, status=403)
        from .ai.quality import detect_quality_issues
        issues = detect_quality_issues(jid)
        return Response({"issues": issues})


class IngestionDebugView(APIView):
    def get(self, request, run_id):
        if not request.user.is_staff:
            return Response({"error": "admin only"}, status=403)
        try:
            run = IngestionRun.objects.get(id=run_id, status="failed")
        except IngestionRun.DoesNotExist:
            return Response(status=404)
        cfg = PROMPTS["debug_ingestion_v1"]
        prompt = cfg["template"].format(
            error_message=run.error_message[:2000],
            log_excerpt="(see Railway logs)",
            source_type=run.source.source_type,
            source_url=run.source.url,
        )
        try:
            result, _ = cached_llm_call(
                task_type="debug", prompt=prompt, system=cfg["system"],
                prompt_version=cfg["version"], max_tokens=600,
                ingestion_run=run, context="admin",
            )
        except QuotaExceeded:
            return Response({"error": "quota_exceeded"}, status=429)
        return Response({"explanation": result["text"]})


class BudgetDashboardView(APIView):
    def get(self, request):
        if not request.user.is_staff:
            return Response({"error": "admin only"}, status=403)
        return Response(get_budget_dashboard())
```

### 6.7 PMTiles Pipeline

```bash
#!/usr/bin/env bash
# scripts/generate_tiles.sh
set -euo pipefail

JURISDICTION_ID="${1:?Usage: $0 <jurisdiction_id> [slug]}"
SLUG="${2:-jurisdiction_${JURISDICTION_ID}}"
WORK="/tmp/tiles_${SLUG}"
mkdir -p "$WORK"

echo "=== Generating PMTiles for jurisdiction=${JURISDICTION_ID} slug=${SLUG} ==="

# ── Export parcels ─────────────────────────────────────────────────────────────
ogr2ogr -f GeoJSON -progress "${WORK}/parcels.geojson" \
  "${DATABASE_URL}" \
  -sql "SELECT id, apn, address, land_use_code, lot_size_sqft, geom
        FROM gis_parcel WHERE jurisdiction_id=${JURISDICTION_ID} AND ST_IsValid(geom)" \
  -nlt MULTIPOLYGON -t_srs EPSG:4326

PARCEL_COUNT=$(python3 -c "import json; d=json.load(open('${WORK}/parcels.geojson')); print(len(d['features']))")

# ── Export zones ───────────────────────────────────────────────────────────────
ogr2ogr -f GeoJSON -progress "${WORK}/zones.geojson" \
  "${DATABASE_URL}" \
  -sql "SELECT id, zone_code, zone_name, zone_type, geom
        FROM gis_zone WHERE jurisdiction_id=${JURISDICTION_ID} AND ST_IsValid(geom)" \
  -nlt MULTIPOLYGON -t_srs EPSG:4326

# ── Generate PMTiles ───────────────────────────────────────────────────────────
tippecanoe -o "${WORK}/parcels.pmtiles" \
  --layer=parcels --minimum-zoom=10 --maximum-zoom=16 \
  --simplification=4 --drop-densest-as-needed --read-parallel --force \
  "${WORK}/parcels.geojson"

tippecanoe -o "${WORK}/zones.pmtiles" \
  --layer=zones --minimum-zoom=8 --maximum-zoom=14 \
  --simplification=6 --drop-densest-as-needed --read-parallel --force \
  "${WORK}/zones.geojson"

# ── Upload to R2 ──────────────────────────────────────────────────────────────
for LAYER in parcels zones; do
  aws s3 cp "${WORK}/${LAYER}.pmtiles" \
    "s3://${R2_BUCKET_NAME}/tiles/${SLUG}/${LAYER}.pmtiles" \
    --endpoint-url "${R2_ENDPOINT_URL}" \
    --content-type "application/x-protobuf" \
    --cache-control "public, max-age=3600"
done

# ── Validate + record in Django ────────────────────────────────────────────────
python manage.py shell -c "
from gis.models import Tileset
from gis.tiles.validator import validate_tileset
import os

for layer, zoom_min, zoom_max in [('parcels', 10, 16), ('zones', 8, 14)]:
    ts, _ = Tileset.objects.update_or_create(
        jurisdiction_id=${JURISDICTION_ID}, layer_type=layer,
        defaults={
            'artifact_key': 'tiles/${SLUG}/' + layer + '.pmtiles',
            'zoom_min': zoom_min, 'zoom_max': zoom_max,
            'feature_count': ${PARCEL_COUNT} if layer=='parcels' else None,
            'generation_status': 'generating',
        }
    )
    is_valid, error = validate_tileset(ts, os.environ.get('TILES_PUBLIC_URL',''))
    ts.generation_status = 'valid' if is_valid else 'invalid'
    ts.validation_error = error
    ts.save()
    print(f'{layer}: {\"valid\" if is_valid else \"INVALID: \" + error}')
"

rm -rf "$WORK"
echo "=== PMTiles generation complete ==="
```

```python
# gis/tiles/validator.py
import httpx, structlog
from ..models import Tileset

logger = structlog.get_logger()
CA_BOUNDS = {"west": -124.5, "south": 32.5, "east": -114.0, "north": 42.1}


def validate_tileset(tileset: Tileset, tiles_public_url: str) -> tuple[bool, str]:
    if not tiles_public_url:
        return True, ""  # Skip validation if no public URL configured

    tile_url = f"{tiles_public_url}/{tileset.artifact_key}"

    try:
        r = httpx.head(tile_url, timeout=10, follow_redirects=True)
        if r.status_code != 200:
            return False, f"HTTP {r.status_code}"
        size = int(r.headers.get("content-length", 0))
        if size < 10_000:
            return False, f"File too small: {size} bytes"
        tileset.file_size_bytes = size

        # Check PMTiles magic bytes
        r2 = httpx.get(tile_url, headers={"Range": "bytes=0-6"}, timeout=10)
        if r2.content[:7] != b"PMTiles":
            return False, f"Invalid magic bytes: {r2.content[:7]!r}"

    except Exception as e:
        return False, f"Validation request failed: {e}"

    # Bounds check
    for attr, bound_key, comparator, threshold in [
        ("bounds_west", "west", lambda a, b: a < b - 1.0, CA_BOUNDS["west"]),
        ("bounds_east", "east", lambda a, b: a > b + 1.0, CA_BOUNDS["east"]),
    ]:
        val = getattr(tileset, attr, None)
        if val and comparator(float(val), threshold):
            return False, f"{attr}={val} outside California"

    if tileset.feature_count == 0:
        return False, "Feature count is 0 — empty tileset"

    tileset.save(update_fields=["file_size_bytes"])
    return True, ""
```

### 6.8 Evaluation Plan (Golden Dataset + Regression Tests)

```
tests/ai/golden/
├── fremont_r1_page14.json
├── fremont_c2_page8.json
└── README.md
```

```json
{
  "input": {
    "filename": "fremont_zoning_code_2024.pdf",
    "page_number": 14,
    "page_text": "Section 18.30.040 R-1 District. Maximum height: 30 feet. Minimum lot area: 6,000 square feet. Front yard setback: 20 feet."
  },
  "expected": {
    "zone_code": "R-1",
    "rules": [
      {"field_name": "max_height_ft",    "numeric_value": 30.0,   "min_confidence": 0.9,
       "quote_snippet_contains": "Maximum height: 30 feet"},
      {"field_name": "min_lot_size_sqft","numeric_value": 6000.0, "min_confidence": 0.9,
       "quote_snippet_contains": "Minimum lot area: 6,000 square feet"},
      {"field_name": "setback_front_ft", "numeric_value": 20.0,   "min_confidence": 0.85,
       "quote_snippet_contains": "Front yard setback: 20 feet"}
    ]
  },
  "prompt_version": "extract_zoning_rules_v1"
}
```

```python
# tests/ai/test_extraction_eval.py
import json, os, pytest
from pathlib import Path

GOLDEN_DIR = Path(__file__).parent / "golden"
SKIP = pytest.mark.skipif(
    not os.environ.get("PYTEST_AI_EVAL"),
    reason="Set PYTEST_AI_EVAL=1 to run LLM eval tests"
)

def test_citation_enforcement_rejects_empty_snippet():
    from gis.ai.extraction_pipeline import _enforce_citations
    rules = [{"field_name": "max_height_ft", "raw_value": "30",
               "confidence": 0.9, "quote_snippet": ""}]
    result = _enforce_citations(rules, "Maximum height: 30 feet.")
    assert not result[0]["citation_valid"]
    assert "missing_quote_snippet" in result[0]["citation_errors"]

def test_citation_enforcement_rejects_fabricated_snippet():
    from gis.ai.extraction_pipeline import _enforce_citations
    rules = [{"field_name": "max_height_ft", "raw_value": "45",
               "confidence": 0.9, "quote_snippet": "Maximum height: 45 feet."}]
    result = _enforce_citations(rules, "Maximum height: 30 feet.")
    assert not result[0]["citation_valid"]
    assert "quote_snippet_not_found_in_page" in result[0]["citation_errors"]

def test_citation_enforcement_accepts_valid_snippet():
    from gis.ai.extraction_pipeline import _enforce_citations
    rules = [{"field_name": "max_height_ft", "raw_value": "30",
               "confidence": 0.9, "quote_snippet": "Maximum height: 30 feet."}]
    result = _enforce_citations(rules, "Maximum height: 30 feet.")
    assert result[0]["citation_valid"]

@SKIP
@pytest.mark.parametrize(
    "case", [json.loads(f.read_text()) for f in GOLDEN_DIR.glob("*.json")],
    ids=[f.stem for f in GOLDEN_DIR.glob("*.json")]
)
def test_golden_extraction(case, db):
    from gis.ai.extraction_pipeline import PROMPTS, _enforce_citations
    from gis.ai.quota import cached_llm_call
    cfg = PROMPTS["extract_zoning_rules_v1"]
    inp = case["input"]
    prompt = cfg["template"].format(
        page_number=inp["page_number"],
        filename=inp["filename"],
        page_text=inp["page_text"],
    )
    result, _ = cached_llm_call(
        task_type="extract", prompt=prompt, system=cfg["system"],
        prompt_version=cfg["version"], max_tokens=800, context="management",
    )
    data = json.loads(result["text"])
    assert data.get("zone_code") == case["expected"]["zone_code"]

    validated = _enforce_citations(data.get("rules", []), inp["page_text"])
    by_field = {r["field_name"]: r for r in validated if r.get("citation_valid")}

    for exp in case["expected"]["rules"]:
        field = exp["field_name"]
        assert field in by_field, f"Field '{field}' not found in valid extractions"
        got = by_field[field]
        if "numeric_value" in exp:
            assert abs(float(got.get("numeric_value") or 0) - exp["numeric_value"]) < 0.5
        assert float(got.get("confidence", 0)) >= exp["min_confidence"]
        if "quote_snippet_contains" in exp:
            assert exp["quote_snippet_contains"].lower() in got.get("quote_snippet","").lower()
```

---

## Section 7 — Scalability, Reliability, Security, Observability Roadmap

### Async + Queue Hardening (Week 2+)

```python
# Trigger ingestion as Django-Q task (not inline)
from django_q.tasks import async_task
async_task("gis.ingestion.loader.run_ingestion", source_id,
           task_name=f"ingest_source_{source_id}")

# Retry with exponential backoff via Q_CLUSTER config
Q_CLUSTER = {
    "name": "parcelmap", "orm": "default", "workers": 2,
    "timeout": 600, "retry": 720, "max_attempts": 3,
    "ack_failures": True,
}
```

**Rate limiting on data sources:**
```python
import httpx
limits = httpx.Limits(max_connections=5, max_keepalive_connections=2)
transport = httpx.HTTPTransport(retries=3)
client = httpx.Client(limits=limits, transport=transport, timeout=120)
```

### Monitoring (free tier)

```python
# Sentry — wrap in settings.py
import sentry_sdk
if dsn := env("SENTRY_DSN", default=""):
    sentry_sdk.init(dsn=dsn, traces_sample_rate=0.1,
                    profiles_sample_rate=0.1)
```

- **UptimeRobot** (free, 50 monitors): add `/health/` endpoint
- **Railway logs**: structlog JSON → searchable in Railway dashboard
- **Supabase dashboard**: query `ai_runs` for token usage trends
- **Week 3**: Grafana Cloud free tier (10K metrics) + Prometheus Django exporter

### Security

```python
# settings.py — production security settings
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"
SESSION_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SECURE = not DEBUG
SECURE_SSL_REDIRECT = not DEBUG
```

**OWASP basics:**
- All SQL through Django ORM — never string-interpolated raw SQL
- PostGIS raw SQL: always use parameterized `%s` placeholders
- CORS: explicit allowlist, never `*` in production
- Secrets: Railway env vars only, never in code or git history
- Admin: change default `/admin/` path in production, use 2FA

**Threat model (key risks for this system):**

| Risk | Mitigation |
|------|-----------|
| Scraper floods bbox API | `AIRateLimitMiddleware` + DB connection pool limit |
| Token quota exhaustion | `check_quota()` + daily caps + OFFLINE_ONLY_TASKS guard |
| Hallucinated citations stored | `_enforce_citations()` + pending review status |
| CRS corruption in DB | `check_ca_bounds()` + `assert_model_compatibility()` |
| Secrets in logs | structlog `bind()` — never log raw env vars |

### Performance

```sql
-- Week 3: add BRIN index on large ingestion tables
CREATE INDEX CONCURRENTLY idx_parcels_updated_brin
  ON parcels USING BRIN(updated_at);

-- Precompute parcel → zone join (refresh after each ingestion)
CREATE MATERIALIZED VIEW parcel_zone_lookup AS
SELECT p.id AS parcel_id, z.id AS zone_id, z.zone_code
FROM parcels p
JOIN zones z ON ST_Intersects(p.geom, z.geom)
WHERE p.jurisdiction_id = z.jurisdiction_id;

CREATE INDEX ON parcel_zone_lookup(parcel_id);
REFRESH MATERIALIZED VIEW CONCURRENTLY parcel_zone_lookup;
```

**Caching:**
- Django cache (local-memory Day-1, Redis Week-3) for bbox responses: 60s TTL
- PMTiles CDN caching: `Cache-Control: public, max-age=3600`
- AI responses: `cached_llm_call()` 7-day cache by `input_hash`

### Data Governance

- Every parcel/zone row → `source_id` → full lineage to URL + download
- `ingestion_runs` is append-only (never delete runs)
- Raw artifacts kept in R2 indefinitely (cheap storage, essential for reprocessing)
- `extractions` is append-only (AI output never edited — only `validation_status` updates)
- `zoning_rules` only shows `approved` status via API — `pending` never served
- Reprocessing: re-run ingestion with same `source_id` → `update_or_create` handles idempotently

---

## Section 8 — AI-Assisted Development: Agents + Workflow

### /agents/ Folder

Each file is a markdown "system prompt" for that agent role. Open it in Continue.dev or paste it at the top of an Aider session. Use one agent per context window — never mix agent responsibilities in one prompt.

**agents/architect.md (summary):**
- Responsibilities: system design, ADRs, schema changes, prompt versioning, API contracts
- Inputs: `models.py` + `PROMPTS` dict + requirement in 1-3 sentences + constraints
- Outputs: ADR (committed to `docs/adr/`), schema diff, API contract, integration risks
- Checklist: breaking changes? golden dataset update needed? dimension change? free-tier safe?
- DoD: ADR committed, no undocumented breaking changes

**agents/backend.md (summary):**
- Responsibilities: Django models, DRF views, ingestion, Django-Q tasks, migrations
- Inputs: ADR + `models.py` + `urls.py` + API contract
- Outputs: implementation + migration + 2+ tests + curl smoke-test command
- Checklist: `update_or_create` used? every LLM call via `cached_llm_call()`? `AIRun` logged? offline task guarded? parameterized SQL?
- DoD: `pytest -x` green, endpoint tested with curl

**agents/frontend.md (summary):**
- Responsibilities: React+TS components, MapLibre integration, API wiring, AI panel
- Inputs: API contract + current `App.tsx` + `VITE_USE_PMTILES` value
- Outputs: `.tsx` components + updated wiring
- Checklist: bbox fetch only on `moveend`? PMTiles `source-layer` matches tippecanoe `--layer`? No hardcoded URLs? Error states handled?
- DoD: `npm run build` zero errors, tested in Chrome

**agents/gis_data.md (summary):**
- Responsibilities: CRS detection/repair, geometry validation, GeoPandas normalizer, tippecanoe generation
- Inputs: source file or URL + format description + expected CRS
- Outputs: field mapping table + CRS audit + normalized loader function + post-load SQL queries
- Checklist: `gdf.crs` verified? MultiPolygon cast? `make_valid()` applied? CA bounds check passes? `ST_Area(geom::geography)` not `area_deg`?
- DoD: zero invalid geometries, centroids inside California bbox, quality check passes

**agents/devops_sre.md (summary):**
- Responsibilities: Dockerfile, Railway config, Supabase, R2, Cloudflare Worker, Sentry, CI
- Inputs: `Dockerfile` + `railway.toml` + description of what changed
- Outputs: updated config + new env vars for `.env.example` + deploy verification steps + rollback command
- Checklist: no secrets in code? `/health/` returns 200? pgvector enabled? R2 CORS allows frontend? tile Worker deployed?
- DoD: public URL 200, Sentry event received, Railway deploy log green

**agents/qa.md (summary):**
- Responsibilities: pytest + Vitest, golden dataset, regression tests, citation validation, ingestion validation
- Inputs: feature implementation + acceptance criteria
- Outputs: test file(s) + golden dataset entry (for AI features) + post-load SQL verification
- Checklist: happy path + error case? LLM tests marked `@SKIP_IF_NO_EVAL`? new prompt → new golden entry? geometry fixture includes invalids?
- DoD: all tests pass in CI, golden suite ≥70% field coverage ≥80% citation precision

### Vibe-Coding Toolchain

**Install once:**
```bash
# Ollama
brew install ollama  # macOS; or: curl -fsSL https://ollama.com/install.sh | sh
ollama pull llama3.2 && ollama pull llama3.1:8b && ollama pull nomic-embed-text

# Aider
pip install aider-chat

# .aider.conf.yml (project root)
cat > .aider.conf.yml << 'EOF'
model: ollama/llama3.1:8b
editor-model: ollama/llama3.2
auto-commits: false
show-diffs: true
test-cmd: cd backend && pytest -x -q
read:
  - backend/gis/models.py
  - backend/core/llm/base.py
  - .env.example
EOF

# Continue.dev: install VS Code extension "Continue"
# Config: ~/.continue/config.json
# Add Ollama provider pointing to localhost:11434
```

**Daily Aider patterns:**
```bash
# Feature implementation
aider backend/gis/views.py backend/gis/urls.py backend/gis/serializers.py
# Inside Aider: paste ADR + API contract → ask for implementation + tests

# GIS work
aider backend/gis/ingestion/loader.py backend/gis/ingestion/geo_utils.py

# AI feature
aider backend/gis/ai/extraction_pipeline.py backend/gis/ai/prompts.py

# Non-interactive refactor
aider backend/gis/ai/*.py --message \
  "Refactor all LLM calls to use cached_llm_call(). Keep function signatures."
```

### Prompt Playbooks

**Feature Implementation:**
```
You are the Backend Agent for a Django+PostGIS+AI parcel map.

Feature: [FEATURE]
ADR: [PASTE]
Current models.py: [PASTE]

Rules:
- ORM only. Raw SQL only for PostGIS ST_ functions (parameterized).
- LLM calls via cached_llm_call() with correct context parameter.
- Offline tasks: assert_offline_task(task_type, context='worker').
- GeoJSON FeatureCollection for geo endpoints, JSON for rest.
- Tests: happy path + 404 + validation error.

Output: implementation + migration (if needed) + tests + curl command.
```

**Code Review:**
```
Review this code for:
1. Security: SQL injection, CORS, auth bypass, secret leakage
2. GIS correctness: CRS assumptions, geometry type assumptions, area in degrees²
3. AI safety: no AIRun log, missing citation enforcement, offline task not guarded
4. Performance: N+1 queries, missing indexes, unbounded result sets
5. Missing error handling / tests

Code: [PASTE]

Format: Severity (critical/major/minor) | Location | Problem | Fix
```

**Debug Ingestion:**
```
Ingestion failed.
error_message: [PASTE]
source_type: [TYPE]
structlog: [PASTE]

Diagnose:
1. Root cause (specific function if possible)
2. Data issue or code bug?
3. Exact fix (code)
4. Verification query
5. Prevention
```

**Write Migration:**
```
Design a safe schema migration.
Current models.py: [PASTE]
Required change: [DESCRIBE]

Produce:
1. Updated model
2. Django migration file (RunSQL for PostGIS-specific ops)
3. Data migration if existing rows need transform
4. Rollback plan
5. Zero-downtime strategy if table has >100K rows
```

**Incident Response:**
```
Production incident: [SYMPTOM]
Railway logs: [PASTE]
Sentry errors: [PASTE]
Recent deploy: [yes/no, what changed]

Check in order:
1. DB reachable? (curl /health/)
2. API responding? (curl /api/parcels/?bbox=...)
3. AI pipeline stuck? (Django-Q tasks backed up?)
4. Frontend errors? (open browser console)

For each: give exact command to verify.
Then: give rollback command if needed.
```

### Daily Cadence

```
08:45 — Morning check (10 min)
  railway logs --tail 50 | grep -E "ERROR|CRITICAL|quota_exceeded"
  python manage.py ai_report
  Pick today's 1 feature

09:00 — Plan (15 min)
  Paste requirement into architect.md prompt
  Get: ADR outline, schema change, API contract, acceptance criteria (3 testable)

09:15 — Implement (2-3 hours)
  aider [relevant files]
  Implement → run locally (docker-compose up) → curl endpoints → open browser

12:00 — Test (45 min)
  cd backend && pytest -x -q
  cd frontend && npm run build
  If AI feature: add golden dataset entry

13:00 — Code review (20 min)
  git diff HEAD | paste to aider with agents/qa.md in context
  "Review this diff against the QA checklist. List PR gate violations."
  Fix all critical + major

13:30 — Deploy (15 min)
  python scripts/pr_gate.py    # must pass before push
  git push origin main         # Railway auto-deploys
  railway logs --tail 20

14:00 — Observe (15 min)
  curl https://your-app.railway.app/health/
  curl https://your-app.railway.app/api/ai/budget/ | python3 -m json.tool
  Check Sentry dashboard

14:30 — Iterate or stop
```

### PR Gate

```python
# scripts/pr_gate.py
import subprocess, sys

def gate(name, cmd, expect=0):
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    ok = r.returncode == expect
    print(f"{'✅' if ok else '❌'} {name}")
    if not ok: print(f"   {(r.stdout + r.stderr)[:300]}")
    return ok

gates = [
    gate("pytest",          "cd backend && python -m pytest -x -q 2>&1 | tail -5"),
    gate("frontend_build",  "cd frontend && npm run build 2>&1 | tail -3"),
    gate("no_migrations_pending",
         "cd backend && python manage.py migrate --check 2>&1 | grep -c 'No migrations'"),
    gate("no_fabricated_citations",  # grep returns 1 (nothing found) = good
         "git diff HEAD backend/gis/ai/ | grep '^+' | grep -i 'quote_snippet.*null'",
         expect=1),
]

failures = [g for g in gates if not g]
if any(not g for g in gates):
    print(f"\n{sum(1 for g in gates if not g)} gate(s) failed.")
    sys.exit(1)
print("\nAll gates passed. Safe to merge.")
```

---

## Section 9 — Deliverables Recap

### Day-1 Checklist

```
INFRASTRUCTURE
[ ] Supabase project + postgis + vector extensions enabled
[ ] Railway project created, Dockerfile builds
[ ] Cloudflare R2 bucket created
[ ] Vercel project connected to GitHub

BACKEND
[ ] All models migrated to Supabase
[ ] 10 endpoints working (test each with curl)
[ ] Django admin accessible at /admin/
[ ] CORS configured for Vercel frontend URL
[ ] /health/ returns 200

INGESTION
[ ] Fremont jurisdiction + Source records created in admin
[ ] Parcel ingestion run completes (status=completed)
[ ] Zone ingestion run completes
[ ] Parcel rows visible in Supabase table view

FRONTEND
[ ] Map loads centered on Fremont (no console errors)
[ ] Parcels visible as polygons at zoom 12+
[ ] Zones visible as colored polygons at zoom 9+
[ ] Click parcel → detail panel shows APN, address, land use
[ ] Click zone → detail panel shows zone code and type
[ ] Search by APN returns result + map flies to it
[ ] Layer toggles work

DEPLOYMENT
[ ] Backend live at railway.app URL
[ ] Frontend live at vercel.app URL
[ ] URL shareable without auth
[ ] Structlog output visible in Railway logs

AI (DAY-1 MINIMAL)
[ ] LLM factory returns client (test: python manage.py shell → get_llm_client())
[ ] Ollama running locally (or Gemini key set for production)
[ ] Admin can upload PDF + trigger extraction (extractions appear in admin)
```

### Milestones After Day-1

| Timeline | Goal |
|----------|------|
| Week 1 Day 2 | Zone ingestion + zone layer on map |
| Week 1 Day 3 | Document chunking + embedding + RAG /ai/ask/ endpoint |
| Week 1 Day 4 | Quota + cache wired + budget dashboard live |
| Week 1 Day 5 | 5 golden test cases + regression test suite |
| Week 2 Day 6 | PMTiles generated + Cloudflare Worker deployed |
| Week 2 Day 7 | Citation quality UI (approved rules + quote snippets visible) |
| Week 2 Day 8 | /agents/ folder committed + PR gate in daily loop |
| Week 2 Day 9 | 2nd municipality (Oakland) ingested |
| Week 2 Day 10 | Embedding model rebuild test (switch model, verify search still works) |

### Common Pitfalls + Mitigations

| Pitfall | Symptom | Fix |
|---------|---------|-----|
| Unknown CRS — data lands in ocean | Parcels appear off Pacific coast | Always check `gdf.crs` before load; use `check_ca_bounds()` after |
| Shapefile truncates column names to 10 chars | Field "SITEADDRESS" → "SITEADDRES" | Print `gdf.columns.tolist()` before mapping |
| `make_valid()` returns GeometryCollection | PostGIS type error on insert | Filter `geom_type in {"Polygon","MultiPolygon"}` after make_valid |
| bbox API at low zoom returns 500K features | Timeout / OOM | Add zoom gate in frontend (don't fetch below zoom 12) + `[:2000]` server-side cap |
| LLM returns citation with wrong page number | Hallucinated rule stored | `_enforce_citations()` substring check + pending review + admin approval gate |
| Embedding model switched without rebuild | RAG returns garbage results | `assert_model_compatibility()` raises RuntimeError + `rebuild_embeddings --confirm` |
| Quota exhaustion from loop | All Gemini tokens gone in minutes | `OFFLINE_ONLY_TASKS` guard + daily cap + rate limit middleware |
| PMTiles magic byte check fails | Partial upload to R2 | `validate_tileset()` rejects before marking `valid`; re-run generation |
| Django-Q worker not running | Ingestion tasks never execute | Add worker as separate Railway service; check Railway services dashboard |
| Supabase 500MB limit hit | Inserts start failing | Add `pg_dump` cron to R2 weekly; consider Neon.tech swap (free 3GB) |

---

## Section 10 — "If You Only Have 6 Hours" Compressed Runbook

**Goal: public URL with parcels on map + click-to-detail. AI deferred.**

**Hour 1 — Infra (9:00–10:00)**
- Supabase: create project, enable PostGIS + vector in SQL editor
- Railway: create project
- Vercel: connect GitHub repo
- R2: create bucket
- `git init parcel-map` → docker-compose.yml → `.env` → `railway.toml`

**Hour 2 — Backend core (10:00–11:00)**
- `django-admin startproject core .` + `python manage.py startapp gis`
- Create models: Jurisdiction, Source, IngestionRun, Parcel, Zone (geometry only)
- `makemigrations && migrate` against local docker-compose DB
- 4 endpoints only: `/parcels/?bbox=`, `/parcels/{id}/`, `/zones/?bbox=`, `/search/`
- Register all models in admin

**Hour 3 — Ingestion (11:00–12:00)**
- Download Alameda County parcel GeoJSON to disk manually
- Write minimal `load_parcels()` — `normalize_crs()` → `validate_geometries()` → `update_or_create`
- Run: `python manage.py shell` → call loader → verify rows in Supabase dashboard
- Skip: R2 upload, zone ingestion, AI features

**Hour 4 — Frontend (12:00–13:00)**
- `npm create vite . -- --template react-ts` + `npm install maplibre-gl tailwindcss`
- Copy App.tsx from Section 5.7 above (USE_PMTILES=false)
- Test locally: map loads, parcels appear at zoom 12, click shows detail

**Hour 5 — Deploy (13:00–14:00)**
- `git push origin main` → Railway auto-deploys
- Set all env vars in Railway dashboard
- `railway run python manage.py migrate` + `createsuperuser`
- Vercel: connect repo + set `VITE_API_URL`
- Fix CORS if needed (most common issue at this stage)

**Hour 6 — Polish + Verify (14:00–15:00)**
- Walk through Day-1 checklist (Section 9) — check each criterion
- Screenshot/record a demo
- Write down 3 things that broke and why (your learning log for tomorrow)

**What you skip in 6h vs 8h:**
- Zone ingestion (Day 2)
- R2 artifact storage (Day 2)
- AI features (Week 1)
- PMTiles (Week 2)
- The demo shows: map + parcels + click-to-detail. That is sufficient to validate the stack.
```
