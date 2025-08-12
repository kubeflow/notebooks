import React from 'react';
import { act } from 'react-dom/test-utils';
import { renderHook } from '~/__tests__/unit/testUtils/hooks';
import { WorkspaceActionsContext } from '~/app/context/WorkspaceActionsContext';
import { useWorkspaceRowActions } from '~/app/hooks/useWorkspaceRowActions';
import { WorkspacesWorkspace } from '~/generated/data-contracts';
import { buildMockWorkspace } from '~/shared/mock/mockBuilder';

jest.mock('~/app/context/WorkspaceActionsContext', () => {
  const ReactActual = jest.requireActual('react');
  const MockContext = ReactActual.createContext(undefined);
  return {
    WorkspaceActionsContext: MockContext,
    useWorkspaceActionsContext: () => ReactActual.useContext(MockContext),
  };
});

describe('useWorkspaceRowActions', () => {
  const workspace = buildMockWorkspace({ name: 'ws', namespace: 'ns' });

  type MinimalAction = { title?: string; isSeparator?: boolean; onClick?: () => void };
  type RequestActionArgs = { workspace: WorkspacesWorkspace; onActionDone?: () => void };
  type WorkspaceActionsContextLike = {
    requestViewDetailsAction: (args: RequestActionArgs) => void;
    requestEditAction: (args: RequestActionArgs) => void;
    requestDeleteAction: (args: RequestActionArgs) => void;
    requestStartAction: (args: RequestActionArgs) => void;
    requestRestartAction: (args: RequestActionArgs) => void;
    requestStopAction: (args: RequestActionArgs) => void;
  };

  const contextValue: WorkspaceActionsContextLike = {
    requestViewDetailsAction: jest.fn(),
    requestEditAction: jest.fn(),
    requestDeleteAction: jest.fn(),
    requestStartAction: jest.fn(),
    requestRestartAction: jest.fn(),
    requestStopAction: jest.fn(),
  };

  const wrapper: React.FC<React.PropsWithChildren> = ({ children }) => (
    <WorkspaceActionsContext.Provider value={contextValue}>
      {children}
    </WorkspaceActionsContext.Provider>
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('builds actions respecting visibility and separators', () => {
    const actionsToInclude = [
      { id: 'viewDetails' as const },
      { id: 'separator' as const },
      { id: 'edit' as const, isVisible: (w: WorkspacesWorkspace) => w.name === 'ws' },
      { id: 'delete' as const, isVisible: false },
    ];

    const { result } = renderHook(() => useWorkspaceRowActions(actionsToInclude), { wrapper });
    const actions = result.current(workspace);

    expect(actions).toHaveLength(3);
    expect((actions[0] as MinimalAction).title).toBe('View Details');
    expect((actions[1] as MinimalAction).isSeparator).toBe(true);
    expect((actions[2] as MinimalAction).title).toBe('Edit');
  });

  it('triggers context requests on action click', () => {
    const onActionDone = jest.fn();
    const { result } = renderHook(
      () =>
        useWorkspaceRowActions([
          { id: 'start' },
          { id: 'stop' },
          { id: 'restart' },
          { id: 'delete', onActionDone },
        ]),
      { wrapper },
    );

    const actions = result.current(workspace);
    act(() => (actions[0] as MinimalAction).onClick?.());
    act(() => (actions[1] as MinimalAction).onClick?.());
    act(() => (actions[2] as MinimalAction).onClick?.());
    act(() => (actions[3] as MinimalAction).onClick?.());

    expect(contextValue.requestStartAction).toHaveBeenCalledWith({ workspace });
    expect(contextValue.requestStopAction).toHaveBeenCalledWith({ workspace });
    expect(contextValue.requestRestartAction).toHaveBeenCalledWith({ workspace });
    expect(contextValue.requestDeleteAction).toHaveBeenCalledWith({ workspace, onActionDone });
  });
});
