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
          red: '#c91e2f',
          redHover: '#b21927',
          redLight: '#fde8ea',
          black: '#000000',
          dark: '#111111',
          cardDark: '#171717',
          grayBg: '#f2f2f2',
          grayCard: '#fafafa',
          grayBorder: '#e5e5e5',
          white: '#ffffff',
          accent: '#c91e2f'
        }
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', '"DM Sans"', 'system-ui', 'sans-serif'],
        display: ['"Space Grotesk"', '"Manrope"', 'sans-serif']
      }
    },
  },
  plugins: [],
}
