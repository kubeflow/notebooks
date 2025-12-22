import { WorkspaceForm } from '~/__tests__/cypress/cypress/pages/workspaces/workspaceForm';

class CreateWorkspace extends WorkspaceForm {
  readonly CREATE_WORKSPACE_ROUTE = '/workspaces/create';

  visit(): void {
    cy.visit(this.CREATE_WORKSPACE_ROUTE);
    this.wait();
  }

  verifyPageURL(): Cypress.Chainable<string> {
    return cy.verifyRelativeURL(this.CREATE_WORKSPACE_ROUTE);
  }

  private wait(): void {
    this.findProgressStepper().should('exist');
    cy.testA11y();
  }

  findCreateButton(): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.findSubmitButton();
  }

  clickCreate(): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.clickSubmit();
  }

  assertCreateButtonExists(): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.assertSubmitButtonExists();
  }

  assertCreateButtonEnabled(): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.assertSubmitButtonEnabled();
  }

  assertCreateButtonDisabled(): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.assertSubmitButtonDisabled();
  }

  findErrorAlert() {
    return cy.findByTestId('workspace-form-error');
  }

  assertErrorAlertContainsMessage(message: string) {
    cy.findByTestId('workspace-form-error-message').should('have.text', message);
  }

  findKindFilterInput() {
    return cy.findByTestId('kind-filter-name-input');
  }

  typeKindFilter(value: string) {
    return this.findKindFilterInput().clear().type(value);
  }

  clearKindFilter() {
    return this.findKindFilterInput().clear();
  }

  findKindFilterToolbar() {
    return cy.findByTestId('kind-filter-toolbar');
  }

  findImageFilterInput() {
    return cy.findByTestId('image-filter-name-input');
  }

  typeImageFilter(value: string) {
    return this.findImageFilterInput().clear().type(value);
  }

  clearImageFilter() {
    return this.findImageFilterInput().clear();
  }

  findImageFilterToolbar() {
    return cy.findByTestId('image-filter-toolbar');
  }

  findPodConfigFilterInput() {
    return cy.findByTestId('pod-config-filter-name-input');
  }

  typePodConfigFilter(value: string) {
    return this.findPodConfigFilterInput().clear().type(value);
  }

  clearPodConfigFilter() {
    return this.findPodConfigFilterInput().clear();
  }

  findPodConfigFilterToolbar() {
    return cy.findByTestId('pod-config-filter-toolbar');
  }

  assertCardVisible(cardId: string) {
    return cy.get(`#${cardId.replace(/ /g, '-')}`).should('be.visible');
  }

  assertCardNotVisible(cardId: string) {
    return cy.get(`#${cardId.replace(/ /g, '-')}`).should('not.exist');
  }

  findClearAllFiltersButton() {
    return cy.contains('button', 'Clear all filters');
  }

  clickClearAllFilters() {
    return this.findClearAllFiltersButton().click();
  }
}

export const createWorkspace = new CreateWorkspace();
