import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { renderHook } from '~/__tests__/unit/testUtils/hooks';
import { useWorkspaceFormLocationData } from '~/app/hooks/useWorkspaceFormLocationData';
import { NamespaceContextProvider } from '~/app/context/NamespaceContextProvider';

jest.mock('~/app/context/NamespaceContextProvider', () => {
  const ReactActual = jest.requireActual('react');
  const mockNamespaceValue = {
    namespaces: ['ns1', 'ns2', 'ns3'],
    selectedNamespace: 'ns1',
    setSelectedNamespace: jest.fn(),
    lastUsedNamespace: 'ns1',
    updateLastUsedNamespace: jest.fn(),
  };
  const MockContext = ReactActual.createContext(mockNamespaceValue);
  return {
    NamespaceContextProvider: ({ children }: { children: React.ReactNode }) => (
      <MockContext.Provider value={mockNamespaceValue}>{children}</MockContext.Provider>
    ),
    useNamespaceContext: () => ReactActual.useContext(MockContext),
  };
});

describe('useWorkspaceFormLocationData', () => {
  const wrapper: React.FC<
    React.PropsWithChildren<{ initialEntries: (string | { pathname: string; state?: unknown })[] }>
  > = ({ children, initialEntries }) => (
    <MemoryRouter initialEntries={initialEntries}>
      <NamespaceContextProvider>{children}</NamespaceContextProvider>
    </MemoryRouter>
  );

  it('returns edit mode data', () => {
    const initialEntries = [
      { pathname: '/workspaces/edit', state: { namespace: 'ns2', workspaceName: 'ws' } },
    ];
    const { result } = renderHook(() => useWorkspaceFormLocationData(), {
      wrapper: (props) => wrapper({ ...props, initialEntries }),
    });
    expect(result.current).toEqual({ mode: 'edit', namespace: 'ns2', workspaceName: 'ws' });
  });

  it('throws when missing workspaceName in edit mode', () => {
    const initialEntries = [{ pathname: '/workspaces/edit', state: { namespace: 'ns1' } }];
    expect(() =>
      renderHook(() => useWorkspaceFormLocationData(), {
        wrapper: (props) => wrapper({ ...props, initialEntries }),
      }),
    ).toThrow();
  });

  it('returns create mode data using selected namespace when state not provided', () => {
    const initialEntries = [{ pathname: '/workspaces/create' }];
    const { result } = renderHook(() => useWorkspaceFormLocationData(), {
      wrapper: (props) => wrapper({ ...props, initialEntries }),
    });
    expect(result.current).toEqual({ mode: 'create', namespace: 'ns1' });
  });
});
