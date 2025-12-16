class ToastNotification {
  find() {
    return cy.get('.pf-v6-c-alert-group[aria-live="polite"]');
  }

  findAlert(variant: 'success' | 'danger' | 'warning' | 'info') {
    return this.find().find(`.pf-v6-c-alert.pf-m-${variant}`);
  }

  findErrorAlert() {
    return this.findAlert('danger');
  }

  findSuccessAlert() {
    return this.findAlert('success');
  }

  findInfoAlert() {
    return this.findAlert('info');
  }

  assertErrorAlertExists() {
    this.findErrorAlert().should('exist');
  }

  assertErrorAlertNotExists() {
    this.findErrorAlert().should('not.exist');
  }

  assertSuccessAlertExists() {
    this.findSuccessAlert().should('exist');
  }

  assertInfoAlertExists() {
    this.findInfoAlert().should('exist');
  }

  assertErrorAlertContainsMessage(message: string) {
    this.findErrorAlert().should('contain.text', message);
  }

  assertSuccessAlertContainsMessage(message: string) {
    this.findSuccessAlert().should('contain.text', message);
  }

  assertInfoAlertContainsMessage(message: string) {
    this.findInfoAlert().should('contain.text', message);
  }

  closeErrorAlert() {
    this.findErrorAlert().find('button[aria-label="Close"]').click();
  }
}

export const toastNotification = new ToastNotification();
