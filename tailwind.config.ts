import type { Config } from "tailwindcss";

/** Chaque couleur passe par un jeton défini dans src/index.css, pour les deux thèmes. */
const jeton = (nom: string) => `rgb(var(--${nom}) / <alpha-value>)`;

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: jeton("paper"),
        card: jeton("card"),
        sand: jeton("sand"),
        ink: jeton("ink"),
        muted: jeton("muted"),
        line: jeton("line"),
        hair: jeton("hair"),
        fort: jeton("fort"),
        "sur-fort": jeton("sur-fort"),
        rouge: jeton("rouge"),
        "sur-rouge": jeton("sur-rouge"),
        ok: jeton("ok"),
        "ok-fond": jeton("ok-fond"),
        attention: jeton("attention"),
        "attention-fond": jeton("attention-fond"),
        voile: jeton("voile"),
      },
      fontFamily: {
        display: ['"Archivo Black"', "Archivo", "Arial Black", "sans-serif"],
        sans: ["Archivo", "Inter", "Arial", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
