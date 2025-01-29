import React from 'react';
import { APIState } from '~/shared/api/types';
import { NotebookAPIs } from '~/app/types';
import { getNamespaces, getWorkspaceKinds } from '~/shared/api/notebookService';
import useAPIState from '~/shared/api/useAPIState';

export type NotebookAPIState = APIState<NotebookAPIs>;

const useNotebookAPIState = (
  hostPath: string | null,
): [apiState: NotebookAPIState, refreshAPIState: () => void] => {
  const createAPI = React.useCallback(
    (path: string) => ({
      getNamespaces: getNamespaces(path),
      getWorkspaceKinds: getWorkspaceKinds(path),
    }),
    [],
  );

  return useAPIState(hostPath, createAPI);
};

export default useNotebookAPIState;
