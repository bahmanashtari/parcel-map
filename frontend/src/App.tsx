import { useEffect, useRef } from 'react'
import maplibregl, { type StyleSpecification } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

function App() {
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)

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
      const geojson = await response.json()
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
    }

    mapRef.current.on('moveend', onMoveEnd)

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
