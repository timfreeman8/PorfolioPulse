/// <reference types="vitest/config" />
import path from 'path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';
const dirname = typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));

// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  test: {
    projects: [
      // ── Storybook browser tests ─────────────────────────────────────────
      // Runs Storybook interaction tests and a11y checks in a real Chromium
      // browser via Playwright. Kept separate from unit tests so it doesn't
      // require a running browser for plain logic tests.
      {
        extends: true,
        plugins: [
          // The plugin will run tests for the stories defined in your Storybook config
          // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
          storybookTest({
            configDir: path.join(dirname, '.storybook')
          }),
        ],
        test: {
          name: 'storybook',
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({}),
            instances: [{ browser: 'chromium' }],
          },
        },
      },

      // ── Pure logic / utility unit tests ────────────────────────────────
      // Runs in the Node environment — no browser needed. Covers lib utilities
      // such as fiscal.ts and csv.ts that have no DOM dependencies.
      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'node',
          include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
        },
      },

      // ── Component tests ─────────────────────────────────────────────────
      // Runs in jsdom so React components can be rendered and asserted on
      // without a real browser. Separate from the node project so jsdom is
      // only loaded for files that actually need it.
      {
        extends: true,
        test: {
          name: 'component',
          environment: 'jsdom',
          include: ['src/**/*.component.test.tsx'],
        },
      },
    ],
  }
});