import React, { ReactNode, useCallback, useContext, useMemo, useState } from 'react';
import useMount from '~/app/hooks/useMount';
import useNamespaces from '~/app/hooks/useNamespaces';
import { useStorage } from './BrowserStorageContext';

const storageKey = 'kubeflow.notebooks.namespace.lastUsed';

interface NamespaceContextType {
  namespaces: string[];
  selectedNamespace: string;
  setSelectedNamespace: (namespace: string) => void;
  lastUsedNamespace: string;
  updateLastUsedNamespace: (value: string) => void;
}

const NamespaceContext = React.createContext<NamespaceContextType | undefined>(undefined);

export const useNamespaceContext = (): NamespaceContextType => {
  const context = useContext(NamespaceContext);
  if (!context) {
    throw new Error('useNamespaceContext must be used within a NamespaceContextProvider');
  }
  return context;
};

interface NamespaceContextProviderProps {
  children: ReactNode;
}

export const NamespaceContextProvider: React.FC<NamespaceContextProviderProps> = ({ children }) => {
  const [namespaces, setNamespaces] = useState<string[]>([]);
  const [selectedNamespace, setSelectedNamespace] = useState<string>('');
  const [namespacesData, loaded, loadError] = useNamespaces();
  const [lastUsedNamespace, setLastUsedNamespace] = useStorage<string>(storageKey, '');

  const fetchNamespaces = useCallback(() => {
    if (loaded && namespacesData) {
      const namespaceNames = namespacesData.map((ns) => ns.name);
      setNamespaces(namespaceNames);
      setSelectedNamespace(lastUsedNamespace.length ? lastUsedNamespace : namespaceNames[0]);
      if (!lastUsedNamespace.length || !namespaceNames.includes(lastUsedNamespace)) {
        setLastUsedNamespace(storageKey, namespaceNames[0]);
      }
    } else {
      if (loadError) {
        console.error('Error loading namespaces: ', loadError);
      }
      setNamespaces([]);
      setSelectedNamespace('');
    }
  }, [loaded, namespacesData, lastUsedNamespace, setLastUsedNamespace, loadError]);

  const updateLastUsedNamespace = useCallback(
    (value: string) => setLastUsedNamespace(storageKey, value),
    [setLastUsedNamespace],
  );

  useMount(fetchNamespaces);

  const namespacesContextValues = useMemo(
    () => ({
      namespaces,
      selectedNamespace,
      setSelectedNamespace,
      lastUsedNamespace,
      updateLastUsedNamespace,
    }),
    [namespaces, selectedNamespace, lastUsedNamespace, updateLastUsedNamespace],
  );

  return (
    <NamespaceContext.Provider value={namespacesContextValues}>
      {children}
    </NamespaceContext.Provider>
  );
};
