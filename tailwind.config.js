/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "sans-serif",
        ],
        display: ["Gabarito", "ui-rounded", "system-ui", "sans-serif"],
        body: ["Hanken Grotesk", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      // Add specific font-weight configurations
      fontWeight: {
        normal: 400,
        medium: 500,
        semibold: 600,
      },
      colors: {
        brand: {
          DEFAULT: "#6C5CE7",
          deep: "#2F278D",
          ink: "#1E1638",
          muted: "#5B5675",
          mist: "#FAF9FF",
          lilac: "#EFEBFF",
          green: "#45A134",
        },
      },
    },
  },
  plugins: [],
};
