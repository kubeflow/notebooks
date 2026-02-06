import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { renderHook } from '~/__tests__/unit/testUtils/hooks';
import { useNamespaceSelectorWrapper } from '~/app/hooks/useNamespaceSelectorWrapper';
import { useWorkspaceFormLocationData } from '~/app/hooks/useWorkspaceFormLocationData';

jest.mock('~/app/hooks/useNamespaceSelectorWrapper', () => ({
  useNamespaceSelectorWrapper: jest.fn(),
}));

const mockUseNamespaceSelectorWrapper = useNamespaceSelectorWrapper as jest.MockedFunction<
  typeof useNamespaceSelectorWrapper
>;

describe('useWorkspaceFormLocationData', () => {
  beforeEach(() => {
    mockUseNamespaceSelectorWrapper.mockReturnValue({
      namespacesLoaded: true,
      selectedNamespace: 'ns1',
    } as ReturnType<typeof useNamespaceSelectorWrapper>);
  });

  const wrapper: React.FC<
    React.PropsWithChildren<{ initialEntries: (string | { pathname: string; state?: unknown })[] }>
  > = ({ children, initialEntries }) => (
    <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
  );

  it('returns edit mode data', () => {
    const initialEntries = [
      {
        pathname: '/workspaces/edit',
        state: { namespace: 'ns2', workspaceName: 'ws', workspaceKindName: 'wk' },
      },
    ];
    const { result } = renderHook(() => useWorkspaceFormLocationData(), {
      wrapper: (props) => wrapper({ ...props, initialEntries }),
    });
    expect(result.current).toEqual({
      mode: 'update',
      namespace: 'ns2',
      workspaceName: 'ws',
      workspaceKindName: 'wk',
    });
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
