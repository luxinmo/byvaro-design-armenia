import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx,html}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        /* Success · verde semántico para estados "ok" (contrato vigente,
         * actividad reciente, exigencia cumplida). Sustituye a
         * `emerald-*` de Tailwind — migración masiva en abril 2026. */
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        /* Warning · ámbar semántico (pendientes, por expirar, favoritos).
         * Sustituye a `amber-*` de Tailwind. */
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
        },
      },
      /* Escala de radios Byvaro · reducida (menos redondo en todo el
         sistema). Los pills (rounded-full) se mantienen intactos. */
      borderRadius: {
        /* shadcn tokens · derivados de --radius (8px tras la reducción). */
        lg: "var(--radius)",                  // 8px  (antes 16px)
        md: "calc(var(--radius) - 2px)",      // 6px  (antes 14px)
        sm: "calc(var(--radius) - 4px)",      // 4px  (antes 12px)
        /* Override de los Tailwind grandes · panel/card usa 2xl, dialogs 2xl/3xl. */
        xl: "10px",                            // antes 12px
        "2xl": "12px",                         // antes 16px
        "3xl": "16px",                         // antes 24px
      },
      boxShadow: {
        soft: '0 2px 16px -6px rgba(0,0,0,0.06)',
        'soft-lg': '0 4px 24px -8px rgba(0,0,0,0.1)',
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.4s ease both",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
