class Home {
  visit() {
    cy.visit('/');
  }
}

export const home = new Home();
