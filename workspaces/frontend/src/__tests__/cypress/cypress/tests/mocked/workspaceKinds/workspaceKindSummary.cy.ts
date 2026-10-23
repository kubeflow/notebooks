import { mockModArchResponse } from 'mod-arch-core';
import { workspaceKindSummary } from '~/__tests__/cypress/cypress/pages/workspaceKinds/workspaceKindSummary';
import { navBar } from '~/__tests__/cypress/cypress/pages/components/navBar';
import { workspaceKinds } from '~/__tests__/cypress/cypress/pages/workspaceKinds/workspaceKinds';
import type { WorkspaceKindSummaryNavigationState } from '~/__tests__/cypress/cypress/pages/workspaceKinds/workspaceKindSummary';
import {
  deleteModal,
  workspaceDetailsDrawer,
  workspaces,
  stopModal,
} from '~/__tests__/cypress/cypress/pages/workspaces/workspaces';
import {
  buildMockNamespace,
  buildMockWorkspace,
  buildMockWorkspaceKind,
  buildMockWorkspaceKindUpdate,
  buildMockWorkspaceKindInfo,
  buildMockPodConfig,
  buildMockPodTemplate,
  buildPodTemplateOptions,
  buildMockOptionInfo,
  buildMockWorkspaceList,
  buildMockWorkspaceDetails,
  buildMockActionsWorkspaceActionPause,
} from '~/shared/mock/mockBuilder';
import {
  buildMockWorkspaceWithGPU,
  buildMockWorkspaceWithImage,
  buildMockWorkspaceWithPodConfig,
} from '~/__tests__/cypress/cypress/utils/testBuilders';
import { NOTEBOOKS_API_VERSION } from '~/__tests__/cypress/cypress/support/commands/api';
import { V1Beta1WorkspaceState } from '~/generated/data-contracts';

const DEFAULT_NAMESPACE = 'default';
const NAMESPACE_A = 'namespace-a';
const NAMESPACE_B = 'namespace-b';
const TEST_WORKSPACE_KIND = 'jupyterlab';

type WorkspaceKindSummarySetup = {
  mockNamespace: ReturnType<typeof buildMockNamespace>;
  mockWorkspaceKind: ReturnType<typeof buildMockWorkspaceKindInfo>;
  mockWorkspaces: ReturnType<typeof buildMockWorkspace>[];
};

const setupWorkspaceKindSummary = (args: {
  workspaceKindName: string;
  namespace: string;
  workspaceCount: number;
  customWorkspaces?: ReturnType<typeof buildMockWorkspace>[];
}): WorkspaceKindSummarySetup => {
  const { workspaceKindName, namespace, workspaceCount, customWorkspaces } = args;
  const mockNamespace = buildMockNamespace({ name: namespace });
  const mockWorkspaceKind = buildMockWorkspaceKindInfo({ name: workspaceKindName });

  const mockWorkspaces =
    customWorkspaces ||
    buildMockWorkspaceList({
      count: workspaceCount,
      namespace: mockNamespace.name,
      kind: mockWorkspaceKind,
      state: V1Beta1WorkspaceState.WorkspaceStateRunning,
    });

  cy.interceptApi(
    'GET /api/:apiVersion/namespaces',
    { path: { apiVersion: NOTEBOOKS_API_VERSION } },
    mockModArchResponse([mockNamespace]),
  ).as('getNamespaces');

  cy.interceptApi(
    'GET /api/:apiVersion/workspacekinds/:kind',
    { path: { apiVersion: NOTEBOOKS_API_VERSION, kind: workspaceKindName } },
    mockModArchResponse(
      buildMockWorkspaceKindUpdate(buildMockWorkspaceKind({ name: workspaceKindName })),
    ),
  ).as('getWorkspaceKind');

  cy.interceptApi(
    'GET /api/:apiVersion/workspaces',
    { path: { apiVersion: NOTEBOOKS_API_VERSION } },
    mockModArchResponse(mockWorkspaces),
  ).as('getAllWorkspaces');

  return { mockNamespace, mockWorkspaceKind, mockWorkspaces };
};

