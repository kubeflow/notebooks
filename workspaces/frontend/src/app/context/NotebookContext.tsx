import React, { ReactNode, useMemo } from 'react';
import EnsureAPIAvailability from '~/app/EnsureAPIAvailability';
import { URL_PREFIX, BFF_API_VERSION } from '~/shared/utilities/const';
import useNotebookAPIState, { NotebookAPIState } from './useNotebookAPIState';

export type NotebookContextType = {
  apiState: NotebookAPIState;
  refreshAPIState: () => void;
};

export const NotebookContext = React.createContext<NotebookContextType>({
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  apiState: { apiAvailable: false, api: null as unknown as NotebookAPIState['api'] },
  refreshAPIState: () => undefined,
});

interface NotebookContextProviderProps {
  children: ReactNode;
}

export const NotebookContextProvider: React.FC<NotebookContextProviderProps> = ({ children }) => {
  // Remove trailing slash from URL_PREFIX to avoid double slashes
  const cleanPrefix = URL_PREFIX.replace(/\/$/, '');
  const hostPath = `${cleanPrefix}/api/${BFF_API_VERSION}`;

  const [apiState, refreshAPIState] = useNotebookAPIState(hostPath);

  const contextValue = useMemo(
    () => ({
      apiState,
      refreshAPIState,
    }),
    [apiState, refreshAPIState],
  );

  return (
    <NotebookContext.Provider value={contextValue}>
      <EnsureAPIAvailability>{children}</EnsureAPIAvailability>
    </NotebookContext.Provider>
  );
};
