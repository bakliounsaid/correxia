import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Satoshi", "system-ui", "sans-serif"],
      },
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: {
          50: "#EEF6FF",
          100: "#DBECFF",
          200: "#B7D9FF",
          300: "#7FC0FF",
          400: "#3FA1FF",
          500: "#007BFF",
          600: "#0062D1",
          700: "#004BA3",
          800: "#003673",
          900: "#00244D",
          950: "#00142B",
        },
        secondary: {
          50: "#EFF8FF",
          100: "#D9EEFF",
          200: "#BEE2FF",
          300: "#91D2FF",
          400: "#5CBAFF",
          500: "#2898FF",
          600: "#1478E6",
          700: "#0F5EB4",
          800: "#0B4582",
          900: "#082E57",
          950: "#041833",
        },
        ia: {
          50: "#F5F3FF",
          100: "#EDE9FE",
          200: "#DDD6FE",
          300: "#C4B5FD",
          400: "#A78BFA",
          500: "#8B5CF6",
          600: "#7C3AED",
          700: "#6D28D9",
          800: "#5B21B6",
          900: "#4C1D95",
          950: "#2E1065",
        },
        gray: {
          50: "#F6F6F6",
          100: "#E7E7E7",
          200: "#E2E0DB",
          300: "#B0B0BD",
          400: "#999999",
          500: "#666666",
          600: "#5D5D5D",
          700: "#4F4F4F",
          800: "#454545",
          900: "#333333",
          950: "#262626",
        },
        error: {
          50: "#FEF2F2",
          400: "#FE6C64",
          500: "#F87171",
          600: "#DC2626",
        },
        success: {
          50: "#F1FCE9",
          400: "#74D843",
          500: "#22C55E",
          600: "#3E9718",
        },
        warning: {
          50: "#FFF8ED",
          400: "#FFA73D",
          500: "#E67600",
        },
      },
      boxShadow: {
        card: "0 10px 25px rgba(0, 0, 0, 0.05)",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.65" },
        },
        shimmer: {
          "0%": { backgroundPosition: "200% 0" },
          "100%": { backgroundPosition: "-200% 0" },
        },
      },
      animation: {
        float: "float 5s ease-in-out infinite",
        "pulse-soft": "pulse-soft 3s ease-in-out infinite",
        shimmer: "shimmer 8s linear infinite",
      },
    },
  },
  plugins: [],
};
export default config;
