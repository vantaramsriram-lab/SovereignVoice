import { motion, useReducedMotion } from 'framer-motion'

interface BackgroundAuraProps {
  variant?: 'hero' | 'soft'
}

/**
 * Very restrained ambient motion. One soft radial light that drifts slowly —
 * no looping gradients over the whole page.
 */
export function BackgroundAura({ variant = 'hero' }: BackgroundAuraProps) {
  const reduce = useReducedMotion()
  const strength = variant === 'hero' ? 1 : 0.5

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <motion.div
        className="absolute left-1/2 top-[-18rem] h-[46rem] w-[46rem] -translate-x-1/2 rounded-full"
        style={{
          background: `radial-gradient(circle at 50% 50%, rgba(255,255,255,${0.055 * strength}), rgba(143,240,198,${0.03 * strength}) 42%, transparent 68%)`,
          filter: 'blur(20px)',
        }}
        animate={
          reduce
            ? undefined
            : {
                x: ['-52%', '-47%', '-52%'],
                y: ['0%', '4%', '0%'],
                scale: [1, 1.06, 1],
              }
        }
        transition={{ duration: 26, repeat: Infinity, ease: 'easeInOut' }}
      />
      {variant === 'hero' && (
        <div
          className="absolute inset-x-0 top-0 h-px"
          style={{
            background:
              'linear-gradient(90deg, transparent, rgba(255,255,255,0.14), transparent)',
          }}
        />
      )}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_100%_60%_at_50%_-10%,rgba(255,255,255,0.05),transparent_60%)]" />
    </div>
  )
}
