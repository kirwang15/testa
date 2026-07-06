import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        coral: "#ff6b57",
        ink: "#161616",
        leaf: "#4caf50",
        mint: "#18a999",
        paper: "#f7f8fb",
        sun: "#ffc857"
      },
      boxShadow: {
        crisp: "0 12px 30px rgba(22, 22, 22, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
