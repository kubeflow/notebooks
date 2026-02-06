import { useCallback } from 'react';
import { FetchState, FetchStateCallbackPromise, useFetchState, NotReadyError } from 'mod-arch-core';
import { useNotebookAPI } from '~/app/hooks/useNotebookAPI';
import { useNamespaceSelectorWrapper } from '~/app/hooks/useNamespaceSelectorWrapper';

export interface SecretKeyValuePair {
  key: string;
  value: string;
}

interface UseSecretContentsOptions {
  isOpen: boolean;
  secretName: string | undefined;
}

const useSecretContents = ({
  isOpen,
  secretName,
}: UseSecretContentsOptions): FetchState<SecretKeyValuePair[]> => {
  const { api, apiAvailable } = useNotebookAPI();
  const { selectedNamespace } = useNamespaceSelectorWrapper();

  const call = useCallback<FetchStateCallbackPromise<SecretKeyValuePair[]>>(async () => {
    if (!apiAvailable) {
      return Promise.reject(new NotReadyError('API not yet available'));
    }

    if (!isOpen || !secretName) {
      return Promise.reject(new NotReadyError('Modal not open or no secret to edit'));
    }

    const response = await api.secrets.getSecret(selectedNamespace, secretName);
    const { contents } = response.data;

    if (Object.keys(contents).length === 0) {
      return [];
    }

    return Object.entries(contents).map(([key, value]) => ({
      key,
      value: value.base64 ? atob(value.base64) : '',
    }));
  }, [api.secrets, apiAvailable, isOpen, secretName, selectedNamespace]);

  return useFetchState(call, [], { initialPromisePurity: true });
};

export default useSecretContents;
