/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        base: '#0a0a0a',
        surface: '#141414',
        card: '#1c1c1c',
        border: '#252525',
        gold: {
          DEFAULT: '#c9952a',
          light: '#e0aa42',
          dim: '#8a6318'
        },
        text: {
          primary: '#e4e4e4',
          secondary: '#888888',
          muted: '#555555'
        }
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: []
}
