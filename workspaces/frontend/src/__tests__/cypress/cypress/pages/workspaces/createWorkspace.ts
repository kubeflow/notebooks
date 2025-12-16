class CreateWorkspace {
  readonly CREATE_WORKSPACE_ROUTE = '/workspaces/create';

  visit() {
    cy.visit(this.CREATE_WORKSPACE_ROUTE);
    this.wait();
  }

  verifyPageURL() {
    return cy.verifyRelativeURL(this.CREATE_WORKSPACE_ROUTE);
  }

  private wait() {
    this.findProgressStepper().should('exist');
    cy.testA11y();
  }

  findProgressStepper() {
    return cy.get('.pf-v6-c-progress-stepper');
  }

  findProgressStep(stepName: string) {
    return this.findProgressStepper().contains(stepName);
  }

  assertProgressStepVisible(stepName: string) {
    this.findProgressStep(stepName).should('be.visible');
  }

  findKindCard(kindName: string) {
    return cy.get(`#${kindName.replace(/ /g, '-')}`);
  }

  selectKind(kindName: string) {
    return this.findKindCard(kindName).click();
  }

  assertKindSelected(kindName: string) {
    return this.findKindCard(kindName).should('have.class', 'pf-m-selected');
  }

  findImageCard(imageId: string) {
    return cy.get(`#${imageId.replace(/ /g, '-')}`);
  }

  selectImage(imageId: string) {
    return this.findImageCard(imageId).click();
  }

  assertImageSelected(imageId: string) {
    return this.findImageCard(imageId).should('have.class', 'pf-m-selected');
  }

  findPodConfigCard(podConfigId: string) {
    return cy.get(`#${podConfigId.replace(/ /g, '-')}`);
  }

  selectPodConfig(podConfigId: string) {
    return this.findPodConfigCard(podConfigId).click();
  }

  assertPodConfigSelected(podConfigId: string) {
    return this.findPodConfigCard(podConfigId).should('have.class', 'pf-m-selected');
  }

  findWorkspaceNameInput() {
    return cy.findByTestId('workspace-name');
  }

  typeWorkspaceName(name: string) {
    return this.findWorkspaceNameInput().clear().type(name);
  }

  findNextButton() {
    return cy.findByTestId('next-button');
  }

  findPreviousButton() {
    return cy.findByTestId('previous-button');
  }

  findCreateButton() {
    return cy.findByTestId('submit-button');
  }

  assertCreateButtonExists() {
    this.findCreateButton().should('exist');
  }

  findCancelButton() {
    return cy.findByTestId('cancel-button');
  }

  clickNext() {
    return this.findNextButton().click();
  }

  clickPrevious() {
    return this.findPreviousButton().click();
  }

  clickCreate() {
    return this.findCreateButton().click();
  }

  clickCancel() {
    return this.findCancelButton().click();
  }

  assertNextButtonEnabled() {
    return this.findNextButton().should('not.be.disabled');
  }

  assertNextButtonDisabled() {
    return this.findNextButton().should('be.disabled');
  }

  assertPreviousButtonEnabled() {
    return this.findPreviousButton().should('not.be.disabled');
  }

  assertPreviousButtonDisabled() {
    return this.findPreviousButton().should('be.disabled');
  }

  assertCreateButtonEnabled() {
    return this.findCreateButton().should('not.be.disabled');
  }

  assertCreateButtonDisabled() {
    return this.findCreateButton().should('be.disabled');
  }

  assertNoResultsFound() {
    cy.contains('No results found').should('be.visible');
  }

  findErrorAlert() {
    return cy.findByTestId('workspace-form-error');
  }

  assertErrorAlertContainsMessage(message: string) {
    cy.findByTestId('workspace-form-error-message').should('have.text', `Error: ${message}`);
  }
}

export const createWorkspace = new CreateWorkspace();
