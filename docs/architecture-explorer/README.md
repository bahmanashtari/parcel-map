# Architecture Explorer

Interactive internal architecture explorer for `parcel-map`.

## What this is

A standalone React + Vite + TypeScript app under `docs/architecture-explorer/` that maps:
- current implemented architecture in this repo
- planned/target architecture from docs
- data model relationships
- backend/frontend/GIS/AI flows

## Run locally

```bash
cd docs/architecture-explorer
npm install
npm run dev
```

Build for static output:

```bash
npm run build
npm run preview
```

## Notes

- This explorer is frontend-only and has no backend dependency.
- Content is hardcoded from repository inspection and intentionally separates:
  - `Implemented`
  - `Partial`
  - `Planned`
- Planned labels are based on `docs/ca_gis_platform_unified_plan.md` and are not treated as as-built behavior.
