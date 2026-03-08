// vite.config.js
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

function createLegacyAgentPageRedirect() {
  const legacyRoutes = new Map([
    ["/public/agent-gallery.html", "/agent-gallery.html"],
    ["/public/agent-card-view.html", "/agent-card-view.html"],
  ]);

  const redirectLegacyRoute = (req, res, next) => {
    const requestUrl = req.url ?? "";

    for (const [legacyPath, targetPath] of legacyRoutes) {
      if (requestUrl.startsWith(legacyPath)) {
        const suffix = requestUrl.slice(legacyPath.length);
        res.statusCode = 302;
        res.setHeader("Location", `${targetPath}${suffix}`);
        res.end();
        return;
      }
    }

    next();
  };

  return {
    name: "legacy-agent-page-redirect",
    configureServer(server) {
      server.middlewares.use(redirectLegacyRoute);
    },
    configurePreviewServer(server) {
      server.middlewares.use(redirectLegacyRoute);
    },
  };
}

export default defineConfig({
  root: ".",
  server: {
    open: true,
  },
  build: {
    target: "esnext", // Support top-level await for WebGPU
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "index.html"),
        agentGallery: path.resolve(__dirname, "agent-gallery.html"),
        agentCardView: path.resolve(__dirname, "agent-card-view.html"),
      },
      output: {
        assetFileNames: "assets/[name]-[hash][extname]",
        entryFileNames: "assets/[name]-[hash].js",
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@styles": path.resolve(__dirname, "./src/styles"),
      "@ui": path.resolve(__dirname, "./src/ui"),
      "@weapons": path.resolve(__dirname, "./src/weapons"),
      "@weapon_spawns": path.resolve(__dirname, "./src/weapon_spawns"),
      "@data": path.resolve(__dirname, "./public/data"),
      "@assets": path.resolve(__dirname, "./public/assets"),
    },
  },
  optimizeDeps: {
    include: [
      "three",
      "three/examples/jsm/controls/OrbitControls",
      "three/examples/jsm/loaders/GLTFLoader",
      "three/examples/jsm/loaders/DRACOLoader",
      "three/examples/jsm/libs/meshopt_decoder.module.js",
      "three/examples/jsm/postprocessing/EffectComposer",
      "three/examples/jsm/postprocessing/RenderPass",
      "three/examples/jsm/postprocessing/UnrealBloomPass",
    ],
  },
  plugins: [tailwindcss(), createLegacyAgentPageRedirect()],
  experimental: {
    renderBuiltUrl(filename) {
      if (filename.endsWith(".wasm")) {
        return { relative: true };
      }
      return { relative: true };
    },
  },
});
