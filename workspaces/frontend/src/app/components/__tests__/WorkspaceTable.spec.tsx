import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import WorkspaceTable from '~/app/components/WorkspaceTable';
import useWorkspaceKinds from '~/app/hooks/useWorkspaceKinds';
import { V1Beta1WorkspaceState } from '~/generated/data-contracts';
import { buildMockWorkspace, buildMockWorkspaceKind } from '~/shared/mock/mockBuilder';

jest.mock('~/app/hooks/useWorkspaceKinds', () => jest.fn());

jest.mock('~/app/context/WorkspaceActionsContext', () => ({
  useWorkspaceActionsContext: () => ({ isDrawerExpanded: false }),
}));

jest.mock('~/app/routerHelper', () => ({
  useTypedNavigate: () => jest.fn(),
}));

jest.mock('~/app/pages/Workspaces/WorkspaceConnectAction', () => ({
  WorkspaceConnectAction: () => <button type="button">Connect</button>,
}));

jest.mock('~/app/pages/Workspaces/ExpandedWorkspaceRow', () => ({
  ExpandedWorkspaceRow: () => <tr data-testid="expanded-workspace-row" />,
}));

jest.mock('~/app/components/RedirectIconWithPopover', () => ({
  RedirectIconWithPopover: () => <span data-testid="redirect-icon" />,
}));

jest.mock('~/app/components/WorkspaceKindImage', () => ({
  __esModule: true,
  default: ({ children }: { children: (src: string) => React.ReactNode }) => (
    <>{children('resolved-src')}</>
  ),
}));

jest.mock('~/app/components/RefreshCounter', () => ({
  RefreshCounter: () => <span data-testid="refresh-counter" />,
}));

jest.mock('~/shared/components/ToolbarFilter', () => {
  const react = jest.requireActual<typeof import('react')>('react');
  const MockToolbarFilter = react.forwardRef(() =>
    react.createElement('div', { 'data-testid': 'toolbar-filter' }),
  );
  MockToolbarFilter.displayName = 'MockToolbarFilter';
  return {
    __esModule: true,
    default: MockToolbarFilter,
  };
});

const mockUseWorkspaceKinds = useWorkspaceKinds as jest.MockedFunction<typeof useWorkspaceKinds>;

describe('WorkspaceTable', () => {
  const refreshWorkspaces = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseWorkspaceKinds.mockReturnValue([[buildMockWorkspaceKind()], true, undefined, jest.fn()]);
  });

  it('shows Unknown for empty or missing workspace state', () => {
    const workspaces = [
      buildMockWorkspace({
        name: 'empty-state-workspace',
        state: '' as V1Beta1WorkspaceState,
      }),
      buildMockWorkspace({
        name: 'missing-state-workspace',
        state: undefined as unknown as V1Beta1WorkspaceState,
      }),
    ];

    render(
      <WorkspaceTable
        workspaces={workspaces}
        refreshWorkspaces={refreshWorkspaces}
        canExpandRows={false}
        canCreateWorkspaces={false}
        hiddenColumns={[
          'name',
          'image',
          'podConfig',
          'kind',
          'namespace',
          'gpu',
          'idleGpu',
          'lastActivity',
        ]}
      />,
    );

    const stateLabels = screen.getAllByTestId('state-label');
    expect(stateLabels).toHaveLength(2);
    stateLabels.forEach((stateLabel) => {
      expect(stateLabel).toHaveTextContent('Unknown');
      expect(stateLabel).not.toBeEmptyDOMElement();
    });
  });
});
