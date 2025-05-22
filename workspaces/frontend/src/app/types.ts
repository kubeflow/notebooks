import {
  WorkspaceImageConfigValue,
  WorkspaceKind,
  WorkspacePodConfigValue,
  WorkspacePodVolumeMount,
  WorkspacePodSecretMount,
} from '~/shared/api/backendApiTypes';

export interface WorkspacesColumnNames {
  name: string;
  kind: string;
  image: string;
  podConfig: string;
  state: string;
  homeVol: string;
  cpu: string;
  ram: string;
  lastActivity: string;
  redirectStatus: string;
}

export interface WorkspaceKindsColumnNames {
  icon: string;
  name: string;
  description: string;
  deprecated: string;
  numberOfWorkspaces: string;
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
