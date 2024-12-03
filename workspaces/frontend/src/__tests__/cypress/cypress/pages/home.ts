class Home {
  visit() {
    cy.visit(`/`);
  }

  findButton() {
    return cy.get('button:contains("Create Workspace")');
  }
}

export const home = new Home();
