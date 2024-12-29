import React, { useState, useContext, ReactNode, useMemo, useCallback } from 'react';
import useMount from '~/app/hooks/useMount';
import useNamespaces from '~/app/hooks/useNamespaces';

interface NamespaceContextType {
  namespaces: string[];
  selectedNamespace: string;
  setSelectedNamespace: (namespace: string) => void;
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

  const fetchNamespaces = useCallback(() => {
    if (loaded && namespacesData) {
      const namespaceNames = namespacesData.map((ns) => ns.name);
      setNamespaces(namespaceNames);
      setSelectedNamespace(namespaceNames.length > 0 ? namespaceNames[0] : '');
    } else {
      if (loadError) {
        console.error('Error loading namespaces: ', loadError);
      }
      setNamespaces([]);
      setSelectedNamespace('');
    }
  }, [loaded, namespacesData, loadError]);

  useMount(fetchNamespaces);

  const namespacesContextValues = useMemo(
    () => ({ namespaces, selectedNamespace, setSelectedNamespace }),
    [namespaces, selectedNamespace],
  );

  return (
    <NamespaceContext.Provider value={namespacesContextValues}>
      {children}
    </NamespaceContext.Provider>
  );
};
