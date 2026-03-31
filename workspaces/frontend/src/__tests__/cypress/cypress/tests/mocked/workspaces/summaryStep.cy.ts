import { mockModArchResponse } from 'mod-arch-core';
import { createWorkspace } from '~/__tests__/cypress/cypress/pages/workspaces/createWorkspace';
import { editWorkspace } from '~/__tests__/cypress/cypress/pages/workspaces/editWorkspace';
import { workspaces } from '~/__tests__/cypress/cypress/pages/workspaces/workspaces';
import { NOTEBOOKS_API_VERSION } from '~/__tests__/cypress/cypress/support/commands/api';
import {
  buildMockNamespace,
  buildMockPVC,
  buildMockWorkspace,
  buildMockWorkspaceKind,
  buildMockWorkspaceKindInfo,
  buildMockWorkspaceUpdate,
} from '~/shared/mock/mockBuilder';
import { navBar } from '~/__tests__/cypress/cypress/pages/components/navBar';
import {
  V1Beta1WorkspaceState,
  type WorkspacekindsImageConfigValue,
  type WorkspacekindsPodConfigValue,
} from '~/generated/data-contracts';

const STEP_NAMES = {
  KIND: 'Workspace Kind',
  IMAGE: 'Image',
  POD_CONFIG: 'Pod Config',
  PROPERTIES: 'Properties',
  SUMMARY: 'Summary',
} as const;

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

