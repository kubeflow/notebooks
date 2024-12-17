import React, {
  useState,
  useContext,
  ReactNode,
  useMemo,
  useCallback,
} from 'react';
import useMount from '../hooks/useMount';

interface NamespaceContextState {
  namespaces: string[];
  selectedNamespace: string;
  setSelectedNamespace: (namespace: string) => void;
}

const NamespaceContext = React.createContext<NamespaceContextState | undefined>(
  undefined
);

export const useNamespaceContext = () => {
  const context = useContext(NamespaceContext);
  if (!context) {
    throw new Error(
      "useNamespaceContext must be used within a NamespaceProvider"
    );
  }
  return context;
};

interface NamespaceProviderProps {
  children: ReactNode;
}

export const NamespaceProvider: React.FC<NamespaceProviderProps> = ({
  children,
}) => {
  const [namespaces, setNamespaces] = useState<string[]>([]);
  const [selectedNamespace, setSelectedNamespace] = useState<string>("");

  // Todo: Need to replace with actual API call
  const fetchNamespaces = useCallback(async () => {
    const mockNamespaces = {
      data: [{ name: 'default' }, { name: 'kubeflow' }, { name: 'custom-namespace' }],
    };
    const namespaceNames = mockNamespaces.data.map((ns) => ns.name);
    setNamespaces(namespaceNames);
    setSelectedNamespace(namespaceNames.length > 0 ? namespaceNames[0] : "");
  }, []);
  useMount(fetchNamespaces);
  const namespacesContextValues = useMemo(
    () => ({ namespaces, selectedNamespace, setSelectedNamespace }),
    [namespaces, selectedNamespace]
  );
  return (
    <NamespaceContext.Provider value={namespacesContextValues}>
      {children}
    </NamespaceContext.Provider>
  );
};
