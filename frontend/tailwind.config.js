/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Deep agricultural green as the brand color, with a warm
        // "harvest" accent used sparingly for calls-to-action / prices.
        forest: {
          50: '#eefbf3',
          100: '#d6f5e1',
          200: '#aeeac8',
          300: '#79d7a9',
          400: '#45bd86',
          500: '#22a06a',
          600: '#158055',
          700: '#0f6647',
          800: '#0c4f3a',
          900: '#0a4030',
          950: '#052419',
        },
        harvest: {
          400: '#f2b552',
          500: '#e8992b',
          600: '#cc7d1c',
        },
        cloud: {
          50: '#fafaf9',
          100: '#f4f4f2',
          200: '#e7e7e3',
        },
      },
      fontFamily: {
        display: ['"Fraunces"', 'serif'],
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 2px 10px -2px rgba(10, 64, 48, 0.10), 0 8px 24px -8px rgba(10, 64, 48, 0.08)',
        float: '0 8px 30px -6px rgba(10, 64, 48, 0.25)',
      },
      borderRadius: {
        '2xl': '1.1rem',
        '3xl': '1.6rem',
      },
      keyframes: {
        'pop-in': {
          '0%': { transform: 'scale(0.9)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        'like-burst': {
          '0%': { transform: 'scale(1)' },
          '35%': { transform: 'scale(1.35)' },
          '100%': { transform: 'scale(1)' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(12px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
      animation: {
        'pop-in': 'pop-in 0.25s ease-out',
        'like-burst': 'like-burst 0.35s ease-out',
        'slide-up': 'slide-up 0.3s ease-out',
      },
    },
  },
  plugins: [],
}
