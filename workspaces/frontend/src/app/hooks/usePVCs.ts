import { useCallback } from 'react';
import { FetchStateCallbackPromise, useFetchState, NotReadyError } from 'mod-arch-core';
import { PvcsPVCListItem } from '~/generated/data-contracts';
import { useNotebookAPI } from '~/app/hooks/useNotebookAPI';
import { useNamespaceSelectorWrapper } from '~/app/hooks/useNamespaceSelectorWrapper';

interface UsePVCsResult {
  pvcs: PvcsPVCListItem[];
  pvcLoadError: string | null;
}

const usePVCs = (): UsePVCsResult => {
  const { api, apiAvailable } = useNotebookAPI();
  const { selectedNamespace } = useNamespaceSelectorWrapper();

  const call = useCallback<FetchStateCallbackPromise<PvcsPVCListItem[]>>(async () => {
    if (!apiAvailable) {
      return Promise.reject(new NotReadyError('API not yet available'));
    }
    if (!selectedNamespace) {
      return Promise.reject(new NotReadyError('Namespace not yet available'));
    }
    const response = await api.pvc.listPvCs(selectedNamespace);
    return response.data;
  }, [api.pvc, apiAvailable, selectedNamespace]);

  const [pvcs, , error] = useFetchState(call, [], { initialPromisePurity: true });

  return {
    pvcs,
    pvcLoadError:
      error && !(error instanceof NotReadyError)
        ? 'Failed to load volume details. Connection info may be unavailable.'
        : null,
  };
};

export default usePVCs;
