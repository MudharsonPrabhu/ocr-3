/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./lib/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        accent: "#0ea5a4",
        surface: "#0b1220",
        night: "#071029",
        "night-2": "#071829"
      },
      boxShadow: {
        sheet: "0 15px 45px rgba(3,7,18,0.55)"
      }
    }
  },
  plugins: [],
};

