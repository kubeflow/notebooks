import { useCallback } from 'react';
import { FetchState, FetchStateCallbackPromise, useFetchState, NotReadyError } from 'mod-arch-core';
import { useNotebookAPI } from '~/app/hooks/useNotebookAPI';
import { SecretsSecretUpdate, V1SecretType } from '~/generated/data-contracts';

export type SecretKeyValuePair = { key: string } & (
  | { kind: 'unchanged' }
  | { kind: 'new' | 'replacement'; value: string }
);

export interface SecretDetails {
  keyValuePairs: SecretKeyValuePair[];
  immutable: boolean;
  type: SecretsSecretUpdate['type'];
}

interface UseSecretOptions {
  isOpen: boolean;
  secretName: string | undefined;
  namespace: string;
}

const DEFAULT_SECRET_DETAILS: SecretDetails = {
  keyValuePairs: [],
  immutable: false,
  type: V1SecretType.SecretTypeOpaque,
};

const useSecret = ({
  isOpen,
  secretName,
  namespace,
}: UseSecretOptions): FetchState<SecretDetails> => {
  const { api, apiAvailable } = useNotebookAPI();

  const call = useCallback<FetchStateCallbackPromise<SecretDetails>>(async () => {
    if (!apiAvailable) {
      return Promise.reject(new NotReadyError('API not yet available'));
    }

    if (!isOpen || !secretName || !namespace) {
      return Promise.reject(new NotReadyError('Modal not open or secret target not ready'));
    }

    const response = await api.secrets.getSecret(namespace, secretName);
    const { contents, immutable, type } = response.data;

    // Existing data stays on the server, including values that are not UTF-8 text.
    const keyValuePairs: SecretKeyValuePair[] = Object.keys(contents).map((key) => ({
      key,
      kind: 'unchanged',
    }));

    return { keyValuePairs, immutable, type };
  }, [api.secrets, apiAvailable, isOpen, secretName, namespace]);

  return useFetchState(call, DEFAULT_SECRET_DETAILS, { initialPromisePurity: true });
};

export default useSecret;
