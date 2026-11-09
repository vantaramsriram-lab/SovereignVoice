import type { ReactNode } from 'react'
import { PILL_CLASSES, type PillTone } from '../../utils/crm'

interface PillProps {
  tone?: PillTone
  children: ReactNode
  className?: string
  dot?: boolean
}

export function Pill({ tone = 'neutral', children, className = '', dot = false }: PillProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-[3px] text-[11px] font-medium leading-5 tracking-wide ${PILL_CLASSES[tone]} ${className}`}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />}
      {children}
    </span>
  )
}
