import { useEffect, useId, useState } from 'react'
import mermaid from 'mermaid'

type Props = {
  title: string
  description?: string
  chart: string
}

mermaid.initialize({
  startOnLoad: false,
  securityLevel: 'loose',
  theme: 'neutral',
  flowchart: { useMaxWidth: true, htmlLabels: true },
})

export function MermaidDiagram({ title, description, chart }: Props) {
  const [svg, setSvg] = useState<string>('')
  const [error, setError] = useState<string>('')
  const id = useId().replace(/:/g, '_')

  useEffect(() => {
    let cancelled = false

    async function renderDiagram() {
      try {
        setError('')
        const { svg: rendered } = await mermaid.render(`mermaid_${id}`, chart)
        if (!cancelled) {
          setSvg(rendered)
        }
      } catch (err) {
        if (!cancelled) {
          setError(String(err))
        }
      }
    }

    void renderDiagram()

    return () => {
      cancelled = true
    }
  }, [chart, id])

  return (
    <article className="diagram-card">
      <header className="diagram-header">
        <h3>{title}</h3>
        {description ? <p>{description}</p> : null}
      </header>
      {error ? (
        <pre className="diagram-error">{error}</pre>
      ) : (
        <div className="mermaid-svg" dangerouslySetInnerHTML={{ __html: svg }} />
      )}
    </article>
  )
}
