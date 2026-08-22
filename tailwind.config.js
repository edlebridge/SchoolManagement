/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: 'var(--color-bg)',
        surface: {
          DEFAULT: 'var(--color-surface)',
          raised: 'var(--color-surface-raised)',
          overlay: 'var(--color-surface-overlay)',
          border: 'var(--color-border)',
          muted: 'var(--color-border-muted)',
        },
        ink: {
          DEFAULT: 'var(--color-text)',
          soft: 'var(--color-text-soft)',
          muted: 'var(--color-text-muted)',
        },
        primary: {
          DEFAULT: 'var(--color-primary)',
          light: 'var(--color-primary-light)',
          dark: 'var(--color-primary-dark)',
          soft: 'var(--color-primary-soft)',
          'soft-text': 'var(--color-primary-soft-text)',
        },
        success: {
          DEFAULT: 'var(--color-success)',
          soft: 'var(--color-success-soft)',
          'soft-text': 'var(--color-success-soft-text)',
        },
        warning: {
          DEFAULT: 'var(--color-warning)',
          soft: 'var(--color-warning-soft)',
          'soft-text': 'var(--color-warning-soft-text)',
        },
        error: {
          DEFAULT: 'var(--color-error)',
          soft: 'var(--color-error-soft)',
          'soft-text': 'var(--color-error-soft-text)',
        },
        info: {
          DEFAULT: 'var(--color-info)',
          soft: 'var(--color-info-soft)',
          'soft-text': 'var(--color-info-soft-text)',
        },
        skeleton: 'var(--color-skeleton)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
