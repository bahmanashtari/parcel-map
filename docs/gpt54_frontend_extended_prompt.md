# GPT-5.4 Extended Thinking Prompt: `parcel-map` Frontend (Current As-Built)

Use this prompt as the working context for frontend tasks in `parcel-map`.

## Operating rules
- Treat repository code as source of truth.
- Keep status labeling explicit in responses:
  - `Implemented now`
  - `Partially built`
  - `Planned/target (docs-only)`
- Do not invent features that are not in code.
- Prefer minimal, testable, low-churn changes.

---

## 1) Frontend surfaces in this repo

### Implemented now
- Main user-facing frontend app: `frontend/` (React + TypeScript + Vite + MapLibre).
- Internal docs frontend app: `docs/architecture-explorer/` (React + TypeScript + Vite + Mermaid).

### Partially built
- Main app is map-first and functional, but narrow in scope.
- Architecture explorer is rich as documentation UI, but content is manually curated and may contain stale references.

### Planned/target (docs-only)
- Broader UI platform from `docs/ca_gis_platform_unified_plan.md` is roadmap, not live behavior.

---

## 2) Main frontend (`frontend/`) exact implementation

### Stack and tooling
- `react@19.2.0`, `react-dom@19.2.0`, `maplibre-gl@5.19.0`
- Vite `^7.3.1`, TypeScript `~5.9.3`
- ESLint present (`frontend/eslint.config.js`)
- TypeScript strict mode enabled in `frontend/tsconfig.app.json`

### Entry and layout
- Entry: `frontend/src/main.tsx`
- App root component: `frontend/src/App.tsx`
- Global layout CSS: `frontend/src/index.css`
- `App.css` currently contains mostly default Vite template styles and is not imported by `App.tsx`.

### Map behavior (`frontend/src/App.tsx`)
- Initializes a MapLibre map with OSM raster tiles.
- Initial center/zoom: `[-121.9886, 37.5483]`, zoom `11`.
- On map load and on every `moveend`, computes bbox from map bounds.
- Calls backend with hardcoded URL:
  - ``http://127.0.0.1:8000/api/parcels/?bbox=${west},${south},${east},${north}``
- Expects GeoJSON `FeatureCollection`.
- Adds/updates source `parcels`.
- Ensures two layers exist:
  - `parcels-fill` (green translucent fill)
  - `parcels-outline` (dark green line)
- If features exist, computes aggregate bounds from all feature coordinates and calls `fitBounds`.
- Uses `isAutoFittingRef` guard to skip one `moveend` triggered by own `fitBounds` call.

### Data assumptions in frontend
- Assumes backend returns valid GeoJSON `FeatureCollection` with `features` array.
- Extracts bounds by recursively traversing `geometry.coordinates` for coordinate pairs.
- No schema validation of response payload beyond TypeScript cast.

### Current frontend limitations
- No loading state.
- No error UI or retry behavior.
- No request cancellation/debouncing while panning.
- API base URL is hardcoded (not env-driven).
- Logs bbox and response to console.
- No routing, no auth UI, no document UI, no AI UI in this main app.

---

## 3) Backend API contract currently relevant to frontend

### Implemented now
- `GET /api/parcels/?bbox=west,south,east,north`
  - Returns GeoJSON `FeatureCollection`.
  - `400` on missing/invalid bbox.
- Additional AI-document endpoints exist (not used by main frontend yet):
  - `GET /api/documents/`
  - `POST /api/documents/`
  - `GET /api/documents/<id>/`
  - `GET /api/documents/<id>/constraints/`

### Notes for integration
- Current main frontend only consumes `/api/parcels/`.
- CORS in development mode is permissive because `DJANGO_ENV=development` and `CORS_ALLOW_ALL_ORIGINS=True` in development settings.

---

## 4) Internal architecture explorer frontend (`docs/architecture-explorer/`)

### Purpose
- Standalone internal UI for understanding project architecture, status, flows, and glossary.
- No backend dependency; content is code-defined in static data files.

### Stack
- `react@19.2.0`, `react-dom@19.2.0`, `mermaid@11.12.0`
- Vite + TypeScript strict mode

### Key files
- App shell and section rendering: `docs/architecture-explorer/src/App.tsx`
- Static content/data model: `docs/architecture-explorer/src/data/content.ts`
- UI components:
  - `src/components/Sidebar.tsx`
  - `src/components/StatusBadge.tsx`
  - `src/components/Accordion.tsx`
  - `src/components/MermaidDiagram.tsx`
- Styling: `docs/architecture-explorer/src/styles.css`

### Behavior
- Left sidebar controls active section.
- Sections rendered conditionally with badges (`implemented`, `partial`, `planned`).
- Mermaid diagrams rendered client-side via `mermaid.render`.
- Tabs for flows and diagram categories.
- "Comfort Reading" toggle switches a readability mode class.
- Entire explorer content is static and sourced from `content.ts` constants.

### Known stale points inside explorer content
- Some diagram/content text still uses old names like `ExtractedRule` / `rule_type` in places, while backend runtime uses `ExtractedConstraint` / `constraint_type`.
- Treat explorer content as documentation UI, not runtime source of truth.

---

## 5) Frontend file map (high signal)

### `frontend/`
- `src/main.tsx`: React bootstrap in `StrictMode`
- `src/App.tsx`: MapLibre map lifecycle and parcel fetch loop
- `src/index.css`: full-screen map container styling
- `vite.config.ts`: basic React plugin config
- `package.json`: scripts (`dev`, `build`, `lint`, `preview`)

### `docs/architecture-explorer/`
- `src/main.tsx`: React bootstrap
- `src/App.tsx`: multi-section explorer UI
- `src/data/content.ts`: all content and Mermaid source strings
- `src/styles.css`: visual system and responsive rules
- `src/components/*`: reusable display components

---

## 6) Practical commands

### Main frontend
```bash
cd frontend
npm install
npm run dev
npm run build
npm run lint
npm run preview
```

### Architecture explorer
```bash
cd docs/architecture-explorer
npm install
npm run dev
npm run build
npm run preview
```

### Backend (for frontend API)
```bash
cd backend
./venv/bin/python manage.py runserver
```

---

## 7) If you are asked to modify frontend

Follow these constraints:
- Preserve existing behavior unless specifically asked to change it.
- Keep API assumptions explicit and aligned with backend views/serializers.
- For main app, avoid introducing large framework changes (state managers/router) unless requested.
- If adding document UI, wire to already-implemented `/api/documents/*` endpoints.
- Call out stale docs/content where detected instead of silently propagating outdated terms.

---

## 8) Current frontend summary snapshot

### Implemented now
- Live parcel map rendering loop with bbox API.
- Basic map draw/update with fit-to-data behavior.
- Internal architecture explorer UI with sectioned documentation and diagrams.

### Partially built
- Main map frontend lacks UX polish/error/loading/request control features.
- Explorer content includes some stale naming in static docs data.

### Planned/target (docs-only)
- Larger zoning/search/AI UI capabilities described in roadmap docs are not in active main frontend code.
