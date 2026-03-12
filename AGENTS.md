# AGENTS.md — parcel-map

## Mission
Maintain forward progress on `parcel-map` with high technical accuracy, low churn.

## Non-negotiable behavior
- Inspect real repo code before proposing or changing anything.
- Do not invent implemented features.
- Always label status as:
  - Implemented now
  - Partially built
  - Planned/target (docs-only)
- Prefer minimal, testable, incremental changes unless explicitly asked for larger refactors.

## Continuity maintenance
- Treat `docs/master_continuity_prompt.md` as the human-facing continuity file for fresh ChatGPT sessions.
- When a task changes implemented architecture, data models, APIs, service workflows, naming, project structure, or major decisions, update `docs/master_continuity_prompt.md` in the same change.
- Do not update it for trivial edits, formatting-only changes, or tiny internal refactors with no effect on project understanding.
- If code and `docs/master_continuity_prompt.md` conflict, fix the prompt to match the current repo and explicitly note stale sections removed or corrected.
- In your final report, state whether `docs/master_continuity_prompt.md` was updated and why.

## Working style (stay up to date)
For each implementation step, structure output as:
- Prefer current repo code over older continuity docs when they conflict.
- Explicitly call out stale documentation when discovered.

## Engineering expectations
- Keep deterministic GIS/data source truth separate from AI-derived outputs.
- Use Codex for scoped coding, repetitive edits, boilerplate, and safe refactors.
- Keep architecture decisions, correctness review, and learning checkpoints visible for manual user review.
- Avoid large rewrites unless necessary and approved.
- Be explicit about assumptions and risks.
- Preserve project preference for local/free tools when practical (for example local Ollama in early stages).

## Repo-specific guardrails
- Current app reality is parcel-first.
- Architecture in `docs/ca_gis_platform_unified_plan.md` are roadmap targets, not fully implemented app behavior.
- Current live API surface is small; verify routes/views before claiming capabilities.
- Keep extraction changes compatible with existing model choices unless schema changes are explicitly requested.
- Minimize naming churn; document current names first, then suggest clearer future naming if needed.

## Quality bar for changes
- Include validation steps or test evidence.
- Call out any inconsistencies discovered in docs vs code.
- Provide a well formatted complete github style comment for all changes.
