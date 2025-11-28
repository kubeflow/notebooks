import { mockModArchResponse } from 'mod-arch-core';
import { pageNotfound } from '~/__tests__/cypress/cypress/pages/pageNotFound';
import { home } from '~/__tests__/cypress/cypress/pages/home';
import { NOTEBOOKS_API_VERSION } from '~/__tests__/cypress/cypress/support/commands/api';
import { workspaces } from '~/__tests__/cypress/cypress/pages/workspaces/workspaces';
import { buildMockNamespace, buildMockWorkspace } from '~/shared/mock/mockBuilder';

describe('Application', () => {
  it('should redirect to page not found when visiting a non-existent page', () => {
    pageNotfound.visit();
    pageNotfound.assertPageVisible();
  });

  it('should redirect to Workspaces page when visiting the root', () => {
    const mockNamespace = buildMockNamespace({ name: 'default' });
    const mockWorkspace = buildMockWorkspace({ namespace: mockNamespace.name });

    cy.interceptApi(
      'GET /api/:apiVersion/namespaces',
      { path: { apiVersion: NOTEBOOKS_API_VERSION } },
      mockModArchResponse([mockNamespace]),
    ).as('getNamespaces');

    cy.interceptApi(
      'GET /api/:apiVersion/workspaces/:namespace',
      { path: { apiVersion: NOTEBOOKS_API_VERSION, namespace: mockNamespace.name } },
      mockModArchResponse([mockWorkspace]),
    ).as('getWorkspaces');

    home.visit();

    cy.wait('@getNamespaces');
    cy.wait('@getWorkspaces');

    workspaces.findPageTitle();
    workspaces.verifyPageURL();
  });
});
