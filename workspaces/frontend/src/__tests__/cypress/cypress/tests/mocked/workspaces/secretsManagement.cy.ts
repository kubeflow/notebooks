import { mockModArchResponse } from 'mod-arch-core';
import { editWorkspace } from '~/__tests__/cypress/cypress/pages/workspaces/editWorkspace';
import { secretsManagement } from '~/__tests__/cypress/cypress/pages/workspaces/secretsManagement';
import { workspaces } from '~/__tests__/cypress/cypress/pages/workspaces/workspaces';
import { NOTEBOOKS_API_VERSION } from '~/__tests__/cypress/cypress/support/commands/api';
import {
  buildMockNamespace,
  buildMockWorkspace,
  buildMockWorkspaceKind,
  buildMockWorkspaceKindInfo,
  buildMockWorkspaceUpdateFromWorkspace,
} from '~/shared/mock/mockBuilder';
import { navBar } from '~/__tests__/cypress/cypress/pages/components/navBar';
import { V1Beta1WorkspaceState } from '~/generated/data-contracts';

describe('Secrets Expandable Key/Value Pairs', () => {
  const mockNamespace = buildMockNamespace({ name: 'default' });
  const mockWorkspaceKindInfo = buildMockWorkspaceKindInfo({ name: 'jupyterlab' });
  const mockWorkspaceKindFull = buildMockWorkspaceKind({ name: 'jupyterlab' });

  // Create a workspace with secrets already attached
  const mockWorkspaceListItem = buildMockWorkspace({
    name: 'test-workspace',
    namespace: mockNamespace.name,
    workspaceKind: mockWorkspaceKindInfo,
    state: V1Beta1WorkspaceState.WorkspaceStateRunning,
  });

  // Override the secrets in the workspace
  mockWorkspaceListItem.podTemplate.volumes.secrets = [
    { secretName: 'api-key-secret', mountPath: '/mnt/secrets', defaultMode: 420 },
    { secretName: 'db-credentials', mountPath: '/mnt/db', defaultMode: 384 },
  ];

  // Create the WorkspaceUpdate format for the getWorkspace API call
  const mockWorkspaceUpdate = buildMockWorkspaceUpdateFromWorkspace({
    workspace: mockWorkspaceListItem,
  });

  beforeEach(() => {
    cy.interceptApi(
      'GET /api/:apiVersion/namespaces',
      { path: { apiVersion: NOTEBOOKS_API_VERSION } },
      mockModArchResponse([mockNamespace]),
    ).as('getNamespaces');

    cy.interceptApi(
      'GET /api/:apiVersion/workspaces/:namespace',
      { path: { apiVersion: NOTEBOOKS_API_VERSION, namespace: mockNamespace.name } },
      mockModArchResponse([mockWorkspaceListItem]),
    ).as('getWorkspaces');

    // Intercept the individual workspace GET request (returns WorkspaceUpdate format)
    cy.intercept(
      'GET',
      `/api/${NOTEBOOKS_API_VERSION}/workspaces/${mockNamespace.name}/${mockWorkspaceListItem.name}`,
      mockModArchResponse(mockWorkspaceUpdate),
    ).as('getWorkspace');

    // Intercept workspace kind GET (needed for edit form)
    cy.intercept(
      'GET',
      `/api/${NOTEBOOKS_API_VERSION}/workspacekinds/${mockWorkspaceKindInfo.name}`,
      mockModArchResponse(mockWorkspaceKindFull),
    ).as('getWorkspaceKind');

    // Intercept list secrets API (called when secrets section loads)
    cy.intercept('GET', `/api/${NOTEBOOKS_API_VERSION}/secrets/${mockNamespace.name}`, {
      data: [],
    }).as('listSecrets');

    // Intercept getSecret API calls (fetched lazily on row expand)
    cy.intercept(
      'GET',
      `/api/${NOTEBOOKS_API_VERSION}/secrets/${mockNamespace.name}/api-key-secret`,
      {
        data: {
          name: 'api-key-secret',
          type: 'Opaque',
          immutable: false,
          contents: {
            username: { base64: 'dXNlcm5hbWU=' },
            // cspell:disable-next-line
            password: { base64: 'cGFzc3dvcmQ=' },
          },
        },
      },
    ).as('getSecret1');

    cy.intercept(
      'GET',
      `/api/${NOTEBOOKS_API_VERSION}/secrets/${mockNamespace.name}/db-credentials`,
      {
        data: {
          name: 'db-credentials',
          type: 'Opaque',
          immutable: false,
          contents: {
            // cspell:disable-next-line
            dbHost: { base64: 'ZGJIb3N0' },
            // cspell:disable-next-line
            dbPassword: { base64: 'ZGJQYXNzd29yZA==' },
          },
        },
      },
    ).as('getSecret2');

    // Navigate to edit workspace page
    workspaces.visit();
    cy.wait('@getNamespaces');
    navBar.selectNamespace(mockNamespace.name);
    cy.wait('@getWorkspaces');

    // Click edit on the workspace
    workspaces.findAction({ action: 'edit', workspaceName: mockWorkspaceListItem.name }).click();
    cy.wait('@getWorkspace');

    // Navigate to properties step where secrets are visible
    cy.wait('@getWorkspaceKind');
    editWorkspace.clickNext(); // Skip workspace kind step
    editWorkspace.clickNext(); // Skip image step
    editWorkspace.clickNext(); // Skip pod config step, now on properties

    // Expand the Secrets section (it's collapsed by default)
    cy.contains('button', 'Secrets').click();
  });

  it('should display secret keys with masked values in expanded row', () => {
    // Expand the secret row to see key/value pairs
    secretsManagement.expandSecretRow('api-key-secret');
    cy.wait('@getSecret1');

    // Verify expanded row displays keys with masked values
    secretsManagement.assertExpandedRowContainsKeys('api-key-secret', ['username', 'password']);
    secretsManagement.assertExpandedRowValuesMasked('api-key-secret');
  });

  it('should display different contents for different secrets', () => {
    // Expand first secret
    secretsManagement.expandSecretRow('api-key-secret');
    cy.wait('@getSecret1');
    secretsManagement.assertExpandedRowContainsKeys('api-key-secret', ['username', 'password']);

    // Expand second secret
    secretsManagement.expandSecretRow('db-credentials');
    cy.wait('@getSecret2');
    secretsManagement.assertExpandedRowContainsKeys('db-credentials', ['dbHost', 'dbPassword']);
  });
});
