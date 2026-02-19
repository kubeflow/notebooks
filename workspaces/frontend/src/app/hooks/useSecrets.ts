import { FetchState, useFetchState } from 'mod-arch-core';
import { useCallback } from 'react';
import { useNotebookAPI } from '~/app/hooks/useNotebookAPI';
import { ApiSecretListEnvelope } from '~/generated/data-contracts';

export const useSecretsByNamespace = (
  namespace: string,
): FetchState<ApiSecretListEnvelope['data']> => {
  const { api, apiAvailable } = useNotebookAPI();

  const call = useCallback(async () => {
    if (!apiAvailable) {
      throw new Error('API not yet available');
    }
    if (!namespace) {
      throw new Error('Namespace is required');
    }
    const envelope = await api.secrets.listSecrets(namespace);
    return envelope.data;
  }, [api.secrets, apiAvailable, namespace]);

  return useFetchState(call, []);
};
