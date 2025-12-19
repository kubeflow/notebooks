class Workspaces {
  readonly WORKSPACES_ROUTE = '/workspaces';

  visit() {
    cy.visit(this.WORKSPACES_ROUTE);
    this.wait();
  }

  findPageTitle() {
    return cy.findByTestId('app-page-title').should('exist').and('contain', 'Workspaces');
  }

  verifyPageURL() {
    return cy.verifyRelativeURL(this.WORKSPACES_ROUTE);
  }

  private wait() {
    this.findPageTitle();
    cy.testA11y();
  }

  findCreateWorkspaceButton() {
    return cy.get('button:contains("Create workspace")');
  }

  findWorkspacesTable() {
    return cy.findByTestId('workspaces-table');
  }

  findWorkspacesTableRows() {
    return this.findWorkspacesTable().find('tbody tr');
  }

  findWorkspaceTableRow(workspaceName: string) {
    return this.findWorkspacesTableRows().filter(`:contains("${workspaceName}")`).first();
  }

  findColumnHeader(columnName: string) {
    return cy.get('th').contains(columnName);
  }

  findEmptyState() {
    return cy.findByTestId('empty-state');
  }

  assertWorkspaceRowName(index: number, name: string) {
    return cy
      .findByTestId(`workspace-row-${index}`)
      .findByTestId('workspace-name')
      .should('have.text', name);
  }

  assertWorkspaceRowState(index: number, state: string) {
    return cy
      .findByTestId(`workspace-row-${index}`)
      .findByTestId('state-label')
      .should('have.text', state);
  }

  assertWorkspaceRowImage(index: number, image: string) {
    return cy
      .findByTestId(`workspace-row-${index}`)
      .findByTestId('workspace-image-name')
      .should('have.text', image);
  }

  assertWorkspaceRowLastActivity(index: number, lastActivity: string) {
    return cy
      .findByTestId(`workspace-row-${index}`)
      .findByTestId('workspace-lastActivity')
      .should('have.text', lastActivity);
  }

  applyFilter(args: { key: string; value: string; name: string }) {
    cy.findByTestId('filter-workspaces-dropdown').click();
    cy.findByTestId(`filter-workspaces-dropdown-${args.key}`).click();
    cy.findByTestId('filter-workspaces-search-input').clear();
    cy.findByTestId('filter-workspaces-search-input').type(args.value);
  }

  removeFilter(filterName: string) {
    cy.get('.pf-v6-c-label-group')
      .filter(`:contains("${filterName}")`)
      .first()
      .find('.pf-v6-c-label__actions button')
      .first()
      .click();
  }

  removeAllFilters() {
    cy.contains('button', 'Clear all filters').click();
  }

  openWorkspaceActionDropdown(workspaceName: string) {
    this.findWorkspaceTableRow(workspaceName).findByTestId('action-column').find('button').click();
  }

  findAction(args: {
    action: 'delete' | 'start' | 'stop' | 'restart' | 'viewDetails' | 'edit';
    workspaceName: string;
  }) {
    this.openWorkspaceActionDropdown(args.workspaceName);
    return cy.findByTestId(`action-${args.action}`);
  }

  toggleRowExpansion(rowIndex: number) {
    return cy
      .findByTestId(`workspace-row-${rowIndex}`)
      .find('td[class*="pf-v6-c-table__toggle"]')
      .find('button')
      .click();
  }

  findExpandedRowContent(workspaceName: string) {
    return this.findWorkspaceTableRow(workspaceName).parent().find('tr[class*="pf-m-expanded"]');
  }

  findPagination() {
    return cy.get('nav[class*="pf-v6-c-pagination"]').last();
  }

  findPaginationInfo() {
    return this.findPagination().find('.pf-v6-c-pagination__total-items');
  }

  goToNextPage() {
    return this.findPagination().find('button[aria-label*="Go to next page"]').click();
  }

  goToPreviousPage() {
    return this.findPagination().find('button[aria-label*="Go to previous page"]').click();
  }

  selectPerPage(perPage: number) {
    this.findPagination()
      .find('button')
      .filter(':contains("per page")')
      .first()
      .click({ force: true });
    return cy
      .get('button')
      .contains(new RegExp(`^${perPage}$`))
      .click({ force: true });
  }

  assertWorkspaceCount(count: number) {
    this.findWorkspacesTableRows().should('have.length', count);
  }

  assertEmptyStateExists() {
    this.findEmptyState().should('exist');
  }

  assertEmptyStateNotExists() {
    this.findEmptyState().should('not.exist');
  }

  assertExpandedRowExists(workspaceName: string) {
    this.findExpandedRowContent(workspaceName).should('exist');
  }

  assertExpandedRowNotExists(workspaceName: string) {
    this.findExpandedRowContent(workspaceName).should('not.exist');
  }

  assertExpandedRowContainsText(workspaceName: string, text: string) {
    this.findExpandedRowContent(workspaceName).should('contain.text', text);
  }

  assertPaginationExists() {
    this.findPagination().should('exist');
  }

  assertPrevNextDisabled() {
    this.findPagination().find('button[aria-label*="Go to previous page"]').should('be.disabled');
    this.findPagination().find('button[aria-label*="Go to next page"]').should('be.disabled');
  }
}

