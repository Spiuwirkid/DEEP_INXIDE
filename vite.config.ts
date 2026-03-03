import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { geminiProxyPlugin } from "./server/gemini-proxy";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
    allowedHosts: [
      "cyberxtron.com",
      "nsc.ddavadev.site",
      "www.cyberxtron.com",
      "portal.cyberxtron.com",
      "deepinxide.cyberxtron.com",
      "shadowspot.cyberxtron.com",
      "darkflash-incident.cyberxtron.com",
      "brandsafe.cyberxtron.com",
    ],
  },
  plugins: [react(), geminiProxyPlugin(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  // ── Security: Hide source code ──
  css: {
    devSourcemap: false,
  },
  build: {
    // No source maps in production — prevents source code exposure
    sourcemap: false,
    // Minify & obfuscate
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,   // Remove all console.log in production
        drop_debugger: true,  // Remove debugger statements
      },
      mangle: {
        toplevel: true,       // Mangle top-level variable names
      },
      format: {
        comments: false,      // Strip all comments
      },
    },
    // Split chunks to obfuscate code further
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          supabase: ['@supabase/supabase-js'],
        },
        // Randomize chunk filenames — no predictable paths
        chunkFileNames: 'assets/[hash].js',
        entryFileNames: 'assets/[hash].js',
        assetFileNames: 'assets/[hash].[ext]',
      },
    },
  },
}));
