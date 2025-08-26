import React, { ReactNode, useMemo } from 'react';
import EnsureAPIAvailability from '~/app/EnsureAPIAvailability';
import { BFF_API_PREFIX, BFF_API_VERSION } from '~/shared/utilities/const';
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
  // Remove trailing slash from BFF_API_PREFIX to avoid double slashes
  const cleanPrefix = BFF_API_PREFIX.replace(/\/$/, '');
  const hostPath = `${cleanPrefix}/api/${BFF_API_VERSION}`;

  const [apiState, refreshAPIState] = useNotebookAPIState(hostPath);

  return (
    <NotebookContext.Provider
      value={useMemo(
        () => ({
          apiState,
          refreshAPIState,
        }),
        [apiState, refreshAPIState],
      )}
    >
      <EnsureAPIAvailability>{children}</EnsureAPIAvailability>
    </NotebookContext.Provider>
  );
};
