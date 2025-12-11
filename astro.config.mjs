import cloudflare from "@astrojs/cloudflare";
import mdx from "@astrojs/mdx";
import { defineConfig } from "astro/config";

import sitemap from "@astrojs/sitemap";

export default defineConfig({
  site: "https://hypertext.tv",
  output: "server",
  devToolbar: {
    enabled: false,
  },
  adapter: cloudflare({
    imageService: "compile",
    workerEntryPoint: {
      path: "./src/worker.ts",
      namedExports: ["VisitorTracker"],
    },
  }),
  prefetch: true,
  redirects: {
    "/ch/00": "/",
    "/about": "/credits",
    "/ch/999": "/credits",
  },
  integrations: [mdx(), sitemap()],
});
