import { useCallback } from 'react';
import { FetchStateCallbackPromise, useFetchState, NotReadyError } from 'mod-arch-core';
import { SecretsSecretListItem } from '~/generated/data-contracts';
import { useNotebookAPI } from '~/app/hooks/useNotebookAPI';
import { useNamespaceSelectorWrapper } from '~/app/hooks/useNamespaceSelectorWrapper';

interface UseSecretsResult {
  secrets: SecretsSecretListItem[];
  secretsLoaded: boolean;
  secretLoadError: string | null;
  refreshSecrets: () => Promise<SecretsSecretListItem[] | undefined>;
}

const useSecrets = (): UseSecretsResult => {
  const { api, apiAvailable } = useNotebookAPI();
  const { selectedNamespace } = useNamespaceSelectorWrapper();

  const call = useCallback<FetchStateCallbackPromise<SecretsSecretListItem[]>>(async () => {
    if (!apiAvailable) {
      return Promise.reject(new NotReadyError('API not yet available'));
    }
    if (!selectedNamespace) {
      return Promise.reject(new NotReadyError('Namespace not yet available'));
    }
    const response = await api.secrets.listSecrets(selectedNamespace);
    return response.data;
  }, [api.secrets, apiAvailable, selectedNamespace]);

  const [secrets, secretsLoaded, error, refreshSecrets] = useFetchState(call, [], {
    initialPromisePurity: true,
  });

  return {
    secrets,
    secretsLoaded,
    secretLoadError:
      error && !(error instanceof NotReadyError) ? 'Failed to load secret details.' : null,
    refreshSecrets,
  };
};

export default useSecrets;
