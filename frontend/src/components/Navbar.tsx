import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { motion } from 'framer-motion'

const LINKS = [
  { to: '/', label: 'Intro' },
  { to: '/try', label: 'Try it' },
  { to: '/demo', label: 'Demo' },
]

export function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <motion.header
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className="fixed inset-x-0 top-0 z-50"
    >
      <div
        className={`border-b backdrop-blur-xl transition-all duration-500 ${
          scrolled
            ? 'border-white/[0.07] bg-ink-950/75'
            : 'border-transparent bg-ink-950/25'
        }`}
      >
        <div className="shell flex h-16 items-center justify-between">
          <NavLink
            to="/"
            className="group flex items-center gap-2.5 rounded-full py-1 pr-2 transition-opacity hover:opacity-90"
            aria-label="SovereignVoice introduction"
          >
            <span className="text-3xl font-medium tracking-[-0.01em] text-mist-50">
              Sovereign<span className="text-mist-300">Voice</span>
            </span>
          </NavLink>

          <nav className="flex items-center gap-1" aria-label="Primary">
            {LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end
                className={({ isActive }) =>
                  `relative rounded-full px-3 py-2 text-[12.5px] font-medium transition-colors duration-300 sm:px-4 sm:text-[13.5px] ${
                    isActive ? 'text-white' : 'text-mist-400 hover:text-mist-100'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {link.label}
                    {isActive && (
                      <motion.span
                        layoutId="nav-active"
                        className="absolute inset-0 -z-10 rounded-full border border-white/10 bg-white/[0.06]"
                        transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                      />
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </nav>
        </div>
      </div>
    </motion.header>
  )
}
