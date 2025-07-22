class Home {
  visit() {
    cy.visit(`/`);
  }

  findButton() {
    return cy.get('button:contains("Create workspace")');
  }
}

export const home = new Home();
