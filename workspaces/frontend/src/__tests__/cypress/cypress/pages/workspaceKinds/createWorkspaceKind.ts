class CreateWorkspaceKind {
  readonly CREATE_WORKSPACE_KIND_ROUTE = '/workspacekinds/create';

  visit() {
    cy.visit(this.CREATE_WORKSPACE_KIND_ROUTE);
    this.wait();
  }

  verifyPageURL() {
    return cy.verifyRelativeURL(this.CREATE_WORKSPACE_KIND_ROUTE);
  }

  findPageTitle() {
    return cy
      .findByTestId('app-page-title')
      .should('exist')
      .and('contain', 'Create workspace kind');
  }

  findUploadFileField() {
    return cy.findByTestId('upload-file-field');
  }

  findFileInput() {
    // Find the hidden file input within the FileUpload component
    return this.findUploadFileField().find('input[type="file"]');
  }

  findSubmitButton() {
    return cy.findByTestId('submit-button');
  }

  findCancelButton() {
    return cy.findByTestId('cancel-button');
  }

  findErrorAlert() {
    return cy.findByTestId('workspace-kind-form-error');
  }

  assertErrorAlertContainsMessage(message: string) {
    cy.findByTestId('workspace-kind-form-error-message').should('have.text', message);
  }

  findFormPropertiesSection() {
    return cy.findByTestId('workspace-kind-form-properties');
  }

  findEmptyStateMessage() {
    return cy.contains('No results found');
  }

  uploadYamlContent(content: string) {
    this.findFileInput().selectFile(
      {
        contents: Cypress.Buffer.from(content),
        fileName: 'workspace-kind.yaml',
        mimeType: 'application/x-yaml',
      },
      { force: true },
    );
    return this;
  }

  clearYamlContent() {
    // The FileUpload component should have a clear button after file is uploaded
    this.findUploadFileField().within(() => {
      cy.contains('button', 'Clear').click();
    });
    return this;
  }

  assertYamlContentContains(text: string) {
    this.findUploadFileField().find('textarea').should('contain.value', text);
    return this;
  }

  clickSubmit() {
    this.findSubmitButton().click();
    return this;
  }

  clickCancel() {
    this.findCancelButton().click();
    return this;
  }

  assertSubmitButtonEnabled() {
    this.findSubmitButton().should('not.be.disabled');
    return this;
  }

  assertSubmitButtonDisabled() {
    this.findSubmitButton().should('be.disabled');
    return this;
  }

  assertUploadFileFieldExists() {
    this.findUploadFileField().should('exist');
    return this;
  }

  assertFormPropertiesSectionExists() {
    this.findFormPropertiesSection().should('exist');
    return this;
  }

  assertEmptyStateVisible() {
    this.findEmptyStateMessage().should('be.visible');
    return this;
  }

  private wait() {
    this.findPageTitle();
    cy.testA11y();
  }
}

export const createWorkspaceKind = new CreateWorkspaceKind();
