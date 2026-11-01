import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
// On Vercel (which sets VERCEL=1 during the build) the /api relay exists, so the AI diagnosis is
// switched on. GitHub Pages builds have no backend and keep the rule-based diagnosis.
const aiOn = process.env.VERCEL === '1' || process.env.VITE_LOCAL_AI === '1';
export default defineConfig({
  plugins: [tailwindcss()],
  define: aiOn ? { 'import.meta.env.VITE_LOCAL_AI': JSON.stringify('1') } : {},
});
