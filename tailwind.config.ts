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
          50:  "#fdf8f0",
          100: "#faefd9",
          200: "#f5d9a8",
          300: "#eebe6e",
          400: "#e8a23e",
          500: "#d4861f",
          600: "#b06a17",
          700: "#8a5016",
          800: "#6e3f17",
          900: "#5a3415",
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
