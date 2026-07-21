import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import WorkspaceTable from '~/app/components/WorkspaceTable';
import { V1Beta1WorkspaceState } from '~/generated/data-contracts';
import { buildMockWorkspace } from '~/shared/mock/mockBuilder';

jest.mock('~/app/hooks/useWorkspaceKinds', () => ({
  __esModule: true,
  default: () => [[]],
}));

jest.mock('~/app/routerHelper', () => ({
  useTypedNavigate: () => ({ navigate: jest.fn() }),
}));

jest.mock('~/app/components/WorkspaceKindImage', () => ({
  __esModule: true,
  default: ({ children }: { children: (src: string) => React.ReactNode }) => <>{children('')}</>,
}));

jest.mock('~/app/components/RedirectIconWithPopover', () => ({
  RedirectIconWithPopover: () => null,
}));

jest.mock('~/app/pages/Workspaces/WorkspaceConnectAction', () => ({
  WorkspaceConnectAction: () => null,
}));

describe('WorkspaceTable state column', () => {
  it('renders "Unknown" when workspace.state is empty', () => {
    const workspace = buildMockWorkspace({
      state: '' as V1Beta1WorkspaceState,
      stateMessage: '',
    });

    render(
      <WorkspaceTable
        workspaces={[workspace]}
        refreshWorkspaces={jest.fn()}
        rowActions={() => []}
      />,
    );

    const stateCell = screen.getByTestId('state-label');
    expect(stateCell).toHaveTextContent('Unknown');
  });

  it('shows the real state in the tooltip when stateMessage is empty but state is set', () => {
    const workspace = buildMockWorkspace({
      state: V1Beta1WorkspaceState.WorkspaceStateRunning,
      stateMessage: '',
    });

    render(
      <WorkspaceTable
        workspaces={[workspace]}
        refreshWorkspaces={jest.fn()}
        rowActions={() => []}
      />,
    );

    const stateCell = screen.getByTestId('state-label');
    expect(stateCell).toHaveTextContent('Running');
  });
});
