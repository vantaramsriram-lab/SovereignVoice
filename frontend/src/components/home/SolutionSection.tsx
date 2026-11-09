import { motion } from 'framer-motion'
import {
  AudioLines,
  Brain,
  CheckCheck,
  ClipboardCheck,
  Languages,
  Layers,
  ShieldCheck,
  UserCheck,
} from 'lucide-react'
import { Reveal } from '../ui/Reveal'
import { SectionHeading } from '../ui/SectionHeading'

const STAGES = [
  {
    number: '01',
    title: 'Understand every language',
    engine: 'Gnani Prisma · STT',
    icon: Languages,
    points: [
      'Transcribes regional languages as spoken.',
      'Handles multilingual and code-mixed speech.',
      'Keeps the original conversation intact.',
      'Reports the detected language code.',
    ],
  },
  {
    number: '02',
    title: 'Understand the context',
    engine: 'Groq-qwen/qwen3.8-27b',
    icon: Brain,
    points: [
      'Reads what the customer actually meant.',
      'Identifies payment intentions.',
      'Separates explicit commitments from willingness.',
      'Surfaces complaints, disputes and sentiment.',
    ],
  },
  {
    number: '03',
    title: 'Extract customer intelligence',
    engine: 'Structured CRM record',
    icon: ClipboardCheck,
    points: [
      'Fills only the fields the evidence supports.',
      'Records amounts and dates solely when stated.',
      'Marks missing and uncertain information.',
      'Recommends the next action for the team.',
    ],
  },
  {
    number: '04',
    title: 'Generate localized responses',
    engine: 'Gnani Timbre · TTS',
    icon: AudioLines,
    points: [
      'Turns the reviewed script into speech.',
      'Uses the configured voice and language.',
      'Produces natural audio for the agent.',
      'Nothing is sent to the customer automatically.',
    ],
  },
]

const DIFFERENTIATORS = [
  { icon: Languages, label: 'Multilingual understanding' },
  { icon: Layers, label: 'Evidence-based CRM extraction' },
  { icon: ShieldCheck, label: 'No fabricated payment commitments' },
  { icon: AudioLines, label: 'Localized response generation' },
  { icon: UserCheck, label: 'Human review for uncertain information' },
]

export function SolutionSection() {
  return (
    <section className="relative border-t border-white/[0.05] py-20 sm:py-28" id="how">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-64"
        style={{
          background:
            'radial-gradient(ellipse 60% 100% at 50% 0%, rgba(255,255,255,0.045), transparent 70%)',
        }}
        aria-hidden="true"
      />
      <div className="shell relative">
        <SectionHeading
          eyebrow="The SovereignVoice way"
          title="A better way to understand every customer conversation."
          description="SovereignVoice transforms multilingual customer conversations into actionable intelligence and natural, localized responses."
          align="center"
          className="mx-auto max-w-3xl text-center"
        />

        {/* pipeline */}
        <div className="relative mt-16">
          {/* connecting line — horizontal on desktop, vertical on mobile */}
          <motion.div
            aria-hidden="true"
            initial={{ scaleX: 0, opacity: 0 }}
            whileInView={{ scaleX: 1, opacity: 1 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
            className="absolute left-0 right-0 top-[26px] hidden h-px origin-left lg:block"
            style={{
              background:
                'linear-gradient(90deg, transparent, rgba(255,255,255,0.16) 12%, rgba(255,255,255,0.16) 88%, transparent)',
            }}
          />
          <motion.div
            aria-hidden="true"
            initial={{ scaleY: 0, opacity: 0 }}
            whileInView={{ scaleY: 1, opacity: 1 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
            className="absolute bottom-8 left-[19px] top-8 w-px origin-top lg:hidden"
            style={{
              background:
                'linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.16), rgba(255,255,255,0.05))',
            }}
          />

          <ol className="relative grid gap-10 lg:grid-cols-4 lg:gap-7">
            {STAGES.map((stage, index) => {
              const Icon = stage.icon
              return (
                <motion.li
                  key={stage.number}
                  initial={{ opacity: 0, y: 22 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.5 }}
                  transition={{
                    duration: 0.6,
                    delay: index * 0.12,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  className="group relative flex gap-5 lg:block"
                >
                  {/* node */}
                  <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/12 bg-ink-850 text-mist-300 transition-all duration-500 group-hover:border-accent/40 group-hover:text-accent group-hover:shadow-glow">
                    <Icon size={16} strokeWidth={1.9} />
                  </div>

                  <div className="min-w-0 lg:mt-6 lg:pr-4">
                    <div className="flex items-baseline gap-2.5">
                      <span className="font-mono text-[11px] tracking-[0.1em] text-mist-600">
                        {stage.number}
                      </span>
                      <span className="h-px flex-1 bg-white/[0.06]" aria-hidden="true" />
                    </div>
                    <h3 className="mt-3 text-[15.5px] font-medium leading-snug tracking-[-0.01em] text-mist-50">
                      {stage.title}
                    </h3>
                    <p className="mt-1 text-[11.5px] font-medium uppercase tracking-[0.12em] text-mist-600">
                      {stage.engine}
                    </p>
                    <ul className="mt-4 space-y-1.5">
                      {stage.points.map((point) => (
                        <li
                          key={point}
                          className="flex gap-2 text-[12.5px] leading-relaxed text-mist-400"
                        >
                          <span
                            className="mt-[7px] h-[3px] w-[3px] shrink-0 rounded-full bg-mist-500"
                            aria-hidden="true"
                          />
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </motion.li>
              )
            })}
          </ol>
        </div>

        {/* core value */}
        <Reveal delay={0.1} className="mt-16">
          <div className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-b from-white/[0.035] to-transparent px-6 py-10 sm:px-12 sm:py-12">
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-px"
              style={{
                background:
                  'linear-gradient(90deg, transparent, rgba(143,240,198,0.35), transparent)',
              }}
              aria-hidden="true"
            />
            <p className="mx-auto max-w-3xl text-center text-[19px] font-normal leading-[1.5] tracking-[-0.015em] text-mist-100 sm:text-[23px]">
              From customer voice to actionable intelligence — without losing the
              meaning behind the conversation.
            </p>

            <div className="mt-9 flex flex-wrap items-center justify-center gap-2.5">
              {DIFFERENTIATORS.map((item) => {
                const Icon = item.icon
                return (
                  <span
                    key={item.label}
                    className="inline-flex items-center gap-2 rounded-full border border-white/[0.09] bg-white/[0.025] px-3.5 py-1.5 text-[11.5px] text-mist-300 transition-colors duration-300 hover:border-white/20 hover:text-mist-100"
                  >
                    <Icon size={12} className="text-mist-500" />
                    {item.label}
                  </span>
                )
              })}
            </div>

            <div className="mt-8 flex items-center justify-center gap-2 text-[11px] text-mist-600">
              <CheckCheck size={12} />
              Analysis and response generation only — a human makes every decision.
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
