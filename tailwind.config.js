/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#0d0d14',
          card: '#13131e',
          elevated: '#1a1a28',
          border: '#252535',
        },
      },
    },
  },
  plugins: [],
}
