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
