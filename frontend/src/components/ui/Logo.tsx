interface LogoProps {
  size?: number
  className?: string
  animated?: boolean
}

/**
 * SovereignVoice mark: a sovereign seal made of concentric arcs that resolve
 * into a speech signal. Drawn inline so it never depends on a network asset.
 */
export function Logo({ size = 28, className = '', animated = false }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="sv-mark" x1="4" y1="2" x2="28" y2="30" gradientUnits="userSpaceOnUse">
          <stop stopColor="#f7f7f9" />
          <stop offset="1" stopColor="#8ff0c6" />
        </linearGradient>
      </defs>
      <circle cx="16" cy="16" r="14.2" stroke="url(#sv-mark)" strokeOpacity="0.28" strokeWidth="1.1" />
      <path
        d="M16 4.6c5.1 0 9.3 3.6 9.3 8.1 0 4.4-4.2 8-9.3 8-1.6 0-3-.3-4.3-.9l-4.4 2.2 1.1-3.9c-1.1-1.5-1.7-3.3-1.7-5.4 0-4.5 4.2-8.1 9.3-8.1Z"
        stroke="url(#sv-mark)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <g stroke="url(#sv-mark)" strokeWidth="1.6" strokeLinecap="round">
        <path d="M13.1 11.6v4.4" />
        <path d="M16 9.9v7.8" />
        <path d="M18.9 12.6v2.4" />
      </g>
      {animated && (
        <circle
          cx="16"
          cy="16"
          r="14.2"
          stroke="#8ff0c6"
          strokeOpacity="0.5"
          strokeWidth="1"
          className="animate-pulse-ring"
          style={{ transformOrigin: '16px 16px' }}
        />
      )}
    </svg>
  )
}
