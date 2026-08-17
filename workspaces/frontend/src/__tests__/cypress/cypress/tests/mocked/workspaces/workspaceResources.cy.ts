import { mockModArchResponse } from 'mod-arch-core';
import {
  workspaceDetailsDrawer,
  workspaces,
} from '~/__tests__/cypress/cypress/pages/workspaces/workspaces';
import {
  buildMockContainerResourceUsage,
  buildMockNamespace,
  buildMockWorkspace,
  buildMockWorkspaceDetails,
  buildMockWorkspaceResourceUsage,
} from '~/shared/mock/mockBuilder';
import { NOTEBOOKS_API_VERSION } from '~/__tests__/cypress/cypress/support/commands/api';
import { navBar } from '~/__tests__/cypress/cypress/pages/components/navBar';
import { MetricsErrorCode, V1Beta1WorkspaceState } from '~/generated/data-contracts';

const DEFAULT_NAMESPACE = 'default';
const TEST_WORKSPACE_NAME = 'TestWorkspace';

const setupWorkspaceWithResources = (
  resourceUsageOverrides?: Parameters<typeof buildMockWorkspaceResourceUsage>[0],
  workspaceState = V1Beta1WorkspaceState.WorkspaceStateRunning,
) => {
  const mockNamespace = buildMockNamespace({ name: DEFAULT_NAMESPACE });
  const mockWorkspace = buildMockWorkspace({
    name: TEST_WORKSPACE_NAME,
    namespace: DEFAULT_NAMESPACE,
    state: workspaceState,
  });

  cy.interceptApi(
    'GET /api/:apiVersion/namespaces',
    { path: { apiVersion: NOTEBOOKS_API_VERSION } },
    mockModArchResponse([mockNamespace]),
  ).as('getNamespaces');

  cy.interceptApi(
    'GET /api/:apiVersion/workspaces/:namespace',
    { path: { apiVersion: NOTEBOOKS_API_VERSION, namespace: DEFAULT_NAMESPACE } },
    mockModArchResponse([mockWorkspace]),
  ).as('getWorkspaces');

  cy.interceptApi(
    'GET /api/:apiVersion/workspaces/:namespace/:workspaceName/podtemplate/details',
    {
      path: {
        apiVersion: NOTEBOOKS_API_VERSION,
        namespace: DEFAULT_NAMESPACE,
        workspaceName: TEST_WORKSPACE_NAME,
      },
    },
    mockModArchResponse(buildMockWorkspaceDetails()),
  ).as('getWorkspaceDetails');

  cy.interceptApi(
    'GET /api/:apiVersion/workspaces/:namespace/:workspaceName/podtemplate/resources',
    {
      path: {
        apiVersion: NOTEBOOKS_API_VERSION,
        namespace: DEFAULT_NAMESPACE,
        workspaceName: TEST_WORKSPACE_NAME,
      },
    },
    mockModArchResponse(buildMockWorkspaceResourceUsage(resourceUsageOverrides)),
  ).as('getWorkspaceResources');

  workspaces.visit();
  cy.wait('@getNamespaces');
  navBar.selectNamespace(DEFAULT_NAMESPACE);
  cy.wait('@getWorkspaces');

  workspaces.findAction({ action: 'viewDetails', workspaceName: TEST_WORKSPACE_NAME }).click();
  workspaceDetailsDrawer.findResourcesTab().click();
  cy.wait('@getWorkspaceResources');
};

describe('Workspace Resources Tab', () => {
  it('should display resource cards with request, limit, and usage values', () => {
    setupWorkspaceWithResources();

    workspaceDetailsDrawer.assertResourceCardExists('cpu');
    workspaceDetailsDrawer.assertResourceCardExists('memory');

    workspaceDetailsDrawer.assertResourceRequest('cpu', '100');
    workspaceDetailsDrawer.assertResourceLimit('cpu', '500');
    workspaceDetailsDrawer.assertResourceUsage('cpu', '50');

    workspaceDetailsDrawer.assertResourceRequest('memory', '128 MiB');
    workspaceDetailsDrawer.assertResourceLimit('memory', '512 MiB');
    workspaceDetailsDrawer.assertResourceUsage('memory', '64 MiB');
  });

  it('should show pending when metrics are not yet available', () => {
    setupWorkspaceWithResources({
      containers: {
        main: buildMockContainerResourceUsage({ metricsFromMetricsServer: undefined }),
      },
    });

    workspaceDetailsDrawer.assertResourceCardExists('cpu');
    workspaceDetailsDrawer.assertResourceUsage('cpu', 'Pending');
    workspaceDetailsDrawer.assertResourceUsage('memory', 'Pending');
  });

  it('should show error alert when workspace is not running', () => {
    setupWorkspaceWithResources({
      error: MetricsErrorCode.ErrorCodeWorkspaceNotRunning,
      containers: undefined,
    });

    workspaceDetailsDrawer.assertResourceErrorAlert('resource-error-not-running');
  });

  it('should show error alert when metrics API is unavailable', () => {
    setupWorkspaceWithResources({
      error: MetricsErrorCode.ErrorCodeMetricsAPINotAvailable,
      containers: undefined,
    });

    workspaceDetailsDrawer.assertResourceErrorAlert('resource-error-no-metrics-api');
  });

  it('should switch between containers using the dropdown', () => {
    setupWorkspaceWithResources({
      containers: {
        main: buildMockContainerResourceUsage(),
        'istio-proxy': buildMockContainerResourceUsage({
          resources: {
            requests: { cpu: '10m', memory: '64Mi' } as unknown as Record<string, never>,
            limits: { cpu: '100m', memory: '128Mi' } as unknown as Record<string, never>,
          },
        }),
      },
    });

    workspaceDetailsDrawer.assertResourceRequest('cpu', '100');

    workspaceDetailsDrawer.selectResourceContainer('istio-proxy');

    workspaceDetailsDrawer.assertResourceRequest('cpu', '10');
    workspaceDetailsDrawer.assertResourceLimit('memory', '128 MiB');
  });

  it('should display GPU resource card when GPU limits are present', () => {
    setupWorkspaceWithResources({
      containers: {
        main: buildMockContainerResourceUsage({
          resources: {
            requests: { cpu: '1', memory: '2Gi' } as unknown as Record<string, never>,
            limits: {
              cpu: '2',
              memory: '4Gi',
              'nvidia.com/gpu': '1',
            } as unknown as Record<string, never>,
          },
        }),
      },
    });

    workspaceDetailsDrawer.assertResourceCardExists('cpu');
    workspaceDetailsDrawer.assertResourceCardExists('memory');
    workspaceDetailsDrawer.assertResourceCardExists('nvidia.com/gpu');
  });
});
