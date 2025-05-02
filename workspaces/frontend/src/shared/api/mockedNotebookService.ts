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
  UpdateWorkspaceAPI,
  UpdateWorkspaceKindAPI,
} from './callTypes';
import {
  mockedHealthCheck,
  mockNamespaces,
  mockWorkspaceKinds,
  mockAllWorkspaces,
  mockWorkspaceBase1,
} from './mockedData';

export const mockGetHealthCheck: GetHealthCheckAPI = () => async () => mockedHealthCheck;

export const mockListNamespaces: ListNamespacesAPI = () => async () => mockNamespaces;

export const mockListAllWorkspaces: ListAllWorkspacesAPI = () => async () => mockAllWorkspaces;

export const mockListWorkspaces: ListWorkspacesAPI = () => async (_opts, namespace) =>
  mockAllWorkspaces.filter((workspace) => workspace.namespace === namespace);

export const mockGetWorkspace: GetWorkspaceAPI = () => async (_opts, namespace, workspace) =>
  mockAllWorkspaces.find((w) => w.name === workspace && w.namespace === namespace)!;

export const mockCreateWorkspace: CreateWorkspaceAPI = () => async () => mockWorkspaceBase1;

// eslint-disable-next-line @typescript-eslint/no-empty-function
export const mockUpdateWorkspace: UpdateWorkspaceAPI = () => async () => {};

// eslint-disable-next-line @typescript-eslint/no-empty-function
export const mockPatchWorkspace: PatchWorkspaceAPI = () => async () => {};

// eslint-disable-next-line @typescript-eslint/no-empty-function
export const mockDeleteWorkspace: DeleteWorkspaceAPI = () => async () => {};

export const mockListWorkspaceKinds: ListWorkspaceKindsAPI = () => async () => mockWorkspaceKinds;

export const mockGetWorkspaceKind: GetWorkspaceKindAPI = () => async (_opts, kind) =>
  mockWorkspaceKinds.find((w) => w.name === kind)!;

// eslint-disable-next-line @typescript-eslint/no-empty-function
export const mockCreateWorkspaceKind: CreateWorkspaceKindAPI = () => async () => {};

// eslint-disable-next-line @typescript-eslint/no-empty-function
export const mockUpdateWorkspaceKind: UpdateWorkspaceKindAPI = () => async () => {};

// eslint-disable-next-line @typescript-eslint/no-empty-function
export const mockPatchWorkspaceKind: PatchWorkspaceKindAPI = () => async () => {};

// eslint-disable-next-line @typescript-eslint/no-empty-function
export const mockDeleteWorkspaceKind: DeleteWorkspaceKindAPI = () => async () => {};
