import {
  HealthCheckResponse,
  Namespace,
  Workspace,
  WorkspaceCreate,
  WorkspaceKind,
  WorkspaceKindPatch,
  WorkspaceKindUpdate,
  WorkspacePatch,
  WorkspacePauseState,
  WorkspaceUpdate,
} from '~/shared/api/backendApiTypes';
import { APIOptions, RequestData } from '~/shared/api/types';

// Health
export type GetHealthCheck = (opts: APIOptions) => Promise<HealthCheckResponse>;

// Namespace
export type ListNamespaces = (opts: APIOptions) => Promise<Namespace[]>;

// Workspace
export type ListAllWorkspaces = (opts: APIOptions) => Promise<Workspace[]>;
export type ListWorkspaces = (opts: APIOptions, namespace: string) => Promise<Workspace[]>;
export type GetWorkspace = (
  opts: APIOptions,
  namespace: string,
  workspace: string,
) => Promise<Workspace>;
export type CreateWorkspace = (
  opts: APIOptions,
  namespace: string,
  data: RequestData<WorkspaceCreate>,
) => Promise<Workspace>;
export type UpdateWorkspace = (
  opts: APIOptions,
  namespace: string,
  workspace: string,
  data: RequestData<WorkspaceUpdate>,
) => Promise<Workspace>;
export type PatchWorkspace = (
  opts: APIOptions,
  namespace: string,
  workspace: string,
  data: RequestData<WorkspacePatch>,
) => Promise<Workspace>;
export type DeleteWorkspace = (
  opts: APIOptions,
  namespace: string,
  workspace: string,
) => Promise<void>;
export type PauseWorkspace = (
  opts: APIOptions,
  namespace: string,
  workspace: string,
  data: RequestData<WorkspacePauseState>,
) => Promise<WorkspacePauseState>;

// WorkspaceKind
export type ListWorkspaceKinds = (opts: APIOptions) => Promise<WorkspaceKind[]>;
export type GetWorkspaceKind = (opts: APIOptions, kind: string) => Promise<WorkspaceKind>;
export type CreateWorkspaceKind = (opts: APIOptions, data: string) => Promise<WorkspaceKind>;
export type UpdateWorkspaceKind = (
  opts: APIOptions,
  kind: string,
  data: RequestData<WorkspaceKindUpdate>,
) => Promise<WorkspaceKind>;
export type PatchWorkspaceKind = (
  opts: APIOptions,
  kind: string,
  data: RequestData<WorkspaceKindPatch>,
) => Promise<WorkspaceKind>;
export type DeleteWorkspaceKind = (opts: APIOptions, kind: string) => Promise<void>;

export type NotebookAPIs = {
  // Health
  getHealthCheck: GetHealthCheck;
  // Namespace
  listNamespaces: ListNamespaces;
  // Workspace
  listAllWorkspaces: ListAllWorkspaces;
  listWorkspaces: ListWorkspaces;
  getWorkspace: GetWorkspace;
  createWorkspace: CreateWorkspace;
  updateWorkspace: UpdateWorkspace;
  patchWorkspace: PatchWorkspace;
  deleteWorkspace: DeleteWorkspace;
  pauseWorkspace: PauseWorkspace;
  // WorkspaceKind
  listWorkspaceKinds: ListWorkspaceKinds;
  getWorkspaceKind: GetWorkspaceKind;
  createWorkspaceKind: CreateWorkspaceKind;
  updateWorkspaceKind: UpdateWorkspaceKind;
  patchWorkspaceKind: PatchWorkspaceKind;
  deleteWorkspaceKind: DeleteWorkspaceKind;
};
