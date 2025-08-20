import { ErrorEnvelopeException } from '~/shared/api/apiUtils';
import { FieldErrorType } from '~/shared/api/backendApiTypes';
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
import { isInvalidYaml } from '~/shared/mock/mockUtils';

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

export const mockCreateWorkspaceKind: CreateWorkspaceKindAPI = () => async (_opts, data) => {
  if (isInvalidYaml(data)) {
    throw new ErrorEnvelopeException({
      error: {
        code: 'invalid_yaml',
        message: 'Invalid YAML provided',
        cause: {
          // eslint-disable-next-line camelcase
          validation_errors: [
            {
              type: FieldErrorType.FieldValueRequired,
              field: 'spec.spawner.displayName',
              message: "Missing required 'spec.spawner.displayName' property",
            },
            {
              type: FieldErrorType.FieldValueUnknown,
              field: 'spec.spawner.xyz',
              message: "Unknown property 'spec.spawner.xyz'",
            },
            {
              type: FieldErrorType.FieldValueNotSupported,
              field: 'spec.spawner.hidden',
              message: "Invalid data type for 'spec.spawner.hidden', expected 'boolean'",
            },
          ],
        },
      },
    });
  }
  return mockWorkspaceKind1;
};

export const mockUpdateWorkspaceKind: UpdateWorkspaceKindAPI = () => async () => mockWorkspaceKind1;

export const mockPatchWorkspaceKind: PatchWorkspaceKindAPI = () => async () => mockWorkspaceKind1;

export const mockDeleteWorkspaceKind: DeleteWorkspaceKindAPI = () => async () => {
  await delay(1500);
};
