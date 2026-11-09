/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#060608',
          900: '#08080a',
          850: '#0b0b0e',
          800: '#101014',
          750: '#141419',
          700: '#191920',
          600: '#22222b',
          500: '#2e2e38',
          400: '#3d3d49',
        },
        mist: {
          50: '#f7f7f9',
          100: '#e9e9ee',
          200: '#c9c9d2',
          300: '#a8a8b4',
          400: '#8b8b98',
          500: '#6f6f7c',
          600: '#565661',
        },
        accent: {
          DEFAULT: '#8ff0c6',
          soft: '#bdf7de',
          deep: '#3ecf9a',
          dim: 'rgba(143, 240, 198, 0.12)',
        },
        danger: '#ff8a8a',
        warn: '#f2c078',
      },
      fontFamily: {
        sans: [
          'ui-sans-serif',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Inter',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      fontSize: {
        '7xl': ['4.5rem', { lineHeight: '1.02', letterSpacing: '-0.035em' }],
        '6xl': ['3.75rem', { lineHeight: '1.04', letterSpacing: '-0.032em' }],
        '5xl': ['3rem', { lineHeight: '1.06', letterSpacing: '-0.03em' }],
      },
      boxShadow: {
        pill: '0 24px 70px -30px rgba(0, 0, 0, 0.9), 0 1px 0 0 rgba(255,255,255,0.05) inset',
        glow: '0 0 0 1px rgba(143,240,198,0.22), 0 18px 60px -28px rgba(143,240,198,0.35)',
      },
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.75rem',
      },
      backgroundImage: {
        'radial-fade':
          'radial-gradient(ellipse 70% 55% at 50% 0%, rgba(255,255,255,0.08), transparent 70%)',
        'grid-fade':
          'linear-gradient(to right, rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.045) 1px, transparent 1px)',
      },
      keyframes: {
        'pulse-ring': {
          '0%': { transform: 'scale(0.9)', opacity: '0.6' },
          '70%': { transform: 'scale(1.6)', opacity: '0' },
          '100%': { transform: 'scale(1.6)', opacity: '0' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        'bar-breathe': {
          '0%, 100%': { transform: 'scaleY(0.35)' },
          '50%': { transform: 'scaleY(1)' },
        },
      },
      animation: {
        'pulse-ring': 'pulse-ring 2.4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        shimmer: 'shimmer 2.4s linear infinite',
        float: 'float 7s ease-in-out infinite',
        'bar-breathe': 'bar-breathe 1.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
