import type { ReactNode } from 'react'
import { Reveal } from './Reveal'

interface SectionHeadingProps {
  eyebrow?: string
  title: ReactNode
  description?: ReactNode
  align?: 'left' | 'center'
  className?: string
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = 'left',
  className = '',
}: SectionHeadingProps) {
  const alignment = align === 'center' ? 'text-center mx-auto items-center' : 'items-start'
  return (
    <Reveal className={`flex flex-col ${alignment} ${className}`}>
      {eyebrow && <span className="label mb-4">{eyebrow}</span>}
      <h2 className="max-w-3xl text-3xl font-medium leading-[1.12] tracking-[-0.02em] text-mist-50 sm:text-4xl md:text-[2.85rem]">
        {title}
      </h2>
      {description && (
        <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-mist-400 sm:text-base">
          {description}
        </p>
      )}
    </Reveal>
  )
}
