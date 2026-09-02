import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#f7f4ee",
        sand: "#ede7dc",
        ink: "#0a0a0a",
        rouge: "#e0111e",
        line: "#1a1a1a",
      },
      fontFamily: {
        display: ['"Archivo Black"', "Archivo", "Arial Black", "sans-serif"],
        sans: ["Archivo", "Inter", "Arial", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
