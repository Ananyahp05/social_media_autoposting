/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                linkedin: "#0077b5",
                "linkedin-light": "#00a0dc",
                "web3-bg": "#0a1628",
                "cyber-blue": "#00f2fe",
                "cyber-purple": "#f093fb",
            },
            animation: {
                'glow': 'glow 2s ease-in-out infinite alternate',
            },
            keyframes: {
                glow: {
                    'from': { boxShadow: '0 0 10px rgba(0, 242, 254, 0.2)' },
                    'to': { boxShadow: '0 0 20px rgba(0, 242, 254, 0.6)' },
                }
            }
        },
    },
    plugins: [],
}
