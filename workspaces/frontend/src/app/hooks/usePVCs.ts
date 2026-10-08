import { useCallback } from 'react';
import { FetchStateCallbackPromise, useFetchState, NotReadyError } from 'mod-arch-core';
import { PvcsPVCListItem } from '~/generated/data-contracts';
import { useNotebookAPI } from '~/app/hooks/useNotebookAPI';

interface UsePVCsResult {
  pvcs: PvcsPVCListItem[];
  pvcsLoaded: boolean;
  pvcLoadError: string | null;
  refreshPVCs: () => Promise<PvcsPVCListItem[] | undefined>;
}

const usePVCs = (namespace: string): UsePVCsResult => {
  const { api, apiAvailable } = useNotebookAPI();

  const call = useCallback<FetchStateCallbackPromise<PvcsPVCListItem[]>>(async () => {
    if (!apiAvailable) {
      return Promise.reject(new NotReadyError('API not yet available'));
    }
    if (!namespace) {
      return Promise.reject(new NotReadyError('Namespace not yet available'));
    }
    const response = await api.pvc.listPvCs(namespace);
    return response.data;
  }, [api.pvc, apiAvailable, namespace]);

  const [pvcs, pvcsLoaded, error, refreshPVCs] = useFetchState(call, [], {
    initialPromisePurity: true,
  });

  return {
    pvcs,
    pvcsLoaded,
    pvcLoadError:
      error && !(error instanceof NotReadyError)
        ? 'Failed to load volume details. Connection info may be unavailable.'
        : null,
    refreshPVCs,
  };
};

export default usePVCs;
