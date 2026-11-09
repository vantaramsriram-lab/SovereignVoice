import { motion } from 'framer-motion'
import { HelpCircle, Info, MinusCircle, Quote } from 'lucide-react'
import type { CustomerIntelligenceSummary } from '../../types'

interface IntelligenceSummaryProps {
  summary: CustomerIntelligenceSummary
}

const GROUPS = [
  {
    key: 'confirmed' as const,
    label: 'Confirmed by the customer',
    hint: 'Stated explicitly in the conversation',
    icon: Quote,
    tone: 'text-accent',
    bullet: 'bg-accent/70',
  },
  {
    key: 'inferred' as const,
    label: 'Inferred',
    hint: 'Interpretation, not a stated fact',
    icon: Info,
    tone: 'text-mist-300',
    bullet: 'bg-mist-400/70',
  },
  {
    key: 'uncertain' as const,
    label: 'Uncertain',
    hint: 'Ambiguous or possibly mis-transcribed',
    icon: HelpCircle,
    tone: 'text-warn',
    bullet: 'bg-warn/70',
  },
  {
    key: 'missing' as const,
    label: 'Missing',
    hint: 'Not present in the conversation',
    icon: MinusCircle,
    tone: 'text-mist-500',
    bullet: 'bg-mist-600',
  },
]

export function IntelligenceSummary({ summary }: IntelligenceSummaryProps) {
  return (
    <div>
      <p className="text-[15px] leading-[1.75] text-mist-200">{summary.narrative}</p>

      <div className="mt-7 grid gap-x-8 gap-y-6 sm:grid-cols-2">
        {GROUPS.map((group, groupIndex) => {
          const items = summary[group.key]
          if (!items || items.length === 0) return null
          const Icon = group.icon
          return (
            <motion.div
              key={group.key}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.05 * groupIndex }}
            >
              <div className="mb-2.5 flex items-center gap-2">
                <Icon size={13} className={group.tone} />
                <span className="text-[12px] font-medium text-mist-200">{group.label}</span>
                <span className="text-[10.5px] text-mist-600">{items.length}</span>
              </div>
              <ul className="space-y-1.5">
                {items.map((item, index) => (
                  <li
                    key={`${group.key}-${index}`}
                    className="flex gap-2.5 text-[13px] leading-relaxed text-mist-400"
                  >
                    <span
                      className={`mt-[7px] h-1 w-1 shrink-0 rounded-full ${group.bullet}`}
                      aria-hidden="true"
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[10.5px] text-mist-600">{group.hint}</p>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
