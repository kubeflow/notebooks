class WorkspaceKinds {
  readonly WORKSPACE_KINDS_ROUTE = '/workspacekinds';

  visit() {
    cy.visit(this.WORKSPACE_KINDS_ROUTE);
    this.wait();
  }

  findPageTitle() {
    return cy.findByTestId('app-page-title').should('exist').and('contain', 'Workspace kinds');
  }

  verifyPageURL() {
    return cy.verifyRelativeURL(this.WORKSPACE_KINDS_ROUTE);
  }

  private wait() {
    this.findPageTitle();
    cy.testA11y();
  }

  findWorkspaceKindsTable() {
    return cy.findByTestId('workspace-kinds-table');
  }

  findWorkspaceKindsTableRows() {
    return this.findWorkspaceKindsTable().find('tbody tr');
  }

  findWorkspaceKindTableRow(workspaceKindName: string) {
    return this.findWorkspaceKindsTableRows().filter(`:contains("${workspaceKindName}")`).first();
  }

  findColumnHeader(columnName: string) {
    return cy.get('th').contains(columnName);
  }

  findEmptyState() {
    return cy.findByTestId('empty-state');
  }

  assertWorkspaceKindRowName(index: number, name: string) {
    return cy
      .findByTestId(`workspace-kind-row-${index}`)
      .findByTestId('workspace-kind-name')
      .should('have.text', name);
  }

  assertWorkspaceKindRowDescription(index: number, description: string) {
    return cy
      .findByTestId(`workspace-kind-row-${index}`)
      .findByTestId('workspace-kind-description')
      .invoke('text')
      .then((text) => {
        // Handle truncated descriptions with ellipsis
        expect(text).to.satisfy((actualText: string) => {
          return (
            actualText === description || description.startsWith(actualText.replace('...', ''))
          );
        });
      });
  }

  assertWorkspaceKindRowStatus(index: number, status: 'Active' | 'Deprecated') {
    return cy
      .findByTestId(`workspace-kind-row-${index}`)
      .findByTestId('status-label')
      .should('have.text', status);
  }

  assertWorkspaceKindRowWorkspaceCount(index: number, count: number) {
    return cy
      .findByTestId(`workspace-kind-row-${index}`)
      .findByTestId('workspace-kind-workspace-count')
      .should('have.text', `${count} Workspaces`);
  }

  assertWorkspaceCountErrorPopoverExists(index: number) {
    return cy
      .findByTestId(`workspace-kind-row-${index}`)
      .findByTestId('workspace-kind-workspace-count')
      .find('.pf-v6-c-button')
      .find('svg')
      .should('exist');
  }

  applyNameFilter(value: string) {
    cy.findByTestId('filter-attribute-dropdown').click();
    cy.findByTestId('filter-attribute-name').click();
    cy.findByTestId('filter-name-input').clear();
    cy.findByTestId('filter-name-input').type(value);
  }

  applyDescriptionFilter(value: string) {
    cy.findByTestId('filter-attribute-dropdown').click();
    cy.findByTestId('filter-attribute-description').click();
    cy.findByTestId('filter-description-input').clear();
    cy.findByTestId('filter-description-input').type(value);
  }

  applyStatusFilter(status: 'Active' | 'Deprecated') {
    cy.findByTestId('filter-attribute-dropdown').click();
    cy.findByTestId('filter-attribute-status').click();
    cy.findByTestId('filter-status-dropdown').click();
    const testId = status === 'Active' ? 'filter-status-active' : 'filter-status-deprecated';
    cy.findByTestId(testId).click();
  }

  removeFilter(filterName: string) {
    cy.get('.pf-v6-c-label-group')
      .filter(`:contains("${filterName}")`)
      .first()
      .find('.pf-v6-c-label__actions button')
      .first()
      .click();
  }

  clearAllFilters() {
    cy.contains('button', 'Clear all filters').click();
  }

  openWorkspaceKindActionDropdown(workspaceKindName: string) {
    this.findWorkspaceKindTableRow(workspaceKindName)
      .findByTestId('action-column')
      .find('button')
      .click();
  }

  findAction(args: { action: 'view-details' | 'edit-workspace-kind'; workspaceKindName: string }) {
    this.openWorkspaceKindActionDropdown(args.workspaceKindName);
    return cy.findByTestId(`action-${args.action}`);
  }

  findCreateWorkspaceKindButton() {
    return cy.findByTestId('create-workspace-kind-button');
  }

  assertWorkspaceKindCount(count: number) {
    this.findWorkspaceKindsTableRows().should('have.length', count);
  }

  assertEmptyStateVisible() {
    this.findEmptyState().should('exist');
  }

  findPagination() {
    return cy.findByTestId('workspace-kinds-pagination');
  }

  goToNextPage() {
    return this.findPagination().find('button[aria-label*="Go to next page"]').click();
  }

  goToPreviousPage() {
    return this.findPagination().find('button[aria-label*="Go to previous page"]').click();
  }

  selectPerPage(perPage: number) {
    this.findPagination().find('.pf-v6-c-menu-toggle').first().click({ force: true });
    return cy.get('.pf-v6-c-menu__item').contains(`${perPage}`).click({ force: true });
  }

  assertPaginationExists() {
    this.findPagination().should('exist');
  }

  assertPrevNextDisabled() {
    this.findPagination().find('button[aria-label*="Go to previous page"]').should('be.disabled');
    this.findPagination().find('button[aria-label*="Go to next page"]').should('be.disabled');
  }

  assertPaginationRange(args: { firstItem: number; lastItem: number; totalItems: number }) {
    this.findPagination().should(
      'contain.text',
      `${args.firstItem} - ${args.lastItem} of ${args.totalItems}`,
    );
  }
}

class WorkspaceKindDetailsDrawer {
  find() {
    return cy.findByTestId('workspaceDetails');
  }

  findCloseButton() {
    return cy.findByTestId('workspace-kind-details-close');
  }

  findTitle() {
    return cy.findByTestId('workspace-kind-details-title');
  }

  findOverviewTab() {
    return cy.findByTestId('overview-tab');
  }

  findImagesTab() {
    return cy.findByTestId('images-tab');
  }

  findPodConfigsTab() {
    return cy.findByTestId('pod-configs-tab');
  }

  findNamespacesTab() {
    return cy.findByTestId('namespaces-tab');
  }

  shouldBeVisible() {
    return this.find().should('be.visible');
  }

  shouldNotExist() {
    return this.find().should('not.exist');
  }
}

export const workspaceKinds = new WorkspaceKinds();
export const workspaceKindDetailsDrawer = new WorkspaceKindDetailsDrawer();