describe('Summary step', () => {
  const mockNamespace = buildMockNamespace({ name: 'default' });
  const TEST_WORKSPACE_NAME = 'Workspace';
  const mockWorkspaces = [
    buildMockWorkspace({}),
    buildMockWorkspace({ name: TEST_WORKSPACE_NAME, namespace: mockNamespace.name }),
  ];

  const mockImage1 = buildMockImageConfigValue(
    'jupyterlab_scipy_200',
    'jupyter-scipy:v2.0.0',
    'JupyterLab with SciPy v2.0.0',
  );
  const mockImage2 = buildMockImageConfigValue(
    'jupyterlab_scipy_210',
    'jupyter-scipy:v2.1.0',
    'JupyterLab with SciPy v2.1.0',
  );
  const mockPodConfig1 = buildMockPodConfigValue('tiny_cpu', 'Tiny CPU', 'Tiny CPU resources');
  const mockPodConfig2 = buildMockPodConfigValue('small_cpu', 'Small CPU', 'Small CPU resources');

  const mockWorkspaceKind = buildMockWorkspaceKind({
    podTemplate: {
      ...buildMockWorkspaceKind().podTemplate,
      options: {
        imageConfig: {
          default: mockImage1.id,
          values: [mockImage1, mockImage2],
        },
        podConfig: {
          default: mockPodConfig1.id,
          values: [mockPodConfig1, mockPodConfig2],
        },
      },
    },
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

    cy.interceptApi(
      'GET /api/:apiVersion/persistentvolumeclaims/:namespace',
      { path: { apiVersion: NOTEBOOKS_API_VERSION, namespace: mockNamespace.name } },
      mockModArchResponse([buildMockPVC({ name: 'home-pvc' })]),
    ).as('listPVCs');

    workspaces.visit();
    cy.wait('@getNamespaces');

    navBar.selectNamespace(mockNamespace.name);
    cy.wait('@getWorkspaces');
  });

  const navigateToSummaryStep = (): void => {
    createWorkspace.visit();
    cy.wait('@getWorkspaceKinds');

    // Step 1: Kind
    createWorkspace.selectKind(mockWorkspaceKind.name);
    createWorkspace.clickNext();

    // Step 2: Image
    createWorkspace.selectImage(mockImage1.id);
    createWorkspace.clickNext();

    // Step 3: Pod Config
    createWorkspace.selectPodConfig(mockPodConfig1.id);
    createWorkspace.clickNext();

    // Step 4: Properties
    createWorkspace.typeWorkspaceName('test-workspace');
    createWorkspace.attachHomeVolume('home-pvc');
    createWorkspace.clickNext();
  };

  it('should display the Summary step in the progress stepper', () => {
    navigateToSummaryStep();

    createWorkspace.assertProgressStepVisible(STEP_NAMES.SUMMARY);
  });

  it('should render summary cards on the Summary step', () => {
    navigateToSummaryStep();

    createWorkspace.assertSummaryCardVisible(0);
    createWorkspace.assertSummaryCardVisible(1);
    createWorkspace.assertSummaryCardVisible(2);
    createWorkspace.assertSummaryCardVisible(3);
  });

  it('should navigate back to the correct step when clicking a summary card', () => {
    navigateToSummaryStep();

    // Click the Workspace Kind card (step 0)
    createWorkspace.clickSummaryCard(0);
    createWorkspace.assertProgressStepVisible(STEP_NAMES.KIND);
    createWorkspace.assertKindSelected(mockWorkspaceKind.name);

    // Navigate back to Summary
    createWorkspace.clickNext();
    createWorkspace.clickNext();
    createWorkspace.clickNext();
    createWorkspace.clickNext();

    // Click the Image card (step 1)
    createWorkspace.clickSummaryCard(1);
    createWorkspace.assertProgressStepVisible(STEP_NAMES.IMAGE);
    createWorkspace.assertImageSelected(mockImage1.id);
  });

  it('should show Create button on Summary step and Previous goes back to Properties', () => {
    navigateToSummaryStep();

    createWorkspace.assertCreateButtonExists();
    createWorkspace.assertCreateButtonEnabled();

    createWorkspace.clickPrevious();
    createWorkspace.assertProgressStepVisible(STEP_NAMES.PROPERTIES);
  });

  describe('Edit mode side-by-side diff', () => {
    const WORKSPACE_KIND_NAME = mockWorkspaceKind.name;

    const setupEditWorkspace = (): void => {
      const mockWorkspace = buildMockWorkspace({
        name: TEST_WORKSPACE_NAME,
        namespace: mockNamespace.name,
        workspaceKind: buildMockWorkspaceKindInfo({ name: WORKSPACE_KIND_NAME }),
        state: V1Beta1WorkspaceState.WorkspaceStateRunning,
        podTemplate: {
          podMetadata: {
            labels: { testLabel: 'testValue' },
            annotations: {},
          },
          volumes: {
            home: { pvcName: 'home-pvc', mountPath: '/home', readOnly: false },
            data: [],
          },
          options: {
            imageConfig: {
              current: {
                id: mockImage1.id,
                displayName: mockImage1.displayName,
                description: mockImage1.description,
                labels: [],
              },
            },
            podConfig: {
              current: {
                id: mockPodConfig1.id,
                displayName: mockPodConfig1.displayName,
                description: mockPodConfig1.description,
                labels: [],
              },
            },
          },
        },
      });

      const mockWorkspaceUpdateResponse = buildMockWorkspaceUpdate({
        podTemplate: {
          options: {
            imageConfig: mockImage1.id,
            podConfig: mockPodConfig1.id,
          },
          podMetadata: {
            labels: { testLabel: 'testValue' },
            annotations: {},
          },
          volumes: {
            home: '/home',
            data: [],
            secrets: [],
          },
        },
      });

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
    };

    const visitEditWorkspace = (): void => {
      workspaces.findAction({ action: 'edit', workspaceName: TEST_WORKSPACE_NAME }).click();
    };

    it('should display side-by-side diff when values are changed in edit mode', () => {
      setupEditWorkspace();
      visitEditWorkspace();

      cy.wait('@getWorkspaceKind');

      // Step 1: Kind - just proceed
      editWorkspace.clickNext();

      // Step 2: Image - change to a different image
      editWorkspace.selectImage(mockImage2.id);
      editWorkspace.clickNext();

      // Step 3: Pod Config - just proceed
      editWorkspace.clickNext();

      // Step 4: Properties - just proceed
      editWorkspace.clickNext();

      // Step 5: Summary - diff should show side-by-side
      editWorkspace.assertProgressStepVisible('Summary');

      // Verify side-by-side diff layout exists
      editWorkspace.findSummaryDiffCurrent().should('be.visible');
      editWorkspace.findSummaryDiffNew().should('be.visible');
    });
  });
});
