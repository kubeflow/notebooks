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

export type WorkspaceKindsColumnNames = {
  icon: string;
  name: string;
  description: string;
  deprecated: string;
  numberOfWorkspaces: string;
};

// TODO: review this type once workspace creation is fully implemented; use `WorkspaceCreate` type instead.
export interface WorkspaceProperties {
  workspaceName: string;
  deferUpdates: boolean;
  homeDirectory: string;
  volumes: boolean;
  isVolumesExpanded: boolean;
  redirect?: {
    to: string;
    message: {
      text: string;
      level: string;
    };
  };
}
