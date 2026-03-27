/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {},
  },
  plugins: [],
};

theme: {
  extend: {
    fontFamily: {
      sans: ["Weezer", "system-ui", "sans-serif"],
      poppins: ["Weezer", "system-ui", "sans-serif"],
    },
  },
},