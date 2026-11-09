import type { DemoRecord, AnalysisResponse } from '../types'
import { audioUrlFromBase64, blobToDataUrl, probeAudioDuration } from './api'

/**
 * Browser persistence for demo records and UI preferences.
 *
 * Demo records (including their audio, kept as data URLs) live in IndexedDB.
 * localStorage is only about 5 MB, which a couple of analyses with audio can
 * fill, and the old localStorage-based code silently dropped older records when
 * that happened. IndexedDB has a much larger quota, so every analysis is kept
 * until the user deletes it.
 *
 * Small UI preferences stay in localStorage. No credentials are ever stored
 * here — only user-generated audio and the analysis output the backend already
 * returned.
 */

const DB_NAME = 'sovereignvoice'
const DB_VERSION = 1
const RECORDS_STORE = 'records'
const CHANGE_CHANNEL = 'sovereignvoice.records'
/** Where records lived before IndexedDB. Migrated once, then removed. */
const LEGACY_RECORDS_KEY = 'sovereignvoice.records.v1'
const PREFS_KEY = 'sovereignvoice.prefs.v1'

export interface Preferences {
  showTranscriptByDefault: boolean
  reducedMotion: boolean
}

export const DEFAULT_PREFERENCES: Preferences = {
  showTranscriptByDefault: false,
  reducedMotion: false,
}

export class StorageError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'StorageError'
  }
}

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

/* ------------------------------------------------------------------ */
/* IndexedDB helpers                                                   */
/* ------------------------------------------------------------------ */

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new StorageError('This browser does not support saving analyses.'))
      return
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(RECORDS_STORE)) {
        db.createObjectStore(RECORDS_STORE, { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () =>
      reject(new StorageError('Could not open browser storage for saved analyses.'))
  })
  // Allow a later call to retry if opening failed (e.g. private browsing).
  dbPromise.catch(() => {
    dbPromise = null
  })
  return dbPromise
}

function toStorageError(error: DOMException | null, fallback: string): StorageError {
  if (error && error.name === 'QuotaExceededError') {
    return new StorageError(
      'Browser storage is full, so this analysis could not be saved. ' +
        'Delete older demos (Demo page → Clear all) and try again.',
    )
  }
  return new StorageError(fallback)
}

/** Runs one request in its own transaction and resolves when it commits. */
async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
  failureMessage: string,
): Promise<T> {
  const db = await openDb()
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(RECORDS_STORE, mode)
    const request = run(transaction.objectStore(RECORDS_STORE))
    transaction.oncomplete = () => resolve(request.result)
    transaction.onerror = () => reject(toStorageError(transaction.error, failureMessage))
    transaction.onabort = () => reject(toStorageError(transaction.error, failureMessage))
  })
}

/* ------------------------------------------------------------------ */
/* One-time migration from localStorage                                */
/* ------------------------------------------------------------------ */

let migration: Promise<void> | null = null

function migrateLegacyRecords(): Promise<void> {
  if (migration) return migration
  migration = (async () => {
    let raw: string | null = null
    try {
      raw = window.localStorage.getItem(LEGACY_RECORDS_KEY)
    } catch {
      return
    }
    if (!raw) return

    const legacy = safeParse<DemoRecord[]>(raw, [])
    const valid = Array.isArray(legacy) ? legacy.filter(isValidRecord) : []

    if (valid.length > 0) {
      const db = await openDb()
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(RECORDS_STORE, 'readwrite')
        const store = transaction.objectStore(RECORDS_STORE)
        for (const record of valid) {
          // `add` fails on an existing id, so newer IndexedDB data is never
          // overwritten; ignore those per-record errors.
          const request = store.add(record)
          request.onerror = (event) => {
            event.preventDefault()
          }
        }
        transaction.oncomplete = () => resolve()
        transaction.onerror = () => reject(transaction.error)
        transaction.onabort = () => reject(transaction.error)
      })
    }

    try {
      window.localStorage.removeItem(LEGACY_RECORDS_KEY)
    } catch {
      /* nothing to do */
    }
  })().catch((error) => {
    // Retry on the next read instead of caching the failure.
    migration = null
    throw error
  })
  return migration
}

/* ------------------------------------------------------------------ */
/* Cross-tab change notifications                                      */
/* ------------------------------------------------------------------ */

function notifyRecordsChanged(): void {
  if (typeof BroadcastChannel === 'undefined') return
  try {
    const channel = new BroadcastChannel(CHANGE_CHANNEL)
    channel.postMessage('changed')
    channel.close()
  } catch {
    /* notifications are best-effort */
  }
}

