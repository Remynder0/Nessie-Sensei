/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        apex: {
          red: 'var(--color-apex-red)',
          dark: 'var(--color-apex-dark)',
          darker: 'var(--color-apex-darker)',
          gray: 'var(--color-apex-gray)',
        },
        titan: {
          cyan: 'var(--color-titan-cyan)',
          orange: 'var(--color-titan-orange)',
          panel: 'var(--color-titan-panel)',
          border: 'var(--color-titan-border)'
        },
        theme: {
          primary: 'var(--theme-primary)',
          secondary: 'var(--theme-secondary)'
        }
      },
      fontFamily: {
        sans: ['var(--font-sans)'],
        mono: ['var(--font-mono)'],
        display: ['var(--font-display)'],
      }
    },
  },
  plugins: [],
}
