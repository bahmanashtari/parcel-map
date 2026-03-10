export type BuildState = 'implemented' | 'partial' | 'planned'

export type Diagram = {
  id: string
  title: string
  description: string
  mermaid: string
}

export type GlossaryTerm = {
  term: string
  definition: string
  hint?: string
}
