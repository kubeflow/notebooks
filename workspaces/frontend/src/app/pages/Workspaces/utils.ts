import { Workspace } from '~/shared/types';
import { CreateWorkspaceData } from '~/app/types';
import { NotebookAPIState } from '~/app/context/useNotebookAPIState';
import { APIOptions } from '~/shared/api/types';

export type RegisterWorkspaceCreatedResources = {
  workspace: Workspace;
};

export const createWorkspaceCall = async (
  opts: APIOptions,
  api: NotebookAPIState['api'],
  formData: CreateWorkspaceData,
  namespace: string,
): Promise<RegisterWorkspaceCreatedResources> => {
  const workspace = await api.createWorkspace(opts, formData, namespace);
  return { workspace };
};
