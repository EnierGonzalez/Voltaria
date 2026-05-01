import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
    "../../packages/shared/src/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        background: "#060B14",
        foreground: "#F5F7FB",
        panel: "#0B1220",
        panel2: "#101A2B",
        border: "#162235",
        muted: "#B8C4D9",
        primary: "#1F6BFF",
        cyan: "#00C2FF",
        success: "#00E38C",
        warning: "#FFC247",
        danger: "#FF5B6E"
      },
      boxShadow: {
        premium: "0 24px 80px rgba(0, 0, 0, 0.28)"
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "sans-serif"
        ]
      }
    }
  },
  plugins: [animate]
};

export default config;
