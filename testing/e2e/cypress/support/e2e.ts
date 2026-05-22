import '@testing-library/cypress/add-commands';
import './commands/k8s';

before(() => {
  cy.task('setupE2e', null, { timeout: 120_000 });
});
