export interface WorkspaceIcon {
  url: string;
}

export interface WorkspaceLogo {
  url: string;
}

export interface WorkspaceImage {
  id: string;
  displayName: string;
  labels: unknown;
  hidden: boolean;
  redirect?: {
    to: string;
    message: {
      text: string;
      level: string;
    };
  };
}

export interface WorkspacePodConfig {
  id: string;
  displayName: string;
  description: string;
  labels: unknown;
  redirect?: {
    to: string;
    message: {
      text: string;
      level: string;
    };
  };
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
        values: WorkspaceImage[];
      };
      podConfig: {
        default: string;
        values: WorkspacePodConfig[];
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
