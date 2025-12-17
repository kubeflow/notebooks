import { mockModArchResponse } from 'mod-arch-core';
import { createWorkspace } from '~/__tests__/cypress/cypress/pages/workspaces/createWorkspace';
import { workspaces } from '~/__tests__/cypress/cypress/pages/workspaces/workspaces';
import { NOTEBOOKS_API_VERSION } from '~/__tests__/cypress/cypress/support/commands/api';
import {
  buildMockNamespace,
  buildMockOptionInfo,
  buildMockWorkspace,
  buildMockWorkspaceKind,
  buildMockWorkspaceKindInfo,
} from '~/shared/mock/mockBuilder';
import { navBar } from '~/__tests__/cypress/cypress/pages/components/navBar';
import type {
  WorkspacekindsImageConfigValue,
  WorkspacekindsPodConfigValue,
} from '~/generated/data-contracts';

const STEP_NAMES = {
  KIND: 'Workspace Kind',
  IMAGE: 'Image',
  POD_CONFIG: 'Pod Config',
  PROPERTIES: 'Properties',
} as const;

// Helper functions
const navigateToCreateWorkspace = (): void => {
  createWorkspace.visit();
  cy.wait('@getWorkspaceKinds');
};

const selectWorkspaceKind = (kindName: string): void => {
  createWorkspace.selectKind(kindName);
  createWorkspace.assertKindSelected(kindName);
  createWorkspace.clickNext();
};

const selectImage = (imageId: string): void => {
  createWorkspace.selectImage(imageId);
  createWorkspace.assertImageSelected(imageId);
  createWorkspace.clickNext();
};

const selectPodConfig = (podConfigId: string): void => {
  createWorkspace.selectPodConfig(podConfigId);
  createWorkspace.assertPodConfigSelected(podConfigId);
  createWorkspace.clickNext();
};

const buildMockImageConfigValue = (
  id: string,
  displayName: string,
  description: string,
): WorkspacekindsImageConfigValue => ({
  id,
  displayName,
  description,
  labels: [],
  hidden: false,
});

const buildMockPodConfigValue = (
  id: string,
  displayName: string,
  description: string,
): WorkspacekindsPodConfigValue => ({
  id,
  displayName,
  description,
  labels: [],
  hidden: false,
});

const completeAllStepsToProperties = (
  kindName: string,
  imageId: string,
  podConfigId: string,
): void => {
  navigateToCreateWorkspace();
  selectWorkspaceKind(kindName);
  selectImage(imageId);
  selectPodConfig(podConfigId);
};

