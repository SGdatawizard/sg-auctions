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
          50:  "#f0f7f4",
          100: "#d9ede5",
          200: "#b3dbc9",
          300: "#7dc2a6",
          400: "#4da382",
          500: "#2d8563",
          600: "#226b4f",
          700: "#1c5640",
          800: "#174433",
          900: "#12362a",
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
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
