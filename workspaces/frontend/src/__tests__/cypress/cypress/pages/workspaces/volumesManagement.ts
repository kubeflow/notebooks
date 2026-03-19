/**
 * Page object model for Volumes Management section in workspace form.
 */

class VolumesManagementPage {
  // Expandable Section
  findVolumesSection(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.contains('button', 'Data Volumes') as unknown as Cypress.Chainable<
      JQuery<HTMLElement>
    >;
  }

  expandVolumesSection(): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.findVolumesSection().click();
  }

  // Empty State
  findEmptyState(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.findAllByTestId('volumes-empty-state').filter(':visible').last();
  }

  assertEmptyStateVisible(): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.findEmptyState().should('be.visible');
  }

  // Table
  findVolumesTable(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.findAllByTestId('volumes-table').filter(':visible').last();
  }

  findVolumeRow(pvcName: string): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.findVolumesTable().contains('tr', pvcName) as unknown as Cypress.Chainable<
      JQuery<HTMLElement>
    >;
  }

  assertVolumeRowExists(pvcName: string): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.findVolumeRow(pvcName).should('exist');
  }

  assertVolumeRowNotExists(pvcName: string): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.findVolumesTable().should('not.contain', pvcName);
  }

  assertVolumeMountPath(
    pvcName: string,
    mountPath: string,
  ): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.findVolumeRow(pvcName)
      .find('[data-label="Mount Path"]')
      .should('have.text', mountPath);
  }

  assertVolumeReadOnly(pvcName: string, enabled: boolean): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.findVolumeRow(pvcName).should('contain', enabled ? 'Enabled' : 'Disabled');
  }

  assertVolumeCount(count: number): Cypress.Chainable<JQuery<HTMLElement>> {
    if (count === 0) {
      return this.findVolumesTable().should('not.exist');
    }
    return this.findVolumesTable().find('tbody tr').should('have.length', count);
  }

  // Buttons
  findAttachExistingPVCButton(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.findAllByTestId('attach-existing-volume-button').filter(':visible').last();
  }

  clickAttachExistingPVC(): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.findAttachExistingPVCButton().click();
  }

  findCreateVolumeButton(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.findAllByTestId('attach-new-volume-button').filter(':visible').last();
  }

  clickCreateVolume(): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.findCreateVolumeButton().click();
  }

  // Row Actions
  openRowKebabMenu(pvcName: string): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.findVolumeRow(pvcName).find('[aria-label="plain kebab"]').click();
  }

  clickDetachAction(pvcName: string): Cypress.Chainable<JQuery<HTMLElement>> {
    this.openRowKebabMenu(pvcName);
    return cy.contains('Detach').click() as unknown as Cypress.Chainable<JQuery<HTMLElement>>;
  }

  clickEditAction(pvcName: string): Cypress.Chainable<JQuery<HTMLElement>> {
    this.openRowKebabMenu(pvcName);
    return cy.findByTestId(`edit-volume-${pvcName}`).click();
  }
}

class VolumesAttachModal {
  find(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.get('[aria-labelledby="volumes-attach-modal-title"]');
  }

