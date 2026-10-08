// Shared by the create (workspaceForm.ts) and edit (secretsManagement.ts) secret modal page objects,
// so both follow the footer structure if it changes
export const assertSecretModalErrorInFooter = (
  errorAlert: Cypress.Chainable<JQuery<HTMLElement>>,
): Cypress.Chainable<JQuery<HTMLElement>> =>
  errorAlert.closest('footer').within(() => {
    cy.findByTestId('secret-modal-submit-button').should('exist');
  });
