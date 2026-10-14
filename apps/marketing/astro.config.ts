import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://porcelain.fabiofiorita.com',
  devToolbar: { enabled: false },
  vite: {
    plugins: [tailwindcss()],
  },
});
