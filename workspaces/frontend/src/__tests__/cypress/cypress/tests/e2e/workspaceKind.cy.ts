import {
  mockWorkspaceKindsInValid,
  mockWorkspaceKindsValid,
} from '~/__tests__/cypress/cypress/tests/mocked/workspaceKinds.mock';

describe('Test buildKindLogoDictionary Functionality', () => {
  // Mock valid workspace kinds
  context('With Valid Data', () => {
    before(() => {
      // Mock the API response
      cy.intercept('GET', '/api/v1/workspacekinds', {
        statusCode: 200,
        body: mockWorkspaceKindsValid,
      });

      // Visit the page
      cy.visit('/');
    });

    it('should fetch and populate kind logos', () => {
      // Check that the logos are rendered in the table
      cy.get('tbody tr').each(($row) => {
        cy.wrap($row)
          .find('td[data-label="Kind"]')
          .within(() => {
            cy.get('img')
              .should('exist')
              .then(($img) => {
                // Ensure the image is fully loaded
                cy.wrap($img[0]).should('have.prop', 'complete', true);
              });
          });
      });
    });
  });

  // Mock invalid workspace kinds
  context('With Invalid Data', () => {
    before(() => {
      // Mock the API response for invalid workspace kinds
      cy.intercept('GET', '/api/v1/workspacekinds', {
        statusCode: 200,
        body: mockWorkspaceKindsInValid,
      });

      // Visit the page
      cy.visit('/');
    });

    it('should fallback when logo URL is invalid', () => {
      cy.get('tbody tr').each(($row) => {
        cy.wrap($row)
          .find('td[data-label="Kind"]')
          .within(() => {
            cy.get('img')
              .should('exist')
              .then(($img) => {
                // If the image src is invalid, it should not load
                expect($img[0].naturalWidth).to.equal(0); // If the image is invalid, naturalWidth should be 0
              });
          });
      });
    });
  });
});
