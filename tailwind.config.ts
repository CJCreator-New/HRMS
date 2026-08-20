import type { Config } from "tailwindcss";

/**
 * Design tokens — mirrors the CSS variables declared in src/app/globals.css.
 * Keep these two files in sync; the variables are the single source of truth.
 */
const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: {
          50: "var(--primary-50)",
          100: "var(--primary-100)",
          200: "var(--primary-200)",
          300: "var(--primary-300)",
          400: "var(--primary-400)",
          500: "var(--primary-500)",
          600: "var(--primary-600)",
          700: "var(--primary-700)",
          800: "var(--primary-800)",
          900: "var(--primary-900)",
          950: "var(--primary-950)",
        },
        // Semantic surfaces (cards, page bg, hover/muted fills)
        surface: {
          DEFAULT: "var(--surface)",
          subtle: "var(--surface-subtle)",
          muted: "var(--surface-muted)",
        },
        // Semantic text hierarchy
        ink: {
          DEFAULT: "var(--ink)",
          secondary: "var(--ink-secondary)",
          muted: "var(--ink-muted)",
          faint: "var(--ink-faint)",
        },
        // Semantic borders/dividers
        line: {
          DEFAULT: "var(--line)",
          strong: "var(--line-strong)",
        },
        // Sidebar dark surface tokens
        sidebar: {
          bg: "var(--sidebar-bg)",
          raised: "var(--sidebar-bg-raised)",
          text: "var(--sidebar-text)",
          muted: "var(--sidebar-text-muted)",
          bright: "var(--sidebar-text-bright)",
          border: "var(--sidebar-border)",
          hover: "var(--sidebar-hover)",
          active: "var(--sidebar-active-bg)",
          "active-text": "var(--sidebar-active-text)",
          backdrop: "var(--sidebar-backdrop)",
        },
      },
      boxShadow: {
        card: "var(--shadow-card)",
        raised: "var(--shadow-raised)",
        overlay: "var(--shadow-overlay)",
        pop: "var(--shadow-pop)",
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
        mono: ["var(--font-mono)"],
      },
      zIndex: {
        sidebar: "var(--z-sidebar)",
        dropdown: "var(--z-dropdown)",
        modal: "var(--z-modal)",
        drawer: "var(--z-drawer)",
        overlay: "var(--z-overlay)",
        toast: "var(--z-toast)",
        search: "var(--z-search)",
      },
    },
  },
  plugins: [],
};
export default config;
