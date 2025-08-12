import React from 'react';
import { renderHook } from '~/__tests__/unit/testUtils/hooks';
import { NotebookContext } from '~/app/context/NotebookContext';
import { useNotebookAPI } from '~/app/hooks/useNotebookAPI';

jest.mock('~/app/EnsureAPIAvailability', () => ({
  default: ({ children }: { children?: React.ReactNode }) => children as React.ReactElement,
}));

describe('useNotebookAPI', () => {
  it('returns api state and refresh function from context', () => {
    const refreshAPIState = jest.fn();
    const api = {} as ReturnType<typeof useNotebookAPI>['api'];
    const wrapper: React.FC<React.PropsWithChildren> = ({ children }) => (
      <NotebookContext.Provider
        value={{
          apiState: { apiAvailable: true, api },
          refreshAPIState,
        }}
      >
        {children}
      </NotebookContext.Provider>
    );

    const { result } = renderHook(() => useNotebookAPI(), { wrapper });

    expect(result.current.apiAvailable).toBe(true);
    expect(result.current.api).toBe(api);

    result.current.refreshAllAPI();
    expect(refreshAPIState).toHaveBeenCalled();
  });
});
