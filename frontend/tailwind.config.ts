import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        surface: "#ffffff",
        border: "hsl(var(--border))",
        ring: "hsl(var(--ring))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        success: "hsl(var(--success))",
        warning: "hsl(var(--warning))",
        danger: "hsl(var(--danger))",
        slate: {
          // Light theme surface palette
          950: "#f5f1eb",   // page background (cream)
          900: "#ffffff",   // card surface (white)
          800: "#f0ece4",   // secondary surface (warm beige)
          700: "#e2ddd6",   // subtle borders
          // Re-mapped: dark-mode text classes stay readable on light/white backgrounds
          600: "#52525b",   // default #475569 — keep similar
          500: "#71717a",   // default #64748b — keep similar
          400: "#52525b",   // was #94a3b8 (too light on white) → medium gray
          300: "#3f3f46",   // was #cbd5e1 (near-invisible) → readable dark
          200: "#27272a",   // was #e2e8f0 (invisible) → near-black
          100: "#18181b",   // was #f1f5f9 (invisible) → very dark
        },
      },

      fontFamily: {
        heading: ["var(--font-cal)", "system-ui", "sans-serif"],
        body: ["var(--font-satoshi)", "system-ui", "sans-serif"],
        ui: ["var(--font-matter)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        card: "12px",
      },
      boxShadow: {
        violet: "0 0 20px -5px rgba(108, 99, 255, 0.3)",
        "violet-active": "0 0 25px -2px rgba(108, 99, 255, 0.5)",
      },
      animation: {
        "pulse-red": "pulse-red 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "fade-in": "fade-in 0.5s ease-out forwards",
      },
      keyframes: {
        "pulse-red": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.5" },
        },
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};
export default config;

