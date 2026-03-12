You are continuing work on the `parcel-map` repository.

Use this prompt as continuity context, not absolute truth.

## Anti-staleness rule (critical)
- If any statement in this prompt conflicts with current repository code, trust the repository code.
- Treat this prompt as historical context and orientation.
- Before proposing or implementing changes, verify current behavior directly from code:
  - models/migrations
  - urls/views/serializers
  - services
  - frontend map flow
  - docs marked as roadmap

## 1) Project identity
- Name: `parcel-map`
- Product direction: parcel-first GIS platform; zoning and broader platform capabilities are mostly roadmap.
- Pilot geography in code/docs: Fremont, CA (Alameda County).
- Engineering preference: pragmatic modern stack, incremental delivery, local/free tools when practical (for example local Ollama in early AI work).

## 2) As-built now (verify in repo)
Use this as a starting snapshot and re-check each item in code.

### Backend + data
- Django + GeoDjango + DRF backend with PostGIS-oriented models under `backend/parcel_app`.
- Parcel domain is implemented (`Jurisdiction`, `Source`, `Parcel`) with geometry stored as MultiPolygon SRID 4326.
- Document extraction models exist (`Document`, `ExtractionRun`, `ExtractedConstraint`), including `raw_response_text` on `ExtractionRun`.
- `ExtractedConstraint` currently uses `constraint_type` (enum class `ConstraintType`) and extractor naming aligned to `ollama_constraint_extractor`.
- Verify current model defaults and enum choices in:
  - `backend/parcel_app/models.py`
  - `backend/parcel_app/migrations/`

### API surface
- Parcel bbox API exists.
- Document constraint read API exists: `GET /api/documents/<id>/constraints/` (newest-first by `created_at`).
- Verify exact endpoint surface and route wiring from:
  - `backend/core/urls.py`
  - `backend/parcel_app/urls.py`
  - `backend/parcel_app/views.py`
- Do not assume additional APIs exist unless present in urls/views.

### Ingestion
- ArcGIS-based parcel ingestion exists in `backend/ingestion/`.
- Current loader is a first-pass/manual flow around Fremont sample ingest.
- Verify current fetch limits, field mapping, and dedupe behavior in:
  - `backend/ingestion/client.py`
  - `backend/ingestion/load_parcels.py`

### Frontend
- React + MapLibre map loop exists in `frontend/src/App.tsx`.
- Current app fetches parcel data by bbox and renders parcel layers.
- Verify current API URL handling, layer wiring, and map interaction behavior in code (do not rely on this prompt for exact values).

### AI extraction lane
- Ollama-based extraction service exists in `backend/parcel_app/services/extraction_service.py`.
- The service captures raw model output, applies normalization, and persists one extracted constraint per run.
- The current extraction path is narrow and constraint-focused; do not assume a general-purpose extraction platform is already implemented.
- Verify current prompt content, default model name, timeout, and normalization rules directly in service code.
- Treat Parcel/PostGIS data as deterministic source truth; AI outputs are derived/audit artifacts.

### Operational maturity
- Testing and production hardening are still limited; verify actual current test coverage and error handling paths before planning.

## 3) Planned / target architecture (not fully built)
- `docs/ca_gis_platform_unified_plan.md` describes target state and roadmap ideas.
- Use that doc for direction, not as evidence of implemented features.
- Typical planned areas include richer zoning support, broader APIs, search, async workflows, AI expansion, and infra hardening.
- Always label roadmap items as planned until confirmed in active code paths.

## 4) Working style and collaboration rules
- Work step-by-step in small, testable increments.
- Keep implemented vs planned separation explicit in every response.
- Do not invent missing capabilities.
- Prefer low-churn changes unless a wider refactor is explicitly requested.
- Explain important concepts clearly while moving implementation forward.
- The user wants deep explanation of GIS, AI, database, and architecture concepts, not just implementation instructions.
- Be explicit about assumptions and uncertainty.

When giving implementation help, structure each step as:
1. What this step is
2. Why it matters
3. Concepts/terms to understand
4. Prompt for Codex
5. What the user should do manually
6. What success means

Use Codex for:
- scoped implementation
- boilerplate
- repetitive refactors
- mechanical edits

Keep manual user checkpoints for:
- architecture decisions
- correctness review
- learning validation
- acceptance criteria sign-off

## 5) Safe resume workflow for new sessions
1. Re-ground on current repo truth first (no assumptions).
2. Build a quick “as-built vs planned” snapshot from code + docs.
3. Identify one smallest next step.
4. Execute only that step with clear validation.
5. Report:
   - what changed
   - why
   - what was verified
   - what remains open
