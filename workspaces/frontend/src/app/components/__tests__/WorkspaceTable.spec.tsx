import React from 'react';
import { render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import WorkspaceTable from '~/app/components/WorkspaceTable';
import useWorkspaceKinds from '~/app/hooks/useWorkspaceKinds';
import { V1Beta1WorkspaceState } from '~/generated/data-contracts';
import { buildMockWorkspace, buildMockWorkspaceKind } from '~/shared/mock/mockBuilder';

jest.mock('@patternfly/react-core/dist/esm/components/Tooltip', () => {
  const react = jest.requireActual<typeof import('react')>('react');
  return {
    Tooltip: ({
      children,
      content,
      maxWidth,
      isContentLeftAligned,
    }: {
      children: React.ReactNode;
      content: React.ReactNode;
      maxWidth?: string;
      isContentLeftAligned?: boolean;
    }) =>
      react.createElement(
        'span',
        {
          'data-testid': 'mock-tooltip',
          'data-max-width': maxWidth,
          'data-left-aligned': String(Boolean(isContentLeftAligned)),
        },
        children,
        react.createElement('span', { 'data-testid': 'mock-tooltip-content' }, content),
      ),
  };
});

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

  it('shows image and pod config descriptions in tooltips with a reasonable max width', () => {
    const workspace = buildMockWorkspace({
      podTemplate: {
        ...buildMockWorkspace().podTemplate,
        options: {
          imageConfig: {
            current: {
              id: 'custom-image',
              displayName: 'Custom image',
              description: 'Long image description that should wrap in a constrained tooltip.',
              labels: [],
            },
          },
          podConfig: {
            current: {
              id: 'custom-pod',
              displayName: 'Custom pod config',
              description:
                'Long pod config description that should also wrap in a constrained tooltip.',
              labels: [],
            },
          },
        },
      },
    });

    render(
      <WorkspaceTable
        workspaces={[workspace]}
        refreshWorkspaces={refreshWorkspaces}
        canExpandRows={false}
        canCreateWorkspaces={false}
        hiddenColumns={['name', 'kind', 'namespace', 'state', 'gpu', 'idleGpu', 'lastActivity']}
      />,
    );

    const imageName = screen.getByTestId('workspace-image-name');
    const podConfigName = screen.getByTestId('workspace-pod-config-name');

    expect(imageName).toHaveTextContent('Custom image');
    expect(podConfigName).toHaveTextContent('Custom pod config');

    const imageTooltip = imageName.closest('[data-testid="mock-tooltip"]');
    const podConfigTooltip = podConfigName.closest('[data-testid="mock-tooltip"]');

    expect(imageTooltip).toHaveAttribute('data-max-width', '24rem');
    expect(podConfigTooltip).toHaveAttribute('data-max-width', '24rem');
    expect(imageTooltip).toHaveAttribute('data-left-aligned', 'true');
    expect(podConfigTooltip).toHaveAttribute('data-left-aligned', 'true');

    expect(
      within(imageTooltip as HTMLElement).getByTestId('mock-tooltip-content'),
    ).toHaveTextContent('Long image description that should wrap in a constrained tooltip.');
    expect(
      within(podConfigTooltip as HTMLElement).getByTestId('mock-tooltip-content'),
    ).toHaveTextContent(
      'Long pod config description that should also wrap in a constrained tooltip.',
    );
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
