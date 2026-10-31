/* eslint-disable camelcase */
import yaml from 'js-yaml';
import { mockModArchResponse } from 'mod-arch-core';
import { createWorkspaceKind } from '~/__tests__/cypress/cypress/pages/workspaceKinds/createWorkspaceKind';
import { workspaceKinds } from '~/__tests__/cypress/cypress/pages/workspaceKinds/workspaceKinds';
import { NOTEBOOKS_API_VERSION } from '~/__tests__/cypress/cypress/support/commands/api';
import { FieldErrorType } from '~/generated/data-contracts';
import type { WorkspacekindsWorkspaceKindCreate } from '~/generated/data-contracts';
import {
  buildMockNamespace,
  buildMockWorkspaceKind,
  buildMockWorkspaceKindUpdate,
} from '~/shared/mock/mockBuilder';

const DEFAULT_NAMESPACE = 'default';

const VALID_WORKSPACE_KIND_FIXTURE = 'workspaceKinds/validWorkspaceKind.yaml';
const INVALID_WORKSPACE_KIND_FIXTURE = 'workspaceKinds/invalidWorkspaceKind.yaml';
const MISSING_DISPLAY_NAME_WORKSPACE_KIND_FIXTURE =
  'workspaceKinds/missingDisplayNameWorkspaceKind.yaml';

let validWorkspaceKindYaml: string;
let invalidWorkspaceKindYaml: string;
let missingDisplayNameWorkspaceKindYaml: string;

const setupCreateWorkspaceKindTest = () => {
  const mockNamespace = buildMockNamespace({ name: DEFAULT_NAMESPACE });

  cy.interceptApi(
    'GET /api/:apiVersion/namespaces',
    { path: { apiVersion: NOTEBOOKS_API_VERSION } },
    mockModArchResponse([mockNamespace]),
  ).as('getNamespaces');

  cy.interceptApi(
    'GET /api/:apiVersion/workspacekinds',
    { path: { apiVersion: NOTEBOOKS_API_VERSION } },
    mockModArchResponse([]),
  ).as('getWorkspaceKinds');

  cy.interceptApi(
    'GET /api/:apiVersion/workspaces/:namespace',
    { path: { apiVersion: NOTEBOOKS_API_VERSION, namespace: mockNamespace.name } },
    mockModArchResponse([]),
  ).as('getWorkspaces');

  cy.interceptApi(
    'GET /api/:apiVersion/workspaces',
    { path: { apiVersion: NOTEBOOKS_API_VERSION } },
    mockModArchResponse([]),
  ).as('getAllWorkspaces');

  return { mockNamespace };
};

// Deny the workspacekinds list request that the admin-route guard relies on. This is the
// only workspacekinds list intercept registered for the restricted-access test, so no
// earlier success mock can take precedence over the 403.
const setupForbiddenWorkspaceKindsTest = () => {
  const mockNamespace = buildMockNamespace({ name: DEFAULT_NAMESPACE });

  cy.interceptApi(
    'GET /api/:apiVersion/namespaces',
    { path: { apiVersion: NOTEBOOKS_API_VERSION } },
    mockModArchResponse([mockNamespace]),
  ).as('getNamespaces');

  cy.interceptApi(
    'GET /api/:apiVersion/workspacekinds',
    { path: { apiVersion: NOTEBOOKS_API_VERSION } },
    { error: { code: '403', message: 'Forbidden' } },
  ).as('getWorkspaceKindsForbidden');
};

