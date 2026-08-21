import { mockModArchResponse } from 'mod-arch-core';
import {
  buildMockNamespace,
  buildMockWorkspace,
  buildMockWorkspaceKindInfo,
} from '~/shared/mock/mockBuilder';
import { NOTEBOOKS_API_VERSION } from '~/__tests__/cypress/cypress/support/commands/api';
import { workspaces } from '~/__tests__/cypress/cypress/pages/workspaces/workspaces';
import { toastNotification } from '~/__tests__/cypress/cypress/pages/components/toastNotification';
import { V1Beta1WorkspaceState } from '~/generated/data-contracts';

const MINUTE = 60 * 1000;
const FROZEN_TIME = new Date('2025-06-15T12:00:00Z').getTime();

const mockNamespace = buildMockNamespace({ name: 'default' });
const mockKind = buildMockWorkspaceKindInfo({ name: 'jupyterlab' });

const buildActivityWorkspace = (
  name: string,
  eligibleAfterMs: number,
  state: V1Beta1WorkspaceState = V1Beta1WorkspaceState.WorkspaceStateRunning,
) =>
  buildMockWorkspace({
    name,
    namespace: 'default',
    workspaceKind: mockKind,
    state,
    stateMessage: `Workspace is ${state}`,
    activity: {
      lastActivity: FROZEN_TIME - 10 * MINUTE,
      lastUpdate: FROZEN_TIME - 10 * MINUTE,
      rules: { pauseWorkspace: { eligibleAfter: FROZEN_TIME + eligibleAfterMs } },
    },
  });

const buildSafeWorkspace = (name: string) =>
  buildMockWorkspace({
    name,
    namespace: 'default',
    workspaceKind: mockKind,
    state: V1Beta1WorkspaceState.WorkspaceStateRunning,
    stateMessage: 'Workspace is Running',
    activity: {
      lastActivity: FROZEN_TIME - 5 * MINUTE,
      lastUpdate: FROZEN_TIME - 5 * MINUTE,
    },
  });

const setupIntercepts = (mockWorkspaces: ReturnType<typeof buildMockWorkspace>[]) => {
  cy.interceptApi(
    'GET /api/:apiVersion/namespaces',
    { path: { apiVersion: NOTEBOOKS_API_VERSION } },
    mockModArchResponse([mockNamespace]),
  ).as('getNamespaces');

  cy.interceptApi(
    'GET /api/:apiVersion/workspaces/:namespace',
    { path: { apiVersion: NOTEBOOKS_API_VERSION, namespace: 'default' } },
    mockModArchResponse(mockWorkspaces),
  ).as('getWorkspaces');

  cy.interceptApi(
    'GET /api/:apiVersion/workspacekinds',
    { path: { apiVersion: NOTEBOOKS_API_VERSION } },
    mockModArchResponse([]),
  ).as('getWorkspaceKinds');
};

describe('Activity warning indicators', () => {
  beforeEach(() => {
    cy.clock(FROZEN_TIME, ['Date']);
  });

  it('shows warning indicator for workspace within 15 minutes of auto-pause', () => {
    const warningWorkspace = buildActivityWorkspace('ws-warning', 10 * MINUTE);
    setupIntercepts([warningWorkspace]);

    workspaces.visit();
    cy.wait('@getWorkspaces');

    workspaces.assertActivityWarningExists(0);
  });

  it('shows critical indicator for workspace within 5 minutes of auto-pause', () => {
    const criticalWorkspace = buildActivityWorkspace('ws-critical', 3 * MINUTE);
    setupIntercepts([criticalWorkspace]);

    workspaces.visit();
    cy.wait('@getWorkspaces');

    workspaces.assertActivityCriticalExists(0);
  });

  it('does not show indicator for workspace 30 minutes from auto-pause', () => {
    const safeWorkspace = buildActivityWorkspace('ws-safe', 30 * MINUTE);
    setupIntercepts([safeWorkspace]);

    workspaces.visit();
    cy.wait('@getWorkspaces');

    workspaces.assertNoActivityIndicator(0);
  });

  it('does not show indicator for paused workspace regardless of eligibleAfter', () => {
    const pausedWorkspace = buildActivityWorkspace(
      'ws-paused',
      3 * MINUTE,
      V1Beta1WorkspaceState.WorkspaceStatePaused,
    );
    setupIntercepts([pausedWorkspace]);

    workspaces.visit();
    cy.wait('@getWorkspaces');

    workspaces.assertNoActivityIndicator(0);
  });

  it('does not show indicator for workspace without activity rules', () => {
    const noRulesWorkspace = buildSafeWorkspace('ws-no-rules');
    setupIntercepts([noRulesWorkspace]);

    workspaces.visit();
    cy.wait('@getWorkspaces');

    workspaces.assertNoActivityIndicator(0);
  });

  it('shows toast when data refresh transitions workspace into warning state', () => {
    const safeWorkspace = buildActivityWorkspace('ws-transition', 20 * MINUTE);
    setupIntercepts([safeWorkspace]);

    workspaces.visit();
    cy.wait('@getWorkspaces');

    workspaces.assertNoActivityIndicator(0);
    toastNotification.assertWarningAlertNotExists();

    const warningWorkspace = buildActivityWorkspace('ws-transition', 10 * MINUTE);
    cy.interceptApi(
      'GET /api/:apiVersion/workspaces/:namespace',
      { path: { apiVersion: NOTEBOOKS_API_VERSION, namespace: 'default' } },
      mockModArchResponse([warningWorkspace]),
    ).as('getWorkspacesRefresh');

    cy.findByTestId('workspace-refresh-now').click();
    cy.wait('@getWorkspacesRefresh');

    toastNotification.assertWarningAlertExists();
    toastNotification.assertWarningAlertContainsMessage('ws-transition');
    workspaces.assertActivityWarningExists(0);
  });
});
