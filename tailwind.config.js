/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb', // Primary brand action
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a', // Primary brand dark blue
          950: '#0f1f4b',
          header: '#0f172a',
          sidebar: '#1e293b',
        },
        navy: {
          700: '#1e293b',
          800: '#131d33',
          850: '#0f172a',
          900: '#0a0f1d',
          950: '#060913',
        },
      },
    },
  },
  plugins: [],
};
