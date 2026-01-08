import { mockModArchResponse } from 'mod-arch-core';
import { editWorkspace } from '~/__tests__/cypress/cypress/pages/workspaces/editWorkspace';
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
import { WorkspacesWorkspaceState } from '~/generated/data-contracts';

describe('SecretsAttachModal', () => {
  const mockNamespace = buildMockNamespace({ name: 'default' });
  const mockWorkspaceKindInfo = buildMockWorkspaceKindInfo({ name: 'jupyterlab' });
  const mockWorkspaceKindFull = buildMockWorkspaceKind({ name: 'jupyterlab' });

  const mockWorkspaceListItem = buildMockWorkspace({
    name: 'test-workspace',
    namespace: mockNamespace.name,
    workspaceKind: mockWorkspaceKindInfo,
    state: WorkspacesWorkspaceState.WorkspaceStateRunning,
  });
  mockWorkspaceListItem.podTemplate.volumes.secrets = [];

  const mockWorkspaceUpdate = buildMockWorkspaceUpdateFromWorkspace({
    workspace: mockWorkspaceListItem,
  });

  const mockSecrets = [
    buildMockSecret({ name: 'api-secret', canMount: true }),
    buildMockSecret({ name: 'db-secret', canMount: true }),
    buildMockSecret({ name: 'unmountable-secret', canMount: false }),
  ];

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

    cy.intercept(
      'GET',
      `/api/${NOTEBOOKS_API_VERSION}/workspaces/${mockNamespace.name}/${mockWorkspaceListItem.name}`,
      mockModArchResponse(mockWorkspaceUpdate),
    ).as('getWorkspace');

    cy.intercept(
      'GET',
      `/api/${NOTEBOOKS_API_VERSION}/workspacekinds/${mockWorkspaceKindInfo.name}`,
      mockModArchResponse(mockWorkspaceKindFull),
    ).as('getWorkspaceKind');

    cy.intercept('GET', `/api/${NOTEBOOKS_API_VERSION}/secrets/${mockNamespace.name}`, {
      data: mockSecrets,
    }).as('listSecrets');

    // Mock getSecret for each available secret (SecretsViewPopover fetches on mount)
    mockSecrets.forEach((secret) => {
      cy.intercept(
        'GET',
        `/api/${NOTEBOOKS_API_VERSION}/secrets/${mockNamespace.name}/${secret.name}`,
        {
          data: {
            name: secret.name,
            type: secret.type,
            immutable: secret.immutable,
            contents: {
              key1: { base64: 'dmFsdWUx' }, // base64 for 'value1'
            },
          },
        },
      ).as(`getSecret-${secret.name}`);
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
    cy.contains('button', 'Secrets').click();
    cy.wait('@listSecrets'); // Wait for secrets to load after expanding section
  });

  it('should open attach modal and attach a secret', () => {
    cy.contains('button', 'Attach Existing Secrets').click({ force: true });
    // eslint-disable-next-line @cspell/spellchecker
    cy.get('[aria-labelledby="basic-modal-title"]').should('be.visible');

    // Select secret using the typeahead input
    // eslint-disable-next-line @cspell/spellchecker
    cy.get('[aria-labelledby="basic-modal-title"]').find('input[type="text"]').first().click();
    cy.contains('.pf-v6-c-menu__list-item', 'api-secret').click();
    cy.get('body').click(0, 0);

    // Fill mount path
    cy.get('#mount-path').type('/mnt/secrets');

    // Attach button in modal footer should be enabled
    cy.get('.pf-v6-c-modal-box__footer')
      .contains('button', 'Attach')
      .should('not.be.disabled')
      .click();

    // Verify secret appears in table
    cy.get('table[aria-label="Secrets Table"]').should('contain', 'api-secret');
    cy.get('table[aria-label="Secrets Table"]').should('contain', '/mnt/secrets');
  });

  it('should validate default mode input', () => {
    cy.contains('button', 'Attach Existing Secrets').click({ force: true });
    // eslint-disable-next-line @cspell/spellchecker
    cy.get('[aria-labelledby="basic-modal-title"]').should('be.visible');

    // Select secret using the typeahead input
    // eslint-disable-next-line @cspell/spellchecker
    cy.get('[aria-labelledby="basic-modal-title"]').find('input[type="text"]').first().click();
    cy.contains('.pf-v6-c-menu__list-item', 'api-secret').click();
    cy.get('body').click(0, 0);
    cy.get('#mount-path').type('/mnt/secrets');

    // Enter invalid mode
    cy.get('#default-mode').clear();
    cy.get('#default-mode').type('999');
    cy.contains('Must be a valid UNIX file system permission value').should('be.visible');
    cy.get('.pf-v6-c-modal-box__footer').contains('button', 'Attach').should('be.disabled');

    // Enter valid mode
    cy.get('#default-mode').clear();
    cy.get('#default-mode').type('755');
    cy.contains('Must be a valid UNIX file system permission value').should('not.exist');
    cy.get('.pf-v6-c-modal-box__footer').contains('button', 'Attach').should('not.be.disabled');
  });

  it('should disable unmountable secrets', () => {
    cy.contains('button', 'Attach Existing Secrets').click({ force: true });
    // eslint-disable-next-line @cspell/spellchecker
    cy.get('[aria-labelledby="basic-modal-title"]').should('be.visible');

    // Open the secret dropdown
    // eslint-disable-next-line @cspell/spellchecker
    cy.get('[aria-labelledby="basic-modal-title"]').find('input[type="text"]').first().click();

    // Unmountable secret should be disabled (has pf-m-disabled class)
    cy.contains('.pf-v6-c-menu__list-item', 'unmountable-secret').should(
      'have.class',
      'pf-m-disabled',
    );
  });
});
