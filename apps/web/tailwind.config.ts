import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0a0a0f',
        panel: '#12121a',
        border: '#22222e',
        neon: '#a855f7',
        gold: '#f5c542',
        accent: '#22d3ee',
        danger: '#ef4444',
        success: '#22c55e',
      },
      boxShadow: {
        neon: '0 0 20px rgba(168,85,247,0.35)',
        gold: '0 0 24px rgba(245,197,66,0.4)',
      },
      fontFamily: { display: ['Inter', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
} satisfies Config;
