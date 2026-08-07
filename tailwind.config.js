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
          red: '#da292a',
          dark: '#1a1a1a',
          darker: '#0a0a0c',
          gray: '#2c2c2c',
        },
        titan: {
          cyan: '#00f0ff',
          orange: '#ff5a00',
          panel: '#15191e',
          border: '#2a313a'
        },
        theme: {
          primary: 'var(--theme-primary)',
          secondary: 'var(--theme-secondary)'
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
        display: ['Chakra Petch', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
