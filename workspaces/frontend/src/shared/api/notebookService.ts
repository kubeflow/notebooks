import {
  extractNotebookResponse,
  restCREATE,
  restDELETE,
  restGET,
  restPATCH,
  restUPDATE,
} from '~/shared/api/apiUtils';
import { handleRestFailures } from '~/shared/api/errorUtils';
import {
  HealthCheckResponse,
  Namespace,
  Workspace,
  WorkspaceKind,
} from '~/shared/api/backendApiTypes';
import {
  CreateWorkspaceAPI,
  CreateWorkspaceKindAPI,
  DeleteWorkspaceAPI,
  DeleteWorkspaceKindAPI,
  GetHealthCheckAPI,
  GetWorkspaceAPI,
  GetWorkspaceKindAPI,
  ListAllWorkspacesAPI,
  ListNamespacesAPI,
  ListWorkspaceKindsAPI,
  ListWorkspacesAPI,
  PatchWorkspaceAPI,
  PatchWorkspaceKindAPI,
  UpdateWorkspaceAPI,
  UpdateWorkspaceKindAPI,
} from './callTypes';

export const getHealthCheck: GetHealthCheckAPI = (hostPath) => (opts) =>
  handleRestFailures(restGET(hostPath, `/healthcheck`, {}, opts)).then((response) =>
    extractNotebookResponse<HealthCheckResponse>(response),
  );

export const listNamespaces: ListNamespacesAPI = (hostPath) => (opts) =>
  handleRestFailures(restGET(hostPath, `/namespaces`, {}, opts)).then((response) =>
    extractNotebookResponse<Namespace[]>(response),
  );

export const listAllWorkspaces: ListAllWorkspacesAPI = (hostPath) => (opts) =>
  handleRestFailures(restGET(hostPath, `/workspaces`, {}, opts)).then((response) =>
    extractNotebookResponse<Workspace[]>(response),
  );

export const listWorkspaces: ListWorkspacesAPI = (hostPath) => (opts, namespace) =>
  handleRestFailures(restGET(hostPath, `/workspaces/${namespace}`, {}, opts)).then((response) =>
    extractNotebookResponse<Workspace[]>(response),
  );

export const getWorkspace: GetWorkspaceAPI = (hostPath) => (opts, namespace, workspace) =>
  handleRestFailures(restGET(hostPath, `/workspaces/${namespace}/${workspace}`, {}, opts)).then(
    (response) => extractNotebookResponse<Workspace>(response),
  );

export const createWorkspace: CreateWorkspaceAPI = (hostPath) => (opts, namespace, data) =>
  handleRestFailures(restCREATE(hostPath, `/workspaces/${namespace}`, data, {}, opts)).then(
    (response) => extractNotebookResponse<Workspace>(response),
  );

export const updateWorkspace: UpdateWorkspaceAPI =
  (hostPath) => (opts, namespace, workspace, data) =>
    handleRestFailures(
      restUPDATE(hostPath, `/workspaces/${namespace}/${workspace}`, data, {}, opts),
    ).then((response) => extractNotebookResponse<Workspace>(response));

export const patchWorkspace: PatchWorkspaceAPI = (hostPath) => (opts, namespace, workspace, data) =>
  handleRestFailures(restPATCH(hostPath, `/workspaces/${namespace}/${workspace}`, data, opts)).then(
    (response) => extractNotebookResponse<Workspace>(response),
  );

export const deleteWorkspace: DeleteWorkspaceAPI = (hostPath) => (opts, namespace, workspace) =>
  handleRestFailures(
    restDELETE(hostPath, `/workspaces/${namespace}/${workspace}`, {}, {}, opts),
  ).then((response) => extractNotebookResponse<void>(response));

export const listWorkspaceKinds: ListWorkspaceKindsAPI = (hostPath) => (opts) =>
  handleRestFailures(restGET(hostPath, `/workspacekinds`, {}, opts)).then((response) =>
    extractNotebookResponse<WorkspaceKind[]>(response),
  );

export const getWorkspaceKind: GetWorkspaceKindAPI = (hostPath) => (opts, kind) =>
  handleRestFailures(restGET(hostPath, `/workspacekinds/${kind}`, {}, opts)).then((response) =>
    extractNotebookResponse<WorkspaceKind>(response),
  );

export const createWorkspaceKind: CreateWorkspaceKindAPI = (hostPath) => (opts, data) =>
  handleRestFailures(restCREATE(hostPath, `/workspacekinds`, data, {}, opts)).then((response) =>
    extractNotebookResponse<WorkspaceKind>(response),
  );

export const updateWorkspaceKind: UpdateWorkspaceKindAPI = (hostPath) => (opts, kind, data) =>
  handleRestFailures(restUPDATE(hostPath, `/workspacekinds/${kind}`, data, {}, opts)).then(
    (response) => extractNotebookResponse<WorkspaceKind>(response),
  );

export const patchWorkspaceKind: PatchWorkspaceKindAPI = (hostPath) => (opts, kind, data) =>
  handleRestFailures(restPATCH(hostPath, `/workspacekinds/${kind}`, data, opts)).then((response) =>
    extractNotebookResponse<WorkspaceKind>(response),
  );

export const deleteWorkspaceKind: DeleteWorkspaceKindAPI = (hostPath) => (opts, kind) =>
  handleRestFailures(restDELETE(hostPath, `/workspacekinds/${kind}`, {}, {}, opts)).then(
    (response) => extractNotebookResponse<void>(response),
  );
