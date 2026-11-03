import { WorkspaceFormData, WorkspaceFormMode } from '~/app/types';
import {
  ApiWorkspaceCreateEnvelope,
  ApiWorkspaceEnvelope,
  WorkspacekindsWorkspaceKindListItem,
} from '~/generated/data-contracts';
import { NotebookApis } from '~/shared/api/notebookApi';
import {
  buildWorkspaceCreatePayload,
  buildWorkspaceUpdatePayload,
} from '~/shared/api/workspacePayloads';

// TODO: properly validate form data
interface ValidatedWorkspaceFormData
  extends Omit<WorkspaceFormData, 'kind' | 'imageConfig' | 'podConfig'> {
  kind: WorkspacekindsWorkspaceKindListItem;
  imageConfig: NonNullable<WorkspaceFormData['imageConfig']>;
  podConfig: NonNullable<WorkspaceFormData['podConfig']>;
}

export function isValidWorkspaceFormData(
  data: WorkspaceFormData,
): data is ValidatedWorkspaceFormData {
  return data.kind !== undefined && data.imageConfig !== undefined && data.podConfig !== undefined;
}

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

  const podTemplate = {
    podMetadata: data.podMetadata,
    options: {
      imageConfig: data.imageConfig,
      podConfig: data.podConfig,
    },
    volumes: {
      home: data.properties.homeVolume?.pvcName,
      data: data.properties.volumes,
      secrets: data.properties.secrets,
    },
  };

  if (mode === 'create') {
    return api.workspaces.createWorkspace(namespace, {
      data: buildWorkspaceCreatePayload({
        name: data.properties.name,
        displayName: data.properties.displayName || undefined,
        kind: data.kind.name,
        paused: false,
        podTemplate,
      }),
    });
  }

  // The form displays the resource name as a fallback. Do not persist that
  // fallback as a display name unless the user changes the field.
  const displayName =
    data.properties.displayName === (data.originalDisplayName || data.properties.name)
      ? data.originalDisplayName
      : data.properties.displayName;

  return api.workspaces.updateWorkspace(namespace, data.properties.name, {
    data: buildWorkspaceUpdatePayload({
      displayName,
      paused: false,
      podTemplate,
      revision: data.revision,
    }),
  });
};
