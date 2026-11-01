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
  buildMockSecretResponse,
  buildMockWorkspace,
  buildMockWorkspaceKind,
  buildMockWorkspaceKindInfo,
  buildMockWorkspaceUpdateFromWorkspace,
} from '~/shared/mock/mockBuilder';
import { navBar } from '~/__tests__/cypress/cypress/pages/components/navBar';
import { interceptListValues } from '~/__tests__/cypress/cypress/utils/testBuilders';
import {
  V1Beta1WorkspaceState,
  V1SecretType,
  type SecretsSecretUpdate,
} from '~/generated/data-contracts';

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

  const testSecrets = ['test-secret', 'immutable-secret', 'no-update-secret', 'missing-secret'].map(
    (secretName) => ({ secretName, mountPath: `/mnt/${secretName}`, defaultMode: 420 }),
  );

  const mockWorkspaceUpdate = buildMockWorkspaceUpdateFromWorkspace({
    workspace: mockWorkspaceListItem,
    volumes: { secrets: testSecrets },
  });

  const mockSecrets = [
    buildMockSecret({ name: 'test-secret', canMount: true, canUpdate: true }),
    buildMockSecret({ name: 'immutable-secret', canMount: true, canUpdate: true }),
    buildMockSecret({ name: 'no-update-secret', canMount: true, canUpdate: false }),
  ];

  const mockSecretContents: Record<string, SecretsSecretUpdate> = {
    'test-secret': buildMockSecretResponse({ contents: { apiKey: {}, username: {} } }),
    'immutable-secret': buildMockSecretResponse({ immutable: true, contents: { token: {} } }),
  };
  const secretPath = {
    apiVersion: NOTEBOOKS_API_VERSION,
    namespace: mockNamespace.name,
    secretName: 'test-secret',
  };
  const openEditor = () => {
    secretsManagement.openEditModal('test-secret');
    cy.wait('@getSecret-test-secret');
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
      'GET /api/:apiVersion/workspacekinds',
      { path: { apiVersion: NOTEBOOKS_API_VERSION } },
      mockModArchResponse([mockWorkspaceKindFull]),
    ).as('getWorkspaceKinds');
    interceptListValues(mockWorkspaceKindFull);

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

    cy.interceptApi(
      'PUT /api/:apiVersion/secrets/:namespace/:secretName',
      { path: secretPath },
      { data: mockSecretContents['test-secret'] },
    ).as('updateSecret');

    // Navigate to edit workspace properties step
    workspaces.visit();
    cy.wait('@getNamespaces');
    navBar.selectNamespace(mockNamespace.name);
    cy.wait('@getWorkspaces');
    workspaces.clickEditAction(mockWorkspaceListItem.name);
    cy.wait('@getWorkspace');
    cy.wait('@getWorkspaceKinds');
    editWorkspace.clickNext();
    editWorkspace.advancePastRedirectModal();
    editWorkspace.advancePastRedirectModal();
    cy.wait('@listSecrets');
  });

  it('shows undisclosed values with fixed existing key names', () => {
    openEditor();
    secretsModal.assertModalVisible();
    secretsModal.assertEditMode();
    secretsModal.findSecretNameInput().should('have.value', 'test-secret').and('be.disabled');
    secretsModal.findCanMountLabel().should('contain', 'Can mount');
    secretsModal.findCanUpdateLabel().should('contain', 'Can update');
    secretsModal.findImmutableSwitch().should('not.be.checked');
    secretsModal.findKeyInput().first().should('have.value', 'apiKey').and('have.attr', 'readonly');
    secretsModal.assertUndisclosed(2);
    secretsModal.capture('secret-editor-loaded');
  });

  it('saves unchanged redacted keys without sending replacement values', () => {
    openEditor();
    secretsModal.save();
    cy.wait('@updateSecret').then(({ request }) => {
      expect(request.body.data).to.deep.equal({
        type: 'Opaque',
        immutable: false,
        contents: { apiKey: {}, username: {} },
      });
    });
    secretsModal.assertClosed();
  });

  [1920, 1024, 768].forEach((width) => {
    it(`aligns replacement controls at ${width}px and preserves the other undisclosed key`, () => {
      secretsModal.resizeViewport(width);
      openEditor();
      secretsModal.replaceValue({ index: 0, value: 'synthetic-replacement' });
      secretsModal.assertReplacementControlsAligned(0);
      secretsModal.capture(`secret-editor-replacement-${width}`);
      secretsModal.save();
      cy.wait('@updateSecret').then(({ request }) => {
        expect(request.body.data.contents).to.deep.equal({
          apiKey: { base64: btoa('synthetic-replacement') },
          username: {},
        });
      });
      secretsModal.assertClosed();
    });
  });

  it('can mark a mutable secret immutable without replacing undisclosed values', () => {
    openEditor();
    secretsModal.enableImmutable();
    secretsModal.save();
    cy.wait('@updateSecret').then(({ request }) => {
      expect(request.body.data).to.deep.equal({
        type: 'Opaque',
        immutable: true,
        contents: { apiKey: {}, username: {} },
      });
    });
    secretsModal.assertClosed();
  });

  it('deletes a key by omitting it from the update', () => {
    openEditor();
    secretsModal.deleteKey(1);
    secretsModal.capture('secret-editor-deletion');
    secretsModal.save();
    cy.wait('@updateSecret').then(({ request }) => {
      expect(request.body.data.contents).to.deep.equal({ apiKey: {} });
    });
  });

  it('permits deleting the last existing key', () => {
    openEditor();
    secretsModal.deleteKey(1);
    secretsModal.deleteKey(0);
    secretsModal.save();
    cy.wait('@updateSecret').then(({ request }) => {
      expect(request.body.data.contents).to.deep.equal({});
    });
  });

  it('encodes Unicode replacements as UTF-8 bytes', () => {
    openEditor();
    secretsModal.replaceValue({ index: 0, value: '日本語🔑 café' });
    secretsModal.save();
    cy.wait('@updateSecret').then(({ request }) => {
      expect(request.body.data.contents).to.deep.equal({
        apiKey: { base64: '5pel5pys6Kqe8J+UkSBjYWbDqQ==' },
        username: {},
      });
    });
    secretsModal.assertClosed();
  });

  it('can discard replacement text and keep the existing value', () => {
    openEditor();
    secretsModal.replaceValue({ index: 0, value: 'discarded-synthetic-text' });
    secretsModal.keepValue(0);
    secretsModal.assertUndisclosed(2);
    secretsModal.save();
    cy.wait('@updateSecret').then(({ request }) => {
      expect(request.body.data.contents).to.deep.equal({ apiKey: {}, username: {} });
    });
  });

  it('preserves the type returned by the API', () => {
    cy.interceptApi(
      'GET /api/:apiVersion/secrets/:namespace/:secretName',
      { path: secretPath },
      {
        data: buildMockSecretResponse({
          type: V1SecretType.SecretTypeSSHAuth,
          contents: { 'ssh-privatekey': {} },
        }),
      },
    ).as('getSecret-test-secret');
    openEditor();
    secretsModal.assertType('kubernetes.io/ssh-auth');
    secretsModal.save();
    cy.wait('@updateSecret').then(({ request }) => {
      expect(request.body.data).to.deep.equal({
        type: 'kubernetes.io/ssh-auth',
        immutable: false,
        contents: { 'ssh-privatekey': {} },
      });
    });
  });

  it('keeps immutable resources read-only even when canUpdate is true', () => {
    secretsManagement.openEditModal('immutable-secret');
    cy.wait('@getSecret-immutable-secret');
    secretsModal.findCanUpdateLabel().should('contain.text', 'Can update');
    secretsModal.findImmutableSwitch().should('be.checked');
    secretsModal.assertNotEditable();
  });

  it('disables Edit when the API denies updates', () => {
    secretsManagement.clickKebabMenu('no-update-secret');
    secretsManagement.findEditAction('no-update-secret').should('have.class', 'pf-m-aria-disabled');
    secretsModal.assertClosed();
  });

  it('disables Edit when permission metadata is missing', () => {
    secretsManagement.clickKebabMenu('missing-secret');
    secretsManagement.findEditAction('missing-secret').should('have.class', 'pf-m-aria-disabled');
    secretsModal.assertClosed();
  });

  it('allows correction and retry after a failed save without overwriting untouched keys', () => {
    cy.interceptApi(
      'PUT /api/:apiVersion/secrets/:namespace/:secretName',
      { path: secretPath },
      { error: { code: '409', message: 'Secret was modified' } },
    ).as('updateSecretError');
    openEditor();
    secretsModal.save();
    cy.wait('@updateSecretError').then(({ request }) => {
      expect(request.body.data.contents).to.deep.equal({ apiKey: {}, username: {} });
    });
    secretsModal.findErrorAlert().should('contain.text', 'Request failed with status code 409');
    secretsModal.assertErrorAlertInFooter();
    secretsModal.capture('secret-editor-save-error');
    cy.interceptApi(
      'PUT /api/:apiVersion/secrets/:namespace/:secretName',
      { path: secretPath },
      { data: mockSecretContents['test-secret'] },
    ).as('updateSecret');
    secretsModal.replaceValue({ index: 0, value: 'corrected-synthetic-text' });
    secretsModal.findErrorAlert().should('not.exist');
    secretsModal.save();
    cy.wait('@updateSecret').then(({ request }) => {
      expect(request.body.data.contents).to.deep.equal({
        apiKey: { base64: btoa('corrected-synthetic-text') },
        username: {},
      });
    });
    secretsModal.assertClosed();
  });

  it('discards unsaved replacement text when reopened', () => {
    openEditor();
    secretsModal.replaceValue({ index: 0, value: 'discarded-synthetic-text' });
    secretsModal.cancel();
    secretsModal.assertClosed();
    openEditor();
    secretsModal.assertUndisclosed(2);
  });
});
