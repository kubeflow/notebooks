import { useCallback, useRef, useState } from 'react';
import { useNotebookAPI } from '~/app/hooks/useNotebookAPI';
import { useNamespaceSelectorWrapper } from '~/app/hooks/useNamespaceSelectorWrapper';

interface SecretKeysState {
  keys: string[];
  isLoaded: boolean;
  error: string | null;
}

interface UseSecretKeysReturn {
  getSecretKeysState: (secretName: string) => SecretKeysState;
  fetchSecretKeys: (secretName: string) => Promise<void>;
}

const INITIAL_STATE: SecretKeysState = {
  keys: [],
  isLoaded: false,
  error: null,
};

/**
 * Lazily fetches and caches secret key names for display in the secrets table.
 * Keys are fetched on demand (when a row is expanded) and cached per secret name.
 */
export const useSecretKeys = (): UseSecretKeysReturn => {
  const { api } = useNotebookAPI();
  const { selectedNamespace } = useNamespaceSelectorWrapper();
  const [secretKeysMap, setSecretKeysMap] = useState<Map<string, SecretKeysState>>(new Map());
  const fetchingRef = useRef<Set<string>>(new Set());

  const getSecretKeysState = useCallback(
    (secretName: string): SecretKeysState => secretKeysMap.get(secretName) ?? INITIAL_STATE,
    [secretKeysMap],
  );

  const fetchSecretKeys = useCallback(
    async (secretName: string) => {
      if (fetchingRef.current.has(secretName) || secretKeysMap.get(secretName)?.isLoaded) {
        return;
      }

      fetchingRef.current.add(secretName);

      try {
        const response = await api.secrets.getSecret(selectedNamespace, secretName);
        const keys = Object.keys(response.data.contents);
        setSecretKeysMap((prev) => {
          const next = new Map(prev);
          next.set(secretName, { keys, isLoaded: true, error: null });
          return next;
        });
      } catch {
        setSecretKeysMap((prev) => {
          const next = new Map(prev);
          next.set(secretName, { keys: [], isLoaded: true, error: 'Failed to load secret keys' });
          return next;
        });
      } finally {
        fetchingRef.current.delete(secretName);
      }
    },
    [api.secrets, selectedNamespace, secretKeysMap],
  );

  return { getSecretKeysState, fetchSecretKeys };
};
