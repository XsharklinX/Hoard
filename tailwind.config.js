/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        base:    'rgb(var(--c-base)    / <alpha-value>)',
        surface: 'rgb(var(--c-surface) / <alpha-value>)',
        card:    'rgb(var(--c-card)    / <alpha-value>)',
        border:  'rgb(var(--c-border)  / <alpha-value>)',
        gold: {
          DEFAULT: 'rgb(var(--c-gold)       / <alpha-value>)',
          light:   'rgb(var(--c-gold-light)  / <alpha-value>)',
          dim:     'rgb(var(--c-gold-dim)    / <alpha-value>)',
        },
        text: {
          primary:   'rgb(var(--c-text-primary)   / <alpha-value>)',
          secondary: 'rgb(var(--c-text-secondary) / <alpha-value>)',
          muted:     'rgb(var(--c-text-muted)     / <alpha-value>)',
        }
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: []
}
