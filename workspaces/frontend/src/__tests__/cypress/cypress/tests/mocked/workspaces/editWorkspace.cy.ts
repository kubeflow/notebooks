import { mockModArchResponse } from 'mod-arch-core';
import { editWorkspace } from '~/__tests__/cypress/cypress/pages/workspaces/editWorkspace';
import { workspaces } from '~/__tests__/cypress/cypress/pages/workspaces/workspaces';
import {
  buildMockNamespace,
  buildMockWorkspace,
  buildMockWorkspaceKind,
  buildMockWorkspaceKindInfo,
  buildMockWorkspaceUpdate,
} from '~/shared/mock/mockBuilder';
import { NOTEBOOKS_API_VERSION } from '~/__tests__/cypress/cypress/support/commands/api';
import { WorkspacesWorkspaceState } from '~/generated/data-contracts';
import { toastNotification } from '~/__tests__/cypress/cypress/pages/components/toastNotification';

const DEFAULT_NAMESPACE = 'default';
const TEST_WORKSPACE_NAME = 'Workspace';
const WORKSPACE_KIND_NAME = 'jupyterlab';
const IMAGE_CONFIG_ID = 'jupyterlab_scipy_190';
const POD_CONFIG_ID = 'tiny_cpu';

type EditWorkspaceSetup = {
  mockNamespace: ReturnType<typeof buildMockNamespace>;
  mockWorkspace: ReturnType<typeof buildMockWorkspace>;
  mockWorkspaceKind: ReturnType<typeof buildMockWorkspaceKind>;
};

const setupEditWorkspace = (): EditWorkspaceSetup => {
  const mockNamespace = buildMockNamespace({ name: DEFAULT_NAMESPACE });
  const mockWorkspaceKind = buildMockWorkspaceKind({ name: WORKSPACE_KIND_NAME });
  const mockWorkspace = buildMockWorkspace({
    name: TEST_WORKSPACE_NAME,
    namespace: mockNamespace.name,
    workspaceKind: buildMockWorkspaceKindInfo({ name: WORKSPACE_KIND_NAME }),
    state: WorkspacesWorkspaceState.WorkspaceStateRunning,
    podTemplate: {
      podMetadata: {
        labels: { testLabel: 'testValue' },
        annotations: { testAnnotation: 'testAnnotationValue' },
      },
      volumes: {
        home: { pvcName: 'home-pvc', mountPath: '/home', readOnly: false },
        data: [],
      },
      options: {
        imageConfig: {
          current: {
            id: IMAGE_CONFIG_ID,
            displayName: 'jupyter-scipy:v1.9.0',
            description: 'JupyterLab with SciPy',
            labels: [],
          },
        },
        podConfig: {
          current: {
            id: POD_CONFIG_ID,
            displayName: 'Tiny CPU',
            description: 'Pod with 0.1 CPU',
            labels: [],
          },
        },
      },
    },
  });

  const mockWorkspaceUpdateResponse = buildMockWorkspaceUpdate({
    deferUpdates: true,
    podTemplate: {
      options: {
        imageConfig: IMAGE_CONFIG_ID,
        podConfig: POD_CONFIG_ID,
      },
      podMetadata: {
        labels: { testLabel: 'testValue' },
        annotations: { testAnnotation: 'testAnnotationValue' },
      },
      volumes: {
        home: '/home',
        data: [
          { pvcName: 'data-volume-1', mountPath: '/data1', readOnly: false },
          { pvcName: 'data-volume-2', mountPath: '/data2', readOnly: true },
        ],
        secrets: [{ secretName: 'secret-1', mountPath: '/secrets/secret1', defaultMode: 420 }],
      },
    },
  });

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

  cy.interceptApi(
    'GET /api/:apiVersion/workspaces/:namespace/:workspaceName',
    {
      path: {
        apiVersion: NOTEBOOKS_API_VERSION,
        namespace: mockNamespace.name,
        workspaceName: mockWorkspace.name,
      },
    },
    mockModArchResponse(mockWorkspaceUpdateResponse),
  ).as('getWorkspace');

  cy.interceptApi(
    'GET /api/:apiVersion/workspacekinds/:kind',
    { path: { apiVersion: NOTEBOOKS_API_VERSION, kind: WORKSPACE_KIND_NAME } },
    mockModArchResponse(mockWorkspaceKind),
  ).as('getWorkspaceKind');

  cy.interceptApi(
    'GET /api/:apiVersion/workspacekinds',
    { path: { apiVersion: NOTEBOOKS_API_VERSION } },
    mockModArchResponse([mockWorkspaceKind]),
  ).as('getWorkspaceKinds');

  return { mockNamespace, mockWorkspace, mockWorkspaceKind };
};

