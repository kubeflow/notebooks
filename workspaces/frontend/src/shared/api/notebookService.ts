import { NamespacesList, CreateWorkspaceData } from '~/app/types';
import { isNotebookResponse, restGET, restCREATE } from '~/shared/api/apiUtils';
import { APIOptions } from '~/shared/api/types';
import { handleRestFailures } from '~/shared/api/errorUtils';
import { Workspace, WorkspaceKind } from '~/shared/types';

export const getNamespaces =
  (hostPath: string) =>
  (opts: APIOptions): Promise<NamespacesList> =>
    handleRestFailures(restGET(hostPath, `/namespaces`, {}, opts)).then((response) => {
      if (isNotebookResponse<NamespacesList>(response)) {
        return response.data;
      }
      throw new Error('Invalid response format');
    });

export const getWorkspaceKinds =
  (hostPath: string) =>
  (opts: APIOptions): Promise<WorkspaceKind[]> =>
    handleRestFailures(restGET(hostPath, `/workspacekinds`, {}, opts)).then((response) => {
      if (isNotebookResponse<WorkspaceKind[]>(response)) {
        return response.data;
      }
      throw new Error('Invalid response format');
    });

export const createWorkspace =
  (hostPath: string) =>
  (opts: APIOptions, data: CreateWorkspaceData, namespace = ''): Promise<Workspace> =>
    handleRestFailures(restCREATE(hostPath, `/workspaces/${namespace}`, data, opts)).then(
      (response) => {
        if (isNotebookResponse<Workspace>(response)) {
          return response.data;
        }
        throw new Error('Invalid response format');
      },
    );
