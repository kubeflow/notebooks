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

  assertVolumesCount(count: number): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.findByTestId('volumes-count').should('have.text', `${count} added`);
  }

  assertSecretsCount(count: number): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.findByTestId('secrets-count').should('have.text', `${count} added`);
  }

  findSecretsExpandableToggle(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.contains('button', 'Secrets') as unknown as Cypress.Chainable<JQuery<HTMLElement>>;
  }

  expandSecretsSection(): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.findSecretsExpandableToggle().click();
  }

  findCreateNewSecretButton(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.contains('button', 'Create New Secret') as unknown as Cypress.Chainable<
      JQuery<HTMLElement>
    >;
  }

  clickCreateNewSecret(): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.findCreateNewSecretButton().click();
  }
}

class SecretsCreateModal {
  find() {
    // eslint-disable-next-line @cspell/spellchecker
    return cy.get('[aria-labelledby="create-secret-modal-title"]');
  }

  assertModalExists() {
    return this.find().should('exist');
  }

  assertModalNotExists() {
    return this.find().should('not.exist');
  }

  findSecretNameInput() {
    return cy.findByTestId('secret-name-input');
  }

  typeSecretName(name: string) {
    return this.findSecretNameInput().clear().type(name);
  }

  assertSecretNameValue(value: string) {
    return this.findSecretNameInput().should('have.value', value);
  }

  findSecretTypeSelect() {
    return cy.findByTestId('secret-type-select');
  }

  assertSecretTypeDisabled() {
    return this.findSecretTypeSelect().should('be.disabled');
  }

  assertSecretTypeValue(value: string) {
    return this.findSecretTypeSelect().should('contain.text', value);
  }

  findKeyInput(index = 0) {
    return cy.findAllByTestId('key-input').eq(index);
  }

  typeKey(index: number, key: string) {
    return this.findKeyInput(index).clear().type(key);
  }

  assertKeyValue(index: number, value: string) {
    return this.findKeyInput(index).should('have.value', value);
  }

  findValueInput(index = 0) {
    return cy.findAllByTestId('value-input').eq(index);
  }

  typeValue(index: number, value: string) {
    return this.findValueInput(index).clear().type(value);
  }

  assertValueValue(index: number, value: string) {
    return this.findValueInput(index).should('have.value', value);
  }

  findRemoveKeyValuePairButton(index = 0) {
    return cy.findAllByTestId('remove-key-value-pair').eq(index);
  }

  clickRemoveKeyValuePair(index: number) {
    return this.findRemoveKeyValuePairButton(index).click();
  }

  assertRemoveButtonDisabled(index: number) {
    return this.findRemoveKeyValuePairButton(index).should('be.disabled');
  }

  assertRemoveButtonEnabled(index: number) {
    return this.findRemoveKeyValuePairButton(index).should('not.be.disabled');
  }

  findAddKeyValuePairButton() {
    return cy.findByTestId('another-key-value-pair-button');
  }

  clickAddKeyValuePair() {
    return this.findAddKeyValuePairButton().click();
  }

  findCreateButton() {
    // Find the button element that contains 'Create' text in the modal footer
    return this.find()
      .find('footer button, .pf-v6-c-modal-box__footer button')
      .filter(':contains("Create")')
      .first();
  }

  clickCreate() {
    return this.findCreateButton().click();
  }

  assertCreateButtonEnabled() {
    return this.findCreateButton().should('not.be.disabled');
  }

  assertCreateButtonDisabled() {
    return this.findCreateButton().should('be.disabled');
  }

  findCancelButton() {
    // Find the button element that contains 'Cancel' text in the modal footer
    return this.find()
      .find('footer button, .pf-v6-c-modal-box__footer button')
      .filter(':contains("Cancel")')
      .first();
  }

  clickCancel() {
    return this.findCancelButton().click();
  }

  findErrorAlert() {
    // PatternFly Alert component - look for the alert class or role
    return this.find().find('.pf-v6-c-alert, [role="alert"]');
  }

  assertErrorAlertExists() {
    return this.findErrorAlert().should('exist');
  }

  assertErrorAlertContainsMessage(message: string) {
    return this.findErrorAlert().should('contain.text', message);
  }

  assertErrorAlertNotExists() {
    return this.findErrorAlert().should('not.exist');
  }

  findHelperText() {
    // Find the HelperText component that contains the secret name helper text
    return this.find().contains('Must start and end with a letter or number');
  }

  assertHelperTextVisible() {
    return this.findHelperText().should('be.visible');
  }

  assertKeyValuePairCount(count: number) {
    return cy.findAllByTestId('key-value-pair').should('have.length', count);
  }
}

export { WorkspaceForm };
export const secretsCreateModal = new SecretsCreateModal();