const setupMultiNamespaceWorkspaces = (args: {
  workspaceKindName: string;
  namespaceACount: number;
  namespaceBCount: number;
}) => {
  const { workspaceKindName, namespaceACount, namespaceBCount } = args;
  const mockNamespaceA = buildMockNamespace({ name: NAMESPACE_A });
  const mockNamespaceB = buildMockNamespace({ name: NAMESPACE_B });
  const mockWorkspaceKind = buildMockWorkspaceKindInfo({ name: workspaceKindName });

  const namespaceAWorkspaces = buildMockWorkspaceList({
    count: namespaceACount,
    namespace: mockNamespaceA.name,
    kind: mockWorkspaceKind,
    state: V1Beta1WorkspaceState.WorkspaceStateRunning,
  });

  const namespaceBWorkspaces = buildMockWorkspaceList({
    count: namespaceBCount,
    namespace: mockNamespaceB.name,
    kind: mockWorkspaceKind,
    state: V1Beta1WorkspaceState.WorkspaceStateRunning,
  });

  const allWorkspaces = [...namespaceAWorkspaces, ...namespaceBWorkspaces];

  cy.interceptApi(
    'GET /api/:apiVersion/namespaces',
    { path: { apiVersion: NOTEBOOKS_API_VERSION } },
    mockModArchResponse([mockNamespaceA, mockNamespaceB]),
  ).as('getNamespaces');

  cy.interceptApi(
    'GET /api/:apiVersion/workspacekinds/:kind',
    { path: { apiVersion: NOTEBOOKS_API_VERSION, kind: workspaceKindName } },
    mockModArchResponse(
      buildMockWorkspaceKindUpdate(buildMockWorkspaceKind({ name: workspaceKindName })),
    ),
  ).as('getWorkspaceKind');

  cy.interceptApi(
    'GET /api/:apiVersion/workspaces',
    { path: { apiVersion: NOTEBOOKS_API_VERSION } },
    mockModArchResponse(allWorkspaces),
  ).as('getAllWorkspaces');

  cy.interceptApi(
    'GET /api/:apiVersion/workspaces/:namespace',
    { path: { apiVersion: NOTEBOOKS_API_VERSION, namespace: mockNamespaceA.name } },
    mockModArchResponse(namespaceAWorkspaces),
  ).as('getWorkspacesNamespaceA');

  cy.interceptApi(
    'GET /api/:apiVersion/workspaces/:namespace',
    { path: { apiVersion: NOTEBOOKS_API_VERSION, namespace: mockNamespaceB.name } },
    mockModArchResponse(namespaceBWorkspaces),
  ).as('getWorkspacesNamespaceB');

  return { mockNamespaceA, mockNamespaceB, namespaceAWorkspaces, namespaceBWorkspaces };
};

const visitWorkspaceKindSummary = (
  workspaceKind: string,
  state?: WorkspaceKindSummaryNavigationState,
) => {
  workspaceKindSummary.visit(workspaceKind, state);
  cy.wait(['@getNamespaces', '@getAllWorkspaces']);
};

