import { ApiErrorEnvelope, FieldErrorType } from '~/generated/data-contracts';
import { NotebookApis } from '~/shared/api/notebookApi';
import {
  mockAllWorkspaces,
  mockedHealthCheckResponse,
  mockNamespaces,
  mockWorkspaceCreate,
  mockSecretCreate,
  mockSecretsList,
  mockWorkspaceKind1,
  mockWorkspaceKinds,
  mockWorkspaceUpdate,
} from '~/shared/mock/mockNotebookServiceData';
import { buildAxiosError, isInvalidWorkspace, isInvalidYaml } from '~/shared/mock/mockUtils';
import { buildMockWorkspaceUpdateFromWorkspace } from './mockBuilder';

const delay = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export const mockNotebookApisImpl = (): NotebookApis => ({
  healthCheck: {
    getHealthcheck: async () => mockedHealthCheckResponse,
  },
  namespaces: {
    listNamespaces: async () => ({ data: mockNamespaces }),
  },
  workspaces: {
    listAllWorkspaces: async () => ({ data: mockAllWorkspaces }),
    listWorkspacesByNamespace: async (namespace) => ({
      data: mockAllWorkspaces.filter((w) => w.namespace === namespace),
    }),
    getWorkspace: async (namespace, workspaceName) => {
      const workspace = mockAllWorkspaces.find(
        (w) => w.name === workspaceName && w.namespace === namespace,
      )!;
      const workspaceUpdate = buildMockWorkspaceUpdateFromWorkspace({ workspace });
      return { data: workspaceUpdate };
    },
    createWorkspace: async (_namespace, body) => {
      if (isInvalidWorkspace(body.data)) {
        const apiErrorEnvelope: ApiErrorEnvelope = {
          error: {
            code: 'invalid_name',
            message: 'Invalid name',
            cause: {
              // eslint-disable-next-line camelcase
              validation_errors: [
                {
                  type: FieldErrorType.ErrorTypeInvalid,
                  field: 'name',
                  message: 'Invalid field',
                },
              ],
            },
          },
        };
        throw buildAxiosError(apiErrorEnvelope);
      }
      return { data: mockWorkspaceCreate };
    },
    updateWorkspace: async () => ({ data: mockWorkspaceUpdate }),
    deleteWorkspace: async () => {
      await delay(1500);
    },
    updateWorkspacePauseState: async (_namespace, _workspaceName, body) => {
      await delay(1500);
      return {
        data: { paused: body.data.paused },
      };
    },
  },
  workspaceKinds: {
    listWorkspaceKinds: async () => ({ data: mockWorkspaceKinds }),
    getWorkspaceKind: async (kind) => ({
      data: mockWorkspaceKinds.find((w) => w.name === kind)!,
    }),
    createWorkspaceKind: async (body) => {
      if (isInvalidYaml(body)) {
        const apiErrorEnvelope: ApiErrorEnvelope = {
          error: {
            code: 'invalid_yaml',
            message: 'Invalid YAML provided',
            cause: {
              // eslint-disable-next-line camelcase
              validation_errors: [
                {
                  type: FieldErrorType.ErrorTypeRequired,
                  field: 'spec.spawner.displayName',
                  message: "Missing required 'spec.spawner.displayName' property",
                },
                {
                  type: FieldErrorType.ErrorTypeInvalid,
                  field: 'spec.spawner.xyz',
                  message: "Unknown property 'spec.spawner.xyz'",
                },
                {
                  type: FieldErrorType.ErrorTypeNotSupported,
                  field: 'spec.spawner.hidden',
                  message: "Invalid data type for 'spec.spawner.hidden', expected 'boolean'",
                },
              ],
            },
          },
        };

        throw buildAxiosError(apiErrorEnvelope);
      }
      return { data: mockWorkspaceKind1 };
    },
  },
  secrets: {
    listSecrets: async () => ({
      data: mockSecretsList,
    }),
    createSecret: async () => ({
      data: mockSecretCreate,
    }),
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    getSecret: async () => ({
      data: mockSecretCreate,
    }),
    updateSecret: async () => ({
      data: mockSecretCreate,
    }),
    deleteSecret: async () => {
      await delay(1500);
    },
  },
});
