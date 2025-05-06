import { APIOptions } from '~/shared/api/types';
import {
  HealthCheckResponse,
  Namespace,
  Workspace,
  WorkspaceKind,
  WorkspacePodTemplateMutate,
} from '~/shared/types';

export type ResponseBody<T> = {
  data: T;
  metadata?: Record<string, unknown>;
};

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
  data: CreateWorkspaceData,
) => Promise<Workspace>;
export type UpdateWorkspace = (
  opts: APIOptions,
  namespace: string,
  workspace: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Review data and response when start using it
  data: any,
) => Promise<void>;
export type PatchWorkspace = (
  opts: APIOptions,
  namespace: string,
  workspace: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Review data and response when start using it
  data: any,
) => Promise<void>;
export type DeleteWorkspace = (
  opts: APIOptions,
  namespace: string,
  workspace: string,
) => Promise<void>;

// WorkspaceKind
export type ListWorkspaceKinds = (opts: APIOptions) => Promise<WorkspaceKind[]>;
export type GetWorkspaceKind = (opts: APIOptions, kind: string) => Promise<WorkspaceKind>;
export type CreateWorkspaceKind = (
  opts: APIOptions,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Review data and response when start using it
  data: any,
) => Promise<void>;
export type UpdateWorkspaceKind = (
  opts: APIOptions,
  kind: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Review data and response when start using it
  data: any,
) => Promise<void>;
export type PatchWorkspaceKind = (
  opts: APIOptions,
  kind: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Review data and response when start using it
  data: any,
) => Promise<void>;
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
  // WorkspaceKind
  listWorkspaceKinds: ListWorkspaceKinds;
  getWorkspaceKind: GetWorkspaceKind;
  createWorkspaceKind: CreateWorkspaceKind;
  updateWorkspaceKind: UpdateWorkspaceKind;
  patchWorkspaceKind: PatchWorkspaceKind;
  deleteWorkspaceKind: DeleteWorkspaceKind;
};

export type CreateWorkspaceData = {
  data: {
    name: string;
    kind: string;
    paused: boolean;
    deferUpdates: boolean;
    podTemplate: WorkspacePodTemplateMutate;
  };
};