describe('Workspace Kind Summary', () => {
  describe('Basic', () => {
    it('stops the chosen workspace when the same name exists in two namespaces', () => {
      const { mockNamespaceA, mockNamespaceB, namespaceAWorkspaces, namespaceBWorkspaces } =
        setupMultiNamespaceWorkspaces({
          workspaceKindName: TEST_WORKSPACE_KIND,
          namespaceACount: 1,
          namespaceBCount: 1,
        });
      const workspaceName = namespaceBWorkspaces[0].name;
      expect(namespaceAWorkspaces[0].name).to.equal(workspaceName);

      cy.interceptApi(
        'POST /api/:apiVersion/workspaces/:namespace/:workspaceName/actions/pause',
        {
          path: {
            apiVersion: NOTEBOOKS_API_VERSION,
            namespace: mockNamespaceA.name,
            workspaceName,
          },
        },
        mockModArchResponse(buildMockActionsWorkspaceActionPause()),
      ).as('stopNamespaceA');
      cy.interceptApi(
        'POST /api/:apiVersion/workspaces/:namespace/:workspaceName/actions/pause',
        {
          path: {
            apiVersion: NOTEBOOKS_API_VERSION,
            namespace: mockNamespaceB.name,
            workspaceName,
          },
        },
        mockModArchResponse(buildMockActionsWorkspaceActionPause()),
      ).as('stopNamespaceB');

      visitWorkspaceKindSummary(TEST_WORKSPACE_KIND);
      navBar.selectNamespace(mockNamespaceA.name);
      workspaceKindSummary.stopWorkspaceInNamespace(mockNamespaceB.name, workspaceName);
      stopModal.findStopButton().click();

      cy.wait('@stopNamespaceB');
      cy.get('@stopNamespaceA.all').should('have.length', 0);
      stopModal.assertModalNotExists();
    });

    it('should display the workspace kind summary page with correct title', () => {
      setupWorkspaceKindSummary({
        workspaceKindName: TEST_WORKSPACE_KIND,
        namespace: DEFAULT_NAMESPACE,
        workspaceCount: 3,
      });

      visitWorkspaceKindSummary(TEST_WORKSPACE_KIND);

      workspaceKindSummary.verifyPageURL(TEST_WORKSPACE_KIND);
      workspaceKindSummary.findPageTitle(TEST_WORKSPACE_KIND);
    });

    it('should navigate to workspace kinds page when clicking breadcrumb', () => {
      setupWorkspaceKindSummary({
        workspaceKindName: TEST_WORKSPACE_KIND,
        namespace: DEFAULT_NAMESPACE,
        workspaceCount: 3,
      });

      cy.interceptApi(
        'GET /api/:apiVersion/workspacekinds',
        { path: { apiVersion: NOTEBOOKS_API_VERSION } },
        mockModArchResponse([]),
      ).as('getWorkspaceKinds');

      visitWorkspaceKindSummary(TEST_WORKSPACE_KIND);

      workspaceKindSummary.clickBreadcrumbWorkspaceKinds();
      cy.wait('@getWorkspaceKinds');
      workspaceKinds.verifyPageURL();
    });

    it('should display the correct number of workspaces', () => {
      const { mockWorkspaces } = setupWorkspaceKindSummary({
        workspaceKindName: TEST_WORKSPACE_KIND,
        namespace: DEFAULT_NAMESPACE,
        workspaceCount: 5,
      });

      visitWorkspaceKindSummary(TEST_WORKSPACE_KIND);

      workspaceKindSummary.assertWorkspaceCount(mockWorkspaces.length);
    });

    it('should display workspace names in the table', () => {
      const { mockWorkspaces } = setupWorkspaceKindSummary({
        workspaceKindName: TEST_WORKSPACE_KIND,
        namespace: DEFAULT_NAMESPACE,
        workspaceCount: 3,
      });

      visitWorkspaceKindSummary(TEST_WORKSPACE_KIND);

      mockWorkspaces.forEach((workspace, index) => {
        workspaceKindSummary.assertWorkspaceRowName(index, workspace.name);
      });
    });
  });

  describe('Empty state', () => {
    it('should display empty state when no workspaces exist for the workspace kind', () => {
      setupWorkspaceKindSummary({
        workspaceKindName: TEST_WORKSPACE_KIND,
        namespace: DEFAULT_NAMESPACE,
        workspaceCount: 0,
      });

      visitWorkspaceKindSummary(TEST_WORKSPACE_KIND);

      workspaceKindSummary.assertWorkspaceCount(0);
      workspaceKindSummary.assertEmptyStateVisible();
    });
  });

  describe('Summary card', () => {
    it('should display the summary card by default in expanded state', () => {
      setupWorkspaceKindSummary({
        workspaceKindName: TEST_WORKSPACE_KIND,
        namespace: DEFAULT_NAMESPACE,
        workspaceCount: 3,
      });

      visitWorkspaceKindSummary(TEST_WORKSPACE_KIND);

      workspaceKindSummary.assertSummaryCardExists();
      workspaceKindSummary.assertSummaryCardExpanded(true);
    });

    it('should toggle summary card expansion', () => {
      setupWorkspaceKindSummary({
        workspaceKindName: TEST_WORKSPACE_KIND,
        namespace: DEFAULT_NAMESPACE,
        workspaceCount: 3,
      });

      visitWorkspaceKindSummary(TEST_WORKSPACE_KIND);

      workspaceKindSummary.assertSummaryCardExpanded(true);

      workspaceKindSummary.toggleSummaryCard();
      workspaceKindSummary.assertSummaryCardExpanded(false);

      workspaceKindSummary.toggleSummaryCard();
      workspaceKindSummary.assertSummaryCardExpanded(true);
    });
  });

  describe('GPU metrics', () => {
    it('should display total GPUs in use for running workspaces', () => {
      const mockWorkspaces = [
        buildMockWorkspaceWithGPU({
          name: 'Workspace 1',
          namespace: DEFAULT_NAMESPACE,
          workspaceKindName: TEST_WORKSPACE_KIND,
          gpuCount: 2,
          state: V1Beta1WorkspaceState.WorkspaceStateRunning,
        }),
        buildMockWorkspaceWithGPU({
          name: 'Workspace 2',
          namespace: DEFAULT_NAMESPACE,
          workspaceKindName: TEST_WORKSPACE_KIND,
          gpuCount: 3,
          state: V1Beta1WorkspaceState.WorkspaceStateRunning,
        }),
        buildMockWorkspaceWithGPU({
          name: 'Workspace 3',
          namespace: DEFAULT_NAMESPACE,
          workspaceKindName: TEST_WORKSPACE_KIND,
          gpuCount: 4,
          state: V1Beta1WorkspaceState.WorkspaceStatePaused,
        }),
      ];

      setupWorkspaceKindSummary({
        workspaceKindName: TEST_WORKSPACE_KIND,
        namespace: DEFAULT_NAMESPACE,
        workspaceCount: 0,
        customWorkspaces: mockWorkspaces,
      });

      visitWorkspaceKindSummary(TEST_WORKSPACE_KIND);

      // Only running workspaces count (2 + 3 = 5)
      workspaceKindSummary.assertTotalGPUsInUse(5);
      // Total requested includes paused (2 + 3 + 4 = 9)
      workspaceKindSummary.assertTotalGPUsRequested(9);
    });

    it('should display zero GPUs when no workspaces have GPUs', () => {
      const mockWorkspaces = [
        buildMockWorkspace({
          name: 'Workspace 1',
          namespace: DEFAULT_NAMESPACE,
          workspaceKind: buildMockWorkspaceKindInfo({ name: TEST_WORKSPACE_KIND }),
          state: V1Beta1WorkspaceState.WorkspaceStateRunning,
          podTemplate: buildMockPodTemplate({
            options: buildPodTemplateOptions({
              podConfig: buildMockPodConfig({
                current: buildMockOptionInfo({
                  id: 'cpu_pod',
                  displayName: 'CPU Pod',
                  description: 'Pod without GPUs',
                  labels: [],
                }),
              }),
            }),
          }),
        }),
      ];

      setupWorkspaceKindSummary({
        workspaceKindName: TEST_WORKSPACE_KIND,
        namespace: DEFAULT_NAMESPACE,
        workspaceCount: 0,
        customWorkspaces: mockWorkspaces,
      });

      visitWorkspaceKindSummary(TEST_WORKSPACE_KIND);

      workspaceKindSummary.assertTotalGPUsInUse(0);
      workspaceKindSummary.assertTotalGPUsRequested(0);
    });

    it('should display idle GPU workspaces count', () => {
      const now = new Date().getTime();
      const twoHoursAgo = now - 2 * 60 * 60 * 1000;

      const mockWorkspaces = [
        buildMockWorkspaceWithGPU({
          name: 'Active Workspace',
          namespace: DEFAULT_NAMESPACE,
          workspaceKindName: TEST_WORKSPACE_KIND,
          gpuCount: 1,
          state: V1Beta1WorkspaceState.WorkspaceStateRunning,
          activity: {
            lastActivity: now,
            lastUpdate: now,
          },
        }),
        buildMockWorkspaceWithGPU({
          name: 'Idle Workspace',
          namespace: DEFAULT_NAMESPACE,
          workspaceKindName: TEST_WORKSPACE_KIND,
          gpuCount: 2,
          state: V1Beta1WorkspaceState.WorkspaceStatePaused,
          activity: {
            lastActivity: twoHoursAgo,
            lastUpdate: twoHoursAgo,
          },
        }),
      ];

      setupWorkspaceKindSummary({
        workspaceKindName: TEST_WORKSPACE_KIND,
        namespace: DEFAULT_NAMESPACE,
        workspaceCount: 0,
        customWorkspaces: mockWorkspaces,
      });

      visitWorkspaceKindSummary(TEST_WORKSPACE_KIND);

      workspaceKindSummary.assertIdleGPUWorkspaces(1);
    });

    it('should filter by idle GPU workspaces when clicking the idle count', () => {
      const now = new Date().getTime();
      const twoHoursAgo = now - 2 * 60 * 60 * 1000;

      const mockWorkspaces = [
        buildMockWorkspaceWithGPU({
          name: 'Active Workspace',
          namespace: DEFAULT_NAMESPACE,
          workspaceKindName: TEST_WORKSPACE_KIND,
          gpuCount: 1,
          state: V1Beta1WorkspaceState.WorkspaceStateRunning,
          activity: {
            lastActivity: now,
            lastUpdate: now,
          },
        }),
        buildMockWorkspaceWithGPU({
          name: 'Idle Workspace',
          namespace: DEFAULT_NAMESPACE,
          workspaceKindName: TEST_WORKSPACE_KIND,
          gpuCount: 2,
          state: V1Beta1WorkspaceState.WorkspaceStatePaused,
          activity: {
            lastActivity: twoHoursAgo,
            lastUpdate: twoHoursAgo,
          },
        }),
      ];

      setupWorkspaceKindSummary({
        workspaceKindName: TEST_WORKSPACE_KIND,
        namespace: DEFAULT_NAMESPACE,
        workspaceCount: 0,
        customWorkspaces: mockWorkspaces,
      });

      visitWorkspaceKindSummary(TEST_WORKSPACE_KIND);

      workspaceKindSummary.assertWorkspaceCount(2);
      workspaceKindSummary.clickIdleGPUWorkspaces();
      workspaceKindSummary.assertWorkspaceCount(1);
    });
  });

  describe('Top GPU consumer namespaces', () => {
    it('should display top GPU consumer namespaces', () => {
      const mockNamespaceA = buildMockNamespace({ name: NAMESPACE_A });
      const mockNamespaceB = buildMockNamespace({ name: NAMESPACE_B });
      const mockWorkspaceKind = buildMockWorkspaceKindInfo({ name: TEST_WORKSPACE_KIND });

      const mockWorkspaces = [
        buildMockWorkspace({
          name: 'Workspace A1',
          namespace: mockNamespaceA.name,
          workspaceKind: mockWorkspaceKind,
          state: V1Beta1WorkspaceState.WorkspaceStateRunning,
          podTemplate: buildMockPodTemplate({
            options: buildPodTemplateOptions({
              podConfig: buildMockPodConfig({
                current: buildMockOptionInfo({
                  id: 'gpu_pod',
                  displayName: 'GPU Pod',
                  description: 'Pod with 5 GPUs',
                  labels: [{ key: 'gpu', value: '5' }],
                }),
              }),
            }),
          }),
        }),
        buildMockWorkspace({
          name: 'Workspace B1',
          namespace: mockNamespaceB.name,
          workspaceKind: mockWorkspaceKind,
          state: V1Beta1WorkspaceState.WorkspaceStateRunning,
          podTemplate: buildMockPodTemplate({
            options: buildPodTemplateOptions({
              podConfig: buildMockPodConfig({
                current: buildMockOptionInfo({
                  id: 'gpu_pod',
                  displayName: 'GPU Pod',
                  description: 'Pod with 3 GPUs',
                  labels: [{ key: 'gpu', value: '3' }],
                }),
              }),
            }),
          }),
        }),
      ];

      cy.interceptApi(
        'GET /api/:apiVersion/namespaces',
        { path: { apiVersion: NOTEBOOKS_API_VERSION } },
        mockModArchResponse([mockNamespaceA, mockNamespaceB]),
      ).as('getNamespaces');

      cy.interceptApi(
        'GET /api/:apiVersion/workspacekinds/:kind',
        { path: { apiVersion: NOTEBOOKS_API_VERSION, kind: TEST_WORKSPACE_KIND } },
        mockModArchResponse(
          buildMockWorkspaceKindUpdate(buildMockWorkspaceKind({ name: TEST_WORKSPACE_KIND })),
        ),
      ).as('getWorkspaceKind');

      cy.interceptApi(
        'GET /api/:apiVersion/workspaces',
        { path: { apiVersion: NOTEBOOKS_API_VERSION } },
        mockModArchResponse(mockWorkspaces),
      ).as('getAllWorkspaces');

      cy.interceptApi(
        'GET /api/:apiVersion/workspaces/:namespace',
        { path: { apiVersion: NOTEBOOKS_API_VERSION, namespace: mockNamespaceA.name } },
        mockModArchResponse([mockWorkspaces[0]]),
      ).as('getWorkspacesA');

      cy.interceptApi(
        'GET /api/:apiVersion/workspaces/:namespace',
        { path: { apiVersion: NOTEBOOKS_API_VERSION, namespace: mockNamespaceB.name } },
        mockModArchResponse([mockWorkspaces[1]]),
      ).as('getWorkspacesB');

      visitWorkspaceKindSummary(TEST_WORKSPACE_KIND);
      workspaceKindSummary.assertTopGPUConsumerNamespace(NAMESPACE_A, 5);
      workspaceKindSummary.assertTopGPUConsumerNamespace(NAMESPACE_B, 3);
    });

    it('should display "None" when no namespaces have GPU workspaces', () => {
      const mockWorkspaces = [
        buildMockWorkspace({
          name: 'Workspace 1',
          namespace: DEFAULT_NAMESPACE,
          workspaceKind: buildMockWorkspaceKindInfo({ name: TEST_WORKSPACE_KIND }),
          state: V1Beta1WorkspaceState.WorkspaceStateRunning,
          podTemplate: buildMockPodTemplate({
            options: buildPodTemplateOptions({
              podConfig: buildMockPodConfig({
                current: buildMockOptionInfo({
                  id: 'cpu_pod',
                  displayName: 'CPU Pod',
                  description: 'Pod without GPUs',
                  labels: [],
                }),
              }),
            }),
          }),
        }),
      ];

      setupWorkspaceKindSummary({
        workspaceKindName: TEST_WORKSPACE_KIND,
        namespace: DEFAULT_NAMESPACE,
        workspaceCount: 0,
        customWorkspaces: mockWorkspaces,
      });

      visitWorkspaceKindSummary(TEST_WORKSPACE_KIND);

      workspaceKindSummary.assertNoTopGPUConsumers();
    });

    it('should filter by namespace when clicking top GPU consumer namespace', () => {
      const { mockNamespaceA } = setupMultiNamespaceWorkspaces({
        workspaceKindName: TEST_WORKSPACE_KIND,
        namespaceACount: 3,
        namespaceBCount: 2,
      });

      visitWorkspaceKindSummary(TEST_WORKSPACE_KIND);

      workspaceKindSummary.assertWorkspaceCount(5);
      workspaceKindSummary.clickTopGPUConsumerNamespace(mockNamespaceA.name);
      workspaceKindSummary.assertWorkspaceCount(3);
    });
  });

  describe('Navigation state filters', () => {
    it('should filter workspaces by namespace from navigation state', () => {
      const { mockNamespaceA, namespaceAWorkspaces } = setupMultiNamespaceWorkspaces({
        workspaceKindName: TEST_WORKSPACE_KIND,
        namespaceACount: 3,
        namespaceBCount: 2,
      });

      visitWorkspaceKindSummary(TEST_WORKSPACE_KIND, { namespace: mockNamespaceA.name });

      workspaceKindSummary.assertWorkspaceCount(namespaceAWorkspaces.length);
    });

    it('should filter workspaces by imageId from navigation state', () => {
      const imageId = 'test-image-id';
      const mockWorkspaces = [
        buildMockWorkspaceWithImage({
          name: 'Workspace 1',
          namespace: DEFAULT_NAMESPACE,
          workspaceKindName: TEST_WORKSPACE_KIND,
          imageId,
          imageDisplayName: 'Test Image',
        }),
        buildMockWorkspaceWithImage({
          name: 'Workspace 2',
          namespace: DEFAULT_NAMESPACE,
          workspaceKindName: TEST_WORKSPACE_KIND,
          imageId: 'other-image-id',
          imageDisplayName: 'Other Image',
        }),
      ];

      setupWorkspaceKindSummary({
        workspaceKindName: TEST_WORKSPACE_KIND,
        namespace: DEFAULT_NAMESPACE,
        workspaceCount: 0,
        customWorkspaces: mockWorkspaces,
      });

      visitWorkspaceKindSummary(TEST_WORKSPACE_KIND, { imageId });

      workspaceKindSummary.assertWorkspaceCount(1);
    });

    it('should filter workspaces by podConfigId from navigation state', () => {
      const podConfigId = 'large-gpu';
      const mockWorkspaces = [
        buildMockWorkspaceWithPodConfig({
          name: 'Workspace 1',
          namespace: DEFAULT_NAMESPACE,
          workspaceKindName: TEST_WORKSPACE_KIND,
          podConfigId,
          podConfigDisplayName: 'Large GPU',
          podConfigDescription: 'Pod with 8 GPUs',
          labels: [{ key: 'gpu', value: '8' }],
        }),
        buildMockWorkspaceWithPodConfig({
          name: 'Workspace 2',
          namespace: DEFAULT_NAMESPACE,
          workspaceKindName: TEST_WORKSPACE_KIND,
          podConfigId: 'small-cpu',
          podConfigDisplayName: 'Small CPU',
          podConfigDescription: 'Pod without GPUs',
          labels: [],
        }),
      ];

      setupWorkspaceKindSummary({
        workspaceKindName: TEST_WORKSPACE_KIND,
        namespace: DEFAULT_NAMESPACE,
        workspaceCount: 0,
        customWorkspaces: mockWorkspaces,
      });

      visitWorkspaceKindSummary(TEST_WORKSPACE_KIND, { podConfigId });

      workspaceKindSummary.assertWorkspaceCount(1);
    });

    it('should apply multiple filters from navigation state simultaneously', () => {
      const imageId = 'test-image-id';
      const mockWorkspaces = [
        buildMockWorkspaceWithImage({
          name: 'Matching Workspace',
          namespace: NAMESPACE_A,
          workspaceKindName: TEST_WORKSPACE_KIND,
          imageId,
          imageDisplayName: 'Test Image',
        }),
        buildMockWorkspaceWithImage({
          name: 'Non-matching Image',
          namespace: NAMESPACE_A,
          workspaceKindName: TEST_WORKSPACE_KIND,
          imageId: 'other-image',
          imageDisplayName: 'Other Image',
        }),
        buildMockWorkspaceWithImage({
          name: 'Non-matching Namespace',
          namespace: NAMESPACE_B,
          workspaceKindName: TEST_WORKSPACE_KIND,
          imageId,
          imageDisplayName: 'Test Image',
        }),
      ];

      const mockNamespaceA = buildMockNamespace({ name: NAMESPACE_A });
      const mockNamespaceB = buildMockNamespace({ name: NAMESPACE_B });

      cy.interceptApi(
        'GET /api/:apiVersion/namespaces',
        { path: { apiVersion: NOTEBOOKS_API_VERSION } },
        mockModArchResponse([mockNamespaceA, mockNamespaceB]),
      ).as('getNamespaces');

      cy.interceptApi(
        'GET /api/:apiVersion/workspacekinds/:kind',
        { path: { apiVersion: NOTEBOOKS_API_VERSION, kind: TEST_WORKSPACE_KIND } },
        mockModArchResponse(
          buildMockWorkspaceKindUpdate(buildMockWorkspaceKind({ name: TEST_WORKSPACE_KIND })),
        ),
      ).as('getWorkspaceKind');

      cy.interceptApi(
        'GET /api/:apiVersion/workspaces',
        { path: { apiVersion: NOTEBOOKS_API_VERSION } },
        mockModArchResponse(mockWorkspaces),
      ).as('getAllWorkspaces');

      cy.interceptApi(
        'GET /api/:apiVersion/workspaces/:namespace',
        { path: { apiVersion: NOTEBOOKS_API_VERSION, namespace: mockNamespaceA.name } },
        mockModArchResponse([mockWorkspaces[0], mockWorkspaces[1]]),
      ).as('getWorkspacesA');

      cy.interceptApi(
        'GET /api/:apiVersion/workspaces/:namespace',
        { path: { apiVersion: NOTEBOOKS_API_VERSION, namespace: mockNamespaceB.name } },
        mockModArchResponse([mockWorkspaces[2]]),
      ).as('getWorkspacesB');

      visitWorkspaceKindSummary(TEST_WORKSPACE_KIND, { namespace: NAMESPACE_A, imageId });

      workspaceKindSummary.assertWorkspaceCount(1);
    });

    it('should clear all filters when clicking clear all', () => {
      const { mockNamespaceA } = setupMultiNamespaceWorkspaces({
        workspaceKindName: TEST_WORKSPACE_KIND,
        namespaceACount: 3,
        namespaceBCount: 2,
      });

      visitWorkspaceKindSummary(TEST_WORKSPACE_KIND);

      workspaceKindSummary.assertWorkspaceCount(5);
      workspaceKindSummary.clickTopGPUConsumerNamespace(mockNamespaceA.name);
      workspaceKindSummary.assertWorkspaceCount(3);
      workspaceKindSummary.clearAllFilters();
      workspaceKindSummary.assertWorkspaceCount(5);
    });
  });

  describe('Workspace states', () => {
    it('should display workspaces with different states', () => {
      const mockWorkspaces = [
        buildMockWorkspace({
          name: 'Running Workspace',
          namespace: DEFAULT_NAMESPACE,
          workspaceKind: buildMockWorkspaceKindInfo({ name: TEST_WORKSPACE_KIND }),
          state: V1Beta1WorkspaceState.WorkspaceStateRunning,
        }),
        buildMockWorkspace({
          name: 'Paused Workspace',
          namespace: DEFAULT_NAMESPACE,
          workspaceKind: buildMockWorkspaceKindInfo({ name: TEST_WORKSPACE_KIND }),
          state: V1Beta1WorkspaceState.WorkspaceStatePaused,
        }),
        buildMockWorkspace({
          name: 'Error Workspace',
          namespace: DEFAULT_NAMESPACE,
          workspaceKind: buildMockWorkspaceKindInfo({ name: TEST_WORKSPACE_KIND }),
          state: V1Beta1WorkspaceState.WorkspaceStateError,
        }),
      ];

      setupWorkspaceKindSummary({
        workspaceKindName: TEST_WORKSPACE_KIND,
        namespace: DEFAULT_NAMESPACE,
        workspaceCount: 0,
        customWorkspaces: mockWorkspaces,
      });

      visitWorkspaceKindSummary(TEST_WORKSPACE_KIND);

      workspaceKindSummary.assertWorkspaceCount(3);
      workspaceKindSummary.assertWorkspaceRowName(0, 'Running Workspace');
      workspaceKindSummary.assertWorkspaceRowName(1, 'Paused Workspace');
      workspaceKindSummary.assertWorkspaceRowName(2, 'Error Workspace');
    });
  });

  // Regression test for #1413
  describe('Delete from another namespace', () => {
    const SELECTED_NAMESPACE = 'example-profile-1';
    const WORKSPACE_NAMESPACE = 'example-profile-2';
    const WORKSPACE_NAME = 'jupyterlab-workspace';

    it('should send the DELETE request to the workspace namespace, not the selected one', () => {
      const mockWorkspace = buildMockWorkspace({
        name: WORKSPACE_NAME,
        namespace: WORKSPACE_NAMESPACE,
        workspaceKind: buildMockWorkspaceKindInfo({ name: TEST_WORKSPACE_KIND }),
      });

      cy.interceptApi(
        'GET /api/:apiVersion/namespaces',
        { path: { apiVersion: NOTEBOOKS_API_VERSION } },
        mockModArchResponse([
          buildMockNamespace({ name: SELECTED_NAMESPACE }),
          buildMockNamespace({ name: WORKSPACE_NAMESPACE }),
        ]),
      ).as('getNamespaces');
      cy.interceptApi(
        'GET /api/:apiVersion/workspacekinds/:kind',
        { path: { apiVersion: NOTEBOOKS_API_VERSION, kind: TEST_WORKSPACE_KIND } },
        mockModArchResponse(
          buildMockWorkspaceKindUpdate(buildMockWorkspaceKind({ name: TEST_WORKSPACE_KIND })),
        ),
      ).as('getWorkspaceKind');
      cy.interceptApi(
        'GET /api/:apiVersion/workspaces',
        { path: { apiVersion: NOTEBOOKS_API_VERSION } },
        mockModArchResponse([mockWorkspace]),
      ).as('getAllWorkspaces');
      cy.interceptApi(
        'GET /api/:apiVersion/workspaces/:namespace/:workspaceName/podtemplate/details',
        {
          path: {
            apiVersion: NOTEBOOKS_API_VERSION,
            namespace: WORKSPACE_NAMESPACE,
            workspaceName: WORKSPACE_NAME,
          },
        },
        mockModArchResponse(buildMockWorkspaceDetails()),
      ).as('getWorkspaceDetails');
      cy.interceptApi(
        'DELETE /api/:apiVersion/workspaces/:namespace/:workspaceName',
        {
          path: {
            apiVersion: NOTEBOOKS_API_VERSION,
            namespace: WORKSPACE_NAMESPACE,
            workspaceName: WORKSPACE_NAME,
          },
        },
        undefined,
      ).as('deleteInWorkspaceNamespace');
      cy.interceptApi(
        'DELETE /api/:apiVersion/workspaces/:namespace/:workspaceName',
        {
          path: {
            apiVersion: NOTEBOOKS_API_VERSION,
            namespace: SELECTED_NAMESPACE,
            workspaceName: WORKSPACE_NAME,
          },
        },
        undefined,
      ).as('deleteInSelectedNamespace');

      visitWorkspaceKindSummary(TEST_WORKSPACE_KIND);
      navBar.selectNamespace(SELECTED_NAMESPACE);
      navBar.findNamespaceSelector().should('contain', SELECTED_NAMESPACE);

      workspaces.clickViewDetailsAction(WORKSPACE_NAME);
      workspaceDetailsDrawer.assertDrawerExists();
      workspaceDetailsDrawer.clickDeleteAction();

      deleteModal.assertModalExists();
      deleteModal
        .find()
        .should('contain', `Are you sure you want to delete ${WORKSPACE_NAME}`)
        .and('contain', `in namespace ${WORKSPACE_NAMESPACE}`);
      deleteModal.typeConfirmationName(WORKSPACE_NAME);
      deleteModal.clickSubmit();

      cy.wait('@deleteInWorkspaceNamespace').then((interception) => {
        expect(interception.request.method).to.equal('DELETE');
        // The mock server has no `/workspaces` prefix; that comes from the in-cluster route.
        expect(new URL(interception.request.url).pathname).to.equal(
          `/api/${NOTEBOOKS_API_VERSION}/workspaces/${WORKSPACE_NAMESPACE}/${WORKSPACE_NAME}`,
        );
      });
      cy.get('@deleteInSelectedNamespace.all').should('have.length', 0);
    });
  });
});
