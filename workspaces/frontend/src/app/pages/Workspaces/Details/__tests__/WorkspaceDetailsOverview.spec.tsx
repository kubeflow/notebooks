import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { WorkspaceDetailsOverview } from '~/app/pages/Workspaces/Details/WorkspaceDetailsOverview';
import { buildMockWorkspace, buildMockWorkspaceDetails } from '~/shared/mock/mockBuilder';

describe('WorkspaceDetailsOverview', () => {
  const mockWorkspace = buildMockWorkspace({ name: 'test-workspace', namespace: 'test-ns' });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders general workspace overview details', () => {
    const mockDetails = buildMockWorkspaceDetails({
      podMetadata: {
        labels: { env: 'production' },
        annotations: {},
      },
    });

    render(
      <WorkspaceDetailsOverview workspace={mockWorkspace} details={mockDetails} detailsLoaded />,
    );

    expect(screen.getByText('test-workspace')).toBeInTheDocument();
    expect(screen.getByText('env=production')).toBeInTheDocument();
  });

  it('renders pod name and node when pod info is present', () => {
    const mockDetails = buildMockWorkspaceDetails({
      pod: { name: 'workspace-abc-0', nodeName: 'node-gpu-01' },
    });

    render(
      <WorkspaceDetailsOverview workspace={mockWorkspace} details={mockDetails} detailsLoaded />,
    );

    expect(screen.getByTestId('pod-name')).toHaveTextContent('workspace-abc-0');
    expect(screen.getByTestId('pod-node-name')).toHaveTextContent('node-gpu-01');
  });

  it('hides pod information section when pod is null', () => {
    const mockDetails = buildMockWorkspaceDetails({ pod: undefined });

    render(
      <WorkspaceDetailsOverview workspace={mockWorkspace} details={mockDetails} detailsLoaded />,
    );

    expect(screen.queryByTestId('pod-name')).not.toBeInTheDocument();
    expect(screen.queryByTestId('pod-node-name')).not.toBeInTheDocument();
  });

  it('hides the node row when nodeName is empty but still shows pod name', () => {
    const mockDetails = buildMockWorkspaceDetails({
      pod: { name: 'workspace-abc-0', nodeName: '' },
    });

    render(
      <WorkspaceDetailsOverview workspace={mockWorkspace} details={mockDetails} detailsLoaded />,
    );

    expect(screen.getByTestId('pod-name')).toHaveTextContent('workspace-abc-0');
    expect(screen.queryByTestId('pod-node-name')).not.toBeInTheDocument();
  });
});
