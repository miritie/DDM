import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brown: {
          50: '#fdf8f6',
          100: '#f2e8e5',
          200: '#eaddd7',
          300: '#e0cec7',
          400: '#d2bab0',
          500: '#bfa094',
          600: '#a18072',
          700: '#977669',
          800: '#846358',
          900: '#43302b',
        },
        primary: {
          DEFAULT: '#8B4513',
          50: '#F5E6D3',
          100: '#ECDCC5',
          200: '#DBC7A8',
          300: '#C9B28B',
          400: '#B89D6E',
          500: '#A68851',
          600: '#8B4513',
          700: '#6B340E',
          800: '#4A240A',
          900: '#2A1406',
        },
        secondary: {
          DEFAULT: '#D2691E',
          50: '#FAE8DB',
          100: '#F7DFCC',
          200: '#F0CDAD',
          300: '#E9BB8E',
          400: '#E2A86F',
          500: '#DB9650',
          600: '#D2691E',
          700: '#A45117',
          800: '#763A11',
          900: '#48230A',
        },
        accent: {
          DEFAULT: '#CD853F',
          50: '#F9F0E7',
          100: '#F5E6D3',
          200: '#EDD2AC',
          300: '#E5BE85',
          400: '#DDAA5E',
          500: '#D59637',
          600: '#CD853F',
          700: '#A86A32',
          800: '#7D4F26',
          900: '#52341A',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Poppins', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'soft': '0 2px 15px -3px rgba(139, 69, 19, 0.1), 0 10px 20px -2px rgba(139, 69, 19, 0.05)',
        'medium': '0 4px 20px -2px rgba(139, 69, 19, 0.15), 0 12px 25px -5px rgba(139, 69, 19, 0.1)',
        'strong': '0 10px 40px -5px rgba(139, 69, 19, 0.2), 0 15px 30px -8px rgba(139, 69, 19, 0.15)',
      },
      borderRadius: {
        'xl': '1rem',
        '2xl': '1.5rem',
        '3xl': '2rem',
      },
    },
  },
  plugins: [],
};

export default config;
