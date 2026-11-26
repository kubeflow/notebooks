import { defineConfig } from 'cypress';
import { setupPlugins } from './cypress/support/plugin';

export default defineConfig({
  e2e: {
    specPattern: 'cypress/tests/**/*.cy.ts',
    supportFile: 'cypress/support/e2e.ts',
    defaultCommandTimeout: 30_000,
    responseTimeout: 30_000,
    pageLoadTimeout: 60_000,
    viewportWidth: 1920,
    viewportHeight: 1080,
    video: true,
    videoCompression: 32,
    screenshotOnRunFailure: true,
    videosFolder: 'cypress/videos',
    screenshotsFolder: 'cypress/screenshots',
    retries: {
      // One retry absorbs cluster hiccups; passes-on-retry are reported (see plugin/index.ts).
      runMode: 1,
      openMode: 0,
    },
    setupNodeEvents: (on, config) => setupPlugins(on, config),
  },
});
