import {
  WorkspacesPodTemplateMutate,
  WorkspacesWorkspaceCreate,
  WorkspacesWorkspaceUpdate,
} from '~/generated/data-contracts';

// Select API fields explicitly: callers can pass form values with additional UI state.
const buildPodTemplatePayload = (
  podTemplate: WorkspacesPodTemplateMutate,
): WorkspacesPodTemplateMutate => ({
  podMetadata: {
    labels: { ...podTemplate.podMetadata.labels },
    annotations: { ...podTemplate.podMetadata.annotations },
  },
  options: {
    imageConfig: podTemplate.options.imageConfig,
    podConfig: podTemplate.options.podConfig,
  },
  volumes: {
    home: podTemplate.volumes.home,
    data: podTemplate.volumes.data.map(({ pvcName, mountPath, readOnly }) => ({
      pvcName,
      mountPath,
      readOnly,
    })),
    secrets: podTemplate.volumes.secrets?.map(({ secretName, mountPath, defaultMode }) => ({
      secretName,
      mountPath,
      defaultMode,
    })),
  },
});

export const buildWorkspaceCreatePayload = (
  data: WorkspacesWorkspaceCreate,
): WorkspacesWorkspaceCreate => ({
  name: data.name,
  kind: data.kind,
  displayName: data.displayName,
  paused: data.paused,
  podTemplate: buildPodTemplatePayload(data.podTemplate),
});

export const buildWorkspaceUpdatePayload = (
  data: WorkspacesWorkspaceUpdate,
): WorkspacesWorkspaceUpdate => ({
  displayName: data.displayName,
  paused: data.paused,
  podTemplate: buildPodTemplatePayload(data.podTemplate),
  revision: data.revision,
});
