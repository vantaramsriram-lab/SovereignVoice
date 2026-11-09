import { motion } from 'framer-motion'
import {
  AlertCircle,
  Ban,
  CircleHelp,
  Languages,
  MessageSquareWarning,
  Repeat2,
  Target,
} from 'lucide-react'
import { Reveal } from '../ui/Reveal'
import { SectionHeading } from '../ui/SectionHeading'
import { ConventionalBotPhone } from './ConventionalBotPhone'

const PAIN_POINTS = [
  {
    icon: Languages,
    title: 'Poor understanding of regional languages',
    body: 'Scripted models only handle the phrases they were trained on. A Telugu, Tamil or Bengali reply falls straight through.',
  },
  {
    icon: Repeat2,
    title: 'Code-mixed speech breaks the flow',
    body: 'Real customers mix languages mid-sentence — “salary వచ్చాక pay చేస్తాను”. That is not noise; it is the actual meaning.',
  },
  {
    icon: CircleHelp,
    title: 'No contextual understanding',
    body: 'A reason for delay, a question about charges and a request for a callback all get flattened into the same bucket.',
  },
  {
    icon: Target,
    title: 'Willingness read as commitment',
    body: '“I will try” becomes “agreed to pay” in the CRM, and the wrong follow-up gets scheduled.',
  },
  {
    icon: MessageSquareWarning,
    title: 'Generic, unnatural responses',
    body: 'Machine-phrased replies in the wrong language erode trust at the exact moment it matters most.',
  },
  {
    icon: Ban,
    title: 'Complaints and disputes missed',
    body: 'If a customer says the amount is wrong, a rigid flow keeps asking for payment instead of flagging the dispute.',
  },
]

export function PainPointsSection() {
  return (
    <section className="relative border-t border-white/[0.05] py-20 sm:py-28" id="why">
      <div className="shell">
        <div className="grid items-center gap-14 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)] lg:gap-20">
          {/* left: illustration */}
          <Reveal className="order-1 lg:order-1" amount={0.2}>
            <ConventionalBotPhone />
          </Reveal>

          {/* right: pain points */}
          <div className="order-2 lg:order-2">
            <SectionHeading
              eyebrow="The problem"
              title={
                <>
                  Conventional AI bots fail exactly where collections need clarity.
                </>
              }
              description="Collections conversations are multilingual, emotional and full of implied meaning. Scripted assistants are built for menus, not for understanding people."
            />

            <div className="mt-9 space-y-0">
              {PAIN_POINTS.map((point, index) => {
                const Icon = point.icon
                return (
                  <motion.div
                    key={point.title}
                    initial={{ opacity: 0, y: 14 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.6 }}
                    transition={{ duration: 0.5, delay: index * 0.05 }}
                    className="group flex gap-4 border-b border-white/[0.05] py-4 last:border-0"
                  >
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.02] text-mist-400 transition-colors duration-300 group-hover:border-white/15 group-hover:text-mist-100">
                      <Icon size={14} strokeWidth={1.9} />
                    </span>
                    <div>
                      <h3 className="text-[14px] font-medium leading-snug text-mist-100">
                        {point.title}
                      </h3>
                      <p className="mt-1 text-[13px] leading-relaxed text-mist-500">
                        {point.body}
                      </p>
                    </div>
                  </motion.div>
                )
              })}
            </div>

            <Reveal delay={0.15} className="mt-6">
              <div className="flex items-start gap-2.5 rounded-2xl border border-white/[0.07] bg-white/[0.02] px-4 py-3">
                <AlertCircle size={14} className="mt-[3px] shrink-0 text-mist-500" />
                <p className="text-[12.5px] leading-relaxed text-mist-400">
                  The cost is not just the failed call. It is a CRM record that says
                  something the customer never said.
                </p>
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  )
}
