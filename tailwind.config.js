/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        rush: {
          50: '#f2f8f4',
          100: '#e1efe6',
          200: '#c5e0cf',
          300: '#9bc9ad',
          400: '#6bab86',
          500: '#478e63',
          600: '#34724d',
          700: '#2a5a3e',
          800: '#244833',
          900: '#1e3c2b',
          950: '#101a14',
          accent: '#1c7c4c',
          mint: '#83d4a7',
          gold: '#e5a93c',
          amber: '#d97706',
          coral: '#e57d55',
          dark: '#101a14'
        }
      },
      fontFamily: {
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
        display: ['"Manrope"', 'sans-serif']
      }
    },
  },
  plugins: [],
}
