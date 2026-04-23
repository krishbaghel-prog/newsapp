/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"]
      },
      colors: {
        brand: {
          50: "#fff5f5",
          100: "#ffe0e0",
          200: "#ffb8b8",
          300: "#ff8a8a",
          400: "#ff6b6b",
          500: "#f45b5b",
          600: "#e04343",
          700: "#c53030",
          800: "#9b2c2c",
          900: "#742a2a"
        },
        accent: {
          50: "#fffbea",
          100: "#fff3c4",
          200: "#fce588",
          300: "#fadb5f",
          400: "#f7c948",
          500: "#f0b429",
          600: "#de911d",
          700: "#cb6e17",
          800: "#b44d12",
          900: "#8d2b0b"
        },
        surface: {
          light: "#fff8f6",
          dark: "#111216"
        }
      },
      boxShadow: {
        glow: "0 0 20px rgba(244, 91, 91, 0.15)",
        "glow-lg": "0 0 40px rgba(244, 91, 91, 0.2)",
        card: "0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.06)",
        "card-hover": "0 4px 16px rgba(0,0,0,0.08), 0 8px 24px rgba(0,0,0,0.1)"
      },
      animation: {
        "fade-in": "fadeIn 0.5s ease-out forwards",
        "slide-up": "slideUp 0.4s ease-out forwards",
        "pulse-soft": "pulseSoft 2s ease-in-out infinite"
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" }
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        },
        pulseSoft: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.6" }
        }
      }
    }
  },
  plugins: [require("@tailwindcss/forms")]
};
