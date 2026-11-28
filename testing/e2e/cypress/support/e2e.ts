// Global hooks for every spec (browser). Specs don't need their own setup for
// baseline objects, login, or cleanup: it all happens here.
import '@testing-library/cypress/add-commands';
import './browser/commands/k8s';
import { startSession } from './browser/auth';
import { beginTestScope, endTestScope, runCleanup } from './browser/cleanup';
import { parseSpecPath } from './shared/specPath';

const BASELINE_TIMEOUT_MS = 5 * 60_000;

// Fail at load time on a misplaced spec: the actor folder decides who the spec logs in as.
const specPath = parseSpecPath(Cypress.spec.relative);

before(() => {
  if ('error' in specPath) {
    throw new Error(specPath.error);
  }
  // Idempotent and memoized per Cypress process: applied once, however many specs run.
  cy.task('applyBaseline', null, { timeout: BASELINE_TIMEOUT_MS });
});

beforeEach(() => {
  // Objects registered from here until afterEach are cleaned up after this test;
  // those registered in before() hooks, after the spec file.
  beginTestScope();
  if (!('error' in specPath)) {
    startSession(specPath.actor);
  }
});

afterEach(function () {
  // Only a passing test fails on cleanup errors; otherwise they'd hide the real failure.
  runCleanup('test', this.currentTest?.state === 'passed');
  cy.then(endTestScope);
});

after(() => {
  runCleanup('spec', true);
});
