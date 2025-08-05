import { useCallback } from 'react';
import { NotebookApis, notebookApisImpl } from '~/shared/api/notebookApi';
import { APIState } from '~/shared/api/types';
import useAPIState from '~/shared/api/useAPIState';
import { mockNotebookApisImpl } from '~/shared/mock/mockNotebookApis';

export type NotebookAPIState = APIState<NotebookApis>;

const MOCK_API_ENABLED = process.env.WEBPACK_REPLACE__mockApiEnabled === 'true';

const useNotebookAPIState = (
  hostPath: string | null,
): [apiState: NotebookAPIState, refreshAPIState: () => void] => {
  const createApi = useCallback((path: string) => notebookApisImpl(path), []);
  const createMockApi = useCallback(() => mockNotebookApisImpl(), []);
  return useAPIState(hostPath, MOCK_API_ENABLED ? createMockApi : createApi);
};

export default useNotebookAPIState;