describe('Create workspace', () => {
  const mockNamespace = buildMockNamespace({ name: 'default' });
  const mockWorkspaces = [buildMockWorkspace({})];
  const mockWorkspaceKind = buildMockWorkspaceKind();
  const mockImage = buildMockOptionInfo({
    id: 'jupyterlab_scipy_200',
    displayName: 'jupyter-scipy:v2.0.0',
  });
  const mockPodConfig = buildMockOptionInfo({
    id: 'tiny_cpu',
    displayName: 'Tiny CPU',
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
      mockModArchResponse(mockWorkspaces),
    ).as('getWorkspaces');

    cy.interceptApi(
      'GET /api/:apiVersion/workspacekinds',
      { path: { apiVersion: NOTEBOOKS_API_VERSION } },
      mockModArchResponse([mockWorkspaceKind]),
    ).as('getWorkspaceKinds');

    workspaces.visit();
    cy.wait('@getNamespaces');

    navBar.selectNamespace(mockNamespace.name);
    cy.wait('@getWorkspaces');
  });

  describe('Basic', () => {
    it('should navigate through all steps to create a workspace', () => {
      workspaces.findCreateWorkspaceButton().click();
      createWorkspace.verifyPageURL();
      cy.wait('@getWorkspaceKinds');

      // Step 1: Select Kind
      createWorkspace.assertProgressStepVisible(STEP_NAMES.KIND);
      createWorkspace.assertNextButtonDisabled();
      createWorkspace.assertPreviousButtonDisabled();

      createWorkspace.selectKind(mockWorkspaceKind.name);
      createWorkspace.assertKindSelected(mockWorkspaceKind.name);
      createWorkspace.assertNextButtonEnabled();

      // Step 2: Select Image
      createWorkspace.clickNext();
      createWorkspace.assertProgressStepVisible(STEP_NAMES.IMAGE);
      createWorkspace.assertPreviousButtonEnabled();
      createWorkspace.assertNextButtonDisabled();

      createWorkspace.selectImage(mockImage.id);
      createWorkspace.assertImageSelected(mockImage.id);
      createWorkspace.assertNextButtonEnabled();

      // Step 3: Select Pod Config
      createWorkspace.clickNext();
      createWorkspace.assertProgressStepVisible(STEP_NAMES.POD_CONFIG);
      createWorkspace.assertNextButtonDisabled();

      createWorkspace.selectPodConfig(mockPodConfig.id);
      createWorkspace.assertPodConfigSelected(mockPodConfig.id);
      createWorkspace.assertNextButtonEnabled();

      // Step 4: Properties
      createWorkspace.clickNext();
      createWorkspace.assertProgressStepVisible(STEP_NAMES.PROPERTIES);
      createWorkspace.assertCreateButtonExists();
      createWorkspace.assertCreateButtonDisabled();

      const workspaceName = 'My Test Workspace';
      createWorkspace.typeWorkspaceName(workspaceName);
      createWorkspace.assertCreateButtonEnabled();

      cy.interceptApi(
        'POST /api/:apiVersion/workspaces/:namespace',
        { path: { apiVersion: NOTEBOOKS_API_VERSION, namespace: mockNamespace.name } },
        mockModArchResponse(
          buildMockWorkspace({
            name: workspaceName,
            namespace: mockNamespace.name,
            workspaceKind: buildMockWorkspaceKindInfo({}),
          }),
        ),
      ).as('createWorkspace');

      createWorkspace.clickCreate();

      cy.wait('@createWorkspace').then((interception) => {
        expect(interception.response?.statusCode).to.be.equal(200);
        expect(interception.request.body.data).to.have.property('name', workspaceName);
      });

      workspaces.verifyPageURL();
    });

    it('should allow navigation backwards through steps', () => {
      navigateToCreateWorkspace();

      selectWorkspaceKind(mockWorkspaceKind.name);
      selectImage(mockImage.id);

      // Go back to image selection
      createWorkspace.clickPrevious();
      createWorkspace.assertProgressStepVisible(STEP_NAMES.IMAGE);
      createWorkspace.assertImageSelected(mockImage.id);

      // Go back to kind selection
      createWorkspace.clickPrevious();
      createWorkspace.assertProgressStepVisible(STEP_NAMES.KIND);
      createWorkspace.assertKindSelected(mockWorkspaceKind.name);
    });

    it('should cancel workspace creation', () => {
      navigateToCreateWorkspace();
      selectWorkspaceKind(mockWorkspaceKind.name);

      createWorkspace.clickCancel();
      workspaces.verifyPageURL();
    });

    it('should validate workspace name is required', () => {
      completeAllStepsToProperties(mockWorkspaceKind.name, mockImage.id, mockPodConfig.id);

      createWorkspace.assertCreateButtonDisabled();

      createWorkspace.typeWorkspaceName('Test');
      createWorkspace.assertCreateButtonEnabled();

      createWorkspace.findWorkspaceNameInput().clear();
      createWorkspace.assertCreateButtonDisabled();
    });

    it('should navigate from workspaces list to create workspace', () => {
      workspaces.visit();

      workspaces.findCreateWorkspaceButton().click();
      cy.wait('@getWorkspaceKinds');

      createWorkspace.verifyPageURL();
      createWorkspace.assertProgressStepVisible(STEP_NAMES.KIND);
    });

    it('should display error alert when workspace creation fails', () => {
      workspaces.findCreateWorkspaceButton().click();
      cy.wait('@getWorkspaceKinds');

      createWorkspace.selectKind(mockWorkspaceKind.name);
      createWorkspace.clickNext();

      createWorkspace.selectImage(mockImage.id);
      createWorkspace.clickNext();

      createWorkspace.selectPodConfig(mockPodConfig.id);
      createWorkspace.clickNext();

      createWorkspace.typeWorkspaceName('my-test-workspace');

      cy.interceptApi(
        'POST /api/:apiVersion/workspaces/:namespace',
        { path: { apiVersion: NOTEBOOKS_API_VERSION, namespace: mockNamespace.name } },
        {
          error: {
            code: '500',
            message: 'An internal server error occurred',
          },
        },
      ).as('createWorkspaceError');

      createWorkspace.clickCreate();

      cy.wait('@createWorkspaceError');

      createWorkspace.assertErrorAlertContainsMessage('Error: An internal server error occurred');

      createWorkspace.verifyPageURL();
    });
  });

  describe('Selection management', () => {
    it('should allow changing image selection', () => {
      const mockImage2 = buildMockOptionInfo({
        id: 'jupyterlab_scipy_210',
        displayName: 'jupyter-scipy:v2.1.0',
      });

      const mockWorkspaceKindWithMultipleImages = buildMockWorkspaceKind({
        podTemplate: {
          ...mockWorkspaceKind.podTemplate,
          options: {
            ...mockWorkspaceKind.podTemplate.options,
            imageConfig: {
              default: mockImage.id,
              values: [
                buildMockImageConfigValue(
                  mockImage.id,
                  mockImage.displayName,
                  'JupyterLab, with SciPy Packages',
                ),
                buildMockImageConfigValue(
                  mockImage2.id,
                  mockImage2.displayName,
                  'JupyterLab, with SciPy Packages v2.1.0',
                ),
              ],
            },
          },
        },
      });

      cy.interceptApi(
        'GET /api/:apiVersion/workspacekinds',
        { path: { apiVersion: NOTEBOOKS_API_VERSION } },
        mockModArchResponse([mockWorkspaceKindWithMultipleImages]),
      ).as('getWorkspaceKindsMultiple');

      createWorkspace.visit();
      cy.wait('@getWorkspaceKindsMultiple');

      createWorkspace.selectKind(mockWorkspaceKindWithMultipleImages.name);
      createWorkspace.clickNext();

      // Select first image
      createWorkspace.selectImage(mockImage.id);
      createWorkspace.assertImageSelected(mockImage.id);

      // Change to second image
      createWorkspace.selectImage(mockImage2.id);
      createWorkspace.assertImageSelected(mockImage2.id);

      // Navigate forward and back to verify selection persists
      createWorkspace.clickNext();
      createWorkspace.clickPrevious();
      createWorkspace.assertImageSelected(mockImage2.id);
    });

    it('should allow changing pod config selection', () => {
      const mockPodConfig2 = buildMockOptionInfo({
        id: 'large_cpu',
        displayName: 'Large CPU',
      });

      const mockWorkspaceKindWithMultiplePodConfigs = buildMockWorkspaceKind({
        podTemplate: {
          ...mockWorkspaceKind.podTemplate,
          options: {
            ...mockWorkspaceKind.podTemplate.options,
            podConfig: {
              default: mockPodConfig.id,
              values: [
                buildMockPodConfigValue(mockPodConfig.id, mockPodConfig.displayName, 'Tiny CPU'),
                buildMockPodConfigValue(mockPodConfig2.id, mockPodConfig2.displayName, 'Large CPU'),
              ],
            },
          },
        },
      });

      cy.interceptApi(
        'GET /api/:apiVersion/workspacekinds',
        { path: { apiVersion: NOTEBOOKS_API_VERSION } },
        mockModArchResponse([mockWorkspaceKindWithMultiplePodConfigs]),
      ).as('getWorkspaceKindsMultiplePodConfigs');

      createWorkspace.visit();
      cy.wait('@getWorkspaceKindsMultiplePodConfigs');

      createWorkspace.selectKind(mockWorkspaceKindWithMultiplePodConfigs.name);
      createWorkspace.clickNext();

      createWorkspace.selectImage(mockImage.id);
      createWorkspace.clickNext();

      // Select first pod config
      createWorkspace.selectPodConfig(mockPodConfig.id);
      createWorkspace.assertPodConfigSelected(mockPodConfig.id);

      // Change to second pod config
      createWorkspace.selectPodConfig(mockPodConfig2.id);
      createWorkspace.assertPodConfigSelected(mockPodConfig2.id);

      // Navigate forward and back to verify selection persists
      createWorkspace.clickNext();
      createWorkspace.clickPrevious();
      createWorkspace.assertPodConfigSelected(mockPodConfig2.id);
    });

    it('should reset selections when changing workspace kind', () => {
      const mockWorkspaceKind2 = buildMockWorkspaceKind({
        name: 'vscode',
        displayName: 'VS Code',
      });

      cy.interceptApi(
        'GET /api/:apiVersion/workspacekinds',
        { path: { apiVersion: NOTEBOOKS_API_VERSION } },
        mockModArchResponse([mockWorkspaceKind, mockWorkspaceKind2]),
      ).as('getMultipleWorkspaceKinds');

      createWorkspace.visit();
      cy.wait('@getMultipleWorkspaceKinds');

      // Select first kind and complete all selections
      createWorkspace.selectKind(mockWorkspaceKind.name);
      createWorkspace.clickNext();

      createWorkspace.selectImage(mockImage.id);
      createWorkspace.clickNext();

      createWorkspace.selectPodConfig(mockPodConfig.id);

      // Go back to kind selection
      createWorkspace.clickPrevious();
      createWorkspace.clickPrevious();

      // Select different kind
      createWorkspace.selectKind(mockWorkspaceKind2.name);
      createWorkspace.clickNext();

      // Verify previous image selection is not applied
      // (the UI should show unselected state or different options)
      createWorkspace.assertNextButtonDisabled();
    });
  });

  describe('Edge cases', () => {
    it('should handle empty workspace kinds list', () => {
      cy.interceptApi(
        'GET /api/:apiVersion/workspacekinds',
        { path: { apiVersion: NOTEBOOKS_API_VERSION } },
        mockModArchResponse([]),
      ).as('getEmptyWorkspaceKinds');

      createWorkspace.visit();
      cy.wait('@getEmptyWorkspaceKinds');

      // Verify empty state is shown
      createWorkspace.assertNoResultsFound();
    });

    it('should handle single workspace kind', () => {
      createWorkspace.visit();
      cy.wait('@getWorkspaceKinds');

      // With a single workspace kind, verify it can be selected
      createWorkspace.selectKind(mockWorkspaceKind.name);
      createWorkspace.assertKindSelected(mockWorkspaceKind.name);
      createWorkspace.assertNextButtonEnabled();
    });

    it('should handle workspace kind with single image option', () => {
      const mockWorkspaceKindSingleImage = buildMockWorkspaceKind({
        podTemplate: {
          ...mockWorkspaceKind.podTemplate,
          options: {
            ...mockWorkspaceKind.podTemplate.options,
            imageConfig: {
              default: mockImage.id,
              values: [
                buildMockImageConfigValue(
                  mockImage.id,
                  mockImage.displayName,
                  'JupyterLab, with SciPy Packages',
                ),
              ],
            },
          },
        },
      });

      cy.interceptApi(
        'GET /api/:apiVersion/workspacekinds',
        { path: { apiVersion: NOTEBOOKS_API_VERSION } },
        mockModArchResponse([mockWorkspaceKindSingleImage]),
      ).as('getWorkspaceKindsSingleImage');

      createWorkspace.visit();
      cy.wait('@getWorkspaceKindsSingleImage');

      createWorkspace.selectKind(mockWorkspaceKindSingleImage.name);
      createWorkspace.clickNext();

      // Select the single available image
      createWorkspace.selectImage(mockImage.id);
      createWorkspace.assertImageSelected(mockImage.id);
      createWorkspace.assertNextButtonEnabled();
    });

    it('should handle workspace kind with single pod config option', () => {
      const mockWorkspaceKindSinglePodConfig = buildMockWorkspaceKind({
        podTemplate: {
          ...mockWorkspaceKind.podTemplate,
          options: {
            ...mockWorkspaceKind.podTemplate.options,
            podConfig: {
              default: mockPodConfig.id,
              values: [
                buildMockPodConfigValue(mockPodConfig.id, mockPodConfig.displayName, 'Tiny CPU'),
              ],
            },
          },
        },
      });

      cy.interceptApi(
        'GET /api/:apiVersion/workspacekinds',
        { path: { apiVersion: NOTEBOOKS_API_VERSION } },
        mockModArchResponse([mockWorkspaceKindSinglePodConfig]),
      ).as('getWorkspaceKindsSinglePodConfig');

      createWorkspace.visit();
      cy.wait('@getWorkspaceKindsSinglePodConfig');

      createWorkspace.selectKind(mockWorkspaceKindSinglePodConfig.name);
      createWorkspace.clickNext();

      createWorkspace.selectImage(mockImage.id);
      createWorkspace.clickNext();

      // Select the single available pod config
      createWorkspace.selectPodConfig(mockPodConfig.id);
      createWorkspace.assertPodConfigSelected(mockPodConfig.id);
      createWorkspace.assertNextButtonEnabled();
    });
  });
});
