import { useMemo, useState } from 'react'
import { Accordion } from './components/Accordion'
import { MermaidDiagram } from './components/MermaidDiagram'
import { Sidebar } from './components/Sidebar'
import { StatusBadge } from './components/StatusBadge'
import {
  aiBoundaries,
  aiModels,
  aiWorkflowFacts,
  backendBehaviors,
  backendStructure,
  diagrams,
  flowCards,
  folderMap,
  frontendFlow,
  frontendLimits,
  gisModels,
  glossary,
  overviewCards,
  sections,
  sourceTrace,
  stackSnapshot,
  statusBoard,
  systemLanes,
} from './data/content'

type SectionId = (typeof sections)[number]['id']

const sectionLeads: Record<SectionId, string> = {
  overview: 'Quick project orientation, scope boundary, and stack reality check.',
  architecture: 'System lanes and diagrams with explicit built-versus-planned separation.',
  backend: 'Django structure, live API behavior, and extraction service responsibilities.',
  frontend: 'Current MapLibre fetch/render loop and immediate UX/engineering limits.',
  gis: 'Spatial data model, geometry assumptions, and core GIS terms in this repo.',
  ai: 'Document extraction lane from raw LLM response through normalized rule storage.',
  flows: 'Step-by-step operational views for ingestion, render, and AI extraction paths.',
  relationships: 'Folder/module responsibilities and data relationship maps.',
  status: 'Current delivery status: what is built, partial, and still missing.',
  glossary: 'Project-specific GIS and AI terms for faster onboarding and relearning.',
}

