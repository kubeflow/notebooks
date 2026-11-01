import { assertSecretModalErrorInFooter } from '~/__tests__/cypress/cypress/pages/components/secretModalFooter';

// Page object model for Secrets Management

class SecretsManagementPage {
  // Table
  findSecretsTable() {
    return cy.findByTestId('secrets-table');
  }

  findSecretRow(secretName: string) {
    return this.findSecretsTable().contains('tr', secretName);
  }

  // Expandable Section
  findSecretsSection() {
    return cy.findByTestId('secrets-expandable-section');
  }

  expandSecretsSection() {
    return this.findSecretsSection().find('button').first().click();
  }

  // Actions
  clickKebabMenu(secretName: string) {
    return cy.findByTestId(`secret-kebab-${secretName}`).click();
  }

  findEditAction(secretName: string) {
    return cy.findByTestId(`edit-secret-${secretName}`);
  }

  clickEditAction(secretName: string) {
    return this.findEditAction(secretName).click();
  }

  clickRemoveAction(secretName: string) {
    return cy.findByTestId(`remove-secret-${secretName}`).click();
  }

  openEditModal(secretName: string) {
    this.clickKebabMenu(secretName);
    this.clickEditAction(secretName);
  }

  // Buttons
  findAttachSecretsButton() {
    return cy.findByTestId('attach-existing-secrets-button');
  }

  clickAttachExistingSecrets() {
    return this.findAttachSecretsButton().click();
  }

  findCreateSecretButton() {
    return cy.findByTestId('attach-new-secret-button');
  }

  // Expandable rows for key/value pairs
  expandSecretRow(secretName: string) {
    return cy.findByTestId(`expand-secret-${secretName}`).click();
  }

  assertExpandedRowContainsKeys(secretName: string, keys: string[]) {
    this.findSecretRow(secretName)
      .parent('tbody')
      .within(() => {
        keys.forEach((key) => {
          cy.contains('td', key).should('exist');
        });
      });
  }

  assertExpandedRowValuesMasked(secretName: string) {
    this.findSecretRow(secretName)
      .parent('tbody')
      .within(() => {
        cy.contains('td', '*********').should('exist');
      });
  }

  // Empty state
  findEmptyState() {
    return cy.findByTestId('secrets-empty-state');
  }

  assertEmptyStateVisible() {
    this.findEmptyState().should('be.visible');
  }
}

class SecretsModal {
  find() {
    return cy.findByTestId('secrets-modal');
  }

  findSecretNameInput() {
    return cy.findByTestId('secret-name-input');
  }

  findImmutableSwitch() {
    return cy.findByTestId('secret-immutable-switch');
  }

  enableImmutable() {
    return this.findImmutableSwitch()
      .should('be.enabled')
      .check({ force: true })
      .should('be.checked');
  }

  findSubmitButton() {
    return cy.findByTestId('secret-modal-submit-button');
  }

  findCanMountLabel() {
    return cy.findByTestId('can-mount-label');
  }

  findCanUpdateLabel() {
    return cy.findByTestId('can-update-label');
  }

  findKeyInput() {
    return this.find().findAllByTestId('key-input');
  }

  typeKey(index: number, key: string) {
    return this.findKeyInput().eq(index).clear().type(key);
  }

  findRow(index: number) {
    return this.find().findAllByTestId('key-value-pair').eq(index);
  }

  replaceValue({ index, value }: { index: number; value: string }) {
    this.findRow(index).findByTestId('replace-secret-value').click();
    return this.typeValue({ index, value });
  }

  typeValue({ index, value }: { index: number; value: string }) {
    return this.findRow(index)
      .findByTestId('value-input')
      .clear({ log: false })
      .type(value, { log: false, parseSpecialCharSequences: false });
  }

  keepValue(index: number) {
    return this.findRow(index).findByTestId('keep-secret-value').click();
  }

  resizeViewport(width: number) {
    return cy.viewport(width, 1080);
  }

  assertReplacementControlsAligned(index: number) {
    this.findRow(index)
      .findByTestId('key-input')
      .then(($key) => {
        const key = $key[0].getBoundingClientRect();
        const keyCenter = key.top + key.height / 2;
        ['value-input', 'keep-secret-value', 'remove-key-value-pair'].forEach((testId) => {
          this.findRow(index)
            .findByTestId(testId)
            .should(($control) => {
              const control = $control[0].getBoundingClientRect();
              expect(
                control.top + control.height / 2,
                `${testId} vertical alignment`,
              ).to.be.closeTo(keyCenter, 1);
            });
        });
      });
    this.findRow(index).findByTestId('value-input').should('have.attr', 'type', 'password');
    this.findRow(index)
      .findByTestId('keep-secret-value')
      .should('have.attr', 'aria-label')
      .and('match', /^Keep existing value for /);
  }

  deleteKey(index: number) {
    return this.findRow(index).findByTestId('remove-key-value-pair').click();
  }

  save() {
    return this.findSubmitButton().click();
  }

  cancel() {
    return this.find().findByTestId('secret-modal-cancel-button').click();
  }

  assertUndisclosed(count: number) {
    this.find().findAllByTestId('undisclosed-value').should('have.length', count);
    this.find().findAllByTestId('value-input').should('not.exist');
  }

  assertType(type: string) {
    return this.find().findByTestId('secret-type-select').should('contain.text', type);
  }

  assertNotEditable() {
    this.findSubmitButton().should('be.disabled');
    this.findImmutableSwitch().should('be.disabled');
    this.find().findAllByTestId('replace-secret-value').should('be.disabled');
    this.find().findAllByTestId('remove-key-value-pair').should('be.disabled');
    this.find().findByTestId('another-key-value-pair-button').should('be.disabled');
  }

  assertClosed() {
    return this.find().should('not.exist');
  }

  capture(name: string) {
    return this.find().screenshot(name);
  }

  findErrorAlert() {
    return this.find().findByTestId('error-alert');
  }

  assertErrorAlertInFooter() {
    return assertSecretModalErrorInFooter(this.findErrorAlert());
  }

  assertModalVisible() {
    this.find().should('be.visible');
  }

  assertEditMode() {
    this.find().contains('Edit Secret').should('be.visible');
  }

  assertCreateMode() {
    this.find().contains('Create Secret').should('be.visible');
  }
}

class SecretsAttachModal {
  find() {
    return cy.findByTestId('secrets-attach-modal');
  }

  assertSecretOptionAvailable(secretName: string): Cypress.Chainable<JQuery<HTMLElement>> {
    this.find().findByPlaceholderText('Select a secret').click();
    return cy
      .contains('.pf-v6-c-menu__list-item', secretName)
      .should('be.visible')
      .and('not.have.class', 'pf-m-disabled');
  }

  assertModalVisible(): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.find().should('be.visible');
  }

  assertModalNotExists(): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.find().should('not.exist');
  }
}

class SecretsDetachModal {
  find(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.findByTestId('detach-secret-modal');
  }

  assertModalVisible(): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.find().should('be.visible');
  }

  assertModalNotExists(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.findByTestId('detach-secret-modal').should('not.exist');
  }

  assertContains(text: string): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.find().should('contain', text);
  }

  findConfirmButton(): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.find().findByTestId('confirm-button');
  }

  clickConfirm(): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.findConfirmButton().click();
  }

  findCancelButton(): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.find().findByTestId('cancel-button');
  }

  clickCancel(): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.findCancelButton().click();
  }
}

export const secretsManagement = new SecretsManagementPage();
export const secretsAttachModal = new SecretsAttachModal();
export const secretsModal = new SecretsModal();
export const secretsDetachModal = new SecretsDetachModal();
