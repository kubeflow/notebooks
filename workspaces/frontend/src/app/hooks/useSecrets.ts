import { useCallback } from 'react';
import { FetchStateCallbackPromise, useFetchState, NotReadyError } from 'mod-arch-core';
import { SecretsSecretListItem } from '~/generated/data-contracts';
import { useNotebookAPI } from '~/app/hooks/useNotebookAPI';

interface UseSecretsResult {
  secrets: SecretsSecretListItem[];
  secretsLoaded: boolean;
  secretLoadError: string | null;
  refreshSecrets: () => Promise<SecretsSecretListItem[] | undefined>;
}

const useSecrets = (namespace: string): UseSecretsResult => {
  const { api, apiAvailable } = useNotebookAPI();

  const call = useCallback<FetchStateCallbackPromise<SecretsSecretListItem[]>>(async () => {
    if (!apiAvailable) {
      return Promise.reject(new NotReadyError('API not yet available'));
    }
    if (!namespace) {
      return Promise.reject(new NotReadyError('Namespace not yet available'));
    }
    const response = await api.secrets.listSecrets(namespace);
    return response.data;
  }, [api.secrets, apiAvailable, namespace]);

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