function App() {
  const [active, setActive] = useState<SectionId>('overview')
  const [flowTab, setFlowTab] = useState<'ingestion' | 'render' | 'ai'>('ingestion')
  const [diagramTab, setDiagramTab] = useState<'system' | 'flows' | 'models'>('system')
  const [readingMode, setReadingMode] = useState(false)

  const navItems = useMemo(
    () => sections.map((section) => ({ id: section.id, title: section.title, state: section.state })),
    [],
  )

  return (
    <div className="layout">
      <Sidebar items={navItems} activeId={active} onSelect={(id) => setActive(id as SectionId)} />

      <main className={readingMode ? 'main-panel reading-mode' : 'main-panel'}>
        <header className="main-header">
          <div className="title-block">
            <p className="eyebrow">Internal Explorer</p>
            <h2>{sections.find((s) => s.id === active)?.title}</h2>
            <p className="section-lead">{sectionLeads[active]}</p>
          </div>
          <div className="header-controls">
            <button
              type="button"
              className={readingMode ? 'mode-toggle active' : 'mode-toggle'}
              onClick={() => setReadingMode((value) => !value)}
              aria-pressed={readingMode}
            >
              {readingMode ? 'Comfort Reading: On' : 'Comfort Reading: Off'}
            </button>
            <div className="header-badges">
              <StatusBadge state="implemented" />
              <StatusBadge state="partial" />
              <StatusBadge state="planned" />
            </div>
          </div>
        </header>

        {active === 'overview' ? (
          <section className="content-grid">
            <div className="card-grid three">
              {overviewCards.map((card) => (
                <article key={card.title} className="card">
                  <div className="card-title-row">
                    <h3>{card.title}</h3>
                    <StatusBadge state={card.state} />
                  </div>
                  <ul className="tight-list">
                    {card.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>

            <article className="card">
              <h3>Current Stack Snapshot</h3>
              <div className="kv-list">
                {stackSnapshot.map((row) => (
                  <div key={row.area} className="kv-row">
                    <span>{row.area}</span>
                    <strong>{row.value}</strong>
                  </div>
                ))}
              </div>
            </article>

            <article className="card tone-muted">
              <h3>Evidence Trace</h3>
              <p>
                Explorer content is derived from inspected repository files. Planned labels are pulled from
                <code> docs/ca_gis_platform_unified_plan.md</code> and kept separate from as-built behavior.
              </p>
              <div className="chip-row">
                {sourceTrace.map((path) => (
                  <span key={path} className="path-chip">
                    {path}
                  </span>
                ))}
              </div>
            </article>
          </section>
        ) : null}

        {active === 'architecture' ? (
          <section className="content-grid">
            <article className="card">
              <h3>Architecture Lanes</h3>
              <div className="lane-grid">
                {systemLanes.map((lane) => (
                  <article key={lane.lane} className="lane-card">
                    <div className="card-title-row">
                      <h4>{lane.lane}</h4>
                      <StatusBadge state={lane.state} />
                    </div>
                    <p>{lane.now}</p>
                    <p className="muted">Next: {lane.next}</p>
                  </article>
                ))}
              </div>
            </article>

            <article className="card">
              <div className="tab-row">
                <button
                  type="button"
                  className={diagramTab === 'system' ? 'tab active' : 'tab'}
                  onClick={() => setDiagramTab('system')}
                >
                  High-Level
                </button>
                <button
                  type="button"
                  className={diagramTab === 'flows' ? 'tab active' : 'tab'}
                  onClick={() => setDiagramTab('flows')}
                >
                  Flow Diagrams
                </button>
                <button
                  type="button"
                  className={diagramTab === 'models' ? 'tab active' : 'tab'}
                  onClick={() => setDiagramTab('models')}
                >
                  Model Diagram
                </button>
              </div>

              {diagramTab === 'system' ? <MermaidDiagram {...diagrams[0]} chart={diagrams[0].mermaid} /> : null}
              {diagramTab === 'flows' ? (
                <div className="diagram-stack">
                  <MermaidDiagram {...diagrams[1]} chart={diagrams[1].mermaid} />
                  <MermaidDiagram {...diagrams[2]} chart={diagrams[2].mermaid} />
                  <MermaidDiagram {...diagrams[3]} chart={diagrams[3].mermaid} />
                </div>
              ) : null}
              {diagramTab === 'models' ? <MermaidDiagram {...diagrams[4]} chart={diagrams[4].mermaid} /> : null}
            </article>
          </section>
        ) : null}

        {active === 'backend' ? (
          <section className="content-grid">
            <article className="card">
              <h3>Django Project Structure</h3>
              <div className="card-grid three">
                {backendStructure.map((part) => (
                  <article key={part.module} className="mini-card">
                    <h4>{part.module}</h4>
                    <ul className="tight-list">
                      {part.responsibilities.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            </article>

            <Accordion
              title="Current API and Behavior"
              subtitle={<StatusBadge state="implemented" />}
              defaultOpen
            >
              <ul className="tight-list">
                {backendBehaviors.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </Accordion>

            <Accordion title="Service Layer Snapshot" subtitle={<StatusBadge state="partial" />} defaultOpen>
              <ul className="tight-list">
                <li>
                  <code>parcel_app/services/extraction_service.py</code> contains manual and Ollama extraction
                  functions.
                </li>
                <li>
                  Extraction runs track status transitions (<code>running</code> → <code>completed/failed</code>) and
                  errors.
                </li>
                <li>
                  Raw model text is persisted before normalization to preserve audit context.
                </li>
              </ul>
            </Accordion>
          </section>
        ) : null}

        {active === 'frontend' ? (
          <section className="content-grid">
            <article className="card">
              <h3>Current Map Flow (App.tsx)</h3>
              <ol className="ordered-list">
                {frontendFlow.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ol>
            </article>

            <article className="card">
              <h3>Map Rendering Diagram</h3>
              <MermaidDiagram {...diagrams[2]} chart={diagrams[2].mermaid} />
            </article>

            <article className="card tone-warn">
              <h3>Frontend Limitations / Next Steps</h3>
              <ul className="tight-list">
                {frontendLimits.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </article>
          </section>
        ) : null}

        {active === 'gis' ? (
          <section className="content-grid">
            <article className="card">
              <h3>Current GIS Models</h3>
              <div className="card-grid three">
                {gisModels.map((model) => (
                  <article key={model.model} className="mini-card">
                    <h4>{model.model}</h4>
                    <ul className="tight-list">
                      {model.fields.map((field) => (
                        <li key={field}>{field}</li>
                      ))}
                    </ul>
                    <p className="muted">{model.notes}</p>
                  </article>
                ))}
              </div>
            </article>

            <article className="card">
              <h3>GIS Concepts in This Codebase</h3>
              <div className="chip-row concepts">
                <span className="concept-chip" title="Coordinate Reference System identifier">
                  SRID 4326
                </span>
                <span className="concept-chip" title="Bounding box viewport filter from frontend map bounds">
                  BBox Query
                </span>
                <span className="concept-chip" title="Geometry intersection test in database query">
                  ST_Intersects Equivalent
                </span>
                <span className="concept-chip" title="Current geometry storage type for parcels">
                  MultiPolygon
                </span>
                <span className="concept-chip" title="Spatial index enabled on Parcel.geom">
                  Spatial Index
                </span>
              </div>
            </article>

            <MermaidDiagram {...diagrams[4]} chart={diagrams[4].mermaid} />
          </section>
        ) : null}

        {active === 'ai' ? (
          <section className="content-grid">
            <article className="card">
              <h3>AI Extraction Models</h3>
              <div className="card-grid three">
                {aiModels.map((model) => (
                  <article key={model.model} className="mini-card">
                    <div className="card-title-row">
                      <h4>{model.model}</h4>
                      <StatusBadge state={model.state} />
                    </div>
                    <p>{model.summary}</p>
                  </article>
                ))}
              </div>
            </article>

            <Accordion title="Current Manual + LLM Paths" subtitle={<StatusBadge state="partial" />} defaultOpen>
              <ul className="tight-list">
                {aiWorkflowFacts.map((fact) => (
                  <li key={fact}>{fact}</li>
                ))}
              </ul>
            </Accordion>

            <article className="card-grid two">
              <article className="card tone-good">
                <h3>Where AI Is Currently Used</h3>
                <ul className="tight-list">
                  {aiBoundaries.implemented.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </article>

              <article className="card tone-muted">
                <h3>Where AI Is Planned</h3>
                <ul className="tight-list">
                  {aiBoundaries.planned.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </article>
            </article>

            <MermaidDiagram {...diagrams[3]} chart={diagrams[3].mermaid} />
          </section>
        ) : null}

        {active === 'flows' ? (
          <section className="content-grid">
            <article className="card">
              <div className="tab-row">
                {flowCards.map((flow) => (
                  <button
                    key={flow.id}
                    type="button"
                    className={flowTab === flow.id ? 'tab active' : 'tab'}
                    onClick={() => setFlowTab(flow.id as 'ingestion' | 'render' | 'ai')}
                  >
                    {flow.title}
                  </button>
                ))}
              </div>

              {flowCards
                .filter((flow) => flow.id === flowTab)
                .map((flow) => (
                  <article key={flow.id} className="mini-card flow-card">
                    <div className="card-title-row">
                      <h3>{flow.title}</h3>
                      <StatusBadge state={flow.state} />
                    </div>
                    <ol className="ordered-list">
                      {flow.steps.map((step) => (
                        <li key={step}>{step}</li>
                      ))}
                    </ol>
                  </article>
                ))}
            </article>

            <div className="diagram-stack">
              <MermaidDiagram {...diagrams[1]} chart={diagrams[1].mermaid} />
              <MermaidDiagram {...diagrams[2]} chart={diagrams[2].mermaid} />
              <MermaidDiagram {...diagrams[3]} chart={diagrams[3].mermaid} />
            </div>
          </section>
        ) : null}

        {active === 'relationships' ? (
          <section className="content-grid">
            <article className="card">
              <h3>Folder / Module Responsibilities</h3>
              <div className="card-grid two">
                {folderMap.map((node) => (
                  <article key={node.path} className="mini-card">
                    <h4>{node.path}</h4>
                    <p>{node.role}</p>
                    <ul className="tight-list">
                      {node.interactions.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            </article>

            <MermaidDiagram {...diagrams[0]} chart={diagrams[0].mermaid} />
            <MermaidDiagram {...diagrams[4]} chart={diagrams[4].mermaid} />
          </section>
        ) : null}

        {active === 'status' ? (
          <section className="content-grid">
            <article className="card-grid three">
              <article className="card tone-good">
                <div className="card-title-row">
                  <h3>Built</h3>
                  <StatusBadge state="implemented" />
                </div>
                <ul className="tight-list">
                  {statusBoard.built.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </article>

              <article className="card tone-muted">
                <div className="card-title-row">
                  <h3>Partially Built</h3>
                  <StatusBadge state="partial" />
                </div>
                <ul className="tight-list">
                  {statusBoard.partial.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </article>

              <article className="card tone-warn">
                <div className="card-title-row">
                  <h3>Missing / Next</h3>
                  <StatusBadge state="planned" />
                </div>
                <ul className="tight-list">
                  {statusBoard.missing.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </article>
            </article>
          </section>
        ) : null}

        {active === 'glossary' ? (
          <section className="content-grid">
            <article className="card">
              <h3>GIS + AI Glossary (Project-specific)</h3>
              <div className="glossary-grid">
                {glossary.map((entry) => (
                  <article key={entry.term} className="mini-card">
                    <h4>{entry.term}</h4>
                    <p>{entry.definition}</p>
                    {entry.hint ? <p className="muted">{entry.hint}</p> : null}
                  </article>
                ))}
              </div>
            </article>
          </section>
        ) : null}
      </main>
    </div>
  )
}

export default App
