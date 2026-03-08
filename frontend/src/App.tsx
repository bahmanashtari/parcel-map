import { useEffect, useRef } from 'react'
import type { FeatureCollection } from 'geojson'
import maplibregl, { type StyleSpecification } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

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

function App() {
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
        `http://127.0.0.1:8000/api/parcels/?bbox=${bbox}`,
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

export default App
