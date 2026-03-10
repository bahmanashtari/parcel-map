import { useState, type ReactNode } from 'react'

type Props = {
  title: string
  subtitle?: ReactNode
  defaultOpen?: boolean
  children: ReactNode
}

export function Accordion({ title, subtitle, defaultOpen = false, children }: Props) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <section className="accordion">
      <button
        type="button"
        className="accordion-toggle"
        onClick={() => setIsOpen((value) => !value)}
        aria-expanded={isOpen}
      >
        <span>
          <strong>{title}</strong>
          {subtitle ? <span className="accordion-subtitle">{subtitle}</span> : null}
        </span>
        <span className="accordion-icon">{isOpen ? '−' : '+'}</span>
      </button>
      {isOpen ? <div className="accordion-content">{children}</div> : null}
    </section>
  )
}
