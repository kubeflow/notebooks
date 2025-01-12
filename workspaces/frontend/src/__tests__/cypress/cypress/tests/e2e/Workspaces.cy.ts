import { WorkspaceState } from '~/shared/types';
import { home } from '~/__tests__/cypress/cypress/pages/home';
import {
  mockWorkspaces,
  mockWorkspacesByNS,
} from '~/__tests__/cypress/cypress/tests/mocked/workspace.mock';
import { mockNamespaces } from '~/__mocks__/mockNamespaces';
import { mockBFFResponse } from '~/__mocks__/utils';

// Helper function to validate the content of a single workspace row in the table
const validateWorkspaceRow = (workspace: any, index: number) => {
  // Validate the workspace name
  cy.getDataTest(`workspace-row-${index}`)
    .find('[data-test="workspace-name"]')
    .should('have.text', workspace.name);

  // Map workspace state to the expected label
  const expectedLabel = WorkspaceState[workspace.status.state];

  // Validate the state label and pod configuration
  cy.getDataTest(`workspace-row-${index}`)
    .find('[data-test="state-label"]')
    .should('have.text', expectedLabel);

  cy.getDataTest(`workspace-row-${index}`)
    .find('[data-test="pod-config"]')
    .should('have.text', workspace.options.podConfig);
};

// Test suite for workspace-related tests
describe('Workspaces Tests', () => {
  beforeEach(() => {
    home.visit();
    cy.intercept('GET', '/api/v1/workspaces', {
      body: mockBFFResponse(mockWorkspaces),
    }).as('getWorkspaces');
    cy.wait('@getWorkspaces');
  });

  it('should display the correct number of workspaces', () => {
    cy.getDataTest('workspaces-table')
      .find('tbody tr')
      .should('have.length', mockWorkspaces.length);
  });

  it('should validate all workspace rows', () => {
    mockWorkspaces.forEach((workspace, index) => {
      cy.log(`Validating workspace ${index + 1}: ${workspace.name}`);
      validateWorkspaceRow(workspace, index);
    });
  });

  it('should handle empty workspaces gracefully', () => {
    cy.intercept('GET', '/api/v1/workspaces', { statusCode: 200, body: { data: [] } });
    cy.visit('/');

    cy.getDataTest('workspaces-table').find('tbody tr').should('not.exist');
  });
});

// Test suite for workspace functionality by namespace
describe('Workspace by namespace functionality', () => {
  beforeEach(() => {
    home.visit();

    cy.intercept('GET', '/api/v1/namespaces', {
      body: mockBFFResponse(mockNamespaces),
    }).as('getNamespaces');

    cy.intercept('GET', 'api/v1/workspaces', { body: mockBFFResponse(mockWorkspaces) }).as(
      'getWorkspaces',
    );

    cy.intercept('GET', '/api/v1/workspaces/kubeflow', {
      body: mockBFFResponse(mockWorkspacesByNS),
    }).as('getKubeflowWorkspaces');

    cy.wait('@getNamespaces');
  });

  it('should update workspaces when namespace changes', () => {
    // Verify initial state (default namespace)
    cy.wait('@getWorkspaces');
    cy.getDataTest('workspaces-table')
      .find('tbody tr')
      .should('have.length', mockWorkspaces.length);

    // Change namespace to "kubeflow"
    cy.findByTestId('namespace-toggle').click();
    cy.findByTestId('dropdown-item-kubeflow').click();

    // Verify the API call is made with the new namespace
    cy.wait('@getKubeflowWorkspaces')
      .its('request.url')
      .should('include', '/api/v1/workspaces/kubeflow');

    // Verify the length of workspaces list is updated
    cy.getDataTest('workspaces-table')
      .find('tbody tr')
      .should('have.length', mockWorkspacesByNS.length);
  });
});
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
