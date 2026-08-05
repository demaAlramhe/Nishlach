import type { Config } from "tailwindcss";

/**
 * Brand tokens for נשלח (Nishlach).
 * Tailwind v4 also mirrors these in app/globals.css @theme for utility generation.
 */
const config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          yellow: "#F5B700",
          yellowHover: "#D69E00",
          dark: "#1A1A1A",
          muted: "#6B7280",
          bgLight: "#FAFAF8",
          success: "#16A34A",
          error: "#DC2626",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;

export default config;
