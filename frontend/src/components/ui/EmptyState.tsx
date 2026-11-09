import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon: ReactNode
  title: string
  description: string
  action?: ReactNode
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 bg-white/[0.015] px-6 py-20 text-center">
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-mist-400">
        {icon}
      </div>
      <h3 className="text-[17px] font-medium text-mist-100">{title}</h3>
      <p className="mt-2 max-w-md text-[13.5px] leading-relaxed text-mist-500">{description}</p>
      {action && <div className="mt-7">{action}</div>}
    </div>
  )
}
