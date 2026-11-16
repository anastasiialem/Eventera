/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        powder: '#F5E9EC',
        card: '#FFFBFA',
        plum: { DEFAULT: '#4A2A3F', dark: '#2E1B28' },
        coral: '#E8806A',
        lavender: '#C9B6E4',
      },
      fontFamily: {
        display: ['Prata', 'serif'],
        sans: ['Onest', 'system-ui', 'sans-serif'],
        pixel: ['Doto', 'monospace'],
        script: ['"Homemade Apple"', 'cursive'],
      },
      borderRadius: {
        card: '22px',
      },
      boxShadow: {
        soft: '0 8px 30px rgba(74, 42, 63, 0.08)',
      },
    },
  },
  plugins: [],
}
