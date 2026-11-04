/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Design direction:
        // Forest green: #1E5E3A | Harvest gold: #D9822B | Off-white: #F9FAF7
        brand: {
          green: '#1E5E3A',
          gold: '#D9822B',
          bg: '#F9FAF7',
        },
        forest: {
          50: '#f0f8f3',
          100: '#d7ede1',
          200: '#b2dbc6',
          300: '#83c2a3',
          400: '#52a37f',
          500: '#328863',
          600: '#257250',
          700: '#1E5E3A', // Primary Forest Green
          800: '#1a4c30',
          900: '#153f28',
          950: '#0a2316',
        },
        harvest: {
          50: '#fdf8ef',
          100: '#faedd6',
          200: '#f4d9aa',
          300: '#eebf75',
          400: '#e5a041',
          500: '#D9822B', // Harvest Gold
          600: '#bc6820',
          700: '#954c1c',
          800: '#7a3d1d',
          900: '#64341b',
        },
        cloud: {
          50: '#F9FAF7', // Off-White
          100: '#f2f4f0',
          200: '#e5e7e1',
          300: '#d2d6cc',
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
