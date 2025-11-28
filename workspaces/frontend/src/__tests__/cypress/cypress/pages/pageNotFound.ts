class PageNotFound {
  visit() {
    cy.visit(`/force-not-found-page`, { failOnStatusCode: false });
    this.wait();
  }

  private wait() {
    this.findPage();
    cy.testA11y();
  }

  findPage() {
    return cy.get('h1:contains("404 Page not found")');
  }

  assertPageVisible() {
    this.findPage().should('be.visible');
  }
}

export const pageNotfound = new PageNotFound();
