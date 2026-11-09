import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Archive, ArrowRight, Database, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { DemoRecord } from '../types'
import {
  clearRecords,
  deleteRecord,
  readRecords,
  storageFootprint,
} from '../services/storage'
import { DemoEntry } from '../components/demo/DemoEntry'
import { EmptyState } from '../components/ui/EmptyState'
import { Notice } from '../components/ui/Notice'
import { BackgroundAura } from '../components/ui/BackgroundAura'

export function Demo() {
  const [records, setRecords] = useState<DemoRecord[]>([])
  const [footprint, setFootprint] = useState('0 KB')
  const [error, setError] = useState<string | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)

  const refresh = useCallback(() => {
    const stored = readRecords()
    setRecords(stored)
    setFootprint(storageFootprint().readable)
  }, [])

  useEffect(() => {
    refresh()
    // Keep the page in sync if another tab writes a record.
    const onStorage = (event: StorageEvent) => {
      if (event.key === 'sovereignvoice.records.v1') refresh()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [refresh])

  const handleDelete = (id: string) => {
    try {
      setRecords(deleteRecord(id))
      setFootprint(storageFootprint().readable)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete this record.')
    }
  }

  const handleClearAll = () => {
    clearRecords()
    setRecords([])
    setConfirmClear(false)
    setFootprint('0 KB')
  }

  return (
    <div className="pb-20 pt-28 sm:pt-32">
      <BackgroundAura variant="soft" />
      <div className="shell relative">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="label mb-3">Demo library</p>
            <h1 className="text-3xl font-medium tracking-[-0.025em] text-mist-50 sm:text-[2.6rem]">
              Saved analyses
            </h1>
            <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-mist-400">
              Every analysis you run on the Home page is stored in this browser only.
              Nothing is uploaded anywhere else, and no customer data leaves your machine
              beyond the analysis request itself.
            </p>
          </div>

          <div className="flex items-center gap-3 text-[11.5px] text-mist-500">
            <span className="flex items-center gap-1.5 rounded-full border border-white/[0.08] px-3 py-1.5">
              <Database size={11} />
              {records.length} record{records.length === 1 ? '' : 's'} · {footprint}
            </span>
            {records.length > 0 &&
              (confirmClear ? (
                <span className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleClearAll}
                    className="rounded-full bg-danger/15 px-3 py-1.5 font-medium text-danger transition-colors hover:bg-danger/25"
                  >
                    Confirm clear
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmClear(false)}
                    className="px-1 text-mist-500 hover:text-mist-200"
                  >
                    Cancel
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmClear(true)}
                  className="flex items-center gap-1.5 rounded-full border border-white/[0.08] px-3 py-1.5 transition-colors hover:border-danger/40 hover:text-danger"
                >
                  <Trash2 size={11} />
                  Clear all
                </button>
              ))}
          </div>
        </div>

        {error && (
          <Notice tone="danger" className="mt-6" title="Storage error">
            {error}
          </Notice>
        )}

        <div className="mt-10">
          {records.length === 0 ? (
            <EmptyState
              icon={<Archive size={20} />}
              title="No saved analyses yet"
              description="Run an analysis on the Home page and it will appear here — with the customer audio, the generated localized response, and the verified CRM record."
              action={
                <Link to="/" className="btn-primary">
                  Run an analysis <ArrowRight size={15} />
                </Link>
              }
            />
          ) : (
            <motion.div layout className="space-y-4">
              <AnimatePresence initial={false}>
                {records.map((record) => (
                  <DemoEntry key={record.id} record={record} onDelete={handleDelete} />
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </div>

        <p className="mt-10 text-[11px] leading-relaxed text-mist-600">
          Records are stored in this browser's localStorage and are capped to keep storage
          healthy. No API keys, tokens or credentials are ever stored here. Separate
          illustrative sample scenarios live in the project's{' '}
          <code className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[10.5px]">
            demo_scenarios/
          </code>{' '}
          folder and are not presented as real customer analyses.
        </p>
      </div>
    </div>
  )
}
