import { useEffect, useRef, useState } from 'react'
import type { FeatureCollection } from 'geojson'
import maplibregl, { type StyleSpecification } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

const API_BASE_URL = 'http://127.0.0.1:8000'
const DOCUMENTS_HASH = '#documents'

type AppView = 'map' | 'documents'

type DocumentListItem = {
  id: number
  title: string
  document_type: string
  status: string
  created_at: string
  jurisdiction_name: string
  constraint_count: number
}

type DocumentDetail = {
  id: number
  title: string
  document_type: string
  status: string
  created_at: string
  source_url: string | null
  file_path: string | null
  jurisdiction_name: string
  source_name: string | null
  constraint_count: number
}

type ExtractedConstraint = {
  id: number
  constraint_type: string
  value_text: string
  unit: string | null
  applies_to: string | null
  citation_text: string
  page_number: number | null
  created_at: string
}

function getViewFromHash(hash: string): AppView {
  return hash === DOCUMENTS_HASH ? 'documents' : 'map'
}

function formatDate(value: string): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }
  return parsed.toLocaleString()
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`)
  }
  return (await response.json()) as T
}

function collectLngLatPairs(
  value: unknown,
  points: Array<[number, number]>,
): void {
  if (!Array.isArray(value)) {
    return
  }

  // GeoJSON coordinate pair: [lng, lat]
  if (
    value.length >= 2 &&
    typeof value[0] === 'number' &&
    typeof value[1] === 'number'
  ) {
    points.push([value[0], value[1]])
    return
  }

  for (const item of value) {
    collectLngLatPairs(item, points)
  }
}

function getFeatureCollectionBounds(geojson: FeatureCollection) {
  const points: Array<[number, number]> = []

  for (const feature of geojson.features) {
    if (feature.geometry && 'coordinates' in feature.geometry) {
      collectLngLatPairs(feature.geometry.coordinates, points)
    }
  }

  if (points.length === 0) {
    return null
  }

  let minLng = points[0][0]
  let minLat = points[0][1]
  let maxLng = points[0][0]
  let maxLat = points[0][1]

  for (const [lng, lat] of points) {
    minLng = Math.min(minLng, lng)
    minLat = Math.min(minLat, lat)
    maxLng = Math.max(maxLng, lng)
    maxLat = Math.max(maxLat, lat)
  }

  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ] as [[number, number], [number, number]]
}

function MapView() {
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const isAutoFittingRef = useRef(false)

  useEffect(() => {
    if (!mapContainerRef.current) {
      return
    }

    const style: StyleSpecification = {
      version: 8,
      sources: {
        osm: {
          type: 'raster',
          tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
          tileSize: 256,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        },
      },
      layers: [
        {
          id: 'osm-raster',
          type: 'raster',
          source: 'osm',
        },
      ],
    }

    mapRef.current = new maplibregl.Map({
      container: mapContainerRef.current,
      style,
      center: [-121.9886, 37.5483],
      zoom: 11,
    })

    const onMoveEnd = async () => {
      if (!mapRef.current) {
        return
      }

      // Skip the moveend fired by our own fitBounds call.
      if (isAutoFittingRef.current) {
        isAutoFittingRef.current = false
        return
      }

      const map = mapRef.current
      const bounds = mapRef.current.getBounds()
      const west = bounds.getWest()
      const south = bounds.getSouth()
      const east = bounds.getEast()
      const north = bounds.getNorth()

      const bbox = `${west},${south},${east},${north}`
      console.log(bbox)

      const response = await fetch(
        `${API_BASE_URL}/api/parcels/?bbox=${bbox}`,
      )
      const geojson = (await response.json()) as FeatureCollection
      console.log(geojson)

      const source = map.getSource('parcels') as maplibregl.GeoJSONSource | undefined
      if (source) {
        source.setData(geojson)
      } else {
        map.addSource('parcels', {
          type: 'geojson',
          data: geojson,
        })
      }

      if (!map.getLayer('parcels-fill')) {
        map.addLayer({
          id: 'parcels-fill',
          type: 'fill',
          source: 'parcels',
          paint: {
            'fill-color': '#2d6a4f',
            'fill-opacity': 0.2,
          },
        })
      }

      if (!map.getLayer('parcels-outline')) {
        map.addLayer({
          id: 'parcels-outline',
          type: 'line',
          source: 'parcels',
          paint: {
            'line-color': '#1b4332',
            'line-width': 1,
          },
        })
      }

      // If we received features, zoom the map to their overall extent.
      const hasFeatures = (geojson.features?.length ?? 0) > 0
      if (hasFeatures) {
        const parcelBounds = getFeatureCollectionBounds(geojson)
        if (parcelBounds) {
          isAutoFittingRef.current = true
          map.fitBounds(parcelBounds, { padding: 24 })
        }
      }
    }

    mapRef.current.on('moveend', onMoveEnd)
    mapRef.current.once('load', () => {
      void onMoveEnd()
    })

    return () => {
      mapRef.current?.off('moveend', onMoveEnd)
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [])

  return (
    <main className="app-shell">
      <div ref={mapContainerRef} className="map-container" />
    </main>
  )
}

function DocumentsView() {
  const [documents, setDocuments] = useState<DocumentListItem[]>([])
  const [selectedDocumentId, setSelectedDocumentId] = useState<number | null>(null)
  const [documentDetail, setDocumentDetail] = useState<DocumentDetail | null>(null)
  const [constraints, setConstraints] = useState<ExtractedConstraint[]>([])
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false)
  const [isLoadingDetail, setIsLoadingDetail] = useState(false)
  const [documentsError, setDocumentsError] = useState<string | null>(null)
  const [detailError, setDetailError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const loadDocuments = async () => {
      setIsLoadingDocuments(true)
      setDocumentsError(null)

      try {
        const payload = await fetchJson<DocumentListItem[]>(`${API_BASE_URL}/api/documents/`)
        if (cancelled) {
          return
        }

        setDocuments(payload)
        setSelectedDocumentId((current) => {
          if (current !== null && payload.some((item) => item.id === current)) {
            return current
          }
          return payload.length > 0 ? payload[0].id : null
        })
      } catch (error) {
        if (cancelled) {
          return
        }
        setDocuments([])
        setSelectedDocumentId(null)
        setDocumentsError(error instanceof Error ? error.message : 'Failed to load documents.')
      } finally {
        if (!cancelled) {
          setIsLoadingDocuments(false)
        }
      }
    }

    void loadDocuments()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (selectedDocumentId === null) {
      setDocumentDetail(null)
      setConstraints([])
      setDetailError(null)
      return
    }

    let cancelled = false

    const loadDocumentData = async () => {
      setIsLoadingDetail(true)
      setDetailError(null)
      setDocumentDetail(null)
      setConstraints([])

      try {
        const [detailPayload, constraintsPayload] = await Promise.all([
          fetchJson<DocumentDetail>(`${API_BASE_URL}/api/documents/${selectedDocumentId}/`),
          fetchJson<ExtractedConstraint[]>(
            `${API_BASE_URL}/api/documents/${selectedDocumentId}/constraints/`,
          ),
        ])

        if (cancelled) {
          return
        }

        setDocumentDetail(detailPayload)
        setConstraints(constraintsPayload)
      } catch (error) {
        if (cancelled) {
          return
        }
        setDetailError(error instanceof Error ? error.message : 'Failed to load document details.')
      } finally {
        if (!cancelled) {
          setIsLoadingDetail(false)
        }
      }
    }

    void loadDocumentData()

    return () => {
      cancelled = true
    }
  }, [selectedDocumentId])

  return (
    <main className="documents-shell">
      <div className="documents-layout">
        <aside className="documents-list-panel">
          <h2>Documents</h2>

          {isLoadingDocuments ? <p>Loading documents...</p> : null}
          {documentsError ? <p className="status-error">{documentsError}</p> : null}
          {!isLoadingDocuments && !documentsError && documents.length === 0 ? (
            <p>No documents found.</p>
          ) : null}

          <ul className="documents-list">
            {documents.map((document) => (
              <li key={document.id}>
                <button
                  type="button"
                  className={
                    document.id === selectedDocumentId
                      ? 'document-list-item active'
                      : 'document-list-item'
                  }
                  onClick={() => setSelectedDocumentId(document.id)}
                >
                  <span className="document-list-title">{document.title}</span>
                  <span className="document-list-meta">
                    {document.document_type} | {document.status}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <section className="document-detail-panel">
          {selectedDocumentId === null ? <p>Select a document to view details.</p> : null}
          {isLoadingDetail ? <p>Loading document details...</p> : null}
          {detailError ? <p className="status-error">{detailError}</p> : null}

          {documentDetail ? (
            <>
              <h2>{documentDetail.title}</h2>

              <dl className="document-metadata">
                <div>
                  <dt>Type</dt>
                  <dd>{documentDetail.document_type}</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>{documentDetail.status}</dd>
                </div>
                <div>
                  <dt>Created</dt>
                  <dd>{formatDate(documentDetail.created_at)}</dd>
                </div>
                <div>
                  <dt>Jurisdiction</dt>
                  <dd>{documentDetail.jurisdiction_name}</dd>
                </div>
                <div>
                  <dt>Source</dt>
                  <dd>{documentDetail.source_name ?? 'N/A'}</dd>
                </div>
                <div>
                  <dt>Constraint Count</dt>
                  <dd>{documentDetail.constraint_count}</dd>
                </div>
                <div>
                  <dt>Source URL</dt>
                  <dd>
                    {documentDetail.source_url ? (
                      <a href={documentDetail.source_url} target="_blank" rel="noreferrer">
                        {documentDetail.source_url}
                      </a>
                    ) : (
                      'N/A'
                    )}
                  </dd>
                </div>
                <div>
                  <dt>File Path</dt>
                  <dd>{documentDetail.file_path ?? 'N/A'}</dd>
                </div>
              </dl>

              <h3>Extracted Constraints</h3>
              {constraints.length === 0 ? <p>No extracted constraints for this document.</p> : null}

              <ul className="constraints-list">
                {constraints.map((constraint) => (
                  <li key={constraint.id} className="constraint-item">
                    <div className="constraint-header">
                      <strong>{constraint.constraint_type}</strong>
                      <span>{formatDate(constraint.created_at)}</span>
                    </div>
                    <p>
                      <strong>Value:</strong>{' '}
                      {constraint.unit
                        ? `${constraint.value_text} ${constraint.unit}`
                        : constraint.value_text}
                    </p>
                    <p>
                      <strong>Applies To:</strong> {constraint.applies_to ?? 'N/A'}
                    </p>
                    <p>
                      <strong>Page:</strong> {constraint.page_number ?? 'N/A'}
                    </p>
                    <p className="constraint-citation">
                      <strong>Citation:</strong> {constraint.citation_text}
                    </p>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </section>
      </div>
    </main>
  )
}

function App() {
  const [view, setView] = useState<AppView>(() => getViewFromHash(window.location.hash))

  useEffect(() => {
    const onHashChange = () => {
      setView(getViewFromHash(window.location.hash))
    }

    window.addEventListener('hashchange', onHashChange)
    return () => {
      window.removeEventListener('hashchange', onHashChange)
    }
  }, [])

  const showMapView = view === 'map'

  const onSelectMapView = () => {
    if (window.location.hash) {
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`)
    }
    setView('map')
  }

  const onSelectDocumentsView = () => {
    if (window.location.hash !== DOCUMENTS_HASH) {
      window.location.hash = DOCUMENTS_HASH
      return
    }
    setView('documents')
  }

  return (
    <div className="app-root">
      <nav className="app-nav" aria-label="Primary views">
        <button
          type="button"
          className={showMapView ? 'nav-button active' : 'nav-button'}
          onClick={onSelectMapView}
        >
          Map
        </button>
        <button
          type="button"
          className={!showMapView ? 'nav-button active' : 'nav-button'}
          onClick={onSelectDocumentsView}
        >
          AI Documents
        </button>
      </nav>

      {showMapView ? <MapView /> : <DocumentsView />}
    </div>
  )
}

export default App
