import type { Config } from 'tailwindcss'

export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: 'var(--color-ink)',
          soft: 'var(--color-ink-soft)',
          mute: 'var(--color-ink-mute)',
        },
        paper: {
          DEFAULT: 'var(--color-paper)',
          card: 'var(--color-paper-card)',
          line: 'var(--color-paper-line)',
        },
        signal: {
          DEFAULT: 'var(--color-signal)',
          soft: 'var(--color-signal-soft)',
        },
        warn: {
          DEFAULT: 'var(--color-warn)',
          soft: 'var(--color-warn-soft)',
        },
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Inter', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
} satisfies Config
