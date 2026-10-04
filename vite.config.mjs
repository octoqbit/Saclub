import { cpSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  build: {
    chunkSizeWarningLimit: 1000,
    rolldownOptions: {
      input: {
        admin: resolve(root, 'admin.html'),
        account: resolve(root, 'account.html'),
        main: resolve(root, 'index.html'),
        join: resolve(root, 'join.html'),
        about: resolve(root, 'about.html'),
        events: resolve(root, 'events.html'),
        projects: resolve(root, 'projects.html'),
        team: resolve(root, 'team.html'),
      },
    },
  },
  plugins: [
    react(),
    {
      name: 'portal-routes',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          req.url = req.url.replace(/^\/(admin|account)\/?(?=\?|$)/, '/$1.html');
          next();
        });
      },
      configurePreviewServer(server) {
        server.middlewares.use((req, res, next) => {
          req.url = req.url.replace(/^\/(admin|account)\/?(?=\?|$)/, '/$1.html');
          next();
        });
      },
    },
    {
    name: 'include-robot-player',
    apply: 'build',
    writeBundle(outputOptions) {
      // The iframe is a standalone player with relative asset URLs and classic
      // scripts. Copy its runtime files intact; Vite does not follow iframe src.
      const destination = resolve(outputOptions.dir, 'robot-3d');
      mkdirSync(destination, { recursive: true });
      for (const entry of ['index.html', 'robot.css', 'robot.js', 'chip-overlay.js', 'assets']) {
        cpSync(resolve(root, 'robot-3d', entry), resolve(destination, entry), {
          recursive: true,
        });
      }
      // Database image URLs use stable paths, independent of Vite asset hashes.
      for (const folder of ['about-assets', 'showcase-assets']) {
        cpSync(resolve(root, folder), resolve(outputOptions.dir, folder), { recursive: true });
      }
    },
  }],
});
