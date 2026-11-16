/** @type {import('tailwindcss').Config} */
const c = (v) => `rgb(var(--${v}) / <alpha-value>)`

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        powder: { DEFAULT: c('powder'), deep: c('powder-deep') },
        card: c('card'),
        plum: { DEFAULT: c('plum'), dark: c('plum-dark'), soft: c('plum-soft') },
        ink: c('ink'),
        coral: { DEFAULT: c('coral'), soft: c('coral-soft'), deep: c('coral-deep') },
        lavender: { DEFAULT: c('lavender'), soft: c('lavender-soft') },
        line: c('line'),
        success: c('success'),
      },
      fontFamily: {
        display: ['Prata', 'serif'],
        sans: ['Onest', 'system-ui', 'sans-serif'],
        pixel: ['Doto', 'monospace'],
        script: ['"Homemade Apple"', 'cursive'],
      },
      borderRadius: {
        card: '22px',
        tile: '36px',
      },
      boxShadow: {
        soft: '0 8px 30px rgb(74 42 63 / 0.08)',
        lift: '0 14px 40px rgb(74 42 63 / 0.14)',
      },
      maxWidth: {
        page: '72rem',
      },
      keyframes: {
        shimmer: { '100%': { transform: 'translateX(100%)' } },
      },
      animation: {
        shimmer: 'shimmer 1.4s infinite',
      },
    },
  },
  plugins: [],
}
