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
    return cy.findByTestId('create-secret-button');
  }

  // Secrets View Popover
  clickViewSecret(secretName: string) {
    this.findSecretRow(secretName).find('button').first().click();
  }

  findSecretPopover() {
    // PatternFly v6 Popover uses pf-v6-c-popover class
    return cy.get('.pf-v6-c-popover');
  }

  assertPopoverOpen() {
    this.findSecretPopover().should('be.visible');
  }

  assertPopoverTitle(secretName: string) {
    this.findSecretPopover().should('contain', secretName);
  }

  assertPopoverContainsKeys(keys: string[]) {
    keys.forEach((key) => {
      this.findSecretPopover().should('contain', `${key}: *********`);
    });
  }

  assertSecretValuesMasked() {
    this.findSecretPopover().should('contain', '*********');
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
    return cy.findAllByTestId('key-input');
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
