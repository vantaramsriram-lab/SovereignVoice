import { Link } from 'react-router-dom'

/**
 * Footer modelled on the reference: a full-width charcoal field, oversized
 * wordmark made of concentric outlines, then a thin legal strip.
 * No copied branding — the mark and copy are SovereignVoice's own.
 */
export function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="relative overflow-hidden">
      {/* smooth transition from the dark page into the footer field */}
      <div className="h-px w-full bg-gradient-to-r from-transparent via-white/12 to-transparent" />
      <div className="relative bg-ink-900">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.5]"
          style={{
            background:
              'radial-gradient(ellipse 90% 60% at 50% 120%, rgba(255,255,255,0.07), transparent 70%)',
          }}
          aria-hidden="true"
        />

        <div className="shell relative pt-20 sm:pt-24">
          <div className="flex flex-col gap-10 pb-14 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-sm">
              <div className="flex items-center gap-2.5">
                <span className="text-[15px] font-medium text-mist-50">
                  Sovereign<span className="text-mist-300">Voice</span>
                </span>
              </div>
              <p className="mt-4 text-[13.5px] leading-relaxed text-mist-500">
                Multilingual voice intelligence for BFSI collection operations.
                Understanding first — decisions stay with your people.
              </p>
            </div>

            <nav className="flex gap-14 text-[13px]" aria-label="Footer">
              <div className="flex flex-col gap-2.5">
                <span className="label mb-1">Product</span>
                <Link to="/" className="text-mist-400 transition-colors hover:text-mist-100">
                  Home
                </Link>
                <Link to="/demo" className="text-mist-400 transition-colors hover:text-mist-100">
                  Demo
                </Link>
              </div>
              <div className="flex flex-col gap-2.5">
                <span className="label mb-1">Pipeline</span>
                <span className="text-mist-500">Gnani Prisma · STT</span>
                <span className="text-mist-500">Groq - qwen/qwen3.8-27b</span>
                <span className="text-mist-500">Gnani Timbre · TTS</span>
              </div>
            </nav>
          </div>

          {/* oversized wordmark — sized with a ratio so it always fits edge to edge */}
          <div className="relative select-none pb-12 pt-2" aria-hidden="true">
            <div
              className="whitespace-nowrap text-center font-medium leading-[0.82] tracking-[-0.045em] text-transparent"
              style={{
                // The shell is max 1180px wide with 24px side padding; this word
                // measures ~6.32x its font-size in the UI font, so dividing the
                // available width keeps it exactly edge to edge at every width.
                fontSize: 'min(11rem, calc((min(100vw, 1180px) - 48px) / 6.5))',
                WebkitTextStroke: '1px rgba(255,255,255,0.17)',
              }}
            >
              SovereignVoice
            </div>
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-ink-900 to-transparent" />
          </div>

          <div className="flex flex-col gap-3 border-t border-white/[0.07] py-7 text-[12px] text-mist-600 sm:flex-row sm:items-center sm:justify-between">
            <p>Copyright © {year} SovereignVoice. All rights reserved.</p>
          </div>
        </div>
      </div>
    </footer>
  )
}
