/**
 * Storybook global preview configuration.
 *
 * - Imports the app's root CSS so every story renders with the same Tailwind
 *   styles and CSS variables as the real app.
 * - Seeds the Zustand store via localStorage before each story so any
 *   story that renders a component reading portfolio data gets real data
 *   rather than empty state. The store reads from localStorage on hydrate(),
 *   so seeding here is sufficient — no provider wrapper needed.
 */
import type { Preview } from '@storybook/react-vite'
import '../src/index.css'
import { seedIfEmpty } from '../src/lib/seedData'
import { usePortfolioStore } from '../src/store/usePortfolioStore'

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
       color: /(background|color)$/i,
       date: /Date$/i,
      },
    },

    a11y: {
      // 'todo' - show a11y violations in the test UI only
      // 'error' - fail CI on a11y violations
      // 'off' - skip a11y checks entirely
      test: 'todo'
    }
  },

  // Seed the store once per test run so components that read portfolio state
  // (e.g. domain dropdowns, initiative selects) have data to display.
  beforeEach() {
    seedIfEmpty(usePortfolioStore.getState().hydrate)
  },
};

export default preview;