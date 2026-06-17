import { useCallback } from 'react';
import { FetchState, FetchStateCallbackPromise, useFetchState, NotReadyError } from 'mod-arch-core';
import { useNotebookAPI } from '~/app/hooks/useNotebookAPI';
import { useNamespaceSelectorWrapper } from '~/app/hooks/useNamespaceSelectorWrapper';

export interface SecretKeyValuePair {
  key: string;
  value: string;
}

export interface SecretDetails {
  keyValuePairs: SecretKeyValuePair[];
  immutable: boolean;
  type: string;
}

interface UseSecretOptions {
  isOpen: boolean;
  secretName: string | undefined;
}

const DEFAULT_SECRET_DETAILS: SecretDetails = {
  keyValuePairs: [],
  immutable: false,
  type: 'Opaque',
};

const useSecret = ({ isOpen, secretName }: UseSecretOptions): FetchState<SecretDetails> => {
  const { api, apiAvailable } = useNotebookAPI();
  const { selectedNamespace } = useNamespaceSelectorWrapper();

  const call = useCallback<FetchStateCallbackPromise<SecretDetails>>(async () => {
    if (!apiAvailable) {
      return Promise.reject(new NotReadyError('API not yet available'));
    }

    if (!isOpen || !secretName) {
      return Promise.reject(new NotReadyError('Modal not open or no secret to edit'));
    }

    const response = await api.secrets.getSecret(selectedNamespace, secretName);
    const { contents, immutable, type } = response.data;

    const keyValuePairs =
      Object.keys(contents).length === 0
        ? []
        : Object.entries(contents).map(([key, value]) => ({
            key,
            value: value.base64 ? atob(value.base64) : '',
          }));

    return { keyValuePairs, immutable, type };
  }, [api.secrets, apiAvailable, isOpen, secretName, selectedNamespace]);

  return useFetchState(call, DEFAULT_SECRET_DETAILS, { initialPromisePurity: true });
};

export default useSecret;
