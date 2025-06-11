import { useContext } from 'react';
import { NotebookAPIState } from '~/app/context/useNotebookAPIState';
import { NotebookContext } from '~/app/context/NotebookContext';

type UseNotebookAPI = NotebookAPIState & {
  refreshAllAPI: () => void;
};

export const useNotebookAPI = (): UseNotebookAPI => {
  const { apiState, refreshAPIState: refreshAllAPI } = useContext(NotebookContext);

  return {
    refreshAllAPI,
    ...apiState,
  };
};
