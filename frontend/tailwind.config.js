/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      boxShadow: {
        soft: "0 10px 30px rgba(0,0,0,.08)",
        glow: "0 0 0 1px rgba(34,211,238,.18), 0 0 40px rgba(34,211,238,.14)",
      },
    }
  },
  plugins: []
}