  assertModalVisible(): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.find().should('be.visible');
  }

  assertModalNotExists(): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.find().should('not.exist');
  }

  // PVC Selection
  findPVCSelect(): Cypress.Chainable<JQuery<HTMLElement>> {
    // TypeaheadSelect renders as a menu toggle within the modal
    return this.find().find('.pf-v6-c-menu-toggle');
  }

  openPVCDropdown(): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.findPVCSelect().click();
  }

  selectPVC(pvcName: string): Cypress.Chainable<JQuery<HTMLElement>> {
    this.openPVCDropdown();
    return cy.contains('.pf-v6-c-menu__list-item', pvcName).click() as unknown as Cypress.Chainable<
      JQuery<HTMLElement>
    >;
  }

  assertPVCDisabled(pvcName: string): Cypress.Chainable<JQuery<HTMLElement>> {
    this.openPVCDropdown();
    return cy
      .contains('.pf-v6-c-menu__list-item', pvcName)
      .should('have.class', 'pf-m-disabled') as unknown as Cypress.Chainable<JQuery<HTMLElement>>;
  }

  // Mount Path
  findMountPathInput(): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.find().find('#pvc-mount-path');
  }

  typeMountPath(path: string): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.findMountPathInput().clear().type(path);
  }

  assertMountPathValue(path: string): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.findMountPathInput().should('have.value', path);
  }

  // Read-only Switch
  findReadOnlySwitch(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.findByTestId('pvc-read-only-switch');
  }

  toggleReadOnly(): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.findReadOnlySwitch().click({ force: true });
  }

  // Alerts - PatternFly v6 uses .pf-v6-c-alert.pf-m-{variant} pattern
  findAlert(
    variant: 'success' | 'danger' | 'warning' | 'info',
  ): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.find().find(`.pf-v6-c-alert.pf-m-${variant}`);
  }

  assertInUseWarningVisible(): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.findAlert('warning').should('be.visible');
  }

  assertInUseDangerVisible(): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.findAlert('danger').should('be.visible');
  }

  assertErrorAlertVisible(): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.findAlert('danger').should('be.visible');
  }

  assertErrorAlertContains(message: string): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.findAlert('danger').should('contain', message);
  }

  // Footer Buttons
  findAttachButton(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.findByTestId('attach-pvc-button');
  }

  clickAttach(): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.findAttachButton().click();
  }

  assertAttachButtonEnabled(): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.findAttachButton().should('not.be.disabled');
  }

  assertAttachButtonDisabled(): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.findAttachButton().should('be.disabled');
  }

  findCancelButton(): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.find().contains('button', 'Cancel') as unknown as Cypress.Chainable<
      JQuery<HTMLElement>
    >;
  }

  clickCancel(): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.findCancelButton().click();
  }
}

class VolumesCreateModal {
  find(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.findByTestId('create-volume-modal');
  }

  assertModalVisible(): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.find().should('be.visible');
  }

  assertModalNotExists(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.findByTestId('create-volume-modal').should('not.exist');
  }

  // Form Fields
  findPVCNameInput(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.findByTestId('pvc-name-input');
  }

  typePVCName(name: string): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.findPVCNameInput().clear().type(name);
  }

  assertPVCNameValue(name: string): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.findPVCNameInput().should('have.value', name);
  }

  assertPVCNameDisabled(): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.findPVCNameInput().should('be.disabled');
  }

  // Storage Class
  findStorageClassSelect(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.findByTestId('storage-class-select');
  }

  findStorageClassInput(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.findByTestId('storage-class-input');
  }

  selectStorageClass(name: string): void {
    this.findStorageClassSelect().click();
    cy.findByTestId(`storage-class-option-${name}`).click();
  }

  typeStorageClassName(name: string): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.findStorageClassInput().clear().type(name);
  }

  // Access Mode
  findAccessModeRadio(mode: string): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.findByTestId(`access-mode-${mode}`);
  }

  selectAccessMode(mode: string): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.findAccessModeRadio(mode).click({ force: true });
  }

  assertAccessModeChecked(mode: string): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.findAccessModeRadio(mode).should('be.checked');
  }

  // Read-only Switch
  findReadOnlySwitch(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.findByTestId('read-only-switch');
  }

  toggleReadOnly(): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.findReadOnlySwitch().click({ force: true });
  }

  // Error Alert
  findErrorAlert(): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.find().find('.pf-v6-c-alert.pf-m-danger');
  }

  assertErrorAlertVisible(): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.findErrorAlert().should('be.visible');
  }

  assertErrorAlertContains(message: string): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.findErrorAlert().should('contain', message);
  }

  // Footer Buttons
  findSubmitButton(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.findByTestId('create-volume-submit-button');
  }

  clickSubmit(): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.findSubmitButton().click();
  }

  assertSubmitButtonEnabled(): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.findSubmitButton().should('not.be.disabled');
  }

  assertSubmitButtonDisabled(): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.findSubmitButton().should('be.disabled');
  }

  findCancelButton(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.findByTestId('create-volume-cancel-button');
  }

  clickCancel(): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.findCancelButton().click();
  }
}

class VolumesDetachModal {
  find(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.findByTestId('detach-volume-modal');
  }

  assertModalVisible(): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.find().should('be.visible');
  }

  assertModalNotExists(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.findByTestId('detach-volume-modal').should('not.exist');
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

  findDangerAlert(): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.find().findByTestId('detach-volume-danger-alert');
  }

  assertDangerAlertNotExists(): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.find().findByTestId('detach-volume-danger-alert').should('not.exist');
  }
}

export const volumesManagement = new VolumesManagementPage();
export const volumesAttachModal = new VolumesAttachModal();
export const volumesCreateModal = new VolumesCreateModal();
export const volumesDetachModal = new VolumesDetachModal();
