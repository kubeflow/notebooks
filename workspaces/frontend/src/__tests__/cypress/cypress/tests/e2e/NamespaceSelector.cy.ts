const namespaces = ['default', 'kubeflow', 'custom-namespace'];
const mockNamespaces = {
  data: [{ name: 'default' }, { name: 'kubeflow' }, { name: 'custom-namespace' }],
};

describe('Namespace Selector Dropdown', () => {
  beforeEach(() => {
    // Mock the namespaces and selected namespace
    cy.intercept('GET', '/api/v1/namespaces', {
      body: mockNamespaces,
    });
    cy.visit('/');
  });

  it('should open the namespace dropdown and select a namespace', () => {
    cy.get('[data-testid="namespace-toggle"]').click();
    cy.get('[data-testid="namespace-dropdown"]').should('be.visible');
    namespaces.forEach((ns) => {
      cy.get(`[data-testid="dropdown-item-${ns}"]`).should('exist').and('contain', ns);
    });

    cy.get('[data-testid="dropdown-item-kubeflow"]').click();

    // Assert the selected namespace is updated
    cy.get('[data-testid="namespace-toggle"]').should('contain', 'kubeflow');
  });

  it('should display the default namespace initially', () => {
    cy.get('[data-testid="namespace-toggle"]').should('contain', 'default');
  });

  it('should navigate to notebook settings and retain the namespace', () => {
    cy.get('[data-testid="namespace-toggle"]').click();
    cy.get('[data-testid="dropdown-item-custom-namespace"]').click();
    cy.get('[data-testid="namespace-toggle"]').should('contain', 'custom-namespace');
    // Click on navigation button
    cy.get('#Settings').click();
    cy.get('[data-testid="nav-link-/notebookSettings"]').click();
    cy.get('[data-testid="namespace-toggle"]').should('contain', 'custom-namespace');
  });
});
