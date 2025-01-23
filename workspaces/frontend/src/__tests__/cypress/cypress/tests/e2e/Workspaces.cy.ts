import { mockNamespaces } from '~/__mocks__/mockNamespaces';
import { mockBFFResponse } from '~/__mocks__/utils';

describe('Workspaces Component', () => {
  beforeEach(() => {
    // Mock the namespaces API response
    cy.intercept('GET', '/api/v1/namespaces', {
      body: mockBFFResponse(mockNamespaces),
    }).as('getNamespaces');
    cy.visit('/');
    cy.wait('@getNamespaces');
  });

  function openDeleteModal() {
    cy.findAllByTestId('table-body').first().findByTestId('action-column').click();
    cy.findByTestId('action-delete').click();
    cy.findByTestId('delete-modal-input').should('have.value', '');
  }

  it('should test the close mechanisms of the delete modal', () => {
    const closeModalActions = [
      () => cy.get('button').contains('Cancel').click(),
      () => cy.get('[aria-label="Close"]').click(),
    ];

    closeModalActions.forEach((closeAction) => {
      openDeleteModal();
      cy.findByTestId('delete-modal-input').type('Some Text');
      cy.findByTestId('delete-modal').should('be.visible');
      closeAction();
      cy.findByTestId('delete-modal').should('not.exist');
    });

    // Check that clicking outside the modal does not close it
    openDeleteModal();
    cy.findByTestId('delete-modal').should('be.visible');
    cy.get('body').click(0, 0);
    cy.findByTestId('delete-modal').should('be.visible');
  });

  it('should verify the delete modal verification mechanism', () => {
    openDeleteModal();
    cy.findByTestId('delete-modal').within(() => {
      cy.get('strong')
        .first()
        .invoke('text')
        .then((resourceName) => {
          // Type incorrect resource name
          cy.findByTestId('delete-modal-input').type('Wrong Name');
          cy.findByTestId('delete-modal-input').should('have.value', 'Wrong Name');
          cy.findByTestId('delete-modal-helper-text').should('be.visible');
          cy.get('button').contains('Delete').should('have.css', 'pointer-events', 'none');

          // Clear and type correct resource name
          cy.findByTestId('delete-modal-input').clear();
          cy.findByTestId('delete-modal-input').type(resourceName);
          cy.findByTestId('delete-modal-input').should('have.value', resourceName);
          cy.findByTestId('delete-modal-helper-text').should('not.be.exist');
          cy.get('button').contains('Delete').should('not.have.css', 'pointer-events', 'none');
          cy.get('button').contains('Delete').click();
          cy.findByTestId('delete-modal').should('not.exist');
        });
    });
  });
});
