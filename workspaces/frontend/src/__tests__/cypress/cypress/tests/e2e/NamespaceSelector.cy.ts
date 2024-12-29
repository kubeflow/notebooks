import { mockNamespaces } from '~/__mocks__/mockNamespaces';
import { mockBFFResponse } from '~/__mocks__/utils';

const namespaces = ['default', 'kubeflow', 'custom-namespace'];

describe('Namespace Selector Dropdown', () => {
  beforeEach(() => {
    // Mock the namespaces API response
    cy.intercept('GET', '/api/v1/namespaces', {
      body: mockBFFResponse(mockNamespaces),
    }).as('getNamespaces');
    cy.visit('/');
    cy.wait('@getNamespaces');
  });

  it('should open the namespace dropdown and select a namespace', () => {
    cy.findByTestId('namespace-toggle').click();
    cy.findByTestId('namespace-dropdown').should('be.visible');
    namespaces.forEach((ns) => {
      cy.findByTestId(`dropdown-item-${ns}`).should('exist').and('contain', ns);
    });

    cy.findByTestId('dropdown-item-kubeflow').click();

    // Assert the selected namespace is updated
    cy.findByTestId('namespace-toggle').should('contain', 'kubeflow');
  });

  it('should display the default namespace initially', () => {
    cy.findByTestId('namespace-toggle').should('contain', 'default');
  });

  it('should navigate to notebook settings and retain the namespace', () => {
    cy.findByTestId('namespace-toggle').click();
    cy.findByTestId('dropdown-item-custom-namespace').click();
    cy.findByTestId('namespace-toggle').should('contain', 'custom-namespace');
    // Click on navigation button
    cy.get('#Settings').click();
    cy.findByTestId('nav-link-/notebookSettings').click();
    cy.findByTestId('namespace-toggle').should('contain', 'custom-namespace');
  });

  it('should filter namespaces based on search input', () => {
    cy.findByTestId('namespace-toggle').click();
    cy.findByTestId('namespace-search-input').type('custom');
    cy.findByTestId('namespace-search-input').find('input').should('have.value', 'custom');
    cy.findByTestId('namespace-search-button').click();
    // Verify that only the matching namespace is displayed
    namespaces.forEach((ns) => {
      if (ns === 'custom-namespace') {
        cy.findByTestId(`dropdown-item-${ns}`).should('exist').and('contain', ns);
      } else {
        cy.findByTestId(`dropdown-item-${ns}`).should('not.exist');
      }
    });
  });
});
