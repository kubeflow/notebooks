export type WorkspaceKindSummaryNavigationState = {
  namespace?: string;
  imageId?: string;
  podConfigId?: string;
};

class WorkspaceKindSummary {
  readonly WORKSPACE_KIND_SUMMARY_ROUTE = '/workspacekinds/:kind/summary';

  visit(kind: string, state?: WorkspaceKindSummaryNavigationState) {
    const route = this.WORKSPACE_KIND_SUMMARY_ROUTE.replace(':kind', kind);

    cy.visit(
      route,
      state ? { onBeforeLoad: (win) => win.history.pushState({ usr: state }, '', route) } : {},
    );

    this.wait(kind);
  }

  verifyPageURL(kind: string) {
    return cy.verifyRelativeURL(this.WORKSPACE_KIND_SUMMARY_ROUTE.replace(':kind', kind));
  }

  findPageTitle(kind: string) {
    return cy.findByTestId('app-page-title').should('exist').and('contain', kind);
  }

  findBreadcrumb() {
    return cy.get('nav[aria-label="Breadcrumb"]');
  }

  findBreadcrumbItem(text: string) {
    return this.findBreadcrumb().contains(text);
  }

  clickBreadcrumbWorkspaceKinds() {
    this.findBreadcrumbItem('Workspace Kinds').click();
  }

  findSummaryCard() {
    return cy.findByTestId('workspace-kind-summary-card');
  }

  assertSummaryCardExists() {
    this.findSummaryCard().should('exist');
  }

  findSummaryCardToggle() {
    return this.findSummaryCard().find('.pf-v6-c-card__header button');
  }

  toggleSummaryCard() {
    this.findSummaryCardToggle().click();
  }

  assertSummaryCardExpanded(isExpanded: boolean) {
    this.findSummaryCard().should(isExpanded ? 'have.class' : 'not.have.class', 'pf-m-expanded');
  }

  findTotalGPUsInUse() {
    return cy.findByTestId('total-gpus-in-use');
  }

  assertTotalGPUsInUse(count: number) {
    this.findTotalGPUsInUse().should('have.text', `${count} GPUs`);
  }

  findTotalGPUsRequested() {
    return cy.findByTestId('total-gpus-requested');
  }

  assertTotalGPUsRequested(count: number) {
    this.findTotalGPUsRequested().should('have.text', `Requested of ${count} GPUs`);
  }

  findIdleGPUWorkspaces() {
    return cy.findByTestId('idle-gpu-workspaces-button');
  }

  assertIdleGPUWorkspaces(count: number) {
    this.findIdleGPUWorkspaces().should('have.text', count.toString());
  }

  clickIdleGPUWorkspaces() {
    this.findIdleGPUWorkspaces().click();
  }

  findTopGPUConsumers() {
    return cy.findByTestId('top-gpu-consumers');
  }

  findTopGPUConsumerNamespace(namespace: string) {
    return cy.findByTestId(`gpu-consumer-namespace-${namespace}`);
  }

  assertTopGPUConsumerNamespace(namespace: string, gpuCount: number) {
    this.findTopGPUConsumerNamespace(namespace).should('have.text', namespace);
    this.findTopGPUConsumerNamespace(namespace)
      .parent()
      .find('.pf-v6-c-content')
      .should('have.text', `${gpuCount} GPUs`);
  }

  clickTopGPUConsumerNamespace(namespace: string) {
    this.findTopGPUConsumerNamespace(namespace).click();
  }

  assertNoTopGPUConsumers() {
    this.ensureSummaryCardExpanded();
    cy.findByTestId('no-gpu-consumers').should('be.visible').and('have.text', 'None');
  }

  findWorkspaceTable() {
    return cy.findByTestId('workspaces-table');
  }

  findWorkspaceTableRows() {
    return this.findWorkspaceTable().find('tbody tr[data-testid^="workspace-row-"]');
  }

  assertWorkspaceCount(count: number) {
    if (count === 0) {
      this.findEmptyState().should('exist');
    } else {
      this.findWorkspaceTableRows().should('have.length', count);
    }
  }

  assertWorkspaceRowName(index: number, name: string) {
    return cy
      .findByTestId(`workspace-row-${index}`)
      .findByTestId('workspace-name')
      .should('have.text', name);
  }

  findEmptyState() {
    return cy.findByTestId('empty-state');
  }

  assertEmptyStateVisible() {
    this.findEmptyState().should('exist');
  }

  findToolbar() {
    return cy.findByTestId('filter-workspaces-toolbar');
  }

  findActiveFilters() {
    return this.findToolbar().find('.pf-v6-c-label-group', { timeout: 5000 });
  }

  assertActiveFilter(filterLabel: string) {
    // Check for the filter label specifically in the label group (filter chips)
    this.findActiveFilters().should('have.text', filterLabel);
  }

  clearAllFilters() {
    this.findToolbar().contains('button', 'Clear all filters').click();
  }

  ensureSummaryCardExpanded() {
    this.findSummaryCard().then((card) => {
      if (!card.hasClass('pf-m-expanded')) {
        this.toggleSummaryCard();
      }
    });
  }

  private wait(kind: string) {
    this.findPageTitle(kind);
    cy.testA11y();
  }
}

export const workspaceKindSummary = new WorkspaceKindSummary();
