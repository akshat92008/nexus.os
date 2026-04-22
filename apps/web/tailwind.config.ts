import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './store/**/*.{ts,tsx}',
    './hooks/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        agent: {
          researcher: '#60a5fa',
          analyst:    '#a78bfa',
          writer:     '#34d399',
          coder:      '#fb923c',
          strategist: '#f472b6',
          summarizer: '#facc15',
        },
      },
    },
  },
  plugins: [],
};
export default config;
