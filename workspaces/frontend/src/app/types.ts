import {
  WorkspaceImageConfigValue,
  WorkspaceKind,
  WorkspacePodConfigValue,
  WorkspacePodVolumeMount,
  WorkspacePodSecretMount,
  Workspace,
  WorkspaceImageRef,
  WorkspacePodVolumeMounts,
  WorkspaceKindPodMetadata,
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
  imagePullPolicy?: ImagePullPolicy.IfNotPresent | ImagePullPolicy.Always | ImagePullPolicy.Never;
  ports?: WorkspaceKindImagePort[];
  image?: string;
}

export enum ImagePullPolicy {
  IfNotPresent = 'IfNotPresent',
  Always = 'Always',
  Never = 'Never',
}

export interface WorkspaceKindImagePort {
  id: string;
  displayName: string;
  port: number;
  protocol: 'HTTP'; // ONLY HTTP is supported at the moment, per https://github.com/thesuperzapper/kubeflow-notebooks-v2-design/blob/main/crds/workspace-kind.yaml#L275
}

export interface WorkspaceKindPodConfigValue extends WorkspacePodConfigValue {
  resources?: {
    requests: {
      [key: string]: string;
    };
    limits: {
      [key: string]: string;
    };
  };
}

export interface WorkspaceKindImageConfigData {
  default: string;
  values: WorkspaceKindImageConfigValue[];
}

export interface WorkspaceKindPodConfigData {
  default: string;
  values: WorkspaceKindPodConfigValue[];
}
export interface WorkspaceKindPodCulling {
  enabled: boolean;
  maxInactiveSeconds: number;
  activityProbe: {
    jupyter: {
      lastActivity: boolean;
    };
  };
}

export interface WorkspaceKindPodTemplateData {
  podMetadata: WorkspaceKindPodMetadata;
  volumeMounts: WorkspacePodVolumeMounts;
  culling?: WorkspaceKindPodCulling;
  extraVolumeMounts?: WorkspacePodVolumeMount[];
}

export interface WorkspaceKindFormData {
  properties: WorkspaceKindProperties;
  imageConfig: WorkspaceKindImageConfigData;
  podConfig: WorkspaceKindPodConfigData;
  podTemplate: WorkspaceKindPodTemplateData;
}
