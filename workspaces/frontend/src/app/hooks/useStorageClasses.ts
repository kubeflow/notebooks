import { useCallback } from 'react';
import { FetchStateCallbackPromise, useFetchState, NotReadyError } from 'mod-arch-core';
import { ApiErrorEnvelope, StorageclassesStorageClassListItem } from '~/generated/data-contracts';
import { useNotebookAPI } from '~/app/hooks/useNotebookAPI';
import { extractErrorMessage } from '~/shared/api/apiUtils';

interface UseStorageClassesResult {
  storageClasses: StorageclassesStorageClassListItem[];
  storageClassLoadError: string | ApiErrorEnvelope | null;
}

const useStorageClasses = (namespace?: string): UseStorageClassesResult => {
  const { api, apiAvailable } = useNotebookAPI();

  const call = useCallback<
    FetchStateCallbackPromise<StorageclassesStorageClassListItem[]>
  >(async () => {
    if (!apiAvailable) {
      return Promise.reject(new NotReadyError('API not yet available'));
    }
    const query = namespace ? { namespace } : undefined;
    const response = await api.storageClasses.listStorageClasses(query);
    return response.data;
  }, [api.storageClasses, apiAvailable, namespace]);

  const [storageClasses, , error] = useFetchState(call, [], { initialPromisePurity: true });

  return {
    storageClasses,
    storageClassLoadError:
      error && !(error instanceof NotReadyError) ? extractErrorMessage(error) : null,
  };
};

export default useStorageClasses;
