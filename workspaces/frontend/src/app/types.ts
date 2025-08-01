import {
  WorkspacekindsImageConfigValue,
  WorkspacekindsImageRef,
  WorkspacekindsPodConfigValue,
  WorkspacekindsPodMetadata,
  WorkspacekindsPodVolumeMounts,
  WorkspacekindsWorkspaceKind,
  WorkspacesPodSecretMount,
  WorkspacesPodVolumeMount,
  WorkspacesWorkspace,
} from '~/generated/data-contracts';

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
  volumes: WorkspacesPodVolumeMount[];
  secrets: WorkspacesPodSecretMount[];
}

export interface WorkspaceFormData {
  kind: WorkspacekindsWorkspaceKind | undefined;
  image: WorkspacekindsImageConfigValue | undefined;
  podConfig: WorkspacekindsPodConfigValue | undefined;
  properties: WorkspaceFormProperties;
}

export interface WorkspaceCountPerOption {
  count: number;
  countByImage: Record<WorkspacekindsImageConfigValue['id'], number>;
  countByPodConfig: Record<WorkspacekindsPodConfigValue['id'], number>;
  countByNamespace: Record<WorkspacesWorkspace['namespace'], number>;
}

export interface WorkspaceKindProperties {
  displayName: string;
  description: string;
  deprecated: boolean;
  deprecationMessage: string;
  hidden: boolean;
  icon: WorkspacekindsImageRef;
  logo: WorkspacekindsImageRef;
}

export interface WorkspaceKindImageConfigValue extends WorkspacekindsImageConfigValue {
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

export interface WorkspaceKindPodConfigValue extends WorkspacekindsPodConfigValue {
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
  podMetadata: WorkspacekindsPodMetadata;
  volumeMounts: WorkspacekindsPodVolumeMounts;
  culling?: WorkspaceKindPodCulling;
  extraVolumeMounts?: WorkspacesPodVolumeMount[];
}

export interface WorkspaceKindFormData {
  properties: WorkspaceKindProperties;
  imageConfig: WorkspaceKindImageConfigData;
  podConfig: WorkspaceKindPodConfigData;
  podTemplate: WorkspaceKindPodTemplateData;
}