describe('Create workspace kind', () => {
  before(() => {
    cy.fixture(VALID_WORKSPACE_KIND_FIXTURE).then((content) => {
      validWorkspaceKindYaml = content;
    });
    cy.fixture(INVALID_WORKSPACE_KIND_FIXTURE).then((content) => {
      invalidWorkspaceKindYaml = content;
    });
    cy.fixture(MISSING_DISPLAY_NAME_WORKSPACE_KIND_FIXTURE).then((content) => {
      missingDisplayNameWorkspaceKindYaml = content;
    });
  });

  describe('Basic', () => {
    beforeEach(() => {
      setupCreateWorkspaceKindTest();
    });

    it('should display the create workspace kind page', () => {
      createWorkspaceKind.visit();
      createWorkspaceKind.findPageTitle();
      createWorkspaceKind.assertUploadFileFieldExists();
      createWorkspaceKind.verifyPageURL();
    });

    it('submits uploaded pause rules without a probe and surfaces API validation errors', () => {
      const message = 'activityProbe must be configured when pause rules exist';
      cy.interceptApi(
        'POST /api/:apiVersion/workspacekinds',
        { path: { apiVersion: NOTEBOOKS_API_VERSION } },
        { error: { code: '422', message } },
      ).as('createWithoutProbe');
      const config = yaml.load(validWorkspaceKindYaml) as {
        spec: WorkspacekindsWorkspaceKindCreate;
      };
      config.spec.activityRules = [
        { config: { secondsSinceActive: 3600 }, effect: { pauseWorkspace: true } },
      ];
      createWorkspaceKind.visit();
      createWorkspaceKind.uploadYamlContent(yaml.dump(config));
      createWorkspaceKind.assertProbeDependencyError(false);
      createWorkspaceKind.assertSubmitButtonEnabled();
      createWorkspaceKind.clickSubmit();
      cy.wait('@createWithoutProbe');
      createWorkspaceKind.assertErrorAlertContainsMessage(message);
    });

    it('should cancel creation and navigate back to workspace kinds list', () => {
      createWorkspaceKind.visit();
      createWorkspaceKind.clickCancel();
      workspaceKinds.verifyPageURL();
    });

    it('should navigate back to workspace kinds list after successful creation', () => {
      cy.interceptApi(
        'POST /api/:apiVersion/workspacekinds',
        { path: { apiVersion: NOTEBOOKS_API_VERSION } },
        (() => {
          const kind = buildMockWorkspaceKind({
            name: 'test-workspace-kind',
            displayName: 'Test Workspace Kind',
          });
          const update = buildMockWorkspaceKindUpdate(kind);
          return mockModArchResponse({
            name: kind.name,
            podTemplate: update.podTemplate,
            spawner: update.spawner,
          });
        })(),
      ).as('createWorkspaceKind');

      createWorkspaceKind.visit();

      createWorkspaceKind.uploadYamlContent(validWorkspaceKindYaml);
      createWorkspaceKind.clickSubmit();
      cy.wait('@createWorkspaceKind');

      workspaceKinds.verifyPageURL();
    });

    it('should display error alert and not navigate away when creation fails', () => {
      cy.interceptApi(
        'POST /api/:apiVersion/workspacekinds',
        { path: { apiVersion: NOTEBOOKS_API_VERSION } },
        {
          error: {
            code: '500',
            message: 'Internal server error',
          },
        },
      ).as('createWorkspaceKindServerError');

      createWorkspaceKind.visit();

      createWorkspaceKind.uploadYamlContent(validWorkspaceKindYaml);
      createWorkspaceKind.clickSubmit();
      cy.wait('@createWorkspaceKindServerError');

      createWorkspaceKind.assertErrorAlertContainsMessage('Internal server error');

      createWorkspaceKind.verifyPageURL();
    });
  });

  describe('File Upload', () => {
    beforeEach(() => {
      setupCreateWorkspaceKindTest();
    });

    it('should successfully create a workspace kind with valid YAML', () => {
      cy.interceptApi(
        'POST /api/:apiVersion/workspacekinds',
        { path: { apiVersion: NOTEBOOKS_API_VERSION } },
        (() => {
          const kind = buildMockWorkspaceKind({
            name: 'test-workspace-kind',
            displayName: 'Test Workspace Kind',
            description: 'A test workspace kind for testing',
          });
          const update = buildMockWorkspaceKindUpdate(kind);
          return mockModArchResponse({
            name: kind.name,
            podTemplate: update.podTemplate,
            spawner: update.spawner,
          });
        })(),
      ).as('createWorkspaceKind');

      createWorkspaceKind.visit();

      createWorkspaceKind.uploadYamlContent(validWorkspaceKindYaml);

      createWorkspaceKind.assertSubmitButtonEnabled();
      createWorkspaceKind.clickSubmit();

      cy.wait('@createWorkspaceKind').then((interception) => {
        expect(interception.response?.statusCode).to.be.equal(200);
      });

      // Should navigate back to workspace kinds list
      workspaceKinds.verifyPageURL();
    });

    it('should display validation errors for invalid YAML', () => {
      cy.interceptApi(
        'POST /api/:apiVersion/workspacekinds',
        { path: { apiVersion: NOTEBOOKS_API_VERSION } },
        {
          error: {
            code: '400',
            message: 'Validation error',
            cause: {
              validation_errors: [
                {
                  field: 'metadata.name',
                  message: 'Name is required',
                  type: FieldErrorType.ErrorTypeRequired,
                },
              ],
            },
          },
        },
      ).as('createWorkspaceKindError');

      createWorkspaceKind.visit();

      createWorkspaceKind.uploadYamlContent(invalidWorkspaceKindYaml);
      createWorkspaceKind.clickSubmit();
      cy.wait('@createWorkspaceKindError').then((interception) => {
        expect(interception.response?.statusCode).to.be.equal(400);
      });
      createWorkspaceKind.assertErrorAlertContainsMessage('Name is required: metadata.name');
    });

    it('should display error for missing required fields', () => {
      cy.interceptApi(
        'POST /api/:apiVersion/workspacekinds',
        { path: { apiVersion: NOTEBOOKS_API_VERSION } },
        {
          error: {
            code: '400',
            message: 'Validation error',
            cause: {
              validation_errors: [
                {
                  field: 'spec.displayName',
                  message: 'Display name is required',
                  type: FieldErrorType.ErrorTypeRequired,
                },
              ],
            },
          },
        },
      ).as('createWorkspaceKindMissingField');

      createWorkspaceKind.visit();

      createWorkspaceKind.uploadYamlContent(missingDisplayNameWorkspaceKindYaml);
      createWorkspaceKind.clickSubmit();
      cy.wait('@createWorkspaceKindMissingField').then((interception) => {
        expect(interception.response?.statusCode).to.be.equal(400);
      });
      createWorkspaceKind.assertErrorAlertContainsMessage(
        'Display name is required: spec.displayName',
      );
    });

    it('should disable submit button when YAML is empty', () => {
      createWorkspaceKind.visit();
      createWorkspaceKind.assertSubmitButtonDisabled();
      createWorkspaceKind.uploadYamlContent(validWorkspaceKindYaml);
      createWorkspaceKind.assertSubmitButtonEnabled();
      createWorkspaceKind.clearYamlContent();
      createWorkspaceKind.assertSubmitButtonDisabled();
    });

    it('should enable submit button when YAML content is provided', () => {
      createWorkspaceKind.visit();
      createWorkspaceKind.uploadYamlContent(validWorkspaceKindYaml);
      createWorkspaceKind.assertSubmitButtonEnabled();
    });

    it('should clear validation errors when content is modified', () => {
      cy.interceptApi(
        'POST /api/:apiVersion/workspacekinds',
        { path: { apiVersion: NOTEBOOKS_API_VERSION } },
        {
          error: {
            code: '400',
            message: 'Validation error',
            cause: {
              validation_errors: [
                {
                  field: 'metadata.name',
                  message: 'Name is required',
                  type: FieldErrorType.ErrorTypeRequired,
                },
              ],
            },
          },
        },
      ).as('createWorkspaceKindError');
      createWorkspaceKind.visit();
      createWorkspaceKind.uploadYamlContent(invalidWorkspaceKindYaml);
      createWorkspaceKind.clickSubmit();
      cy.wait('@createWorkspaceKindError');
      createWorkspaceKind.assertErrorAlertContainsMessage('Name is required: metadata.name');
      createWorkspaceKind.uploadYamlContent(validWorkspaceKindYaml);
    });
    it('should display structured 422 validation errors as a list in the error toast', () => {
      cy.interceptApi(
        'POST /api/:apiVersion/workspacekinds',
        { path: { apiVersion: NOTEBOOKS_API_VERSION } },
        {
          error: {
            code: '422',
            message: 'request body was invalid',
            cause: {
              validation_errors: [
                {
                  field: 'spec.spawner.displayName',
                  message: "Missing required 'spec.spawner.displayName' property",
                  type: FieldErrorType.ErrorTypeRequired,
                },
                {
                  field: 'spec.spawner.xyz',
                  message: "Unknown property 'spec.spawner.xyz'",
                  type: FieldErrorType.ErrorTypeInvalid,
                },
              ],
            },
          },
        },
      ).as('createWorkspaceKind422Error');
      createWorkspaceKind.visit();
      createWorkspaceKind.uploadYamlContent(invalidWorkspaceKindYaml);
      createWorkspaceKind.clickSubmit();
      cy.wait('@createWorkspaceKind422Error');
      createWorkspaceKind.assertErrorAlertContainsMessage(
        "spec.spawner.displayName: Missing required 'spec.spawner.displayName' property",
      );
      createWorkspaceKind.assertErrorAlertContainsMessage(
        "spec.spawner.xyz: Unknown property 'spec.spawner.xyz'",
      );
    });
  });

  describe('Restricted access', () => {
    beforeEach(() => {
      setupForbiddenWorkspaceKindsTest();
    });

    it('shows the restricted-access message and hides the form on a forbidden list request', () => {
      // Navigate directly rather than via createWorkspaceKind.visit(), whose helper waits for
      // the form page title that never renders when access is denied.
      cy.visit('/workspacekinds/create');

      cy.wait('@getWorkspaceKindsForbidden').its('response.statusCode').should('eq', 403);

      cy.findByTestId('workspace-kinds-access-empty-state').should('be.visible');
      cy.contains('WorkspaceKind management is restricted to administrators').should('be.visible');

      createWorkspaceKind.findUploadFileField().should('not.exist');
      createWorkspaceKind.findSubmitButton().should('not.exist');
      cy.findByTestId('app-page-title').should('not.exist');
    });
  });
});
