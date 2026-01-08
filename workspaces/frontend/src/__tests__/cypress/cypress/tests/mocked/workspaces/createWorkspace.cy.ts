import { mockModArchResponse } from 'mod-arch-core';
import { createWorkspace } from '~/__tests__/cypress/cypress/pages/workspaces/createWorkspace';
import { workspaces } from '~/__tests__/cypress/cypress/pages/workspaces/workspaces';
import { secretsCreateModal } from '~/__tests__/cypress/cypress/pages/workspaces/workspaceForm';
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

  describe('Filter', () => {
    const mockWorkspaceKind2 = buildMockWorkspaceKind({
      name: 'vscode',
      displayName: 'VS Code',
    });

    const mockImage2 = buildMockOptionInfo({
      id: 'jupyterlab_scipy_210',
      displayName: 'jupyter-scipy:v2.1.0',
    });

    const mockPodConfig2 = buildMockOptionInfo({
      id: 'large_cpu',
      displayName: 'Large CPU',
    });

    const mockWorkspaceKindWithMultipleOptions = buildMockWorkspaceKind({
      podTemplate: {
        ...mockWorkspaceKind.podTemplate,
        options: {
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

    describe('Workspace kind filter', () => {
      beforeEach(() => {
        cy.interceptApi(
          'GET /api/:apiVersion/workspacekinds',
          { path: { apiVersion: NOTEBOOKS_API_VERSION } },
          mockModArchResponse([mockWorkspaceKind, mockWorkspaceKind2]),
        ).as('getMultipleWorkspaceKinds');
      });

      it('should filter workspace kinds by name', () => {
        createWorkspace.visit();
        cy.wait('@getMultipleWorkspaceKinds');

        createWorkspace.assertCardVisible(mockWorkspaceKind.name);
        createWorkspace.assertCardVisible(mockWorkspaceKind2.name);

        createWorkspace.typeKindFilter(mockWorkspaceKind.displayName);

        createWorkspace.assertCardVisible(mockWorkspaceKind.name);
        createWorkspace.assertCardNotVisible(mockWorkspaceKind2.name);
      });

      it('should filter workspace kinds by partial name match', () => {
        createWorkspace.visit();
        cy.wait('@getMultipleWorkspaceKinds');

        createWorkspace.typeKindFilter('VS');

        createWorkspace.assertCardNotVisible(mockWorkspaceKind.name);
        createWorkspace.assertCardVisible(mockWorkspaceKind2.name);
      });

      it('should show no results when filter matches nothing', () => {
        createWorkspace.visit();
        cy.wait('@getMultipleWorkspaceKinds');

        createWorkspace.typeKindFilter('NonExistentKind');

        createWorkspace.assertNoResultsFound();
      });

      it('should clear filter and show all kinds', () => {
        createWorkspace.visit();
        cy.wait('@getMultipleWorkspaceKinds');

        createWorkspace.typeKindFilter(mockWorkspaceKind.displayName);
        createWorkspace.assertCardNotVisible(mockWorkspaceKind2.name);

        createWorkspace.clearKindFilter();

        createWorkspace.assertCardVisible(mockWorkspaceKind.name);
        createWorkspace.assertCardVisible(mockWorkspaceKind2.name);
      });
    });

    describe('Image filter', () => {
      beforeEach(() => {
        cy.interceptApi(
          'GET /api/:apiVersion/workspacekinds',
          { path: { apiVersion: NOTEBOOKS_API_VERSION } },
          mockModArchResponse([mockWorkspaceKindWithMultipleOptions]),
        ).as('getWorkspaceKindsWithOptions');
      });

      it('should filter images by name', () => {
        createWorkspace.visit();
        cy.wait('@getWorkspaceKindsWithOptions');

        createWorkspace.selectKind(mockWorkspaceKindWithMultipleOptions.name);
        createWorkspace.clickNext();

        createWorkspace.assertCardVisible(mockImage.id);
        createWorkspace.assertCardVisible(mockImage2.id);

        createWorkspace.typeImageFilter('v2.0.0');

        createWorkspace.assertCardVisible(mockImage.id);
        createWorkspace.assertCardNotVisible(mockImage2.id);
      });

      it('should filter images by id', () => {
        createWorkspace.visit();
        cy.wait('@getWorkspaceKindsWithOptions');

        createWorkspace.selectKind(mockWorkspaceKindWithMultipleOptions.name);
        createWorkspace.clickNext();

        createWorkspace.typeImageFilter('210');

        createWorkspace.assertCardNotVisible(mockImage.id);
        createWorkspace.assertCardVisible(mockImage2.id);
      });

      it('should show no results when image filter matches nothing', () => {
        createWorkspace.visit();
        cy.wait('@getWorkspaceKindsWithOptions');

        createWorkspace.selectKind(mockWorkspaceKindWithMultipleOptions.name);
        createWorkspace.clickNext();

        createWorkspace.typeImageFilter('NonExistentImage');

        createWorkspace.assertNoResultsFound();
      });
    });

    describe('Pod config filter', () => {
      beforeEach(() => {
        cy.interceptApi(
          'GET /api/:apiVersion/workspacekinds',
          { path: { apiVersion: NOTEBOOKS_API_VERSION } },
          mockModArchResponse([mockWorkspaceKindWithMultipleOptions]),
        ).as('getWorkspaceKindsWithOptions');
      });

      it('should filter pod configs by name', () => {
        createWorkspace.visit();
        cy.wait('@getWorkspaceKindsWithOptions');

        createWorkspace.selectKind(mockWorkspaceKindWithMultipleOptions.name);
        createWorkspace.clickNext();

        createWorkspace.selectImage(mockImage.id);
        createWorkspace.clickNext();

        createWorkspace.assertCardVisible(mockPodConfig.id);
        createWorkspace.assertCardVisible(mockPodConfig2.id);

        createWorkspace.typePodConfigFilter('Tiny');

        createWorkspace.assertCardVisible(mockPodConfig.id);
        createWorkspace.assertCardNotVisible(mockPodConfig2.id);
      });

      it('should filter pod configs by id', () => {
        createWorkspace.visit();
        cy.wait('@getWorkspaceKindsWithOptions');

        createWorkspace.selectKind(mockWorkspaceKindWithMultipleOptions.name);
        createWorkspace.clickNext();

        createWorkspace.selectImage(mockImage.id);
        createWorkspace.clickNext();

        createWorkspace.typePodConfigFilter('large');

        createWorkspace.assertCardNotVisible(mockPodConfig.id);
        createWorkspace.assertCardVisible(mockPodConfig2.id);
      });

      it('should show no results when pod config filter matches nothing', () => {
        createWorkspace.visit();
        cy.wait('@getWorkspaceKindsWithOptions');

        createWorkspace.selectKind(mockWorkspaceKindWithMultipleOptions.name);
        createWorkspace.clickNext();

        createWorkspace.selectImage(mockImage.id);
        createWorkspace.clickNext();

        createWorkspace.typePodConfigFilter('NonExistentPodConfig');

        createWorkspace.assertNoResultsFound();
      });

      it('should clear filter using clear all filters button', () => {
        createWorkspace.visit();
        cy.wait('@getWorkspaceKindsWithOptions');

        createWorkspace.selectKind(mockWorkspaceKindWithMultipleOptions.name);
        createWorkspace.clickNext();

        createWorkspace.selectImage(mockImage.id);
        createWorkspace.clickNext();

        createWorkspace.typePodConfigFilter('Tiny');
        createWorkspace.assertCardNotVisible(mockPodConfig2.id);

        createWorkspace.clickClearAllFilters();

        createWorkspace.assertCardVisible(mockPodConfig.id);
        createWorkspace.assertCardVisible(mockPodConfig2.id);
      });
    });

    describe('Filter with regex', () => {
      beforeEach(() => {
        cy.interceptApi(
          'GET /api/:apiVersion/workspacekinds',
          { path: { apiVersion: NOTEBOOKS_API_VERSION } },
          mockModArchResponse([mockWorkspaceKind, mockWorkspaceKind2]),
        ).as('getMultipleWorkspaceKinds');
      });

      it('should support regex pattern in filter', () => {
        createWorkspace.visit();
        cy.wait('@getMultipleWorkspaceKinds');

        createWorkspace.typeKindFilter('JupyterLab|VS Code');

        createWorkspace.assertCardVisible(mockWorkspaceKind.name);
        createWorkspace.assertCardVisible(mockWorkspaceKind2.name);
      });

      it('should support case insensitive filter', () => {
        createWorkspace.visit();
        cy.wait('@getMultipleWorkspaceKinds');

        createWorkspace.typeKindFilter('jupyterlab');

        createWorkspace.assertCardVisible(mockWorkspaceKind.name);
        createWorkspace.assertCardNotVisible(mockWorkspaceKind2.name);
      });
    });
  });

  describe('Secrets Creation Modal', () => {
    const navigateToPropertiesStep = () => {
      completeAllStepsToProperties(mockWorkspaceKind.name, mockImage.id, mockPodConfig.id);
    };

    const openSecretsCreationModal = () => {
      navigateToPropertiesStep();
      createWorkspace.expandSecretsSection();
      createWorkspace.clickCreateNewSecret();
    };

    beforeEach(() => {
      cy.interceptApi(
        'GET /api/:apiVersion/secrets/:namespace',
        { path: { apiVersion: NOTEBOOKS_API_VERSION, namespace: mockNamespace.name } },
        mockModArchResponse([]),
      ).as('listSecrets');
    });

    describe('Basic functionality', () => {
      it('should open and close the secrets creation modal', () => {
        navigateToPropertiesStep();

        // Open modal
        createWorkspace.expandSecretsSection();
        createWorkspace.clickCreateNewSecret();
        secretsCreateModal.assertModalExists();
        secretsCreateModal.find().contains('Create Secret').should('be.visible');

        // Close modal via Cancel button
        secretsCreateModal.clickCancel();
        secretsCreateModal.assertModalNotExists();
      });

      it('should display helper text for secret name field', () => {
        openSecretsCreationModal();

        secretsCreateModal.assertHelperTextVisible();
      });

      it('should display secret type as Opaque and disabled', () => {
        openSecretsCreationModal();

        secretsCreateModal.assertSecretTypeDisabled();
        secretsCreateModal.assertSecretTypeValue('Opaque');
      });

      it('should have Create button enabled initially', () => {
        openSecretsCreationModal();

        secretsCreateModal.assertCreateButtonEnabled();
      });
    });

    describe('Form validation', () => {
      it('should validate secret name is required', () => {
        openSecretsCreationModal();

        // Try to submit without secret name
        secretsCreateModal.clickCreate();

        secretsCreateModal.assertErrorAlertContainsMessage('Secret name is required');
      });

      it('should validate secret name format - invalid characters', () => {
        openSecretsCreationModal();

        secretsCreateModal.typeSecretName('Invalid_Secret_Name');
        secretsCreateModal.typeKey(0, 'key1');
        secretsCreateModal.typeValue(0, 'value1');

        secretsCreateModal.clickCreate();

        secretsCreateModal.assertErrorAlertContainsMessage(
          'Secret name must consist of lower case alphanumeric characters',
        );
      });

      it('should validate secret name format - must start with alphanumeric', () => {
        openSecretsCreationModal();

        secretsCreateModal.typeSecretName('-invalid-secret');
        secretsCreateModal.typeKey(0, 'key1');
        secretsCreateModal.typeValue(0, 'value1');

        secretsCreateModal.clickCreate();

        secretsCreateModal.assertErrorAlertContainsMessage(
          'Secret name must consist of lower case alphanumeric characters',
        );
      });

      it('should validate secret name format - must end with alphanumeric', () => {
        openSecretsCreationModal();

        secretsCreateModal.typeSecretName('invalid-secret-');
        secretsCreateModal.typeKey(0, 'key1');
        secretsCreateModal.typeValue(0, 'value1');

        secretsCreateModal.clickCreate();

        secretsCreateModal.assertErrorAlertContainsMessage(
          'Secret name must consist of lower case alphanumeric characters',
        );
      });

      it('should validate key is required', () => {
        openSecretsCreationModal();

        secretsCreateModal.typeSecretName('valid-secret-name');
        // Don't fill in key
        secretsCreateModal.typeValue(0, 'value1');

        secretsCreateModal.clickCreate();

        secretsCreateModal.assertErrorAlertContainsMessage('Key is required');
      });

      it('should validate value is required', () => {
        openSecretsCreationModal();

        secretsCreateModal.typeSecretName('valid-secret-name');
        secretsCreateModal.typeKey(0, 'key1');
        // Don't fill in value

        secretsCreateModal.clickCreate();

        secretsCreateModal.assertErrorAlertContainsMessage('Value is required');
      });

      it('should validate key format - invalid characters', () => {
        openSecretsCreationModal();

        secretsCreateModal.typeSecretName('valid-secret-name');
        secretsCreateModal.typeKey(0, 'invalid key!');
        secretsCreateModal.typeValue(0, 'value1');

        secretsCreateModal.clickCreate();

        secretsCreateModal.assertErrorAlertContainsMessage(
          'Key must consist of alphanumeric characters, hyphens, underscores, or dots',
        );
      });

      it('should validate duplicate keys are not allowed', () => {
        openSecretsCreationModal();

        secretsCreateModal.typeSecretName('valid-secret-name');
        secretsCreateModal.typeKey(0, 'key1');
        secretsCreateModal.typeValue(0, 'value1');

        // Add another key-value pair with duplicate key
        secretsCreateModal.clickAddKeyValuePair();
        secretsCreateModal.typeKey(1, 'key1');
        secretsCreateModal.typeValue(1, 'value2');

        secretsCreateModal.clickCreate();

        secretsCreateModal.assertErrorAlertContainsMessage('Duplicate keys are not allowed');
      });
    });

    describe('Key-value pairs management', () => {
      it('should add a new key-value pair', () => {
        openSecretsCreationModal();

        secretsCreateModal.assertKeyValuePairCount(1);

        secretsCreateModal.clickAddKeyValuePair();

        secretsCreateModal.assertKeyValuePairCount(2);
      });

      it('should remove a key-value pair when multiple pairs exist', () => {
        openSecretsCreationModal();

        // Add a second pair
        secretsCreateModal.clickAddKeyValuePair();
        secretsCreateModal.assertKeyValuePairCount(2);

        // Remove the second pair
        secretsCreateModal.clickRemoveKeyValuePair(1);
        secretsCreateModal.assertKeyValuePairCount(1);
      });

      it('should not allow removing the last key-value pair', () => {
        openSecretsCreationModal();

        secretsCreateModal.assertRemoveButtonDisabled(0);
      });

      it('should enable remove button when multiple pairs exist', () => {
        openSecretsCreationModal();

        secretsCreateModal.clickAddKeyValuePair();
        secretsCreateModal.assertRemoveButtonEnabled(0);
        secretsCreateModal.assertRemoveButtonEnabled(1);
      });
    });

    describe('Secret creation', () => {
      it('should successfully create a secret with valid data', () => {
        const secretName = 'test-secret';
        const key1 = 'username';
        const value1 = 'admin';
        const key2 = 'password';
        const value2 = 'secret123';

        const mockSecretResponse = {
          name: secretName,
          type: 'Opaque',
          immutable: false,
          contents: {
            [key1]: { base64: btoa(value1) },
            [key2]: { base64: btoa(value2) },
          },
        };

        cy.interceptApi(
          'POST /api/:apiVersion/secrets/:namespace',
          { path: { apiVersion: NOTEBOOKS_API_VERSION, namespace: mockNamespace.name } },
          mockModArchResponse(mockSecretResponse),
        ).as('createSecret');

        // Mock getSecret for the SecretsViewPopover that will mount after creation
        cy.intercept(
          'GET',
          `/api/${NOTEBOOKS_API_VERSION}/secrets/${mockNamespace.name}/${secretName}`,
          { data: mockSecretResponse },
        ).as('getSecret');

        openSecretsCreationModal();

        secretsCreateModal.typeSecretName(secretName);
        secretsCreateModal.typeKey(0, key1);
        secretsCreateModal.typeValue(0, value1);

        // Add second key-value pair
        secretsCreateModal.clickAddKeyValuePair();
        secretsCreateModal.typeKey(1, key2);
        secretsCreateModal.typeValue(1, value2);

        secretsCreateModal.clickCreate();

        cy.wait('@createSecret').then((interception) => {
          expect(interception.request.body.data.name).to.equal(secretName);
          expect(interception.request.body.data.type).to.equal('Opaque');
          expect(interception.request.body.data.contents[key1].base64).to.equal(btoa(value1));
          expect(interception.request.body.data.contents[key2].base64).to.equal(btoa(value2));
        });

        // Modal should close
        secretsCreateModal.assertModalNotExists();
      });

      it('should add created secret to the secrets table', () => {
        const secretName = 'my-new-secret';

        const mockSecretResponse = {
          name: secretName,
          type: 'Opaque',
          immutable: false,
          contents: {
            key1: { base64: btoa('value1') },
          },
        };

        cy.interceptApi(
          'POST /api/:apiVersion/secrets/:namespace',
          { path: { apiVersion: NOTEBOOKS_API_VERSION, namespace: mockNamespace.name } },
          mockModArchResponse(mockSecretResponse),
        ).as('createSecret');

        // Mock getSecret for the SecretsViewPopover
        cy.intercept(
          'GET',
          `/api/${NOTEBOOKS_API_VERSION}/secrets/${mockNamespace.name}/${secretName}`,
          { data: mockSecretResponse },
        ).as('getSecret');

        openSecretsCreationModal();

        secretsCreateModal.typeSecretName(secretName);
        secretsCreateModal.typeKey(0, 'key1');
        secretsCreateModal.typeValue(0, 'value1');

        secretsCreateModal.clickCreate();

        cy.wait('@createSecret');

        // Verify secret appears in the table
        cy.contains('td', secretName).should('exist');
        cy.contains('td', `/secrets/${secretName}`).should('exist');
      });

      it('should handle API error when creating secret', () => {
        const secretName = 'test-secret';

        cy.interceptApi(
          'POST /api/:apiVersion/secrets/:namespace',
          { path: { apiVersion: NOTEBOOKS_API_VERSION, namespace: mockNamespace.name } },
          {
            error: {
              code: '409',
              message: 'Secret already exists',
            },
          },
        ).as('createSecretError');

        openSecretsCreationModal();

        secretsCreateModal.typeSecretName(secretName);
        secretsCreateModal.typeKey(0, 'key1');
        secretsCreateModal.typeValue(0, 'value1');

        secretsCreateModal.clickCreate();

        cy.wait('@createSecretError');

        // Error alert should be displayed (axios error message)
        secretsCreateModal.assertErrorAlertContainsMessage('Request failed with status code 409');
        // Modal should remain open
        secretsCreateModal.assertModalExists();
      });

      it('should reset form after successful creation', () => {
        const secretName = 'reset-test-secret';

        const mockSecretResponse = {
          name: secretName,
          type: 'Opaque',
          immutable: false,
          contents: {
            key1: { base64: btoa('value1') },
          },
        };

        cy.interceptApi(
          'POST /api/:apiVersion/secrets/:namespace',
          { path: { apiVersion: NOTEBOOKS_API_VERSION, namespace: mockNamespace.name } },
          mockModArchResponse(mockSecretResponse),
        ).as('createSecret');

        // Mock getSecret for the SecretsViewPopover
        cy.intercept(
          'GET',
          `/api/${NOTEBOOKS_API_VERSION}/secrets/${mockNamespace.name}/${secretName}`,
          { data: mockSecretResponse },
        ).as('getSecret');

        openSecretsCreationModal();

        secretsCreateModal.typeSecretName(secretName);
        secretsCreateModal.typeKey(0, 'key1');
        secretsCreateModal.typeValue(0, 'value1');

        secretsCreateModal.clickCreate();

        cy.wait('@createSecret');

        // Modal should close
        secretsCreateModal.assertModalNotExists();

        // Open modal again
        createWorkspace.clickCreateNewSecret();
        secretsCreateModal.assertModalExists();

        // Form should be reset
        secretsCreateModal.assertSecretNameValue('');
        secretsCreateModal.assertKeyValue(0, '');
        secretsCreateModal.assertValueValue(0, '');
      });
    });
  });
});
