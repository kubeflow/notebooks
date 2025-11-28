class EditWorkspaceKind {
  readonly EDIT_WORKSPACE_KIND_ROUTE = '/workspacekinds/:kind/edit';

  visit(kind: string) {
    cy.visit(this.EDIT_WORKSPACE_KIND_ROUTE.replace(':kind', kind));
    this.wait();
  }

  verifyPageURL(kind: string) {
    return cy.verifyRelativeURL(this.EDIT_WORKSPACE_KIND_ROUTE.replace(':kind', kind));
  }

  findPageTitle() {
    return cy.findByTestId('app-page-title').should('exist').and('contain', 'Edit workspace kind');
  }

  findFormProperties() {
    return cy.findByTestId('workspace-kind-form-properties');
  }

  assertFormPropertiesVisible() {
    this.findFormProperties().should('be.visible');
  }

  // Properties Section
  findPropertiesSection() {
    return cy.contains('button', 'Properties');
  }

  expandPropertiesSection() {
    this.findPropertiesSection().then((btn) => {
      if (btn.attr('aria-expanded') === 'false') {
        cy.wrap(btn).click();
      }
    });
  }

  collapsePropertiesSection() {
    this.findPropertiesSection().then((btn) => {
      if (btn.attr('aria-expanded') === 'true') {
        cy.wrap(btn).click();
      }
    });
  }

  assertPropertiesSectionExpanded(isExpanded: boolean) {
    this.findPropertiesSection().should(
      'have.attr',
      'aria-expanded',
      isExpanded ? 'true' : 'false',
    );
  }

  assertPropertiesSectionVisible() {
    this.findPropertiesSection().should('be.visible');
  }

  assertWorkspaceKindNameInputVisible() {
    this.findWorkspaceKindNameInput().should('be.visible');
  }

  findWorkspaceKindNameInput() {
    return cy.findByTestId('workspace-kind-name-input');
  }

  findDescriptionInput() {
    return cy.findByTestId('workspace-kind-description-input');
  }

  findIconUrlInput() {
    return cy.findByTestId('workspace-kind-icon-input');
  }

  findLogoUrlInput() {
    return cy.findByTestId('workspace-kind-logo-input');
  }

  findHiddenSwitch() {
    return cy.findByTestId('workspace-kind-hidden-switch');
  }

  findDeprecatedSwitch() {
    return cy.findByTestId('workspace-kind-deprecated-switch');
  }

  findDeprecationMessageInput() {
    return cy.findByTestId('workspace-kind-deprecated-msg-input');
  }

  typeWorkspaceKindName(name: string) {
    this.findWorkspaceKindNameInput().clear().type(name);
  }

  typeDescription(description: string) {
    this.findDescriptionInput().clear().type(description);
  }

  typeIconUrl(url: string) {
    this.findIconUrlInput().clear().type(url);
  }

  typeLogoUrl(url: string) {
    this.findLogoUrlInput().clear().type(url);
  }

  toggleHidden() {
    this.findHiddenSwitch().click({ force: true });
  }

  toggleDeprecated() {
    this.findDeprecatedSwitch().click({ force: true });
  }

  typeDeprecationMessage(message: string) {
    this.findDeprecationMessageInput().clear().type(message);
  }

  assertWorkspaceKindName(name: string) {
    this.findWorkspaceKindNameInput().should('have.value', name);
  }

  assertDescription(description: string) {
    this.findDescriptionInput().should('have.value', description);
  }

  assertIconUrl(url: string) {
    this.findIconUrlInput().should('have.value', url);
  }

  assertLogoUrl(url: string) {
    this.findLogoUrlInput().should('have.value', url);
  }

  assertIconUrlInputVisible() {
    this.findIconUrlInput().should('be.visible');
  }

  assertLogoUrlInputVisible() {
    this.findLogoUrlInput().should('be.visible');
  }

  assertHiddenChecked(checked: boolean) {
    this.findHiddenSwitch().should(checked ? 'be.checked' : 'not.be.checked');
  }

  assertHiddenSwitchExists() {
    this.findHiddenSwitch().should('exist');
  }

  assertDeprecatedChecked(checked: boolean) {
    this.findDeprecatedSwitch().should(checked ? 'be.checked' : 'not.be.checked');
  }

  assertDeprecatedSwitchExists() {
    this.findDeprecatedSwitch().should('exist');
  }

  assertDeprecationMessage(message: string) {
    this.findDeprecationMessageInput().should('have.value', message);
  }

  assertDeprecationMessageVisible(visible: boolean) {
    if (visible) {
      this.findDeprecationMessageInput().should('be.visible');
    } else {
      this.findDeprecationMessageInput().should('not.exist');
    }
  }

  // Image Config Section
  findImageConfigSection() {
    return cy.contains('button', 'Workspace Images');
  }

  expandImageConfigSection() {
    this.findImageConfigSection().then((btn) => {
      if (btn.attr('aria-expanded') === 'false') {
        cy.wrap(btn).click();
      }
    });
  }

  assertImageConfigSectionExpanded(isExpanded: boolean) {
    this.findImageConfigSection().should(
      'have.attr',
      'aria-expanded',
      isExpanded ? 'true' : 'false',
    );
  }

  assertImageConfigSectionVisible() {
    this.findImageConfigSection().should('be.visible');
  }

  findAddImageButton() {
    return cy.contains('button', 'Add Image');
  }

  clickAddImageButton() {
    this.findAddImageButton().click();
  }

  assertAddImageButtonVisible() {
    this.findAddImageButton().should('be.visible');
  }

  // Image Modal
  findImageModal() {
    return cy.findByTestId('image-modal');
  }

  findImageModalTitle() {
    return cy.findByTestId('image-modal-title');
  }

  findImageIdInput() {
    return cy.findByTestId('workspace-kind-image-id-input');
  }

  findImageDisplayNameInput() {
    return cy.findByTestId('workspace-kind-image-name-input');
  }

  findImageDescriptionInput() {
    return cy.findByTestId('workspace-kind-image-description-input');
  }

  findImageUrlInput() {
    return cy.findByTestId('workspace-kind-image-url-input');
  }

  findImageModalSubmitButton() {
    return cy.findByTestId('image-modal-submit-button');
  }

  findImageModalCancelButton() {
    return cy.findByTestId('image-modal-cancel-button');
  }

  typeImageId(id: string) {
    this.findImageIdInput().clear().type(id);
  }

  typeImageDisplayName(name: string) {
    this.findImageDisplayNameInput().clear().type(name);
  }

  typeImageDescription(description: string) {
    this.findImageDescriptionInput().clear().type(description);
  }

  typeImageUrl(url: string) {
    this.findImageUrlInput().clear().type(url);
  }

  submitImageModal() {
    this.findImageModalSubmitButton().click();
  }

  cancelImageModal() {
    this.findImageModalCancelButton().click();
  }

  assertImageModalVisible(visible: boolean) {
    if (visible) {
      this.findImageModal().should('be.visible');
    } else {
      this.findImageModal().should('not.exist');
    }
  }

  assertImageModalTitle(text: string) {
    this.findImageModalTitle().should('have.text', text);
  }

  assertImageId(id: string) {
    this.findImageIdInput().should('have.value', id);
  }

  assertImageDisplayName(displayName: string) {
    this.findImageDisplayNameInput().should('have.value', displayName);
  }

  assertImageDescription(description: string) {
    this.findImageDescriptionInput().should('have.value', description);
  }

  assertImageUrl(url: string) {
    this.findImageUrlInput().should('have.value', url);
  }

  assertImageIdInputVisible() {
    this.findImageIdInput().should('be.visible');
  }

  assertImageDisplayNameInputVisible() {
    this.findImageDisplayNameInput().should('be.visible');
  }

  assertImageDescriptionInputVisible() {
    this.findImageDescriptionInput().should('be.visible');
  }

  assertImageUrlInputVisible() {
    this.findImageUrlInput().should('be.visible');
  }

  findImagesTable() {
    return cy.findByTestId('images-table');
  }

  findImagesTableRows() {
    return this.findImagesTable().find('tbody tr');
  }

  assertImagesTableVisible() {
    this.findImagesTable().should('be.visible');
  }

  assertImageInTable(displayName: string) {
    this.findImagesTable().contains(displayName).should('be.visible');
  }

  assertImageCount(count: number) {
    this.findImagesTableRows().should('have.length', count);
  }

  assertImageNotInTable(displayName: string) {
    this.findImagesTable().should('not.contain.text', displayName);
  }

  findImageTableRowKebab(rowIndex: number) {
    return cy.findByTestId(`images-table-row-${rowIndex}-kebab`);
  }

  clickImageTableRowKebab(rowIndex: number) {
    this.findImageTableRowKebab(rowIndex).click();
  }

  findEditImageMenuItem() {
    return cy.contains('[role="menuitem"]', 'Edit');
  }

  clickEditImage() {
    this.findEditImageMenuItem().click();
  }

  findRemoveImageMenuItem() {
    return cy.contains('[role="menuitem"]', 'Remove');
  }

  clickRemoveImage() {
    this.findRemoveImageMenuItem().click();
  }

  findRemoveImageModal() {
    return cy.findByTestId('remove-image-modal');
  }

  findRemoveImageModalConfirmButton() {
    return cy.findByTestId('remove-image-confirm-button');
  }

  findRemoveImageModalCancelButton() {
    return cy.findByTestId('remove-image-cancel-button');
  }

  confirmRemoveImage() {
    this.findRemoveImageModalConfirmButton().click();
  }

  cancelRemoveImage() {
    this.findRemoveImageModalCancelButton().click();
  }

  assertRemoveImageModalVisible(visible: boolean) {
    if (visible) {
      this.findRemoveImageModal().should('be.visible');
    } else {
      this.findRemoveImageModal().should('not.exist');
    }
  }

  // Pod Config Section
  findPodConfigSection() {
    return cy.contains('button', 'Pod Configurations');
  }

  expandPodConfigSection() {
    this.findPodConfigSection().then((btn) => {
      if (btn.attr('aria-expanded') === 'false') {
        cy.wrap(btn).click();
      }
    });
  }

  assertPodConfigSectionExpanded(isExpanded: boolean) {
    this.findPodConfigSection().should('have.attr', 'aria-expanded', isExpanded ? 'true' : 'false');
  }

  assertPodConfigSectionVisible() {
    this.findPodConfigSection().should('be.visible');
  }

  findPodConfigsTable() {
    return cy.findByTestId('pod-configs-table');
  }

  findPodConfigsTableRows() {
    return this.findPodConfigsTable().find('tbody tr');
  }

  assertPodConfigsTableVisible() {
    this.findPodConfigsTable().should('be.visible');
  }

  assertPodConfigCount(count: number) {
    this.findPodConfigsTableRows().should('have.length', count);
  }

  findAddConfigButton() {
    return cy.contains('button', 'Add Config');
  }

  clickAddConfigButton() {
    this.findAddConfigButton().click();
  }

  assertAddConfigButtonVisible() {
    this.findAddConfigButton().should('be.visible');
  }

  // Pod Config Modal
  findPodConfigModal() {
    return cy.findByTestId('pod-config-modal');
  }

  findPodConfigModalTitle() {
    return cy.findByTestId('pod-config-modal-title');
  }

  findPodConfigIdInput() {
    return cy.findByTestId('workspace-kind-pod-config-id-input');
  }

  findPodConfigDisplayNameInput() {
    return cy.findByTestId('workspace-kind-pod-config-name-input');
  }

  findPodConfigDescriptionInput() {
    return cy.findByTestId('workspace-kind-pod-config-description-input');
  }

  findPodConfigModalSubmitButton() {
    return cy.findByTestId('pod-config-modal-submit-button');
  }

  findPodConfigModalCancelButton() {
    return cy.findByTestId('pod-config-modal-cancel-button');
  }

  typePodConfigId(id: string) {
    this.findPodConfigIdInput().clear().type(id);
  }

  typePodConfigDisplayName(name: string) {
    this.findPodConfigDisplayNameInput().clear().type(name);
  }

  typePodConfigDescription(description: string) {
    this.findPodConfigDescriptionInput().clear().type(description);
  }

  submitPodConfigModal() {
    this.findPodConfigModalSubmitButton().click();
  }

  cancelPodConfigModal() {
    this.findPodConfigModalCancelButton().click();
  }

  assertPodConfigModalVisible(visible: boolean) {
    if (visible) {
      this.findPodConfigModal().should('be.visible');
    } else {
      this.findPodConfigModal().should('not.exist');
    }
  }

  assertPodConfigModalTitle(text: string) {
    this.findPodConfigModalTitle().should('have.text', text);
  }

  assertPodConfigId(id: string) {
    this.findPodConfigIdInput().should('have.value', id);
  }

  assertPodConfigDisplayName(displayName: string) {
    this.findPodConfigDisplayNameInput().should('have.value', displayName);
  }

  assertPodConfigDescription(description: string) {
    this.findPodConfigDescriptionInput().should('have.value', description);
  }

  assertPodConfigIdInputVisible() {
    this.findPodConfigIdInput().should('be.visible');
  }

  assertPodConfigDisplayNameInputVisible() {
    this.findPodConfigDisplayNameInput().should('be.visible');
  }

  assertPodConfigDescriptionInputVisible() {
    this.findPodConfigDescriptionInput().should('be.visible');
  }

  assertPodConfigInTable(displayName: string) {
    this.findPodConfigsTable().contains(displayName).should('be.visible');
  }

  assertPodConfigNotInTable(displayName: string) {
    this.findPodConfigsTable().should('not.contain.text', displayName);
  }

  findPodConfigTableRowKebab(rowIndex: number) {
    return cy.findByTestId(`pod-configs-table-row-${rowIndex}-kebab`);
  }

  clickPodConfigTableRowKebab(rowIndex: number) {
    this.findPodConfigTableRowKebab(rowIndex).click();
  }

  findEditPodConfigMenuItem() {
    return cy.contains('[role="menuitem"]', 'Edit');
  }

  clickEditPodConfig() {
    this.findEditPodConfigMenuItem().click();
  }

  findRemovePodConfigMenuItem() {
    return cy.contains('[role="menuitem"]', 'Remove');
  }

  clickRemovePodConfig() {
    this.findRemovePodConfigMenuItem().click();
  }

  findRemovePodConfigModal() {
    return cy.findByTestId('remove-pod-config-modal');
  }

  findRemovePodConfigModalConfirmButton() {
    return cy.findByTestId('remove-pod-config-confirm-button');
  }

  findRemovePodConfigModalCancelButton() {
    return cy.findByTestId('remove-pod-config-cancel-button');
  }

  confirmRemovePodConfig() {
    this.findRemovePodConfigModalConfirmButton().click();
  }

  cancelRemovePodConfig() {
    this.findRemovePodConfigModalCancelButton().click();
  }

  assertRemovePodConfigModalVisible(visible: boolean) {
    if (visible) {
      this.findRemovePodConfigModal().should('be.visible');
    } else {
      this.findRemovePodConfigModal().should('not.exist');
    }
  }

  // Pod Template Section
  findPodTemplateSection() {
    return cy.contains('button', 'Pod Lifecycle & Customization');
  }

  expandPodTemplateSection() {
    this.findPodTemplateSection().then((btn) => {
      if (btn.attr('aria-expanded') === 'false') {
        cy.wrap(btn).click();
      }
    });
  }

  assertPodTemplateSectionExpanded(isExpanded: boolean) {
    this.findPodTemplateSection().should(
      'have.attr',
      'aria-expanded',
      isExpanded ? 'true' : 'false',
    );
  }

  assertPodTemplateSectionVisible() {
    this.findPodTemplateSection().should('be.visible');
  }

  assertPodMetadataSectionVisible() {
    cy.contains('Pod Metadata').should('be.visible');
  }

  assertAdditionalVolumesSectionVisible() {
    cy.contains('Additional Volumes').should('be.visible');
  }

  // Pod Metadata - Labels
  findLabelsSection() {
    return cy.findByTestId('labels-section').find('button');
  }

  expandLabelsSection() {
    this.findLabelsSection().then((btn) => {
      if (btn.attr('aria-expanded') === 'false') {
        cy.wrap(btn).click();
      }
    });
  }

  findAddLabelButton() {
    return cy.findByTestId('add-labels-button');
  }

  clickAddLabel() {
    this.findAddLabelButton().click();
  }

  findLabelsTable() {
    return cy.findByTestId('labels-table');
  }

  findLabelRow(index: number) {
    return this.findLabelsTable().find('tbody tr').eq(index);
  }

  typeLabelKey(index: number, key: string) {
    this.findLabelRow(index).find('input').eq(0).clear().type(key);
  }

  typeLabelValue(index: number, value: string) {
    this.findLabelRow(index).find('input').eq(1).clear().type(value);
  }

  findDeleteLabelButton(index: number) {
    return this.findLabelRow(index).find('button[aria-label*="Delete"]');
  }

  clickDeleteLabel(index: number) {
    this.findDeleteLabelButton(index).click();
  }

  assertLabelCount(count: number) {
    if (count === 0) {
      cy.findByTestId('labels-table').should('not.exist');
    } else {
      this.findLabelsTable().find('tbody tr').should('have.length', count);
    }
  }

  assertLabelKey(index: number, key: string) {
    this.findLabelRow(index).find('input').eq(0).should('have.value', key);
  }

  assertLabelValue(index: number, value: string) {
    this.findLabelRow(index).find('input').eq(1).should('have.value', value);
  }

  // Pod Metadata - Annotations
  findAnnotationsSection() {
    return cy.findByTestId('annotations-section').find('button');
  }

  expandAnnotationsSection() {
    this.findAnnotationsSection().then((btn) => {
      if (btn.attr('aria-expanded') === 'false') {
        cy.wrap(btn).click();
      }
    });
  }

  findAddAnnotationButton() {
    return cy.findByTestId('add-annotations-button');
  }

  clickAddAnnotation() {
    this.findAddAnnotationButton().click();
  }

  findAnnotationsTable() {
    return cy.findByTestId('annotations-table');
  }

  findAnnotationRow(index: number) {
    return this.findAnnotationsTable().find('tbody tr').eq(index);
  }

  typeAnnotationKey(index: number, key: string) {
    this.findAnnotationRow(index).find('input').eq(0).clear().type(key);
  }

  typeAnnotationValue(index: number, value: string) {
    this.findAnnotationRow(index).find('input').eq(1).clear().type(value);
  }

  findDeleteAnnotationButton(index: number) {
    return this.findAnnotationRow(index).find('button[aria-label*="Delete"]');
  }

  clickDeleteAnnotation(index: number) {
    this.findDeleteAnnotationButton(index).click();
  }

  assertAnnotationCount(count: number) {
    if (count === 0) {
      cy.findByTestId('annotations-table').should('not.exist');
    } else {
      this.findAnnotationsTable().find('tbody tr').should('have.length', count);
    }
  }

  assertAnnotationKey(index: number, key: string) {
    this.findAnnotationRow(index).find('input').eq(0).should('have.value', key);
  }

  assertAnnotationValue(index: number, value: string) {
    this.findAnnotationRow(index).find('input').eq(1).should('have.value', value);
  }

  // Additional Volumes
  findCreateVolumeButton() {
    return cy.findByTestId('create-volume-button');
  }

  clickCreateVolume() {
    this.findCreateVolumeButton().click();
  }

  findVolumesTable() {
    return cy.findByTestId('volumes-table');
  }

  findVolumeRow(index: number) {
    return this.findVolumesTable().find('tbody tr').eq(index);
  }

  findVolumeRowKebab(index: number) {
    return this.findVolumeRow(index).find('button[aria-label="plain kebab"]');
  }

  clickVolumeRowKebab(index: number) {
    this.findVolumeRowKebab(index).click();
  }

  findEditVolumeMenuItem() {
    return cy.contains('[role="menuitem"]', 'Edit');
  }

  clickEditVolume() {
    this.findEditVolumeMenuItem().click();
  }

  findDetachVolumeMenuItem() {
    return cy.contains('[role="menuitem"]', 'Detach');
  }

  clickDetachVolume() {
    this.findDetachVolumeMenuItem().click();
  }

  assertVolumeCount(count: number) {
    if (count === 0) {
      cy.findByTestId('volumes-table').should('not.exist');
    } else {
      this.findVolumesTable().find('tbody tr').should('have.length', count);
    }
  }

  assertVolumeInTable(pvcName: string) {
    this.findVolumesTable().contains(pvcName).should('be.visible');
  }

  assertVolumeNotInTable(pvcName: string) {
    cy.get('body').then((body) => {
      if (body.find('[data-testid="volumes-table"]').length > 0) {
        this.findVolumesTable().should('not.contain.text', pvcName);
      }
    });
  }

  // Volume Modal
  findVolumeModal() {
    return cy.findByTestId('volume-modal');
  }

  findVolumeModalTitle() {
    return this.findVolumeModal().find('h1');
  }

  findPvcNameInput() {
    return cy.findByTestId('pvc-name-input');
  }

  findMountPathInput() {
    return cy.findByTestId('mount-path-input');
  }

  findReadOnlySwitch() {
    return cy.findByTestId('readonly-access-switch');
  }

  typePvcName(name: string) {
    this.findPvcNameInput().clear().type(name);
  }

  typeMountPath(path: string) {
    this.findMountPathInput().clear().type(path);
  }

  toggleReadOnly() {
    this.findReadOnlySwitch().click({ force: true });
  }

  findVolumeModalSubmitButton() {
    return cy.findByTestId('volume-modal-submit-button');
  }

  findVolumeModalCancelButton() {
    return cy.findByTestId('volume-modal-cancel-button');
  }

  submitVolumeModal() {
    this.findVolumeModalSubmitButton().click();
  }

  cancelVolumeModal() {
    this.findVolumeModalCancelButton().click();
  }

  assertVolumeModalVisible(visible: boolean) {
    if (visible) {
      this.findVolumeModal().should('be.visible');
    } else {
      this.findVolumeModal().should('not.exist');
    }
  }

  assertVolumeModalTitle(title: string) {
    this.findVolumeModalTitle().should('have.text', title);
  }

  assertPvcName(name: string) {
    this.findPvcNameInput().should('have.value', name);
  }

  assertMountPath(path: string) {
    this.findMountPathInput().should('have.value', path);
  }

  assertReadOnlyChecked(checked: boolean) {
    this.findReadOnlySwitch().should(checked ? 'be.checked' : 'not.be.checked');
  }

  // Detach Volume Modal
  findDetachVolumeModal() {
    return cy.findByTestId('detach-volume-modal');
  }

  findDetachVolumeModalConfirmButton() {
    return cy.findByTestId('detach-volume-confirm-button');
  }

  findDetachVolumeModalCancelButton() {
    return cy.findByTestId('detach-volume-cancel-button');
  }

  confirmDetachVolume() {
    this.findDetachVolumeModalConfirmButton().click();
  }

  cancelDetachVolume() {
    this.findDetachVolumeModalCancelButton().click();
  }

  assertDetachVolumeModalVisible(visible: boolean) {
    if (visible) {
      this.findDetachVolumeModal().should('be.visible');
    } else {
      this.findDetachVolumeModal().should('not.exist');
    }
  }

  // Action Buttons
  findSubmitButton() {
    return cy.findByTestId('submit-button');
  }

  findCancelButton() {
    return cy.findByTestId('cancel-button');
  }

  clickSubmit() {
    this.findSubmitButton().click();
  }

  clickCancel() {
    this.findCancelButton().click();
  }

  assertSubmitButtonDisabled(disabled: boolean) {
    if (disabled) {
      this.findSubmitButton().should('be.disabled');
    } else {
      this.findSubmitButton().should('not.be.disabled');
    }
  }

  assertSubmitButtonText(text: string) {
    this.findSubmitButton().should('have.text', text);
  }

  private wait() {
    this.findPageTitle();
    cy.testA11y();
  }
}

export const editWorkspaceKind = new EditWorkspaceKind();
