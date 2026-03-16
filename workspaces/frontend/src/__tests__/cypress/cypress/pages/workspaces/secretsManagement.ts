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
    return cy.findByTestId('attach-secrets-button');
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

  toggleImmutable() {
    this.findImmutableSwitch().click({ force: true });
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

export const secretsManagement = new SecretsManagementPage();
export const secretsModal = new SecretsModal();
