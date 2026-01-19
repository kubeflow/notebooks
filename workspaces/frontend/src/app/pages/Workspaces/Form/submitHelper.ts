import { WorkspaceFormData, WorkspaceFormMode, WorkspacesPodSecretMountValue } from '~/app/types';
import {
  ApiWorkspaceCreateEnvelope,
  ApiWorkspaceEnvelope,
  WorkspacekindsWorkspaceKind,
  WorkspacesPodSecretMount,
  WorkspacesWorkspaceCreate,
  WorkspacesWorkspaceUpdate,
} from '~/generated/data-contracts';
import { NotebookApis } from '~/shared/api/notebookApi';

// TODO: properly validate form data
interface ValidatedWorkspaceFormData
  extends Omit<WorkspaceFormData, 'kind' | 'imageConfig' | 'podConfig'> {
  kind: WorkspacekindsWorkspaceKind;
  imageConfig: NonNullable<WorkspaceFormData['imageConfig']>;
  podConfig: NonNullable<WorkspaceFormData['podConfig']>;
}

export function isValidWorkspaceFormData(
  data: WorkspaceFormData,
): data is ValidatedWorkspaceFormData {
  return data.kind !== undefined && data.imageConfig !== undefined && data.podConfig !== undefined;
}

const createWorkspace = async (args: {
  data: ValidatedWorkspaceFormData;
  api: NotebookApis;
  namespace: string;
}): Promise<ApiWorkspaceCreateEnvelope> => {
  const { data, api, namespace } = args;

  const wsCreateData: WorkspacesWorkspaceCreate = {
    name: data.properties.workspaceName,
    kind: data.kind.name,
    paused: false,
    podTemplate: {
      podMetadata: {
        labels: {},
        annotations: {},
      },
      options: {
        imageConfig: data.imageConfig,
        podConfig: data.podConfig,
      },
      volumes: {
        home: data.properties.homeDirectory,
        data: data.properties.volumes,
        secrets: data.properties.secrets,
      },
    },
  };

  return api.workspaces.createWorkspace(namespace, {
    data: wsCreateData,
  });
};

const updateWorkspace = async (args: {
  data: ValidatedWorkspaceFormData;
  api: NotebookApis;
  namespace: string;
}): Promise<ApiWorkspaceEnvelope> => {
  const { data, api, namespace } = args;

  const wsUpdateData: WorkspacesWorkspaceUpdate = {
    paused: false,
    podTemplate: {
      podMetadata: {
        labels: {},
        annotations: {},
      },
      options: {
        imageConfig: data.imageConfig,
        podConfig: data.podConfig,
      },
      volumes: {
        home: data.properties.homeDirectory,
        data: data.properties.volumes,
        secrets: data.properties.secrets,
      },
    },
    revision: data.revision,
  };

  return api.workspaces.updateWorkspace(namespace, data.properties.workspaceName, {
    data: wsUpdateData,
  });
};

/**
 * Converts WorkspacesPodSecretMountValue[] to WorkspacesPodSecretMount[]
 * by omitting the `isAttached` field from each item.
 */
const toSecretMounts = (secrets: WorkspacesPodSecretMountValue[]): WorkspacesPodSecretMount[] =>
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  secrets.map(({ isAttached, ...rest }): WorkspacesPodSecretMount => rest);

export const submitFormData = (args: {
  mode: WorkspaceFormMode;
  data: WorkspaceFormData;
  api: NotebookApis;
  namespace: string;
}): Promise<ApiWorkspaceCreateEnvelope | ApiWorkspaceEnvelope> => {
  const { data, api, mode, namespace } = args;
  data.properties.secrets = toSecretMounts(data.properties.secrets);
  if (!isValidWorkspaceFormData(data)) {
    throw new Error('Invalid form data');
  }

  if (mode === 'create') {
    return createWorkspace({ api, data, namespace });
  }

  return updateWorkspace({ api, data, namespace });
};
