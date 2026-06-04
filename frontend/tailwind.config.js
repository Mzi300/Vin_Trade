/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./src/**/*.css",
  ],
  theme: {
    extend: {
      colors: {
        "trade-dark": "#1e1e24",
        "trade-panel": "#2b2b36",
        "trade-accent": "#00d2ff",
        "trade-buy": "#00e676",
        "trade-sell": "#ff5252",
        "trade-text": "#e0e0e0",
        "trade-muted": "#8e8e93",
      },
    },
  },
  // Remove safelist; all custom utilities are generated via extend.colors
};
