class CreateWorkspaceKindPage {
  visit(): void {
    cy.visit('/workspacekinds/create');
  }

  findUploadField(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.findByTestId('upload-file-field');
  }

  findFileInput(): Cypress.Chainable<JQuery<HTMLInputElement>> {
    return this.findUploadField().find('input[type="file"]');
  }

  findSubmitButton(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.findByTestId('submit-button');
  }

  uploadYamlFile(filePath: string): void {
    cy.readFile(filePath, 'utf-8').then((content: string) => {
      this.findFileInput().selectFile(
        {
          contents: Cypress.Buffer.from(content),
          fileName: 'workspace-kind.yaml',
          mimeType: 'application/x-yaml',
        },
        { force: true },
      );
    });
  }

  clickSubmit(): void {
    this.findSubmitButton().should('not.be.disabled').click();
  }

  findErrorAlert(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.findByTestId('workspace-kind-form-error');
  }
}

export const createWorkspaceKindPage = new CreateWorkspaceKindPage();
