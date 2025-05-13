import {
  CreateWorkspace,
  CreateWorkspaceKind,
  DeleteWorkspace,
  DeleteWorkspaceKind,
  GetHealthCheck,
  GetWorkspace,
  GetWorkspaceKind,
  ListAllWorkspaces,
  ListNamespaces,
  ListWorkspaceKinds,
  ListWorkspaces,
  PatchWorkspace,
  PatchWorkspaceKind,
  UpdateWorkspace,
  UpdateWorkspaceKind,
} from '~/shared/api/notebookApi';
import { APIOptions } from '~/shared/api/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type KubeflowSpecificAPICall = (opts: APIOptions, ...args: any[]) => Promise<unknown>;
type KubeflowAPICall<ActualCall extends KubeflowSpecificAPICall> = (hostPath: string) => ActualCall;

// Health
export type GetHealthCheckAPI = KubeflowAPICall<GetHealthCheck>;

// Namespace
export type ListNamespacesAPI = KubeflowAPICall<ListNamespaces>;

// Workspace
export type ListAllWorkspacesAPI = KubeflowAPICall<ListAllWorkspaces>;
export type ListWorkspacesAPI = KubeflowAPICall<ListWorkspaces>;
export type CreateWorkspaceAPI = KubeflowAPICall<CreateWorkspace>;
export type GetWorkspaceAPI = KubeflowAPICall<GetWorkspace>;
export type UpdateWorkspaceAPI = KubeflowAPICall<UpdateWorkspace>;
export type PatchWorkspaceAPI = KubeflowAPICall<PatchWorkspace>;
export type DeleteWorkspaceAPI = KubeflowAPICall<DeleteWorkspace>;

// WorkspaceKind
export type ListWorkspaceKindsAPI = KubeflowAPICall<ListWorkspaceKinds>;
export type CreateWorkspaceKindAPI = KubeflowAPICall<CreateWorkspaceKind>;
export type GetWorkspaceKindAPI = KubeflowAPICall<GetWorkspaceKind>;
export type UpdateWorkspaceKindAPI = KubeflowAPICall<UpdateWorkspaceKind>;
export type PatchWorkspaceKindAPI = KubeflowAPICall<PatchWorkspaceKind>;
export type DeleteWorkspaceKindAPI = KubeflowAPICall<DeleteWorkspaceKind>;
