/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#1e3a8a',
          action: '#2563eb',
          header: '#0f172a',
          sidebar: '#1e293b',
          canvas: '#f8fafc',
        },
        status: {
          activeBg: '#d1fae5',
          activeText: '#065f46',
          blockedBg: '#fee2e2',
          blockedText: '#991b1b',
        }
      },
    },
  },
  plugins: [],
};
