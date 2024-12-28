/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "Outfit",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "sans-serif",
        ],
      },
      // Add specific font-weight configurations
      fontWeight: {
        normal: 400,
        medium: 500,
        semibold: 600,
      }
    },
  },
  plugins: [],
};

