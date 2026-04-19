import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  // Base path para GitHub Pages (https://luxinmo.github.io/byvaro-design-armenia/).
  // En `npm run dev` Vite sigue sirviendo en "/" porque la base solo se aplica
  // a las URLs de los assets del build de producción.
  base: "/byvaro-design-armenia/",
  server: { host: "::", port: 8080 },
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
