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
  hidden: boolean;
  deprecated: boolean;
  deprecationWarning: string;
  icon: WorkspaceIcon;
  logo: WorkspaceLogo;
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
  podTemplate: {
    volumes: {
      home: string;
      data: {
        pvcName: string;
        mountPath: string;
        readOnly: boolean;
      }[];
    };
  };
  options: {
    imageConfig: string;
    podConfig: string;
  };
  status: WorkspaceStatus;
}
