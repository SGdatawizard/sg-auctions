import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  "#f0f4ff",
          100: "#e0e8f5",
          200: "#c2d1eb",
          300: "#94aed6",
          400: "#6687bc",
          500: "#2f5597",
          600: "#264880",
          700: "#1e3a6b",
          800: "#162d55",
          900: "#0e1e38",
          950: "#080f1e",
        },
        gold: {
          50:  "#fdf9ed",
          100: "#faf0cc",
          200: "#f4de8f",
          300: "#eeca52",
          400: "#e8b825",
          500: "#c99a0f",
          600: "#a87c0b",
          700: "#865f0d",
          800: "#6e4d11",
          900: "#5c3f12",
        },
        cream: {
          50:  "#fdfcf8",
          100: "#f7f4ec",
          200: "#ede8d8",
          300: "#ddd6c0",
          400: "#c9bfa3",
          500: "#b3a685",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
