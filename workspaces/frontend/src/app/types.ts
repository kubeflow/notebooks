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

export enum ResponseMetadataType {
  INT = 'MetadataIntValue',
  DOUBLE = 'MetadataDoubleValue',
  STRING = 'MetadataStringValue',
  STRUCT = 'MetadataStructValue',
  PROTO = 'MetadataProtoValue',
  BOOL = 'MetadataBoolValue',
}

export type ResponseCustomPropertyInt = {
  metadataType: ResponseMetadataType.INT;
  int_value: string; // int64-formatted string
};

export type ResponseCustomPropertyDouble = {
  metadataType: ResponseMetadataType.DOUBLE;
  double_value: number;
};

export type ResponseCustomPropertyString = {
  metadataType: ResponseMetadataType.STRING;
  string_value: string;
};

export type ResponseCustomPropertyStruct = {
  metadataType: ResponseMetadataType.STRUCT;
  struct_value: string; // Base64 encoded bytes for struct value
};

export type ResponseCustomPropertyProto = {
  metadataType: ResponseMetadataType.PROTO;
  type: string; // url describing proto value
  proto_value: string; // Base64 encoded bytes for proto value
};

export type ResponseCustomPropertyBool = {
  metadataType: ResponseMetadataType.BOOL;
  bool_value: boolean;
};

export type ResponseCustomProperty =
  | ResponseCustomPropertyInt
  | ResponseCustomPropertyDouble
  | ResponseCustomPropertyString
  | ResponseCustomPropertyStruct
  | ResponseCustomPropertyProto
  | ResponseCustomPropertyBool;

export type ResponseCustomProperties = Record<string, ResponseCustomProperty>;
export type ResponseStringCustomProperties = Record<string, ResponseCustomPropertyString>;

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
