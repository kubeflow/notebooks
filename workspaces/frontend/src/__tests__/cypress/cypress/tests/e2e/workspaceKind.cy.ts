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

    it('should show a fallback icon when the logo URL is missing', () => {
      cy.get('tbody tr').each(($row) => {
        cy.wrap($row)
          .find('td[data-label="Kind"]')
          .within(() => {
            // Ensure that the image is NOT rendered (because it's invalid or missing)
            cy.get('img').should('not.exist'); // No images should be displayed

            // Check if the fallback icon (TimesCircleIcon) is displayed
            cy.get('svg').should('exist'); // Look for the SVG (TimesCircleIcon)
            cy.get('svg').should('have.class', 'pf-v6-svg'); // Ensure the correct fallback icon class is applied (update the class name based on your icon library)
          });
      });
    });
  });
});
