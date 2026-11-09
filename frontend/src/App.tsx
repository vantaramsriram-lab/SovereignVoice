import { useEffect } from 'react'
import {
  Route,
  Routes,
  useLocation,
} from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Navbar } from './components/Navbar'
import { Footer } from './components/Footer'
import { Home } from './pages/Home'
import { Demo } from './pages/Demo'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [pathname])
  return null
}

function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
      <p className="label mb-3">404</p>
      <h1 className="text-2xl font-medium text-mist-50">This page does not exist.</h1>
      <p className="mt-2 text-[13.5px] text-mist-500">
        SovereignVoice has exactly two pages: Home and Demo.
      </p>
    </div>
  )
}

export default function App() {
  const location = useLocation()

  return (
    <div className="relative flex min-h-screen flex-col bg-ink-950">
      <Navbar />
      <ScrollToTop />
      <main className="flex-1">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          >
            <Routes location={location}>
              <Route path="/" element={<Home />} />
              <Route path="/demo" element={<Demo />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </main>
      <Footer />
    </div>
  )
}
