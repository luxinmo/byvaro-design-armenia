import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  // Sin base path — servimos desde la raíz "/". Funciona para:
  //   - Vercel / Netlify / Cloudflare Pages (SPA fallback automático)
  //   - Dev local (`npm run dev`)
  // Si algún día queremos GitHub Pages con subdirectorio, habría que
  // reactivar base: "/byvaro-design-armenia/" y el SPA 404.html trick.
  server: { host: "::", port: 8080 },
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
