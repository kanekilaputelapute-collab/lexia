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
        navy:  { DEFAULT: '#0F1B2D', 50: '#F0F3F7', 100: '#C8D4E3', 200: '#8FA8C8', 300: '#5A7CA3', 400: '#2E5480', 500: '#1A3A5C', 600: '#0F1B2D' },
        cream: { DEFAULT: '#F5F0E8', dark: '#E8E0D0' },
        gold:  { DEFAULT: '#C9A84C', light: '#F0D98A', dark: '#8B6E28' },
        sage:  { DEFAULT: '#4A7C59', light: '#E8F2EB' },
        rose:  { DEFAULT: '#C4544A', light: '#FAEAE9' },
      },
      fontFamily: {
        display: ['Georgia', 'Cambria', 'Times New Roman', 'serif'],
        body:    ['Palatino Linotype', 'Palatino', 'Book Antiqua', 'Georgia', 'serif'],
        mono:    ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
}
