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

export interface Workspace {
  name: string;
  namespace: string;
  workspace_kind: WorkspaceKind;
  defer_updates: boolean;
  paused: boolean;
  paused_time: number;
  state: WorkspaceState;
  state_message: string;
  pod_template: {
    pod_metadata: {
      labels: Record<string, string>;
      annotations: Record<string, string>;
    };
    volumes: {
      home: {
        pvc_name: string;
        mount_path: string;
        readOnly: boolean;
      };
      data: {
        pvc_name: string;
        mount_path: string;
        readOnly: boolean;
      }[];
    };
    options: {
      image_config: {
        current: {
          id: string;
          display_name: string;
          description: string;
          labels: {
            key: string;
            value: number;
          }[];
        };
      };
      pod_config: {
        current: {
          id: string;
          display_name: string;
          description: string;
          labels: {
            key: string;
            value: string;
          }[];
        };
      };
    };
    image_config: {
      current: string;
      desired: string;
      redirect_chain: string[];
    };
    pod_config: {
      current: string;
      desired: string;
      redirect_chain: string[];
    };
  };

  activity: {
    last_activity: number;
    last_update: number;
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
