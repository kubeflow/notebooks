import React, {
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import useMount from '~/app/hooks/useMount';
import useNamespaces from '~/app/hooks/useNamespaces';
import { useStorage } from './BrowserStorageContext';

const storageKey = 'kubeflow.notebooks.namespace.lastUsed';
const isStandalone = process.env.PRODUCTION !== 'true';

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
  const [scriptLoaded, setScriptLoaded] = useState(false);

  // Track when central dashboard is updating to prevent conflicts with cross-tab sync
  const centralDashboardUpdateRef = useRef(false);

  useEffect(() => {
    if (isStandalone) {
      return;
    }
    const scriptUrl = '/dashboard_lib.bundle.js';
    fetch(scriptUrl, { method: 'HEAD' })
      .then((response) => {
        if (response.ok) {
          const script = document.createElement('script');
          script.src = scriptUrl;
          script.async = true;
          script.onload = () => {
            setScriptLoaded(true);
          };
          script.onerror = () => {
            console.error('Failed to load the script');
          };
          document.head.appendChild(script);
        } else {
          console.warn('Script not found');
        }
      })
      .catch((err) => {
        console.error('Error loading script', err);
      });
  }, []);

  useEffect(() => {
    if (scriptLoaded) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @cspell/spellchecker
      (window as any).centraldashboard.CentralDashboardEventHandler.init((cdeh: any) => {
        // Namespace selection https://github.com/kubeflow/kubeflow/blob/master/components/centraldashboard/README.md
        // eslint-disable-next-line no-param-reassign, @cspell/spellchecker
        cdeh.onNamespaceSelected = (namespace: string) => {
          centralDashboardUpdateRef.current = true;
          setSelectedNamespace(namespace);
          // Always update lastUsedNamespace to enable cross-tab synchronization
          setLastUsedNamespace(storageKey, namespace);
          console.info('Central Dashboard Namespace Selected: ', namespace);
          // Reset flag after update
          setTimeout(() => {
            centralDashboardUpdateRef.current = false;
          }, 100);
        };
      });
    }
  }, [scriptLoaded, setLastUsedNamespace]);

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

  // Listen for changes in lastUsedNamespace from other tabs and update selectedNamespace
  useEffect(() => {
    if (
      !isStandalone &&
      lastUsedNamespace &&
      lastUsedNamespace !== selectedNamespace &&
      !centralDashboardUpdateRef.current
    ) {
      setSelectedNamespace(lastUsedNamespace);
    }
  }, [lastUsedNamespace, selectedNamespace]);

  useMount(() => {
    if (isStandalone) {
      fetchNamespaces();
    }
  });

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
