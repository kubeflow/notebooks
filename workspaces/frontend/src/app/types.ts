import {
  WorkspaceImageConfigValue,
  WorkspaceKind,
  WorkspacePodConfigValue,
  WorkspacePodVolumeMount,
  WorkspacePodSecretMount,
  Workspace,
} from '~/shared/api/backendApiTypes';

export interface WorkspaceColumnDefinition {
  name: string;
  label: string;
  id: string;
}
export interface WorkspaceKindsColumns {
  icon: WorkspaceColumnDefinition;
  name: WorkspaceColumnDefinition;
  description: WorkspaceColumnDefinition;
  deprecated: WorkspaceColumnDefinition;
  numberOfWorkspaces: WorkspaceColumnDefinition;
}

export interface WorkspaceFormProperties {
  workspaceName: string;
  deferUpdates: boolean;
  homeDirectory: string;
  volumes: WorkspacePodVolumeMount[];
  secrets: WorkspacePodSecretMount[];
}

export interface WorkspaceFormData {
  kind: WorkspaceKind | undefined;
  image: WorkspaceImageConfigValue | undefined;
  podConfig: WorkspacePodConfigValue | undefined;
  properties: WorkspaceFormProperties;
}

export interface WorkspaceCountPerOption {
  count: number;
  countByImage: Record<WorkspaceImageConfigValue['id'], number>;
  countByPodConfig: Record<WorkspacePodConfigValue['id'], number>;
  countByNamespace: Record<Workspace['namespace'], number>;
}
