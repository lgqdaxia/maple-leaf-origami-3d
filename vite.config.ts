import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  optimizeDeps: { include: ["three/addons/exporters/GLTFExporter.js"] },
});
