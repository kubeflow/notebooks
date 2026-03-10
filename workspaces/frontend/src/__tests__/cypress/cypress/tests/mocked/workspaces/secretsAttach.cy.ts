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
import { V1Beta1WorkspaceState } from '~/generated/data-contracts';

describe('SecretsAttachModal', () => {
  const mockNamespace = buildMockNamespace({ name: 'default' });
  const mockWorkspaceKindInfo = buildMockWorkspaceKindInfo({ name: 'jupyterlab' });
  const mockWorkspaceKindFull = buildMockWorkspaceKind({ name: 'jupyterlab' });

  const mockWorkspaceListItem = buildMockWorkspace({
    name: 'test-workspace',
    namespace: mockNamespace.name,
    workspaceKind: mockWorkspaceKindInfo,
    state: V1Beta1WorkspaceState.WorkspaceStateRunning,
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

    // Mock getSecret for each available secret (fetched lazily on row expand)
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
    cy.get('[aria-labelledby="basic-modal-title"]')
      .find('input[type="text"]')
      .first()
      .as('secretTypeahead');
    // eslint-disable-next-line cypress/unsafe-to-chain-command -- click after get is required; rule flags any .click() chain
    cy.get('@secretTypeahead').click();
    cy.contains('.pf-v6-c-menu__list-item', 'api-secret').click();
    cy.get('body').click(0, 0);

    // Mount path auto-fills to /secrets/api-secret; click Edit to change it
    cy.findByTestId('mount-path-edit').click();
    cy.findByTestId('mount-path-input').clear();
    cy.findByTestId('mount-path-input').type('/mnt/secrets');
    cy.findByTestId('mount-path-save').as('mountPathSave');
    // eslint-disable-next-line cypress/unsafe-to-chain-command -- click after get is required; rule flags any .click() chain
    cy.get('@mountPathSave').click();

    // Attach button in modal footer should be enabled
    cy.get('.pf-v6-c-modal-box__footer').contains('button', 'Attach').should('not.be.disabled');
    cy.get('.pf-v6-c-modal-box__footer').contains('button', 'Attach').click();

    // Verify secret appears in table
    cy.findByTestId('secrets-table').should('contain', 'api-secret');
    cy.findByTestId('secrets-table').should('contain', '/mnt/secrets');
  });

  it('should validate default mode input', () => {
    cy.contains('button', 'Attach Existing Secrets').click({ force: true });
    // eslint-disable-next-line @cspell/spellchecker
    cy.get('[aria-labelledby="basic-modal-title"]').should('be.visible');

    // Select secret using the typeahead input
    // eslint-disable-next-line @cspell/spellchecker
    cy.get('[aria-labelledby="basic-modal-title"]')
      .find('input[type="text"]')
      .first()
      .as('secretTypeahead2');
    // eslint-disable-next-line cypress/unsafe-to-chain-command -- click after get is required; rule flags any .click() chain
    cy.get('@secretTypeahead2').click();
    cy.contains('.pf-v6-c-menu__list-item', 'api-secret').click();
    cy.get('body').click(0, 0);
    cy.findByTestId('mount-path-edit').click();
    cy.findByTestId('mount-path-input').clear();
    cy.findByTestId('mount-path-input').type('/mnt/secrets');
    cy.findByTestId('mount-path-save').as('mountPathSave2');
    // eslint-disable-next-line cypress/unsafe-to-chain-command -- click after get is required; rule flags any .click() chain
    cy.get('@mountPathSave2').click();

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
