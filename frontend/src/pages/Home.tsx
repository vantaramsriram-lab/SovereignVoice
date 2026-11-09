import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, ArrowRight, CircleSlash, WifiOff } from 'lucide-react'
import { Link } from 'react-router-dom'
import { analyzeAudio, ApiError, probeAudioDuration, blobToDataUrl } from '../services/api'
import { buildInputDataUrl, saveAnalysis } from '../services/storage'
import type { AnalysisResponse, StageKey } from '../types'
import { VoiceInput, type SubmitPayload } from '../components/VoiceInput'
import { ProcessingStages } from '../components/ProcessingStages'
import { AnalysisResults } from '../components/results/AnalysisResults'
import { PainPointsSection } from '../components/home/PainPointsSection'
import { SolutionSection } from '../components/home/SolutionSection'
import { BackgroundAura } from '../components/ui/BackgroundAura'
import { Notice } from '../components/ui/Notice'
import { useHealth } from '../hooks/useHealth'

type Phase = 'idle' | 'processing' | 'results'

const STAGE_KEYS: StageKey[] = ['audio', 'stt', 'llm', 'crm', 'tts']

const HERO_WORDS = ['Understand', 'every', 'conversation.']

export function Home() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [activeStage, setActiveStage] = useState(0)
  const [error, setError] = useState<ApiError | null>(null)
  const [notConfigured, setNotConfigured] = useState<string | null>(null)
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null)
  const [inputAudioUrl, setInputAudioUrl] = useState<string>('')
  const [storageWarning, setStorageWarning] = useState<string | null>(null)
  const resultsRef = useRef<HTMLDivElement | null>(null)
  const stageTimer = useRef<number | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const { health, error: healthError, loading: healthLoading } = useHealth()

  // Clear any stage timer on unmount.
  useEffect(() => {
    return () => {
      if (stageTimer.current !== null) window.clearInterval(stageTimer.current)
      abortRef.current?.abort()
    }
  }, [])

  useEffect(() => {
    if (phase === 'results' && resultsRef.current) {
      resultsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [phase])

  const blockedReason = (() => {
    if (healthLoading) return null
    if (healthError)
      return 'The backend is unreachable. Start the FastAPI server so analysis can run.'
    if (health && !health.pipeline_ready) {
      const missing = Object.entries(health.integrations)
        .filter(([, ready]) => !ready)
        .map(([name]) =>
          name === 'stt'
            ? 'Gnani Prisma (API_KEY_ID)'
            : name === 'llm'
              ? 'Groq (GROQ_API_KEY)'
              : 'Gnani Timbre (API_KEY_ID)',
        )
      // Keep the inline hint short — the full provider name is in the notice
      // that appears if the agent submits anyway.
      return `Analysis is disabled until the backend is configured (${missing.length} integration${missing.length === 1 ? '' : 's'} missing). Add the values to backend/.env and restart the API.`
    }
    return null
  })()

  const startStageSequence = useCallback(() => {
    setActiveStage(0)
    if (stageTimer.current !== null) window.clearInterval(stageTimer.current)
    // This only advances the *highlighted* stage for perceived progress; no
    // stage is ever marked complete here. The backend's real stages replace
    // this list the moment the response arrives.
    stageTimer.current = window.setInterval(() => {
      setActiveStage((current) => Math.min(current + 1, STAGE_KEYS.length - 1))
    }, 2400)
  }, [])

  const stopStageSequence = useCallback(() => {
    if (stageTimer.current !== null) {
      window.clearInterval(stageTimer.current)
      stageTimer.current = null
    }
  }, [])

  const handleSubmit = useCallback(
    async ({ source, agentContext }: SubmitPayload) => {
      setError(null)
      setNotConfigured(null)
      setStorageWarning(null)
      setPhase('processing')
      startStageSequence()

      const controller = new AbortController()
      abortRef.current = controller

      try {
        const [response, prepared] = await Promise.all([
          analyzeAudio(source.blob, source.filename, agentContext, controller.signal),
          buildInputDataUrl(source.blob).catch(async () => ({
            dataUrl: await blobToDataUrl(source.blob),
            duration: await probeAudioDuration(source.blob),
          })),
        ])

        setAnalysis(response)
        setInputAudioUrl(prepared.dataUrl)
        setPhase('results')

        try {
          await saveAnalysis(response, prepared.dataUrl)
        } catch (storageError) {
          setStorageWarning(
            storageError instanceof Error
              ? storageError.message
              : 'This analysis could not be saved to browser storage.',
          )
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return
        const apiError =
          err instanceof ApiError
            ? err
            : new ApiError(
                'The analysis could not be completed.',
                { detail: err instanceof Error ? err.message : String(err) },
              )
        if (apiError.kind === 'not_configured') setNotConfigured(apiError.message)
        setError(apiError)
        setPhase('idle')
      } finally {
        stopStageSequence()
        abortRef.current = null
      }
    },
    [startStageSequence, stopStageSequence],
  )

  const reset = useCallback(() => {
    setPhase('idle')
    setAnalysis(null)
    setInputAudioUrl('')
    setError(null)
    setNotConfigured(null)
    setStorageWarning(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const failedStage: StageKey | null =
    error?.service === 'stt'
      ? 'stt'
      : error?.service === 'llm'
        ? 'llm'
        : error?.service === 'tts'
          ? 'tts'
          : null

  return (
    <div>
      {/* ------------------------------------------------------------ hero */}
      <section className="relative overflow-hidden pb-16 pt-32 sm:pb-20 sm:pt-40">
        <BackgroundAura />
        <div className="shell relative">
          <div className="mx-auto max-w-3xl text-center">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="mb-7 flex justify-center"
            >
              <span className="chip text-sm">
                {/* <span className="h-1.5 w-1.5 rounded-full bg-accent/80" /> */}
                Voice intelligence for BFSI collections
              </span>
            </motion.div>

            <h1 className="flex flex-wrap justify-center gap-x-[0.28em] text-[2.6rem] font-normal leading-[1.06] tracking-[-0.035em] text-mist-50 sm:text-[3.6rem] lg:text-[6rem]">
              {HERO_WORDS.map((word, index) => (
                <motion.span
                  key={word}
                  initial={{ opacity: 0, y: 18, filter: 'blur(6px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  transition={{
                    duration: 0.8,
                    delay: 0.12 + index * 0.09,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  className={index === 2 ? 'text-mist-500' : undefined}
                >
                  {word}
                </motion.span>
              ))}
            </h1>

            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.45 }}
              className="mx-auto mt-6 max-w-xl text-[14.5px] leading-relaxed text-mist-400 sm:text-[15.5px]"
            >
              Upload a customer call part or record one live. SovereignVoice transcribes
              regional and code-mixed speech, extracts evidence-based CRM intelligence,
              and generates a localized response for your team to review.
            </motion.p>
          </div>

          {/* primary input */}
          <motion.div
            initial={{ opacity: 0, y: 22, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.75, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="mx-auto mt-12 max-w-[720px]"
          >
            <AnimatePresence mode="wait">
              {phase === 'results' && analysis ? null : (
                <motion.div
                  key="input"
                  exit={{ opacity: 0, y: -12, filter: 'blur(4px)' }}
                  transition={{ duration: 0.3 }}
                >
                  <VoiceInput
                    onSubmit={handleSubmit}
                    isProcessing={phase === 'processing'}
                    blockedReason={blockedReason}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* processing panel */}
            <AnimatePresence>
              {phase === 'processing' && (
                <motion.div
                  initial={{ opacity: 0, y: 14, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: 'auto' }}
                  exit={{ opacity: 0, y: -8, height: 0 }}
                  transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden"
                >
                  <div className="mt-5 rounded-3xl border border-white/[0.08] bg-ink-850/80 px-5 py-5 backdrop-blur-xl sm:px-6">
                    <div className="mb-4 flex items-center justify-between">
                      <p className="text-[13px] font-medium text-mist-100">
                        Running the SovereignVoice pipeline
                      </p>
                      <span className="text-[11px] text-mist-600">
                        Live stages · real timings
                      </span>
                    </div>
                    <ProcessingStages activeIndex={activeStage} compact />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* configuration / integration errors */}
            <AnimatePresence>
              {(error || notConfigured) && phase === 'idle' && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mt-5 space-y-3"
                >
                  <Notice
                    tone={notConfigured ? 'warning' : 'danger'}
                    title={
                      notConfigured
                        ? 'Integration not configured'
                        : error?.kind === 'network'
                          ? 'Backend unreachable'
                          : 'Analysis failed'
                    }
                  >
                    <p>{notConfigured ?? error?.message}</p>
                    {error?.missing && error.missing.length > 0 && (
                      <p className="mt-2 font-mono text-[11.5px] text-mist-400">
                        Missing: {error.missing.join(', ')}
                      </p>
                    )}
                    {error?.detail && (
                      <p className="mt-2 font-mono text-[11px] leading-relaxed text-mist-500">
                        {error.detail}
                      </p>
                    )}
                  </Notice>

                  {failedStage && (
                    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.015] px-5 py-4">
                      <p className="mb-3 text-[12px] text-mist-500">
                        Pipeline stopped at this stage
                      </p>
                      <ProcessingStages errorStage={failedStage} activeIndex={0} compact />
                    </div>
                  )}

                  {error?.kind === 'network' && (
                    <p className="flex items-center gap-2 px-1 text-[11.5px] text-mist-500">
                      <WifiOff size={12} /> Start the backend with{' '}
                      <code className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[11px]">
                        uvicorn app.main:app --reload --port 8000
                      </code>
                    </p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* quick note about what does not happen */}
            {/* {phase !== 'results' && (
              <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-base text-mist-600">
                <span className="flex items-center gap-1.5">
                  <CircleSlash size={11} /> No automated calls
                </span>
                <span className="flex items-center gap-1.5">
                  <CircleSlash size={11} /> No autonomous customer contact
                </span>
                <span className="flex items-center gap-1.5">
                  <CircleSlash size={11} /> No fabricated commitments
                </span>
              </div>
            )} */}
          </motion.div>

          {/* results */}
          <div ref={resultsRef} className="mx-auto mt-14 max-w-[860px] scroll-mt-24">
            <AnimatePresence>
              {phase === 'results' && analysis && (
                <div className="space-y-5">
                  {storageWarning && (
                    <Notice tone="warning" title="Not saved to the demo library">
                      {storageWarning}
                    </Notice>
                  )}
                  <AnalysisResults
                    analysis={analysis}
                    inputAudioUrl={inputAudioUrl}
                    onReset={reset}
                    voiceLabel={
                      health ? `Gnani Timbre · ${health.config.timbre.voice}` : null
                    }
                  />
                  <div className="flex items-center justify-between rounded-2xl border border-white/[0.07] bg-white/[0.015] px-5 py-4">
                    <p className="text-[12.5px] text-mist-400">
                      Saved to this browser's demo library.
                    </p>
                    <Link
                      to="/demo"
                      className="flex items-center gap-1.5 text-[12.5px] font-medium text-mist-100 transition-colors hover:text-accent"
                    >
                      Open Demo <ArrowRight size={13} />
                    </Link>
                  </div>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------- problem section */}
      <PainPointsSection />

      {/* ------------------------------------------------- solution section */}
      <SolutionSection />

      {/* honesty strip before the footer */}
      <section className="border-t border-white/[0.05] py-10">
        <div className="shell flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-2 text-base leading-relaxed text-mist-500">
            <AlertTriangle size={13} className="mt-[2px] shrink-0 text-mist-600" />
            Outputs are decision support. Amounts, dates and commitments appear only when
            the customer stated them, and uncertain records are flagged for human review.
          </p>
          <span className="shrink-0 font-mono text-[14px] text-mist-600">
            Prisma → Groq-LLM → CRM validation → Timbre
          </span>
        </div>
      </section>
    </div>
  )
}
