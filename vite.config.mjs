import { cpSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  build: {
    rolldownOptions: {
      input: {
        main: resolve(root, 'index.html'),
        join: resolve(root, 'join.html'),
      },
    },
  },
  plugins: [{
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
    },
  }],
});
