/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Brand accent — ServiceNow signature green.
        // We override Tailwind's `cyan` so every accent in the app picks this
        // up automatically (the UI was built with cyan-* utility classes).
        cyan: {
          50: '#e9faf0',
          100: '#c9f2d9',
          200: '#9fe7bb',
          300: '#67d893',
          400: '#35c771',
          500: '#1eb45a',
          600: '#149b4b',
          700: '#0f7d3c',
          800: '#0c6531',
          900: '#0a5028',
        },
        // Polaris-style deep teal-navy used for the top banner.
        now: {
          600: '#12565d',
          700: '#0e3d43',
          800: '#0a2c31',
          900: '#061d21',
        },
      },
      boxShadow: {
        glow: '0 14px 40px -18px rgba(30, 180, 90, 0.55)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: 0, transform: 'translateY(6px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
        'pulse-dot': {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 0.4 },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.25s ease-out',
        'pulse-dot': 'pulse-dot 1.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
