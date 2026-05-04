module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        mono: ['JetBrains Mono', 'monospace'],
        sans: ['Syne', 'sans-serif'],
      },
      colors: {
        brand: { DEFAULT: '#00FF94', dark: '#00C870' },
        surface: { DEFAULT: '#0D1117', 1: '#161B22', 2: '#21262D' },
        border: '#30363D',
        danger: '#FF4D4D',
      },
    },
  },
  plugins: [],
}