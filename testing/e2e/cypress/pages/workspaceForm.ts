/** The Workspace create/edit wizard (`/workspaces/create`). Reached via `workspacesPage.clickCreate()`. */
class WorkspaceFormPage {
  findNextButton(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.findByTestId('next-button');
  }

  findSubmitButton(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.findByTestId('submit-button');
  }

  findErrorAlert(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.findByTestId('workspace-form-error');
  }

  clickNext(): void {
    this.findNextButton().should('not.be.disabled').click();
  }

  clickCreate(): void {
    this.findSubmitButton().should('not.be.disabled').click();
  }

  // Step 1: WorkspaceKind

  findKindCard(kindName: string): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.findByTestId(`kind-card-${kindName}`);
  }

  selectKind(kindName: string): void {
    this.findKindCard(kindName).click();
  }

  // Steps 2-3: image and pod config, chosen by option id (e.g. `environment.baseline.imageConfig`)

  findOptionCard(optionId: string): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.findByTestId(`option-card-header-${optionId.replace(/ /g, '-')}`);
  }

  selectImage(imageConfigId: string): void {
    this.findOptionCard(imageConfigId).click();
  }

  selectPodConfig(podConfigId: string): void {
    this.findOptionCard(podConfigId).click();
  }

  // Step 4: properties

  findDisplayNameInput(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.findByTestId('workspace-display-name');
  }

  typeDisplayName(displayName: string): void {
    this.findDisplayNameInput().clear();
    this.findDisplayNameInput().type(displayName);
  }

  /**
   * Sets the Workspace's Kubernetes name. Without this the UI generates one from
   * the display name plus a random suffix, which a test can't look up afterwards.
   */
  setResourceName(name: string): void {
    cy.findByTestId('workspace-resource-name-edit').click();
    this.findResourceNameInput().clear();
    this.findResourceNameInput().type(name);
  }

  findResourceNameInput(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.findByTestId('workspace-resource-name-input');
  }

  attachHomeVolume(pvcName: string): void {
    cy.findByTestId('attach-existing-volume-button').click();
    cy.findByTestId('volumes-attach-modal').within(() => {
      cy.findByTestId('pvc-select-toggle').click();
    });
    // Options also render the PVC's label chips, so the accessible name is "<pvc> <labels...>".
    cy.findByRole('option', {
      name: (accessibleName) => accessibleName.split(' ')[0] === pvcName,
    }).click();
    cy.findByTestId('attach-pvc-button').click();
  }
}

export const workspaceFormPage = new WorkspaceFormPage();
