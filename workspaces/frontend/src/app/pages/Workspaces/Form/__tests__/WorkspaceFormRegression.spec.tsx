import React from 'react';
import { render, screen, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { WorkspaceForm } from '~/app/pages/Workspaces/Form/WorkspaceForm';
import { useWorkspaceFormLocationData } from '~/app/hooks/useWorkspaceFormLocationData';
import useWorkspaceKinds from '~/app/hooks/useWorkspaceKinds';
import useWorkspaceFormData from '~/app/hooks/useWorkspaceFormData';
import usePodTemplateOptionsListValues from '~/app/hooks/usePodTemplateOptionsListValues';
import { buildMockWorkspaceKind } from '~/shared/mock/mockBuilder';
import type { CommonRestrictions } from '~/generated/data-contracts';

jest.mock('mod-arch-core', () => ({
  ...jest.requireActual('mod-arch-core'),
  useNotification: () => ({ success: jest.fn(), error: jest.fn() }),
}));

jest.mock('~/app/routerHelper', () => ({
  useTypedNavigate: () => jest.fn(),
}));

jest.mock('~/app/hooks/useNotebookAPI', () => ({
  useNotebookAPI: () => ({ api: {}, apiAvailable: true }),
}));

jest.mock('~/app/hooks/useWorkspaceFormLocationData');
jest.mock('~/app/hooks/useWorkspaceKinds');
jest.mock('~/app/hooks/useWorkspaceFormData');
jest.mock('~/app/hooks/usePodTemplateOptionsListValues');

jest.mock('~/app/pages/Workspaces/Form/kind/WorkspaceFormKindSelection', () => ({
  WorkspaceFormKindSelection: () => <div data-testid="kind-step">KindSelection</div>,
}));
jest.mock('~/app/pages/Workspaces/Form/image/WorkspaceFormImageSelection', () => ({
  WorkspaceFormImageSelection: () => <div data-testid="image-step">ImageSelection</div>,
}));
jest.mock('~/app/pages/Workspaces/Form/podConfig/WorkspaceFormPodConfigSelection', () => ({
  WorkspaceFormPodConfigSelection: ({
    selectedPodConfig,
  }: {
    selectedPodConfig?: { id: string };
  }) => (
    <div data-testid="pod-config-step" data-selected-pod={selectedPodConfig?.id ?? 'none'}>
      PodConfigSelection
    </div>
  ),
}));
jest.mock('~/app/pages/Workspaces/Form/properties/WorkspaceFormPropertiesSelection', () => ({
  WorkspaceFormPropertiesSelection: () => (
    <div data-testid="properties-step">PropertiesSelection</div>
  ),
}));
jest.mock('~/app/pages/Workspaces/Form/WorkspaceFormSummaryPanel', () => ({
  WorkspaceFormSummaryPanel: () => <div data-testid="summary-step">SummaryPanel</div>,
}));

describe('WorkspaceForm - PodConfig validity regression tests', () => {
  const mockKind = buildMockWorkspaceKind({ name: 'jupyterlab' });
  const mockInitialData = {
    kind: mockKind,
    imageConfig: 'image-1',
    podConfig: 'pod-1',
    properties: {
      workspaceName: 'test-workspace',
      homeVolume: {
        pvcName: 'test-pvc',
        mountPath: '/home/jovyan',
        readOnly: false,
      },
      volumes: [],
      secrets: [],
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useWorkspaceFormLocationData as jest.Mock).mockReturnValue({
      mode: 'edit',
      namespace: 'default',
      workspaceName: 'test-workspace',
      workspaceKindName: 'jupyterlab',
    });
    (useWorkspaceKinds as jest.Mock).mockReturnValue([[mockKind], true, null]);
    (useWorkspaceFormData as jest.Mock).mockReturnValue([mockInitialData, true, null]);
  });

  it('clears selected podConfig when it becomes hidden in filteredValuesData', async () => {
    let filteredPodConfigValues: Array<{
      id: string;
      displayName: string;
      hidden: boolean;
      restrictions: CommonRestrictions;
    }> = [{ id: 'pod-1', displayName: 'Pod 1', hidden: false, restrictions: { deny: false } }];

    (usePodTemplateOptionsListValues as jest.Mock).mockImplementation(
      ({ imageId }: { imageId?: string }) => {
        if (!imageId) {
          return [
            {
              imageConfig: { default: 'image-1', values: [] },
              podConfig: { default: 'pod-1', values: filteredPodConfigValues },
            },
            true,
            null,
          ];
        }
        return [
          {
            imageConfig: { default: 'image-1', values: [] },
            podConfig: { default: 'pod-1', values: filteredPodConfigValues },
          },
          true,
          null,
        ];
      },
    );

    const { rerender } = render(<WorkspaceForm />);

    // Advance to Pod Config step
    act(() => {
      screen.getByTestId('next-button').click(); // to image step
    });
    act(() => {
      screen.getByTestId('next-button').click(); // to pod config step
    });

    expect(screen.getByTestId('pod-config-step')).toHaveAttribute('data-selected-pod', 'pod-1');
    expect(screen.getByTestId('next-button')).toBeEnabled();

    // Simulate filteredValuesData reload where pod-1 becomes hidden
    filteredPodConfigValues = [
      { id: 'pod-1', displayName: 'Pod 1', hidden: true, restrictions: { deny: false } },
    ];

    act(() => {
      rerender(<WorkspaceForm />);
    });

    // podConfig should be cleared because it became hidden
    expect(screen.getByTestId('pod-config-step')).toHaveAttribute('data-selected-pod', 'none');
    expect(screen.getByTestId('next-button')).toBeDisabled();
  });

  it('retains selected podConfig when it is denied but not hidden (denied-but-present left alone)', async () => {
    let filteredPodConfigValues: Array<{
      id: string;
      displayName: string;
      hidden: boolean;
      restrictions: CommonRestrictions;
    }> = [{ id: 'pod-1', displayName: 'Pod 1', hidden: false, restrictions: { deny: false } }];

    (usePodTemplateOptionsListValues as jest.Mock).mockImplementation(() => [
      {
        imageConfig: { default: 'image-1', values: [] },
        podConfig: { default: 'pod-1', values: filteredPodConfigValues },
      },
      true,
      null,
    ]);

    const { rerender } = render(<WorkspaceForm />);

    act(() => {
      screen.getByTestId('next-button').click();
    });
    act(() => {
      screen.getByTestId('next-button').click();
    });

    expect(screen.getByTestId('pod-config-step')).toHaveAttribute('data-selected-pod', 'pod-1');

    // Simulate reload where pod-1 becomes denied but hidden is false
    filteredPodConfigValues = [
      {
        id: 'pod-1',
        displayName: 'Pod 1',
        hidden: false,
        restrictions: { deny: true, denyMessage: { text: 'Restricted' } },
      },
    ];

    act(() => {
      rerender(<WorkspaceForm />);
    });

    // podConfig should remain selected (denied-but-present is left alone on purpose)
    expect(screen.getByTestId('pod-config-step')).toHaveAttribute('data-selected-pod', 'pod-1');
  });
});