class WorkspaceDetailsDrawer {
  find() {
    return cy.findByTestId('workspace-details');
  }

  findTitle() {
    return this.find().findByTestId('title');
  }

  findCloseButton() {
    return this.find().findByTestId('close-button');
  }

  findOverviewTab() {
    return this.find().findByTestId('overview-tab');
  }

  findActivityTab() {
    return this.find().findByTestId('activity-tab');
  }

  assertOverviewTabSelected(isSelected: boolean) {
    return this.findOverviewTab().should(
      'have.attr',
      'aria-selected',
      isSelected ? 'true' : 'false',
    );
  }

  assertActivityTabSelected(isSelected: boolean) {
    return this.findActivityTab().should(
      'have.attr',
      'aria-selected',
      isSelected ? 'true' : 'false',
    );
  }

  findOverviewTabContent() {
    return this.find().findByTestId('overview-tab-content');
  }

  findActivityTabContent() {
    return this.find().findByTestId('activity-tab-content');
  }

  assertDrawerExists() {
    this.find().should('exist');
  }

  assertDrawerNotExists() {
    this.find().should('not.exist');
  }

  assertDrawerTitle(title: string) {
    this.findTitle().should('have.text', title);
  }

  assertOverviewTabContentVisible() {
    this.findOverviewTabContent().should('be.visible');
  }

  assertOverviewTabContentNotVisible() {
    this.findOverviewTabContent().should('not.be.visible');
  }

  assertOverviewTabContentContainsText(text: string) {
    this.findOverviewTabContent().should('contain.text', text);
  }

  assertActivityTabContentVisible() {
    this.findActivityTabContent().should('be.visible');
  }

  assertActivityTabContentNotVisible() {
    this.findActivityTabContent().should('not.be.visible');
  }

  assertActivityTabContentContainsText(text: string) {
    this.findActivityTabContent().should('contain.text', text);
  }

  assertOverviewTabAriaSelected(selected: boolean) {
    this.findOverviewTab().should('have.attr', 'aria-selected', selected ? 'true' : 'false');
  }

  assertActivityTabAriaSelected(selected: boolean) {
    this.findActivityTab().should('have.attr', 'aria-selected', selected ? 'true' : 'false');
  }

  findActionsToggle() {
    return this.find().findByTestId('workspace-details-action-toggle');
  }

  clickActionsToggle() {
    return this.findActionsToggle().click();
  }

  findEditAction() {
    return cy.findByTestId('workspace-details-action-edit-button');
  }

  clickEditAction() {
    this.clickActionsToggle();
    return this.findEditAction().click();
  }

  findDeleteAction() {
    return cy.findByTestId('workspace-details-action-delete-button');
  }

  clickDeleteAction() {
    this.clickActionsToggle();
    return this.findDeleteAction().click();
  }
}

class DeleteModal {
  find() {
    return cy.findByTestId('delete-modal');
  }

  findConfirmationInput() {
    return this.find().findByTestId('delete-modal-input');
  }

  findSubmitButton() {
    return this.find().findByTestId('delete-button');
  }

  findCancelButton() {
    return this.find().findByTestId('cancel-button');
  }

  assertModalExists() {
    this.find().should('exist');
  }

  assertModalNotExists() {
    this.find().should('not.exist');
  }

  assertSubmitButtonDisabled() {
    this.findSubmitButton().should('be.disabled');
  }

  findErrorAlert() {
    return this.find().findByTestId('delete-modal-error');
  }

  assertErrorAlertContainsMessage(message: string) {
    this.find().findByTestId('delete-modal-error-message').should('have.text', message);
  }

  assertSubmitButtonEnabled() {
    this.findSubmitButton().should('not.be.disabled');
  }
}

class StartModal {
  find() {
    return cy.findByTestId('start-modal');
  }

  findStartButton() {
    return this.find().findByTestId('start-button');
  }

  findCancelButton() {
    return this.find().findByTestId('cancel-button');
  }

  assertModalNotExists() {
    this.find().should('not.exist');
  }

  assertModalExists() {
    this.find().should('exist');
  }

  findErrorAlert() {
    return this.find().findByTestId('start-modal-error');
  }

  assertErrorAlertContainsMessage(message: string) {
    this.find().findByTestId('start-modal-error-message').should('have.text', message);
  }
}

class StopModal {
  find() {
    return cy.findByTestId('stop-modal');
  }

  findStopButton() {
    return this.find().findByTestId('stop-button');
  }

  findCancelButton() {
    return this.find().findByTestId('cancel-button');
  }

  assertModalNotExists() {
    this.find().should('not.exist');
  }

  assertModalExists() {
    this.find().should('exist');
  }

  findErrorAlert() {
    return this.find().findByTestId('stop-modal-error');
  }

  assertErrorAlertContainsMessage(message: string) {
    this.find().findByTestId('stop-modal-error-message').should('have.text', message);
  }
}

export const workspaces = new Workspaces();
export const deleteModal = new DeleteModal();
export const startModal = new StartModal();
export const stopModal = new StopModal();
export const workspaceDetailsDrawer = new WorkspaceDetailsDrawer();
