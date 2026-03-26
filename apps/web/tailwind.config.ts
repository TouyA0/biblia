import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        ink: '#1a1612',
        'ink-soft': '#4a3f35',
        'ink-muted': '#8a7a6e',
        'ink-faint': '#c8b8a8',
        parchment: '#f7f3ed',
        'parchment-dark': '#ede6db',
        'parchment-deep': '#e0d5c5',
        gold: '#b8843a',
        'gold-light': '#d4a85a',
        'gold-pale': '#f0e4cc',
        'blue-sacred': '#2a4a7a',
        'green-valid': '#2d5a3a',
        'green-light': '#e8f4ec',
        'red-soft': '#7a2a2a',
        'red-light': '#f4e8e8',
        'amber-pending': '#7a5a1a',
        'amber-light': '#f8f0da',
      },
      fontFamily: {
        spectral: ['Spectral', 'Georgia', 'serif'],
        crimson: ['Crimson Pro', 'serif'],
        mono: ['DM Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}

export default config