/** Calls `onChange` when another tab adds, edits or removes a record. */
export function subscribeToRecordChanges(onChange: () => void): () => void {
  if (typeof BroadcastChannel === 'undefined') return () => undefined
  const channel = new BroadcastChannel(CHANGE_CHANNEL)
  channel.onmessage = () => onChange()
  return () => channel.close()
}

/* ------------------------------------------------------------------ */
/* Records                                                             */
/* ------------------------------------------------------------------ */

function isValidRecord(record: DemoRecord | null | undefined): record is DemoRecord {
  return Boolean(record && record.id && record.intelligence)
}

function timestamp(record: DemoRecord): number {
  const value = Date.parse(record.createdAt)
  return Number.isNaN(value) ? 0 : value
}

/** Every saved analysis, newest first. */
export async function readRecords(): Promise<DemoRecord[]> {
  if (typeof window === 'undefined') return []
  await migrateLegacyRecords()
  const all = await withStore<DemoRecord[]>(
    'readonly',
    (store) => store.getAll(),
    'Could not read saved analyses from browser storage.',
  )
  return all.filter(isValidRecord).sort((a, b) => timestamp(b) - timestamp(a))
}

export async function saveAnalysis(
  analysis: AnalysisResponse,
  inputAudioDataUrl: string,
): Promise<DemoRecord> {
  const inputLabel = analysis.input_audio.filename ?? 'Recording'
  const record: DemoRecord = {
    id: analysis.analysis_id,
    createdAt: analysis.created_at,
    label: inputLabel,
    agentContext: analysis.agent_context,
    inputAudio: {
      filename: inputLabel,
      mimeType: analysis.input_audio.mime_type,
      sizeBytes: analysis.input_audio.size_bytes,
      durationSeconds: analysis.input_audio.duration_seconds,
      dataUrl: inputAudioDataUrl,
    },
    outputAudio: {
      mimeType: analysis.response_audio.mime_type,
      extension: analysis.response_audio.extension,
      durationSeconds: analysis.response_audio.duration_seconds,
      voice: analysis.response_audio.voice,
      language: analysis.response_audio.language,
      dataUrl: audioUrlFromBase64(
        analysis.response_audio.base64,
        analysis.response_audio.mime_type,
      ),
    },
    transcript: analysis.transcript,
    intelligence: analysis.intelligence,
    stages: analysis.stages,
  }

  // Each analysis is its own entry (ids are unique), so saving a new one never
  // touches the existing ones. Older records are only removed by the user.
  await migrateLegacyRecords()
  await withStore(
    'readwrite',
    (store) => store.put(record),
    `"${record.label}" could not be saved to browser storage.`,
  )
  notifyRecordsChanged()
  return record
}

export async function buildInputDataUrl(blob: Blob): Promise<{
  dataUrl: string
  duration: number | null
}> {
  const [dataUrl, duration] = await Promise.all([
    blobToDataUrl(blob),
    probeAudioDuration(blob),
  ])
  return { dataUrl, duration }
}

export async function deleteRecord(id: string): Promise<void> {
  await withStore(
    'readwrite',
    (store) => store.delete(id),
    'Could not update browser storage.',
  )
  notifyRecordsChanged()
}

export async function clearRecords(): Promise<void> {
  await withStore(
    'readwrite',
    (store) => store.clear(),
    'Could not clear saved analyses.',
  )
  try {
    window.localStorage.removeItem(LEGACY_RECORDS_KEY)
  } catch {
    /* nothing to do */
  }
  notifyRecordsChanged()
}

export async function renameRecord(id: string, label: string): Promise<void> {
  const records = await readRecords()
  const current = records.find((record) => record.id === id)
  if (!current) return
  const updated: DemoRecord = { ...current, label: label.trim() || current.label }
  await withStore(
    'readwrite',
    (store) => store.put(updated),
    'Could not update browser storage.',
  )
  notifyRecordsChanged()
}

/** Approximate size of the given records; audio data URLs dominate the total. */
export function recordsFootprint(records: DemoRecord[]): string {
  const OVERHEAD_PER_RECORD = 4 * 1024
  const bytes = records.reduce(
    (sum, record) =>
      sum +
      record.inputAudio.dataUrl.length +
      record.outputAudio.dataUrl.length +
      OVERHEAD_PER_RECORD,
    0,
  )
  return bytes > 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(2)} MB`
    : `${(bytes / 1024).toFixed(0)} KB`
}

/* ------------------------------------------------------------------ */
/* Preferences                                                         */
/* ------------------------------------------------------------------ */

export function readPreferences(): Preferences {
  if (typeof window === 'undefined') return DEFAULT_PREFERENCES
  return {
    ...DEFAULT_PREFERENCES,
    ...safeParse<Partial<Preferences>>(window.localStorage.getItem(PREFS_KEY), {}),
  }
}

export function writePreferences(prefs: Preferences): void {
  window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
}
