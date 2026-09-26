/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#17253a",
        muted: "#728096",
        paper: "#f4f7fb",
        line: "#e2e8f0",
        brand: {
          50: "#eef5ff",
          100: "#dbeafe",
          500: "#2563eb",
          600: "#1d4ed8",
          700: "#1e40af"
        },
        teal: {
          50: "#e8f7f5",
          500: "#0f9b8e",
          600: "#087f75"
        }
      },
      boxShadow: {
        soft: "0 12px 34px rgba(20, 42, 74, 0.08)"
      },
      borderRadius: {
        card: "1.25rem"
      }
    }
  },
  plugins: []
};
