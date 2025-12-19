/**
 * Base class for workspace form page objects (create and edit).
 * Contains shared methods for interacting with the WorkspaceForm component.
 */
class WorkspaceForm {
  findProgressStepper(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.findByTestId('workspace-form-stepper');
  }

  findProgressStep(stepName: string): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.findProgressStepper().contains(stepName);
  }

  assertProgressStepperVisible(): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.findProgressStepper().should('be.visible');
  }

  assertProgressStepVisible(stepName: string): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.findProgressStep(stepName).should('be.visible');
  }

  findPageTitle(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.findByTestId('workspace-form-title');
  }

  assertPageTitleVisible(): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.findPageTitle().should('be.visible');
  }

  findKindCard(kindName: string): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.get(`#${kindName.replace(/ /g, '-')}`);
  }

  selectKind(kindName: string): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.findKindCard(kindName).click();
  }

  assertKindSelected(kindName: string): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.findKindCard(kindName).should('have.class', 'pf-m-selected');
  }

  findImageCard(imageId: string): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.get(`#${imageId.replace(/ /g, '-')}`);
  }

  selectImage(imageId: string): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.findImageCard(imageId).click();
  }

  assertImageSelected(imageId: string): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.findImageCard(imageId).should('have.class', 'pf-m-selected');
  }

  findPodConfigCard(podConfigId: string): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.get(`#${podConfigId.replace(/ /g, '-')}`);
  }

  selectPodConfig(podConfigId: string): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.findPodConfigCard(podConfigId).click();
  }

  assertPodConfigSelected(podConfigId: string): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.findPodConfigCard(podConfigId).should('have.class', 'pf-m-selected');
  }

  findWorkspaceNameInput(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.findByTestId('workspace-name');
  }

  typeWorkspaceName(name: string): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.findWorkspaceNameInput().clear().type(name);
  }

  assertWorkspaceName(name: string): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.findWorkspaceNameInput().should('have.value', name);
  }

  findNextButton(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.findByTestId('next-button');
  }

  findPreviousButton(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.findByTestId('previous-button');
  }

  findSubmitButton(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.findByTestId('submit-button');
  }

  findCancelButton(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.findByTestId('cancel-button');
  }

  clickNext(): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.findNextButton().click();
  }

  clickPrevious(): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.findPreviousButton().click();
  }

  clickSubmit(): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.findSubmitButton().click();
  }

  clickCancel(): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.findCancelButton().click();
  }

  assertNextButtonEnabled(): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.findNextButton().should('not.be.disabled');
  }

  assertNextButtonDisabled(): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.findNextButton().should('be.disabled');
  }

  assertPreviousButtonEnabled(): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.findPreviousButton().should('not.be.disabled');
  }

  assertPreviousButtonDisabled(): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.findPreviousButton().should('be.disabled');
  }

  assertSubmitButtonEnabled(): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.findSubmitButton().should('not.be.disabled');
  }

  assertSubmitButtonDisabled(): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.findSubmitButton().should('be.disabled');
  }

  assertSubmitButtonExists(): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.findSubmitButton().should('exist');
  }

  assertSubmitButtonText(text: string): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.findSubmitButton().should('have.text', text);
  }

  assertNoResultsFound(): void {
    cy.contains('No results found').should('be.visible');
  }

  findDeferUpdatesCheckbox(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.findByTestId('defer-updates-checkbox');
  }

  assertDeferUpdatesChecked(checked: boolean): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.findDeferUpdatesCheckbox().should(checked ? 'be.checked' : 'not.be.checked');
  }

  assertVolumesCount(count: number): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.findByTestId('volumes-count').should('have.text', `${count} added`);
  }

  assertSecretsCount(count: number): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.findByTestId('secrets-count').should('have.text', `${count} added`);
  }
}

export { WorkspaceForm };
