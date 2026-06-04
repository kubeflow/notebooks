import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { WorkspaceFormSummaryPanel } from '~/app/pages/Workspaces/Form/WorkspaceFormSummaryPanel';
import { buildMockWorkspaceKind } from '~/shared/mock/mockBuilder';
import { WorkspaceFormProperties } from '~/app/types';

describe('WorkspaceFormSummaryPanel', () => {
  const defaultProperties: WorkspaceFormProperties = {
    workspaceName: '',
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
});
