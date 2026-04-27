import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  // Sin base path — servimos desde la raíz "/". Funciona para:
  //   - Vercel / Netlify / Cloudflare Pages (SPA fallback automático)
  //   - Dev local (`npm run dev`)
  // Si algún día queremos GitHub Pages con subdirectorio, habría que
  // reactivar base: "/byvaro-design-armenia/" y el SPA 404.html trick.
  server: {
    host: "::",
    port: 8080,
    /* HMR · cuando se accede desde otro equipo de la LAN
     * (`http://192.168.x.x:8080`), el WebSocket de Hot Module
     * Reload se conecta al mismo host del navegador. Sin
     * `clientPort` explícito, en algunas redes el WS apunta a un
     * puerto distinto y nunca recibe los updates · el segundo
     * equipo se queda con el bundle JS cacheado. */
    hmr: { clientPort: 8080 },
  },
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
