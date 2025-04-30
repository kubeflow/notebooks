export interface WorkspaceIcon {
  url: string;
}

export interface WorkspaceLogo {
  url: string;
}

export interface WorkspaceKind {
  name: string;
  displayName: string;
  description: string;
  deprecated: boolean;
  deprecationMessage: string;
  hidden: boolean;
  icon: WorkspaceIcon;
  logo: WorkspaceLogo;
  podTemplate: {
    podMetadata: {
      labels: {
        myWorkspaceKindLabel: string;
      };
      annotations: {
        myWorkspaceKindAnnotation: string;
      };
    };
    volumeMounts: {
      home: string;
    };
    options: {
      imageConfig: {
        default: string;
        values: [
          {
            id: string;
            displayName: string;
            labels: {
              pythonVersion: string;
            };
            hidden: true;
            redirect?: {
              to: string;
              message: {
                text: string;
                level: string;
              };
            };
          },
        ];
      };
      podConfig: {
        default: string;
        values: [
          {
            id: string;
            displayName: string;
            description: string;
            labels: {
              cpu: string;
              memory: string;
            };
          },
        ];
      };
    };
  };
}

export enum WorkspaceState {
  Running,
  Terminating,
  Paused,
  Pending,
  Error,
  Unknown,
}

export interface WorkspaceStatus {
  activity: {
    lastActivity: number;
    lastUpdate: number;
  };
  pauseTime: number;
  pendingRestart: boolean;
  podTemplateOptions: {
    imageConfig: {
      desired: string;
      redirectChain: {
        source: string;
        target: string;
      }[];
    };
  };
  state: WorkspaceState;
  stateMessage: string;
}

export interface WorkspacePodMetadataMutate {
  labels: Record<string, string>;
  annotations: Record<string, string>;
}

export interface WorkspacePodVolumeMount {
  pvcName: string;
  mountPath: string;
  readOnly?: boolean;
}

export interface WorkspacePodVolumesMutate {
  home?: string;
  data: WorkspacePodVolumeMount[];
}

export interface WorkspacePodTemplateOptionsMutate {
  imageConfig: string;
  podConfig: string;
}

export interface WorkspacePodTemplateMutate {
  podMetadata: WorkspacePodMetadataMutate;
  volumes: WorkspacePodVolumesMutate;
  options: WorkspacePodTemplateOptionsMutate;
}

export interface Workspace {
  name: string;
  namespace: string;
  paused: boolean;
  deferUpdates: boolean;
  kind: string;
  cpu: number;
  ram: number;
  podTemplate: {
    podMetadata: {
      labels: string[];
      annotations: string[];
    };
    volumes: {
      home: string;
      data: {
        pvcName: string;
        mountPath: string;
        readOnly: boolean;
      }[];
    };
    endpoints: {
      displayName: string;
      port: string;
    }[];
  };
  options: {
    imageConfig: string;
    podConfig: string;
  };
  status: WorkspaceStatus;
  redirectStatus: {
    level: 'Info' | 'Warning' | 'Danger';
    text: string;
  };
}

export type WorkspacesColumnNames = {
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
};
