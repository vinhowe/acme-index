const defaultTheme = require("tailwindcss/defaultTheme");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  plugins: [require("@tailwindcss/typography")],
  theme: {
    fontFamily: {
      mono: ["Space Mono", ...defaultTheme.fontFamily.mono],
      button: ["Space Grotesk", ...defaultTheme.fontFamily.sans],
    },
  },
};
