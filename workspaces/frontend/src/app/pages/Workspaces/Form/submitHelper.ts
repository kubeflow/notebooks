import { WorkspaceFormData, WorkspaceFormMode } from '~/app/types';
import {
  ApiWorkspaceCreateEnvelope,
  ApiWorkspaceEnvelope,
  WorkspacekindsWorkspaceKind,
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
    deferUpdates: data.properties.deferUpdates,
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
    deferUpdates: data.properties.deferUpdates,
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

export const submitFormData = (args: {
  mode: WorkspaceFormMode;
  data: WorkspaceFormData;
  api: NotebookApis;
  namespace: string;
}): Promise<ApiWorkspaceCreateEnvelope | ApiWorkspaceEnvelope> => {
  const { data, api, mode, namespace } = args;

  if (!isValidWorkspaceFormData(data)) {
    throw new Error('Invalid form data');
  }

  if (mode === 'create') {
    return createWorkspace({ api, data, namespace });
  }

  return updateWorkspace({ api, data, namespace });
};
