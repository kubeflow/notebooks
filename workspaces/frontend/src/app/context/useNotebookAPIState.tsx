import React from 'react';
import { APIState, APIOptions } from '~/shared/api/types';
import { NotebookAPIs } from '~/app/types';
import { getNamespaces, getWorkspaces, getWorkspaceKinds } from '~/shared/api/notebookService';
import useAPIState from '~/shared/api/useAPIState';

export type NotebookAPIState = APIState<NotebookAPIs>;

const useNotebookAPIState = (
  hostPath: string | null,
): [apiState: NotebookAPIState, refreshAPIState: () => void] => {
  const createAPI = React.useCallback(
    (path: string) => ({
      getNamespaces: getNamespaces(path),
      getWorkspaceKinds: getWorkspaceKinds(path),
      getWorkspaces: (opts: APIOptions, namespace = '') => getWorkspaces(path, namespace)(opts),
    }),
    [],
  );

  return useAPIState(hostPath, createAPI);
};

export default useNotebookAPIState;
