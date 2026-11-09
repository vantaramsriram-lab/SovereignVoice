import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react'
import type { ReactNode } from 'react'

type NoticeTone = 'info' | 'warning' | 'danger' | 'success'

const TONES: Record<NoticeTone, { wrapper: string; icon: ReactNode }> = {
  info: {
    wrapper: 'border-white/10 bg-white/[0.03] text-mist-300',
    icon: <Info size={16} className="text-mist-400" />,
  },
  warning: {
    wrapper: 'border-warn/25 bg-warn/[0.07] text-warn',
    icon: <AlertTriangle size={16} className="text-warn" />,
  },
  danger: {
    wrapper: 'border-danger/30 bg-danger/[0.07] text-danger',
    icon: <XCircle size={16} className="text-danger" />,
  },
  success: {
    wrapper: 'border-accent/25 bg-accent/[0.06] text-accent-soft',
    icon: <CheckCircle2 size={16} className="text-accent" />,
  },
}

interface NoticeProps {
  tone?: NoticeTone
  title?: string
  children?: ReactNode
  className?: string
  action?: ReactNode
}

export function Notice({ tone = 'info', title, children, className = '', action }: NoticeProps) {
  const config = TONES[tone]
  return (
    <div
      className={`flex items-start gap-3 rounded-2xl border px-4 py-3.5 text-[13px] leading-relaxed ${config.wrapper} ${className}`}
      role={tone === 'danger' ? 'alert' : 'status'}
    >
      <span className="mt-[1px] shrink-0">{config.icon}</span>
      <div className="min-w-0 flex-1">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className={title ? 'mt-1 opacity-90' : ''}>{children}</div>}
      </div>
      {action}
    </div>
  )
}
