import { useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Archive, ArrowRight, Database, Sparkles, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { DemoRecord } from '../types'
import {
  clearRecords,
  deleteRecord,
  readRecords,
  recordsFootprint,
  subscribeToRecordChanges,
} from '../services/storage'
import { DemoEntry } from '../components/demo/DemoEntry'
import { EmptyState } from '../components/ui/EmptyState'
import { Notice } from '../components/ui/Notice'
import { BackgroundAura } from '../components/ui/BackgroundAura'

// Add approved, self-recorded exports here as JSON files. The glob stays empty
// until the user adds files, so a fresh clone has no public sample recordings.
const sampleModules = import.meta.glob<DemoRecord>('../samples/*.json', {
  eager: true,
  import: 'default',
})

export function Demo() {
  const [records, setRecords] = useState<DemoRecord[]>([])
  const [footprint, setFootprint] = useState('0 KB')
  const [error, setError] = useState<string | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const [loaded, setLoaded] = useState(false)

  const sampleRecords = useMemo(
    () =>
      Object.entries(sampleModules)
        .map(([path, record]) => ({
          ...record,
          id: `sample-${record.id || path.split('/').pop()}`,
        }))
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
    [],
  )

  const refresh = useCallback(async () => {
    try {
      const stored = await readRecords()
      setRecords(stored)
      setFootprint(recordsFootprint(stored))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load saved analyses.')
    } finally {
      setLoaded(true)
    }
  }, [])

  useEffect(() => {
    void refresh()
    return subscribeToRecordChanges(() => void refresh())
  }, [refresh])

  const handleDelete = async (id: string) => {
    try {
      await deleteRecord(id)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete this record.')
    }
  }

  const handleClearAll = async () => {
    try {
      await clearRecords()
      setRecords([])
      setFootprint('0 KB')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not clear saved analyses.')
    } finally {
      setConfirmClear(false)
    }
  }

  return (
    <div className="pb-20 pt-28 sm:pt-32">
      <BackgroundAura variant="soft" />
      <div className="shell relative">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="label mb-3">Demo library</p>
            <h1 className="text-3xl font-medium tracking-[-0.025em] text-mist-50 sm:text-[2.6rem]">
              Sample analyses and your recordings
            </h1>
            <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-mist-400">
              Explore the public sample analyses, then run your own recording. Your
              analyses stay in this browser; public samples are read-only and shared
              with every visitor.
            </p>
          </div>

          <div className="flex items-center gap-3 text-[11.5px] text-mist-500">
            <span className="flex items-center gap-1.5 rounded-full border border-white/[0.08] px-3 py-1.5">
              <Database size={11} />
              {records.length} your record{records.length === 1 ? '' : 's'} · {footprint}
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
                  Clear your analyses
                </button>
              ))}
          </div>
        </div>

        {error && (
          <Notice tone="danger" className="mt-6" title="Storage error">
            {error}
          </Notice>
        )}

        {sampleRecords.length > 0 && (
          <section className="mt-12">
            <div className="mb-5 flex items-center gap-2">
              <Sparkles size={15} className="text-mist-300" />
              <div>
                <p className="label">Shared with everyone</p>
                <h2 className="mt-1 text-xl font-medium text-mist-50">Sample analyses</h2>
              </div>
              <span className="ml-auto text-[11px] text-mist-600">
                {sampleRecords.length} public sample{sampleRecords.length === 1 ? '' : 's'}
              </span>
            </div>
            <div className="space-y-4">
              {sampleRecords.map((record) => (
                <DemoEntry key={record.id} record={record} readOnly />
              ))}
            </div>
          </section>
        )}

        <section className="mt-12">
          <div className="mb-5 flex items-center gap-2">
            <Archive size={15} className="text-mist-300" />
            <div>
              <p className="label">Private to this browser</p>
              <h2 className="mt-1 text-xl font-medium text-mist-50">Your analyses</h2>
            </div>
          </div>

          {!loaded ? null : records.length === 0 ? (
            <EmptyState
              icon={<Archive size={20} />}
              title="No analyses in this browser yet"
              description="Record or upload an audio sample on the Try page. Your analysis will appear here and remain in this browser until you delete it."
              action={
                <Link to="/try" className="btn-primary">
                  Try your own recording <ArrowRight size={15} />
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
        </section>

        <p className="mt-10 text-[11px] leading-relaxed text-mist-600">
          Your analyses are stored in this browser's local database. Public sample
          files are bundled with the website and are visible to every visitor. Never
          publish real customer recordings or confidential information.
        </p>
      </div>
    </div>
  )
}
