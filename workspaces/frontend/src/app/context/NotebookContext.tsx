import * as React from 'react';
import { ReactNode } from 'react';
import { BFF_API_VERSION } from '~/app/const';
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
  const hostPath = `/api/${BFF_API_VERSION}`;

  const [apiState, refreshAPIState] = useNotebookAPIState(hostPath);

  return (
    <NotebookContext.Provider
      value={React.useMemo(
        () => ({
          apiState,
          refreshAPIState,
        }),
        [apiState, refreshAPIState],
      )}
    >
      {children}
    </NotebookContext.Provider>
  );
};
