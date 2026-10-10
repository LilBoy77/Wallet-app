/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        fintech: {
          dark: '#0f172a',
          card: '#1e293b',
          emerald: '#10b981',
          indigo: '#6366f1',
          rose: '#f43f5e',
        },
      },
    },
  },
  plugins: [],
};
