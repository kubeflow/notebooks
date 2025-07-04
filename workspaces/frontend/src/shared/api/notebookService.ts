import {
  restCREATE,
  restDELETE,
  restGET,
  restPATCH,
  restUPDATE,
  restYAML,
  wrapRequest,
} from '~/shared/api/apiUtils';
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
  PauseWorkspaceAPI,
  StartWorkspaceAPI,
  UpdateWorkspaceAPI,
  UpdateWorkspaceKindAPI,
} from '~/shared/api/callTypes';

export const getHealthCheck: GetHealthCheckAPI = (hostPath) => (opts) =>
  wrapRequest(restGET(hostPath, `/healthcheck`, {}, opts), false);

export const listNamespaces: ListNamespacesAPI = (hostPath) => (opts) =>
  wrapRequest(restGET(hostPath, `/namespaces`, {}, opts));

export const listAllWorkspaces: ListAllWorkspacesAPI = (hostPath) => (opts) =>
  wrapRequest(restGET(hostPath, `/workspaces`, {}, opts));

export const listWorkspaces: ListWorkspacesAPI = (hostPath) => (opts, namespace) =>
  wrapRequest(restGET(hostPath, `/workspaces/${namespace}`, {}, opts));

export const getWorkspace: GetWorkspaceAPI = (hostPath) => (opts, namespace, workspace) =>
  wrapRequest(restGET(hostPath, `/workspaces/${namespace}/${workspace}`, {}, opts));

export const createWorkspace: CreateWorkspaceAPI = (hostPath) => (opts, namespace, data) =>
  wrapRequest(restCREATE(hostPath, `/workspaces/${namespace}`, data, {}, opts));

export const updateWorkspace: UpdateWorkspaceAPI =
  (hostPath) => (opts, namespace, workspace, data) =>
    wrapRequest(restUPDATE(hostPath, `/workspaces/${namespace}/${workspace}`, data, {}, opts));

export const patchWorkspace: PatchWorkspaceAPI = (hostPath) => (opts, namespace, workspace, data) =>
  wrapRequest(restPATCH(hostPath, `/workspaces/${namespace}/${workspace}`, data, opts));

export const deleteWorkspace: DeleteWorkspaceAPI = (hostPath) => (opts, namespace, workspace) =>
  wrapRequest(restDELETE(hostPath, `/workspaces/${namespace}/${workspace}`, {}, {}, opts), false);

export const pauseWorkspace: PauseWorkspaceAPI = (hostPath) => (opts, namespace, workspace) =>
  wrapRequest(
    restCREATE(hostPath, `/workspaces/${namespace}/${workspace}/actions/pause`, {}, opts),
  );

export const startWorkspace: StartWorkspaceAPI = (hostPath) => (opts, namespace, workspace) =>
  wrapRequest(
    restCREATE(hostPath, `/workspaces/${namespace}/${workspace}/actions/start`, {}, opts),
  );

export const listWorkspaceKinds: ListWorkspaceKindsAPI = (hostPath) => (opts) =>
  wrapRequest(restGET(hostPath, `/workspacekinds`, {}, opts));

export const getWorkspaceKind: GetWorkspaceKindAPI = (hostPath) => (opts, kind) =>
  wrapRequest(restGET(hostPath, `/workspacekinds/${kind}`, {}, opts));

export const createWorkspaceKind: CreateWorkspaceKindAPI = (hostPath) => (opts, data) =>
  wrapRequest(restYAML(hostPath, `/workspacekinds`, data, {}, opts));

export const updateWorkspaceKind: UpdateWorkspaceKindAPI = (hostPath) => (opts, kind, data) =>
  wrapRequest(restUPDATE(hostPath, `/workspacekinds/${kind}`, data, {}, opts));

export const patchWorkspaceKind: PatchWorkspaceKindAPI = (hostPath) => (opts, kind, data) =>
  wrapRequest(restPATCH(hostPath, `/workspacekinds/${kind}`, data, opts));

export const deleteWorkspaceKind: DeleteWorkspaceKindAPI = (hostPath) => (opts, kind) =>
  wrapRequest(restDELETE(hostPath, `/workspacekinds/${kind}`, {}, {}, opts), false);
