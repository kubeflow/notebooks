// Node.js process only (see README "Architecture"). The single entry point used by cypress.config.ts.
import * as fs from 'fs';
import { registerBaselineTasks, teardownBaseline } from './baseline';
import { environment } from './environment';
import { registerK8sTasks } from './k8sClient';
import { registerSampleTasks } from './samples';

export function setupPlugins(
  on: Cypress.PluginEvents,
  config: Cypress.PluginConfigOptions,
): Cypress.PluginConfigOptions {
  registerK8sTasks(on);
  registerBaselineTasks(on);
  registerSampleTasks(on);

  on('after:spec', (_spec, results) => {
    if (!results) {
      return;
    }
    // Keep videos only for failing specs, so CI artifacts are just the relevant ones.
    if (results.video && results.stats.failures === 0) {
      fs.unlinkSync(results.video);
    }
    // Retries hide flakiness; make every pass-on-retry visible in the run log.
    for (const test of results.tests) {
      if (test.state === 'passed' && test.attempts.length > 1) {
        console.warn(
          `  ⚠ Passed on retry (${test.attempts.length} attempts): ${test.title.join(' > ')}`,
        );
      }
    }
  });

  on('after:run', async () => {
    if (environment.teardown) {
      await teardownBaseline();
    }
  });

  // Browser code can't see process.env, so publish the resolved environment to it.
  return {
    ...config,
    baseUrl: environment.baseUrl,
    env: { ...config.env, e2e: environment },
  };
}
