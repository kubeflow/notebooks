import {
  CreateWorkspaceAPI,
  CreateWorkspaceKindAPI,
  DeleteWorkspaceAPI,
  DeleteWorkspaceKindAPI,
  GetHealthCheckAPI,
  GetWorkspaceAPI,
  GetWorkspaceKindAPI,
  ListAllWorkspacesAPI,
  ListNamespacesAPI,
  ListWorkspaceKindsAPI,
  ListWorkspacesAPI,
  PatchWorkspaceAPI,
  PatchWorkspaceKindAPI,
  PauseWorkspaceAPI,
  StartWorkspaceAPI,
  UpdateWorkspaceAPI,
  UpdateWorkspaceKindAPI,
} from '~/shared/api/callTypes';
import {
  mockAllWorkspaces,
  mockedHealthCheckResponse,
  mockNamespaces,
  mockPausedStateResponse,
  mockStartedStateResponse,
  mockWorkspace1,
  mockWorkspaceKind1,
  mockWorkspaceKinds,
} from '~/shared/mock/mockNotebookServiceData';

const delay = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export const mockGetHealthCheck: GetHealthCheckAPI = () => async () => mockedHealthCheckResponse;

export const mockListNamespaces: ListNamespacesAPI = () => async () => mockNamespaces;

export const mockListAllWorkspaces: ListAllWorkspacesAPI = () => async () => mockAllWorkspaces;

export const mockListWorkspaces: ListWorkspacesAPI = () => async (_opts, namespace) =>
  mockAllWorkspaces.filter((workspace) => workspace.namespace === namespace);

export const mockGetWorkspace: GetWorkspaceAPI = () => async (_opts, namespace, workspace) =>
  mockAllWorkspaces.find((w) => w.name === workspace && w.namespace === namespace)!;

export const mockCreateWorkspace: CreateWorkspaceAPI = () => async () => mockWorkspace1;

export const mockUpdateWorkspace: UpdateWorkspaceAPI = () => async () => mockWorkspace1;

export const mockPatchWorkspace: PatchWorkspaceAPI = () => async () => mockWorkspace1;

export const mockDeleteWorkspace: DeleteWorkspaceAPI = () => async () => {
  await delay(1500);
};

export const mockPauseWorkspace: PauseWorkspaceAPI = () => async (_opts, namespace, workspace) => {
  await delay(1500);
  return { ...mockPausedStateResponse, namespace, workspaceName: workspace };
};

export const mockStartWorkspace: StartWorkspaceAPI = () => async (_opts, namespace, workspace) => {
  await delay(1500);
  return { ...mockStartedStateResponse, namespace, workspaceName: workspace };
};

export const mockListWorkspaceKinds: ListWorkspaceKindsAPI = () => async () => mockWorkspaceKinds;

export const mockGetWorkspaceKind: GetWorkspaceKindAPI = () => async (_opts, kind) =>
  mockWorkspaceKinds.find((w) => w.name === kind)!;

export const mockCreateWorkspaceKind: CreateWorkspaceKindAPI = () => async () => mockWorkspaceKind1;

export const mockUpdateWorkspaceKind: UpdateWorkspaceKindAPI = () => async () => mockWorkspaceKind1;

export const mockPatchWorkspaceKind: PatchWorkspaceKindAPI = () => async () => mockWorkspaceKind1;

export const mockDeleteWorkspaceKind: DeleteWorkspaceKindAPI = () => async () => {
  await delay(1500);
};
