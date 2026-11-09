import type { DemoRecord, AnalysisResponse } from '../types'
import { audioUrlFromBase64, blobToDataUrl, probeAudioDuration } from './api'

/**
 * localStorage persistence for demo records and UI preferences.
 *
 * No credentials are ever stored here — only user-generated audio and the
 * analysis output the backend already returned. Audio is kept as data URLs so
 * records survive a page refresh without any server-side storage.
 */

const RECORDS_KEY = 'sovereignvoice.records.v1'
const PREFS_KEY = 'sovereignvoice.prefs.v1'
const MAX_RECORDS = 12

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

export function readRecords(): DemoRecord[] {
  if (typeof window === 'undefined') return []
  const parsed = safeParse<DemoRecord[]>(window.localStorage.getItem(RECORDS_KEY), [])
  if (!Array.isArray(parsed)) return []
  return parsed.filter((record) => record && record.id && record.intelligence)
}

function writeRecords(records: DemoRecord[], incoming: DemoRecord): void {
  try {
    window.localStorage.setItem(RECORDS_KEY, JSON.stringify(records))
  } catch (error) {
    // Most likely a quota error: drop the oldest half of the library and retry
    // once, so the newest analysis is never lost.
    const trimmed = records.slice(0, Math.max(1, Math.ceil(records.length / 2)))
    try {
      window.localStorage.setItem(RECORDS_KEY, JSON.stringify(trimmed))
    } catch {
      throw new StorageError(
        `Browser storage is full, so "${incoming.label}" could not be saved. ` +
          'Delete older demos (Demo page → Clear all) and try again.',
      )
    }
  }
}

export function saveAnalysis(
  analysis: AnalysisResponse,
  inputAudioDataUrl: string,
): DemoRecord {
  const existing = readRecords()
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

  // Newest first, de-duplicated, capped so the browser quota stays healthy.
  const next = [record, ...existing.filter((item) => item.id !== record.id)].slice(
    0,
    MAX_RECORDS,
  )
  writeRecords(next, record)
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

export function deleteRecord(id: string): DemoRecord[] {
  const next = readRecords().filter((record) => record.id !== id)
  try {
    window.localStorage.setItem(RECORDS_KEY, JSON.stringify(next))
  } catch {
    throw new StorageError('Could not update browser storage.')
  }
  return next
}

export function clearRecords(): void {
  window.localStorage.removeItem(RECORDS_KEY)
}

export function renameRecord(id: string, label: string): DemoRecord[] {
  const next = readRecords().map((record) =>
    record.id === id ? { ...record, label: label.trim() || record.label } : record,
  )
  window.localStorage.setItem(RECORDS_KEY, JSON.stringify(next))
  return next
}

export function storageFootprint(): { bytes: number; readable: string } {
  const raw = window.localStorage.getItem(RECORDS_KEY) ?? ''
  const bytes = new Blob([raw]).size
  const readable =
    bytes > 1024 * 1024
      ? `${(bytes / (1024 * 1024)).toFixed(2)} MB`
      : `${(bytes / 1024).toFixed(0)} KB`
  return { bytes, readable }
}

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