const visitEditWorkspace = () => {
  workspaces.visit();
  cy.wait('@getNamespaces');
  cy.wait('@getWorkspaces');
  workspaces.findAction({ action: 'edit', workspaceName: TEST_WORKSPACE_NAME }).click();
};

describe('Edit workspace', () => {
  describe('Basic', () => {
    it('should display the edit workspace page with correct title', () => {
      setupEditWorkspace();

      visitEditWorkspace();

      editWorkspace.verifyPageURL();
      editWorkspace.assertPageTitleVisible();
    });

    it('should display progress stepper with all steps', () => {
      setupEditWorkspace();

      visitEditWorkspace();

      editWorkspace.assertProgressStepperVisible();
      editWorkspace.assertProgressStepVisible('Workspace Kind');
      editWorkspace.assertProgressStepVisible('Image');
      editWorkspace.assertProgressStepVisible('Pod Config');
      editWorkspace.assertProgressStepVisible('Properties');
    });

    it('should have Save button instead of Create button on final step', () => {
      setupEditWorkspace();

      visitEditWorkspace();

      cy.wait('@getWorkspaceKind');
      editWorkspace.clickNext();
      editWorkspace.clickNext();
      editWorkspace.clickNext();

      editWorkspace.assertSaveButtonExists();
      editWorkspace.assertSaveButtonText('Save');
    });

    it('should cancel editing and return to workspaces page', () => {
      setupEditWorkspace();

      visitEditWorkspace();

      editWorkspace.verifyPageURL();
      editWorkspace.clickCancel();

      workspaces.verifyPageURL();
    });

    it('should update workspace when clicking Save button', () => {
      const { mockNamespace } = setupEditWorkspace();

      cy.interceptApi(
        'PUT /api/:apiVersion/workspaces/:namespace/:workspaceName',
        {
          path: {
            apiVersion: NOTEBOOKS_API_VERSION,
            namespace: mockNamespace.name,
            workspaceName: TEST_WORKSPACE_NAME,
          },
        },
        mockModArchResponse(buildMockWorkspaceUpdate({})),
      ).as('updateWorkspace');

      visitEditWorkspace();

      cy.wait('@getWorkspaceKind');
      editWorkspace.clickNext();
      editWorkspace.clickNext();
      editWorkspace.clickNext();

      editWorkspace.clickSave();

      cy.wait('@updateWorkspace').then((interception) => {
        expect(interception.request.method).to.equal('PUT');
      });

      workspaces.verifyPageURL();
      toastNotification.assertSuccessAlertExists();
      toastNotification.assertSuccessAlertContainsMessage(
        `Workspace '${TEST_WORKSPACE_NAME}' updated successfully`,
      );
    });

    it('should send updated values in the request payload', () => {
      const { mockNamespace } = setupEditWorkspace();
      const newImageConfigId = 'jupyterlab_scipy_200';
      const newPodConfigId = 'small_cpu';

      cy.interceptApi(
        'PUT /api/:apiVersion/workspaces/:namespace/:workspaceName',
        {
          path: {
            apiVersion: NOTEBOOKS_API_VERSION,
            namespace: mockNamespace.name,
            workspaceName: TEST_WORKSPACE_NAME,
          },
        },
        mockModArchResponse(buildMockWorkspaceUpdate({})),
      ).as('updateWorkspace');

      visitEditWorkspace();

      cy.wait('@getWorkspaceKind');

      // Step 1: Kind Selection - just proceed
      editWorkspace.clickNext();

      // Step 2: Image Selection - change to a different image
      editWorkspace.selectImage(newImageConfigId);
      editWorkspace.clickNext();

      // Step 3: Pod Config Selection - change to a different pod config
      editWorkspace.selectPodConfig(newPodConfigId);
      editWorkspace.clickNext();

      // Step 4: Properties - toggle defer updates (was true, now false)
      editWorkspace.findDeferUpdatesCheckbox().click();

      editWorkspace.clickSave();

      cy.wait('@updateWorkspace').then((interception) => {
        const requestBody = interception.request.body.data;
        expect(requestBody.podTemplate.options.imageConfig).to.equal(newImageConfigId);
        expect(requestBody.podTemplate.options.podConfig).to.equal(newPodConfigId);
        expect(requestBody.deferUpdates).to.equal(false);
      });
    });
  });

  describe('Pre-populated selections', () => {
    it('should pre-select the workspace kind', () => {
      setupEditWorkspace();

      visitEditWorkspace();

      cy.wait('@getWorkspaceKind');
      editWorkspace.assertKindSelected(WORKSPACE_KIND_NAME);
    });

    it('should pre-select the image', () => {
      setupEditWorkspace();

      visitEditWorkspace();

      cy.wait('@getWorkspaceKind');
      editWorkspace.clickNext();

      editWorkspace.assertImageSelected(IMAGE_CONFIG_ID);
    });

    it('should pre-select the pod config', () => {
      setupEditWorkspace();

      visitEditWorkspace();

      cy.wait('@getWorkspaceKind');
      editWorkspace.clickNext();
      editWorkspace.clickNext();

      editWorkspace.assertPodConfigSelected(POD_CONFIG_ID);
    });

    it('should pre-populate the properties in Properties step', () => {
      setupEditWorkspace();

      visitEditWorkspace();

      cy.wait('@getWorkspaceKind');
      editWorkspace.clickNext();
      editWorkspace.clickNext();
      editWorkspace.clickNext();

      editWorkspace.assertWorkspaceName(TEST_WORKSPACE_NAME);
      editWorkspace.assertDeferUpdatesChecked(true);
      editWorkspace.assertVolumesCount(2);
      editWorkspace.assertSecretsCount(1);
    });
  });

  describe('Read-only fields', () => {
    it('should display alert that workspace kind cannot be changed', () => {
      setupEditWorkspace();

      visitEditWorkspace();

      cy.wait('@getWorkspaceKind');
      editWorkspace.assertWorkspaceKindCannotBeChangedAlertVisible();
    });

    it('should not allow selecting a different workspace kind', () => {
      const differentKindName = 'another-kind';
      const mockNamespace = buildMockNamespace({ name: DEFAULT_NAMESPACE });
      const mockWorkspaceKind = buildMockWorkspaceKind({ name: WORKSPACE_KIND_NAME });
      const differentWorkspaceKind = buildMockWorkspaceKind({
        name: differentKindName,
        displayName: 'Another Kind',
      });
      const mockWorkspace = buildMockWorkspace({
        name: TEST_WORKSPACE_NAME,
        namespace: mockNamespace.name,
        workspaceKind: buildMockWorkspaceKindInfo({ name: WORKSPACE_KIND_NAME }),
        state: WorkspacesWorkspaceState.WorkspaceStateRunning,
      });
      const mockWorkspaceUpdateResponse = buildMockWorkspaceUpdate({
        podTemplate: {
          options: {
            imageConfig: IMAGE_CONFIG_ID,
            podConfig: POD_CONFIG_ID,
          },
          podMetadata: { labels: {}, annotations: {} },
          volumes: { home: '/home', data: [] },
        },
      });

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
      cy.interceptApi(
        'GET /api/:apiVersion/workspaces/:namespace/:workspaceName',
        {
          path: {
            apiVersion: NOTEBOOKS_API_VERSION,
            namespace: mockNamespace.name,
            workspaceName: mockWorkspace.name,
          },
        },
        mockModArchResponse(mockWorkspaceUpdateResponse),
      ).as('getWorkspace');
      cy.interceptApi(
        'GET /api/:apiVersion/workspacekinds/:kind',
        { path: { apiVersion: NOTEBOOKS_API_VERSION, kind: WORKSPACE_KIND_NAME } },
        mockModArchResponse(mockWorkspaceKind),
      ).as('getWorkspaceKind');
      cy.interceptApi(
        'GET /api/:apiVersion/workspacekinds',
        { path: { apiVersion: NOTEBOOKS_API_VERSION } },
        mockModArchResponse([mockWorkspaceKind, differentWorkspaceKind]),
      ).as('getWorkspaceKinds');

      visitEditWorkspace();

      cy.wait('@getWorkspaceKind');

      // Verify the current kind is selected
      editWorkspace.assertKindSelected(WORKSPACE_KIND_NAME);

      // Try clicking on a different kind card
      editWorkspace.findKindCard(differentKindName).click();

      // The original kind should still be selected (selection is disabled in edit mode)
      editWorkspace.assertKindSelected(WORKSPACE_KIND_NAME);
    });

    it('should display helper text that workspace name cannot be changed', () => {
      setupEditWorkspace();

      visitEditWorkspace();

      cy.wait('@getWorkspaceKind');
      editWorkspace.clickNext();
      editWorkspace.clickNext();
      editWorkspace.clickNext();

      editWorkspace.assertWorkspaceNameCannotBeChangedHelperTextVisible();
    });

    it('should have workspace name input disabled', () => {
      setupEditWorkspace();

      visitEditWorkspace();

      cy.wait('@getWorkspaceKind');
      editWorkspace.clickNext();
      editWorkspace.clickNext();
      editWorkspace.clickNext();

      editWorkspace.assertWorkspaceNameInputDisabled();
    });
  });

  describe('Navigation', () => {
    it('should navigate through all form steps', () => {
      setupEditWorkspace();

      visitEditWorkspace();

      cy.wait('@getWorkspaceKind');

      // Step 1: Kind Selection - should be pre-selected
      editWorkspace.assertKindSelected(WORKSPACE_KIND_NAME);
      editWorkspace.assertNextButtonEnabled();
      editWorkspace.clickNext();

      // Step 2: Image Selection
      editWorkspace.assertImageSelected(IMAGE_CONFIG_ID);
      editWorkspace.assertNextButtonEnabled();
      editWorkspace.clickNext();

      // Step 3: Pod Config Selection
      editWorkspace.assertPodConfigSelected(POD_CONFIG_ID);
      editWorkspace.assertNextButtonEnabled();
      editWorkspace.clickNext();

      // Step 4: Properties - Save button should appear
      editWorkspace.assertSaveButtonExists();
    });

    it('should allow going back to previous steps', () => {
      setupEditWorkspace();

      visitEditWorkspace();

      cy.wait('@getWorkspaceKind');

      // Navigate to step 2
      editWorkspace.clickNext();
      editWorkspace.assertPreviousButtonEnabled();

      // Go back to step 1
      editWorkspace.clickPrevious();
      editWorkspace.assertKindSelected(WORKSPACE_KIND_NAME);
    });

    it('should disable Previous button on first step', () => {
      setupEditWorkspace();

      visitEditWorkspace();

      cy.wait('@getWorkspaceKind');
      editWorkspace.assertPreviousButtonDisabled();
    });
  });
});
