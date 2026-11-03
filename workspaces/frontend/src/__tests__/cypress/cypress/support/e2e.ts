// ***********************************************************
// This example support/e2e.ts is processed and
// loaded automatically before your test files.
//
// This is a great place to put global configuration and
// behavior that modifies Cypress.
//
// You can change the location of this file or turn off
// automatically serving support files with the
// 'supportFile' configuration option.
//
// You can read more here:
// https://on.cypress.io/configuration
// ***********************************************************

import chaiSubset from 'chai-subset';
import '@cypress/code-coverage/support';
import 'cypress-mochawesome-reporter/register';
import './commands';
import { mockUserSettings } from '~/__mocks__/mockUserSettings';
import { NOTEBOOKS_API_VERSION } from '~/__tests__/cypress/cypress/support/commands/api';

chai.use(chaiSubset);

Cypress.Keyboard.defaults({
  keystrokeDelay: 0,
});

// Monaco cancels its in-flight promises (for example the debounced word highlighter) when the
// editor is disposed. The rejection is not handled inside Monaco, so it escapes as an unhandled
// promise rejection named "Canceled" and fails the running test, even though nothing went wrong
// in the application. Only this specific cancellation is ignored, every other error still fails.
Cypress.on('uncaught:exception', (err) => {
  if (err.name === 'Canceled' && err.message === 'Canceled') {
    return false;
  }
  return undefined;
});

beforeEach(() => {
  if (Cypress.env('MOCK')) {
    // fallback: return 404 for all api requests
    cy.intercept({ pathname: '/api/**' }, { statusCode: 404 });

    cy.interceptApi(
      'GET /api/:apiVersion/user',
      { path: { apiVersion: NOTEBOOKS_API_VERSION } },
      mockUserSettings({}),
    );
  }
});
