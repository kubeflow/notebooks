import React, { ReactNode, useContext, useMemo, useRef, useEffect } from 'react';
import { useBrowserStorage, useNamespaceSelector } from 'mod-arch-core';

const storageKey = 'kubeflow.notebooks.namespace.lastUsed';

interface NamespaceContextType {
  selectedNamespace: string;
  namespacesLoaded: boolean;
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
  const {
    namespaces: namespacesModArc,
    preferredNamespace,
    updatePreferredNamespace,
    namespacesLoaded,
  } = useNamespaceSelector();
  const [lastUsedNamespace, setLastUsedNamespace] = useBrowserStorage<string>(storageKey, '');
  const namespaces = useMemo(() => namespacesModArc.map((ns) => ns.name), [namespacesModArc]);

  const isInitializedRef = useRef(false);
  const previousPreferredNamespaceRef = useRef<string | undefined>(undefined);

  const selectedNamespace = useMemo(() => {
    const currentPreferredName = preferredNamespace?.name ?? '';

    if (!isInitializedRef.current && namespacesLoaded) {
      if (lastUsedNamespace && namespaces.includes(lastUsedNamespace)) {
        return lastUsedNamespace;
      }
      return currentPreferredName;
    }

    if (lastUsedNamespace && namespaces.includes(lastUsedNamespace)) {
      return lastUsedNamespace;
    }

    return currentPreferredName;
  }, [lastUsedNamespace, namespaces, preferredNamespace?.name, namespacesLoaded]);

  useEffect(() => {
    if (isInitializedRef.current || !namespacesLoaded) {
      return;
    }

    isInitializedRef.current = true;

    if (lastUsedNamespace && namespaces.includes(lastUsedNamespace)) {
      updatePreferredNamespace({ name: lastUsedNamespace });
    } else {
      const fallbackNamespace = preferredNamespace?.name || '';
      setLastUsedNamespace(fallbackNamespace);
    }
  }, [
    namespacesLoaded,
    lastUsedNamespace,
    namespaces,
    preferredNamespace?.name,
    updatePreferredNamespace,
    setLastUsedNamespace,
  ]);

  useEffect(() => {
    const currentPreferredName = preferredNamespace?.name;
    const previousPreferredName = previousPreferredNamespaceRef.current;

    previousPreferredNamespaceRef.current = currentPreferredName;

    if (
      isInitializedRef.current &&
      currentPreferredName !== previousPreferredName &&
      currentPreferredName
    ) {
      setLastUsedNamespace(currentPreferredName);
    }
  }, [preferredNamespace?.name, setLastUsedNamespace]);

  const namespacesContextValues = useMemo(
    () => ({
      selectedNamespace,
      namespacesLoaded,
    }),
    [selectedNamespace, namespacesLoaded],
  );

  return (
    <NamespaceContext.Provider value={namespacesContextValues}>
      {children}
    </NamespaceContext.Provider>
  );
};
