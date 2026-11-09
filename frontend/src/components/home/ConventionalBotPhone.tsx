import { motion, useReducedMotion } from 'framer-motion'
import { Frown, Sparkles } from 'lucide-react'

/**
 * Illustration of the status quo: an agent or customer stuck in a loop with a
 * scripted bot that cannot handle a regional-language, code-mixed reply.
 * Drawn with divs and SVG only, so nothing depends on external assets.
 */
export function ConventionalBotPhone() {
  const reduce = useReducedMotion()

  return (
    <div className="relative mx-auto w-full max-w-[380px]">
      {/* soft stage behind the device */}
      <div
        className="absolute inset-0 -z-10 rounded-[3rem]"
        style={{
          background:
            'radial-gradient(circle at 50% 25%, rgba(255,255,255,0.07), transparent 62%)',
        }}
        aria-hidden="true"
      />

      <motion.div
        animate={reduce ? undefined : { y: [0, -8, 0] }}
        transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
        className="relative rounded-[2.6rem] border border-white/12 bg-ink-950 p-2.5 shadow-[0_40px_90px_-40px_rgba(0,0,0,0.95)]"
      >
        <div className="relative overflow-hidden rounded-[2.1rem] border border-white/[0.06] bg-ink-850">
          {/* status bar + notch */}
          <div className="relative flex items-center justify-between px-5 pt-3 text-[10px] text-mist-500">
            <span>9:41</span>
            <div className="absolute left-1/2 top-2 h-5 w-24 -translate-x-1/2 rounded-full bg-ink-950" />
            <span className="tracking-tight">▮▮▮</span>
          </div>

          {/* app header */}
          <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3.5">
            <div>
              <p className="text-[10px] uppercase tracking-[0.14em] text-mist-600">
                Collections support
              </p>
              <p className="text-[13px] font-medium text-mist-100">Automated assistant</p>
            </div>
            <span className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-mist-400">
              <Sparkles size={12} />
            </span>
          </div>

          {/* conversation */}
          <div className="space-y-2.5 px-4 py-4">
            <Bubble side="bot" delay={0.1}>
              Hello! Please reply in English to continue.
            </Bubble>
            <Bubble side="user" delay={0.35} script>
              నా పేమెంట్ గురించి మాట్లాడాలి, salary వచ్చాక చెల్లిస్తాను
            </Bubble>
            <Bubble side="bot" delay={0.6}>
              I did not understand that. Please select an option:
              <div className="mt-2 space-y-1">
                {['1 · Pay now', '2 · Payment already made', '3 · Talk to agent'].map(
                  (option) => (
                    <div
                      key={option}
                      className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-[10.5px] text-mist-400"
                    >
                      {option}
                    </div>
                  ),
                )}
              </div>
            </Bubble>
            <Bubble side="user" delay={0.85}>
              3
            </Bubble>
            <Bubble side="bot" delay={1.05}>
              I did not understand that. Please select an option:
            </Bubble>
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 1.3 }}
              className="flex items-center gap-1.5 px-1 pt-1 text-[10px] text-mist-600"
            >
              <span className="flex gap-1">
                {[0, 1, 2].map((index) => (
                  <motion.span
                    key={index}
                    className="h-1 w-1 rounded-full bg-mist-500"
                    animate={reduce ? undefined : { opacity: [0.25, 1, 0.25] }}
                    transition={{
                      duration: 1.2,
                      repeat: Infinity,
                      delay: index * 0.18,
                    }}
                  />
                ))}
              </span>
              Loop detected · no escalation path
            </motion.div>
          </div>

          {/* frustrated customer */}
          <div className="flex items-center gap-3 border-t border-white/[0.06] bg-ink-800/60 px-4 py-3.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-full border border-danger/25 bg-danger/10 text-danger">
              <Frown size={16} />
            </span>
            <div className="min-w-0">
              <p className="text-[11.5px] font-medium text-mist-200">
                Customer gives up
              </p>
              <p className="text-[10px] text-mist-600">
                Repeats the same answer — conversation abandoned
              </p>
            </div>
          </div>

          <div className="h-1.5 w-full bg-ink-800">
            <div className="mx-auto mt-0.5 h-1 w-20 rounded-full bg-mist-600/40" />
          </div>
        </div>
      </motion.div>

      {/* floating annotation */}
      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.96 }}
        whileInView={{ opacity: 1, y: 0, scale: 1 }}
        viewport={{ once: true, amount: 0.6 }}
        transition={{ delay: 0.9, duration: 0.5 }}
        className="absolute -right-2 bottom-16 hidden rounded-2xl border border-white/10 bg-ink-800/95 px-3.5 py-2.5 shadow-xl backdrop-blur sm:block"
      >
        <p className="text-[10px] uppercase tracking-[0.14em] text-mist-600">Intent lost</p>
        <p className="mt-0.5 text-[11.5px] font-medium text-danger">
          “salary వచ్చాక” = after salary
        </p>
      </motion.div>
    </div>
  )
}

function Bubble({
  side,
  children,
  delay = 0,
  script = false,
}: {
  side: 'bot' | 'user'
  children: React.ReactNode
  delay?: number
  script?: boolean
}) {
  const isBot = side === 'bot'
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.4 }}
      transition={{ duration: 0.45, delay }}
      className={`flex ${isBot ? 'justify-start' : 'justify-end'}`}
    >
      <div
        className={`max-w-[85%] rounded-2xl px-3 py-2 text-[11.5px] leading-relaxed ${
          isBot
            ? 'rounded-bl-md border border-white/[0.07] bg-white/[0.035] text-mist-300'
            : 'rounded-br-md bg-mist-100/90 text-ink-900'
        } ${script ? 'font-normal' : ''}`}
      >
        {children}
      </div>
    </motion.div>
  )
}
