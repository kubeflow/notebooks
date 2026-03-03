/**
 * Page object model for Volumes Management section in workspace form.
 */

class VolumesManagementPage {
  // Expandable Section
  findVolumesSection(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.contains('button', 'Volumes') as unknown as Cypress.Chainable<JQuery<HTMLElement>>;
  }

  expandVolumesSection(): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.findVolumesSection().click();
  }

  // Table
  findVolumesTable(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.findByTestId('volumes-table');
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
    return this.findVolumeRow(pvcName).should('contain', mountPath);
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
    return cy.findByTestId('attach-existing-volume-button');
  }

  clickAttachExistingPVC(): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.findAttachExistingPVCButton().click();
  }

  findCreateVolumeButton(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.findByTestId('create-volume-button');
  }

  clickCreateVolume(): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.findCreateVolumeButton().click();
  }

  // Row Actions
  openRowKebabMenu(pvcName: string): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.findVolumeRow(pvcName).find('[aria-label="plain kebab"]').click();
  }

  clickEditAction(pvcName: string): Cypress.Chainable<JQuery<HTMLElement>> {
    this.openRowKebabMenu(pvcName);
    return cy.contains('Edit').click() as unknown as Cypress.Chainable<JQuery<HTMLElement>>;
  }

  clickDetachAction(pvcName: string): Cypress.Chainable<JQuery<HTMLElement>> {
    this.openRowKebabMenu(pvcName);
    return cy.contains('Detach').click() as unknown as Cypress.Chainable<JQuery<HTMLElement>>;
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
    return cy.findByTestId('volume-modal');
  }

  assertModalVisible(): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.find().should('be.visible');
  }

  assertModalNotExists(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.findByTestId('volume-modal').should('not.exist');
  }

  assertEditMode(): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.find().should('contain', 'Edit Volume');
  }

  assertCreateMode(): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.find().should('contain', 'Create Volume');
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

  findMountPathInput(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.findByTestId('mount-path-input');
  }

  typeMountPath(path: string): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.findMountPathInput().clear().type(path);
  }

  assertMountPathValue(path: string): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.findMountPathInput().should('have.value', path);
  }

  findReadOnlySwitch(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.findByTestId('readonly-access-switch');
  }

  toggleReadOnly(): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.findReadOnlySwitch().click({ force: true });
  }

  // Footer Buttons
  findSubmitButton(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.findByTestId('volume-modal-submit-button');
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

  assertSubmitButtonText(text: string): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.findSubmitButton().should('have.text', text);
  }

  findCancelButton(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.findByTestId('volume-modal-cancel-button');
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

  findDetachButton(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.findByTestId('detach-volume-confirm-button');
  }

  clickDetach(): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.findDetachButton().click();
  }

  findCancelButton(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.findByTestId('detach-volume-cancel-button');
  }

  clickCancel(): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.findCancelButton().click();
  }
}

export const volumesManagement = new VolumesManagementPage();
export const volumesAttachModal = new VolumesAttachModal();
export const volumesCreateModal = new VolumesCreateModal();
export const volumesDetachModal = new VolumesDetachModal();
