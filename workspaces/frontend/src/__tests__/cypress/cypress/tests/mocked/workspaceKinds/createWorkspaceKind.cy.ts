/* eslint-disable camelcase */
import { mockModArchResponse } from 'mod-arch-core';
import { createWorkspaceKind } from '~/__tests__/cypress/cypress/pages/workspaceKinds/createWorkspaceKind';
import { workspaceKinds } from '~/__tests__/cypress/cypress/pages/workspaceKinds/workspaceKinds';
import { NOTEBOOKS_API_VERSION } from '~/__tests__/cypress/cypress/support/commands/api';
import { FieldErrorType } from '~/generated/data-contracts';
import { buildMockNamespace, buildMockWorkspaceKind } from '~/shared/mock/mockBuilder';

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

    it('should cancel creation and navigate back to workspace kinds list', () => {
      createWorkspaceKind.visit();
      createWorkspaceKind.clickCancel();
      workspaceKinds.verifyPageURL();
    });

    it('should navigate back to workspace kinds list after successful creation', () => {
      cy.interceptApi(
        'POST /api/:apiVersion/workspacekinds',
        { path: { apiVersion: NOTEBOOKS_API_VERSION } },
        mockModArchResponse(
          buildMockWorkspaceKind({
            name: 'test-workspace-kind',
            displayName: 'Test Workspace Kind',
          }),
        ),
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

      createWorkspaceKind.assertErrorAlertContainsMessage('Error: Internal server error');

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
        mockModArchResponse(
          buildMockWorkspaceKind({
            name: 'test-workspace-kind',
            displayName: 'Test Workspace Kind',
            description: 'A test workspace kind for testing',
          }),
        ),
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
  });
});
