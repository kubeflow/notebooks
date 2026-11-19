class CreateWorkspacePage {
  findNextButton(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.findByTestId('next-button');
  }

  findSubmitButton(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.findByTestId('submit-button');
  }

  clickNext(): void {
    this.findNextButton().should('not.be.disabled').click();
  }

  clickCreate(): void {
    this.findSubmitButton().should('not.be.disabled').click();
  }

  // Step 1: Kind selection
  selectKind(kindName: string): void {
    cy.findByTestId(`kind-card-${kindName}`).click();
  }

  // Step 2: Image selection — selects the first visible card
  selectFirstImage(): void {
    cy.get('[class*="pf-v6-c-card"][id]').first().click();
  }

  // Step 3: Pod config selection — selects the first visible card
  selectFirstPodConfig(): void {
    cy.get('[class*="pf-v6-c-card"][id]').first().click();
  }

  // Step 4: Properties
  typeName(name: string): void {
    cy.findByTestId('workspace-display-name').clear().type(name);
  }

  // The resource name (the actual k8s object name) is auto-generated from the display name
  // plus a random suffix unless explicitly edited here, so tests that need a deterministic,
  // known resource name (e.g. to look up the CR afterwards) must set it explicitly.
  setResourceName(name: string): void {
    cy.findByTestId('workspace-resource-name-edit').click();
    cy.findByTestId('workspace-resource-name-input').clear().type(name);
  }

  attachHomeVolume(pvcName: string): void {
    cy.findByTestId('attach-existing-volume-button').click();
    // Select PVC in the attach modal
    cy.get('[aria-labelledby="volumes-attach-modal-title"]').within(() => {
      cy.get('.pf-v6-c-menu-toggle').click();
    });
    cy.get('.pf-v6-c-menu__list-item').contains(pvcName).click();
    cy.findByTestId('attach-pvc-button').click();
  }

  findErrorAlert(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.findByTestId('workspace-form-error');
  }
}

export const createWorkspacePage = new CreateWorkspacePage();
