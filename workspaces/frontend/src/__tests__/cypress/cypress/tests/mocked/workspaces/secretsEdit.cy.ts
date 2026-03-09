import { mockModArchResponse } from 'mod-arch-core';
import { editWorkspace } from '~/__tests__/cypress/cypress/pages/workspaces/editWorkspace';
import {
  secretsManagement,
  secretsModal,
} from '~/__tests__/cypress/cypress/pages/workspaces/secretsManagement';
import { workspaces } from '~/__tests__/cypress/cypress/pages/workspaces/workspaces';
import { NOTEBOOKS_API_VERSION } from '~/__tests__/cypress/cypress/support/commands/api';
import {
  buildMockNamespace,
  buildMockSecret,
  buildMockWorkspace,
  buildMockWorkspaceKind,
  buildMockWorkspaceKindInfo,
  buildMockWorkspaceUpdateFromWorkspace,
} from '~/shared/mock/mockBuilder';
import { navBar } from '~/__tests__/cypress/cypress/pages/components/navBar';
import { V1Beta1WorkspaceState } from '~/generated/data-contracts';

describe('Edit Secret Modal', () => {
  const mockNamespace = buildMockNamespace({ name: 'default' });
  const mockWorkspaceKindInfo = buildMockWorkspaceKindInfo({ name: 'jupyterlab' });
  const mockWorkspaceKindFull = buildMockWorkspaceKind({ name: 'jupyterlab' });

  const mockWorkspaceListItem = buildMockWorkspace({
    name: 'test-workspace',
    namespace: mockNamespace.name,
    workspaceKind: mockWorkspaceKindInfo,
    state: V1Beta1WorkspaceState.WorkspaceStateRunning,
  });

  // Add a secret to the workspace
  mockWorkspaceListItem.podTemplate.volumes.secrets = [
    { secretName: 'test-secret', mountPath: '/mnt/secrets', defaultMode: 420 },
  ];

  const mockWorkspaceUpdate = buildMockWorkspaceUpdateFromWorkspace({
    workspace: mockWorkspaceListItem,
  });

  const mockSecrets = [
    buildMockSecret({ name: 'test-secret', canMount: true, canUpdate: true, immutable: false }),
    buildMockSecret({
      name: 'immutable-secret',
      canMount: true,
      canUpdate: false,
      immutable: true,
    }),
  ];

  const mockSecretContents = {
    'test-secret': {
      type: 'Opaque',
      immutable: false,
      contents: {
        apiKey: { base64: btoa('my-api-key') },
        username: { base64: btoa('admin') },
      },
    },
    'immutable-secret': {
      type: 'Opaque',
      immutable: true,
      contents: {
        token: { base64: btoa('secret-token') },
      },
    },
  };

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

    cy.interceptApi(
      'GET /api/:apiVersion/workspaces/:namespace/:workspaceName',
      {
        path: {
          apiVersion: NOTEBOOKS_API_VERSION,
          namespace: mockNamespace.name,
          workspaceName: mockWorkspaceListItem.name,
        },
      },
      mockModArchResponse(mockWorkspaceUpdate),
    ).as('getWorkspace');

    cy.interceptApi(
      'GET /api/:apiVersion/workspacekinds/:kind',
      { path: { apiVersion: NOTEBOOKS_API_VERSION, kind: mockWorkspaceKindInfo.name } },
      mockModArchResponse(mockWorkspaceKindFull),
    ).as('getWorkspaceKind');

    cy.interceptApi(
      'GET /api/:apiVersion/secrets/:namespace',
      { path: { apiVersion: NOTEBOOKS_API_VERSION, namespace: mockNamespace.name } },
      { data: mockSecrets },
    ).as('listSecrets');

    // Mock getSecret for each secret
    Object.entries(mockSecretContents).forEach(([name, data]) => {
      cy.interceptApi(
        'GET /api/:apiVersion/secrets/:namespace/:secretName',
        {
          path: {
            apiVersion: NOTEBOOKS_API_VERSION,
            namespace: mockNamespace.name,
            secretName: name,
          },
        },
        { data },
      ).as(`getSecret-${name}`);
    });

    // Navigate to edit workspace properties step
    workspaces.visit();
    cy.wait('@getNamespaces');
    navBar.selectNamespace(mockNamespace.name);
    cy.wait('@getWorkspaces');
    workspaces.findAction({ action: 'edit', workspaceName: mockWorkspaceListItem.name }).click();
    cy.wait('@getWorkspace');
    cy.wait('@getWorkspaceKind');
    editWorkspace.clickNext();
    editWorkspace.clickNext();
    editWorkspace.clickNext();
    secretsManagement.expandSecretsSection();
    cy.wait('@listSecrets');
  });

  it('should open edit modal with pre-populated fields when clicking edit', () => {
    // Open edit modal
    secretsManagement.openEditModal('test-secret');
    cy.wait('@getSecret-test-secret');

    // Verify modal is in edit mode
    secretsModal.assertModalVisible();
    secretsModal.assertEditMode();

    // Verify name is pre-populated and disabled
    secretsModal.findSecretNameInput().should('have.value', 'test-secret');
    secretsModal.findSecretNameInput().should('be.disabled');

    // Verify permissions labels are shown
    secretsModal.findCanMountLabel().should('contain', 'Can mount');
    secretsModal.findCanUpdateLabel().should('contain', 'Can update');

    // Verify immutable toggle is shown and not checked
    secretsModal.findImmutableSwitch().should('not.be.checked');

    // Verify key-value pairs are loaded
    secretsModal.findKeyInput().first().should('have.value', 'apiKey');
  });

  it('should update secret via API when saving changes', () => {
    // Mock the update API
    cy.interceptApi(
      'PUT /api/:apiVersion/secrets/:namespace/:secretName',
      {
        path: {
          apiVersion: NOTEBOOKS_API_VERSION,
          namespace: mockNamespace.name,
          secretName: 'test-secret',
        },
      },
      { data: mockSecretContents['test-secret'] },
    ).as('updateSecret');

    // Open edit modal
    secretsManagement.openEditModal('test-secret');
    cy.wait('@getSecret-test-secret');

    // Toggle immutable
    secretsModal.toggleImmutable();

    // Click Save
    secretsModal.findSubmitButton().click();

    // Verify API was called
    cy.wait('@updateSecret').then((interception) => {
      expect(interception.request.body.immutable).to.equal(true);
      expect(interception.request.body.type).to.equal('Opaque');
    });
  });

  it('should disable edit action for immutable secrets', () => {
    // Create a workspace with immutable secret attached
    const workspaceWithImmutableSecret = buildMockWorkspace({
      name: 'test-workspace',
      namespace: mockNamespace.name,
      workspaceKind: mockWorkspaceKindInfo,
      state: V1Beta1WorkspaceState.WorkspaceStateRunning,
    });
    workspaceWithImmutableSecret.podTemplate.volumes.secrets = [
      { secretName: 'immutable-secret', mountPath: '/mnt/immutable', defaultMode: 420 },
    ];

    // Re-intercept getWorkspaces with updated workspace data
    cy.interceptApi(
      'GET /api/:apiVersion/workspaces/:namespace',
      { path: { apiVersion: NOTEBOOKS_API_VERSION, namespace: mockNamespace.name } },
      mockModArchResponse([workspaceWithImmutableSecret]),
    ).as('getWorkspacesImmutable');

    // Re-intercept getWorkspace with updated workspace data
    const updatedWorkspace = buildMockWorkspaceUpdateFromWorkspace({
      workspace: workspaceWithImmutableSecret,
    });
    cy.interceptApi(
      'GET /api/:apiVersion/workspaces/:namespace/:workspaceName',
      {
        path: {
          apiVersion: NOTEBOOKS_API_VERSION,
          namespace: mockNamespace.name,
          workspaceName: workspaceWithImmutableSecret.name,
        },
      },
      mockModArchResponse(updatedWorkspace),
    ).as('getWorkspace');

    // Re-intercept listSecrets with a fresh alias
    cy.interceptApi(
      'GET /api/:apiVersion/secrets/:namespace',
      { path: { apiVersion: NOTEBOOKS_API_VERSION, namespace: mockNamespace.name } },
      { data: mockSecrets },
    ).as('listSecretsImmutable');

    // Re-visit the page with fresh intercepts for this test
    workspaces.visit();
    cy.wait('@getNamespaces');
    navBar.selectNamespace(mockNamespace.name);
    cy.wait('@getWorkspacesImmutable');
    workspaces
      .findAction({ action: 'edit', workspaceName: workspaceWithImmutableSecret.name })
      .click();
    cy.wait('@getWorkspace');
    cy.wait('@getWorkspaceKind');
    editWorkspace.clickNext();
    editWorkspace.clickNext();
    editWorkspace.clickNext();
    secretsManagement.expandSecretsSection();
    cy.wait('@listSecretsImmutable');

    // Open kebab menu for immutable secret
    secretsManagement.clickKebabMenu('immutable-secret');

    // Verify Edit action is disabled for immutable secrets
    secretsManagement.findEditAction('immutable-secret').should('have.class', 'pf-m-aria-disabled');
  });

  it('should show Cannot update label for secrets without update permission', () => {
    // Modify mock to have canUpdate: false
    const secretWithoutUpdate = buildMockSecret({
      name: 'no-update-secret',
      canMount: true,
      canUpdate: false,
      immutable: false,
    });

    cy.interceptApi(
      'GET /api/:apiVersion/secrets/:namespace',
      { path: { apiVersion: NOTEBOOKS_API_VERSION, namespace: mockNamespace.name } },
      { data: [...mockSecrets, secretWithoutUpdate] },
    ).as('listSecretsUpdated');

    // Add this secret to workspace and re-visit the page
    mockWorkspaceListItem.podTemplate.volumes.secrets = [
      { secretName: 'no-update-secret', mountPath: '/mnt/no-update', defaultMode: 420 },
    ];

    // Re-intercept getWorkspace with updated workspace data
    const updatedWorkspace = buildMockWorkspaceUpdateFromWorkspace({
      workspace: mockWorkspaceListItem,
    });
    cy.interceptApi(
      'GET /api/:apiVersion/workspaces/:namespace/:workspaceName',
      {
        path: {
          apiVersion: NOTEBOOKS_API_VERSION,
          namespace: mockNamespace.name,
          workspaceName: mockWorkspaceListItem.name,
        },
      },
      mockModArchResponse(updatedWorkspace),
    ).as('getWorkspace');

    workspaces.visit();
    cy.wait('@getNamespaces');
    navBar.selectNamespace(mockNamespace.name);
    cy.wait('@getWorkspaces');
    workspaces.findAction({ action: 'edit', workspaceName: mockWorkspaceListItem.name }).click();
    cy.wait('@getWorkspace');
    cy.wait('@getWorkspaceKind');
    editWorkspace.clickNext();
    editWorkspace.clickNext();
    editWorkspace.clickNext();
    secretsManagement.expandSecretsSection();
    cy.wait('@listSecretsUpdated');

    // Open kebab menu for secret without update permission
    secretsManagement.clickKebabMenu('no-update-secret');

    // Edit action is disabled when canUpdate is false (modal is not opened)
    secretsManagement.findEditAction('no-update-secret').should('have.class', 'pf-m-aria-disabled');
  });
});
