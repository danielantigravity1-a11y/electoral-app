/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./public/**/*.{html,js}"],
  theme: {
    extend: {
      colors: {
        "primary": "#1A1A1A",
        "secondary": "#52525B",
        "background": "#F4F4F5",
        "surface": "#FFFFFF",
        "brand-gold": "#EAB308",
        "brand-gold-light": "#FEF08A",
        "brand-navy": "#0F172A",
        "brand-navy-light": "#1E293B"
      },
      fontFamily: {
        "sans": ["Plus Jakarta Sans", "sans-serif"]
      },
      boxShadow: {
        'soft': '0 10px 40px -10px rgba(0,0,0,0.08)',
        'float': '0 20px 40px -15px rgba(0,0,0,0.15)',
        'inner-light': 'inset 0 2px 4px 0 rgba(255, 255, 255, 0.3)'
      }
    },
  },
  plugins: [],
}
