import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { WorkspaceFormSummaryPanel } from '~/app/pages/Workspaces/Form/WorkspaceFormSummaryPanel';
import { buildMockWorkspaceKind } from '~/shared/mock/mockBuilder';
import { WorkspaceFormProperties } from '~/app/types';

describe('WorkspaceFormSummaryPanel', () => {
  const defaultProperties: WorkspaceFormProperties = {
    displayName: '',
    name: '',
    homeVolume: undefined,
    volumes: [],
    secrets: [],
  };

  const defaultProps = {
    mode: 'create' as const,
    selectedImage: undefined,
    selectedPodConfig: undefined,
    properties: defaultProperties,
    currentStep: 3,
    onNavigateToStep: jest.fn(),
    onSelectImage: jest.fn(),
    onSelectPodConfig: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not show WorkspaceKind pod labels in the summary panel', () => {
    const selectedKind = buildMockWorkspaceKind({
      podTemplate: {
        ...buildMockWorkspaceKind().podTemplate,
        podMetadata: {
          labels: {
            implementationLabel: 'hidden-from-users',
          },
          annotations: {},
        },
      },
    });

    const selectedImage = selectedKind.podTemplate.options.imageConfig.values![0];
    const selectedPodConfig = selectedKind.podTemplate.options.podConfig.values![0];

    render(
      <WorkspaceFormSummaryPanel
        {...defaultProps}
        selectedKind={selectedKind}
        selectedImage={selectedImage}
        selectedPodConfig={selectedPodConfig}
      />,
    );

    expect(screen.getByText('Workspace Kind')).toBeInTheDocument();
    expect(screen.getByText(selectedKind.displayName)).toBeInTheDocument();
    expect(screen.getByText(selectedKind.description)).toBeInTheDocument();
    expect(screen.queryByText('implementationLabel: hidden-from-users')).not.toBeInTheDocument();
    expect(screen.getByText('pythonVersion: 3.11')).toBeInTheDocument();
    expect(screen.getByText('cpu: 100m')).toBeInTheDocument();
  });

  it('uses option IDs when edit-mode list values no longer resolve the selections', () => {
    const selectedKind = buildMockWorkspaceKind({ name: 'jupyterlab' });

    render(
      <WorkspaceFormSummaryPanel
        {...defaultProps}
        mode="update"
        selectedKind={selectedKind}
        originalKind={selectedKind}
        selectedImage={undefined}
        selectedPodConfig={undefined}
        selectedImageId="legacy-image"
        selectedPodConfigId="legacy-pod-config"
        originalImageId="legacy-image"
        originalPodConfigId="legacy-pod-config"
        originalProperties={defaultProperties}
      />,
    );

    expect(screen.getByText('legacy-image')).toBeInTheDocument();
    expect(screen.getByText('legacy-pod-config')).toBeInTheDocument();

    expect(screen.queryByTestId('summary-diff-current')).not.toBeInTheDocument();
    expect(screen.queryByTestId('summary-diff-new')).not.toBeInTheDocument();
  });

  it('compares edit-mode option IDs when list values cannot resolve the options', () => {
    const selectedKind = buildMockWorkspaceKind({ name: 'jupyterlab' });

    render(
      <WorkspaceFormSummaryPanel
        {...defaultProps}
        mode="update"
        selectedKind={selectedKind}
        originalKind={selectedKind}
        selectedImage={undefined}
        selectedPodConfig={undefined}
        selectedImageId="new-image"
        selectedPodConfigId="new-pod-config"
        originalImageId="old-image"
        originalPodConfigId="old-pod-config"
        originalProperties={defaultProperties}
      />,
    );

    expect(screen.getAllByTestId('summary-diff-current')).toHaveLength(2);
    expect(screen.getAllByTestId('summary-diff-new')).toHaveLength(2);

    expect(screen.getByText('old-image')).toBeInTheDocument();
    expect(screen.getByText('new-image')).toBeInTheDocument();
    expect(screen.getByText('old-pod-config')).toBeInTheDocument();
    expect(screen.getByText('new-pod-config')).toBeInTheDocument();
  });
});
