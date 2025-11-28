/* eslint-disable @typescript-eslint/no-namespace */
declare global {
  namespace Cypress {
    interface Chainable {
      verifyRelativeURL: (relativeURL: string) => Cypress.Chainable<string>;
    }
  }
}

Cypress.Commands.add('verifyRelativeURL', (relativeURL: string) => {
  const rel = relativeURL.startsWith('/') ? relativeURL : `/${relativeURL}`;

  return cy.location().then((loc) => {
    const expected = `${loc.protocol}//${loc.host}${rel}`;
    return cy
      .url()
      .should('eq', expected)
      .then(() => expected);
  });
});

export {};
