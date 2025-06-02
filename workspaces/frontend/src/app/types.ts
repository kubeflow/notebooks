import {
  WorkspaceImageConfigValue,
  WorkspaceKind,
  WorkspacePodConfigValue,
  WorkspacePodVolumeMount,
  WorkspacePodSecretMount,
  ImagePullPolicy,
  WorkspaceKindImagePort,
  WorkspaceImageRef,
  WorkspaceKindImageConfig,
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

export interface WorkspaceKindProperties {
  displayName: string;
  description: string;
  deprecated: boolean;
  deprecationMessage: string;
  hidden: boolean;
  icon: WorkspaceImageRef;
  logo: WorkspaceImageRef;
}

export interface WorkspaceKindImageConfigValue extends WorkspaceImageConfigValue {
  imagePullPolicy: ImagePullPolicy.IfNotPresent | ImagePullPolicy.Always | ImagePullPolicy.Never;
  ports: WorkspaceKindImagePort[];
  image: string;
}

export type WorkspaceKindImageFormInput = WorkspaceKindImageConfig<WorkspaceKindImageConfigValue>;
