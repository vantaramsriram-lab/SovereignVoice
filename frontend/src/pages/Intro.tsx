import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  AudioLines,
  Brain,
  CheckCircle2,
  Languages,
  Mic,
  ShieldCheck,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { BackgroundAura } from '../components/ui/BackgroundAura'

const STEPS = [
  {
    eyebrow: '01 · The problem',
    title: 'Real conversations do not follow a script.',
    description:
      'Customers switch between languages, explain why they need more time, raise disputes, and speak with emotion. Conventional bots can miss the meaning — or mistake “I will try” for a promise to pay.',
    icon: Languages,
    points: ['Regional languages and code-mixed speech', 'Hesitation is not a payment commitment'],
  },
  {
    eyebrow: '02 · The pipeline',
    title: 'One voice. Four stages of understanding.',
    description:
      'SovereignVoice turns an audio recording into a structured, reviewable view of the conversation.',
    icon: AudioLines,
    points: [
      'Gnani Prisma transcribes the spoken audio',
      'The LLM interprets context and intent',
      'CRM validation structures evidence and uncertainty',
      'Gnani Timbre generates a localized response',
    ],
  },
  {
    eyebrow: '03 · The difference',
    title: 'Keep the meaning. Not just the words.',
    description:
      'The system distinguishes willingness from explicit commitment, captures only supported amounts and dates, and surfaces complaints, disputes, and missing information.',
    icon: Brain,
    points: ['Evidence-based CRM fields', 'Localized response in the configured language'],
  },
  {
    eyebrow: '04 · Human control',
    title: 'AI assists. People make the decisions.',
    description:
      'Uncertain information is flagged for human review. The generated response is a suggestion for the team — no customer is contacted and no payment decision is made automatically.',
    icon: ShieldCheck,
    points: ['Human review for uncertain records', 'No autonomous customer contact'],
  },
]

export function Intro() {
  const [activeStep, setActiveStep] = useState(0)
  const step = STEPS[activeStep]
  const Icon = step.icon

  const goNext = () => setActiveStep((current) => Math.min(current + 1, STEPS.length - 1))
  const goBack = () => setActiveStep((current) => Math.max(current - 1, 0))

  return (
    <div className="relative min-h-[78vh] overflow-hidden pb-20 pt-28 sm:pt-32">
      <BackgroundAura />
      <div className="shell relative">
        <div className="mx-auto max-w-5xl">
          <div className="mb-10 flex flex-wrap items-center justify-between gap-4">
            <span className="chip">Voice intelligence for BFSI collections</span>
            <div className="flex items-center gap-3">
              <span className="font-mono text-[11px] tracking-[0.12em] text-mist-600">
                {String(activeStep + 1).padStart(2, '0')} / {String(STEPS.length).padStart(2, '0')}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={goBack}
                  disabled={activeStep === 0}
                  aria-label="Previous introduction section"
                  title="Previous section"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.035] text-mist-300 transition-all hover:border-white/25 hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <ArrowLeft size={15} />
                </button>
                <button
                  type="button"
                  onClick={goNext}
                  disabled={activeStep === STEPS.length - 1}
                  aria-label="Next introduction section"
                  title="Next section"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.035] text-mist-300 transition-all hover:border-white/25 hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <ArrowRight size={15} />
                </button>
              </div>
            </div>
          </div>

          <div className="grid items-stretch gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-14">
            <div className="flex flex-col justify-between">
              <div>
                <p className="label mb-4">SovereignVoice · Introduction</p>
                <h1 className="text-4xl font-normal leading-[1.08] tracking-[-0.04em] text-mist-50 sm:text-5xl lg:text-[3.7rem]">
                  Understand
                  <span className="block text-mist-500">every conversation.</span>
                </h1>
                <p className="mt-5 max-w-md text-[14px] leading-relaxed text-mist-400">
                  Multilingual voice intelligence that turns customer audio into
                  contextual insight and localized responses — while keeping people
                  in control.
                </p>
              </div>

              <div className="mt-10 flex items-center gap-2">
                {STEPS.map((item, index) => (
                  <button
                    key={item.eyebrow}
                    type="button"
                    onClick={() => setActiveStep(index)}
                    aria-label={`Show step ${index + 1}: ${item.eyebrow}`}
                    aria-current={activeStep === index ? 'step' : undefined}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      activeStep === index ? 'w-12 bg-mist-100' : 'w-6 bg-white/15 hover:bg-white/35'
                    }`}
                  />
                ))}
              </div>
            </div>

            <div className="relative min-h-[390px] overflow-hidden rounded-[28px] border border-white/[0.08] bg-white/[0.025] p-6 backdrop-blur-xl sm:p-9">
              <div
                className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-white/[0.035] blur-3xl"
                aria-hidden="true"
              />
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeStep}
                  initial={{ opacity: 0, y: 18, filter: 'blur(5px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, y: -12, filter: 'blur(4px)' }}
                  transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
                  className="relative flex h-full flex-col"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/[0.1] bg-white/[0.04] text-mist-100">
                    <Icon size={20} strokeWidth={1.6} />
                  </div>
                  <p className="label mt-8">{step.eyebrow}</p>
                  <h2 className="mt-3 max-w-xl text-2xl font-medium leading-tight tracking-[-0.025em] text-mist-50 sm:text-3xl">
                    {step.title}
                  </h2>
                  <p className="mt-4 max-w-xl text-[13.5px] leading-relaxed text-mist-400">
                    {step.description}
                  </p>
                  <ul className="mt-6 space-y-3">
                    {step.points.map((point) => (
                      <li key={point} className="flex items-start gap-2.5 text-[12.5px] text-mist-300">
                        <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-mist-500" />
                        {point}
                      </li>
                    ))}
                  </ul>

                  {activeStep === STEPS.length - 1 && (
                    <div className="mt-8 flex flex-wrap gap-3">
                      <Link to="/try" className="btn-primary">
                        <Mic size={14} /> Try with your own recording
                      </Link>
                      <Link to="/demo" className="btn-ghost">
                        See the demo
                      </Link>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>

              <div className="relative mt-9 flex items-center justify-between border-t border-white/[0.07] pt-5">
                <span className="text-[11px] text-mist-600">
                  Section {activeStep + 1} of {STEPS.length}
                </span>
                <span className="flex items-center gap-1.5 text-[11px] text-mist-600">
                  <ShieldCheck size={12} /> Human-in-the-loop by design
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
