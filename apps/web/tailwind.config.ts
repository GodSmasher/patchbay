import type { Config } from 'tailwindcss'

export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: '#16181d', soft: '#4b5160', mute: '#8a8f9c' },
        paper: { DEFAULT: '#fbfaf7', card: '#ffffff', line: '#e7e4dc' },
        signal: { DEFAULT: '#1f6f5c', soft: '#e6f2ee' },
        warn: { DEFAULT: '#a4462b', soft: '#fbece6' },
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Inter', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
} satisfies Config
