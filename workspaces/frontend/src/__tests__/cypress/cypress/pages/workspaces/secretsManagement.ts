// Page object model for Secrets View Popover (commit 7843f39)

class SecretsManagementPage {
  // Secrets View Popover
  findSecretRow(secretName: string) {
    return cy.get('table[aria-label="Secrets Table"]').contains('tr', secretName);
  }

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

export const secretsManagement = new SecretsManagementPage();
