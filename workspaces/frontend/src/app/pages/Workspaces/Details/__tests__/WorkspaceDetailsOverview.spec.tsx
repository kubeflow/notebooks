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

  it('renders Pod Information when pod is non-null', () => {
    const mockDetails = buildMockWorkspaceDetails({
      pod: {
        name: 'workspace-abc-0',
        nodeName: 'node-gpu-01',
      },
    });

    render(
      <WorkspaceDetailsOverview workspace={mockWorkspace} details={mockDetails} detailsLoaded />,
    );

    expect(screen.getByTestId('pod-info-title')).toBeInTheDocument();
    expect(screen.getByTestId('pod-name')).toHaveTextContent('workspace-abc-0');
    expect(screen.getByTestId('pod-node-name')).toHaveTextContent('node-gpu-01');
  });

  it('hides Pod Information when pod is null (e.g., paused or pending)', () => {
    const mockDetails = buildMockWorkspaceDetails({ pod: undefined });

    render(
      <WorkspaceDetailsOverview workspace={mockWorkspace} details={mockDetails} detailsLoaded />,
    );

    expect(screen.queryByTestId('pod-info-title')).not.toBeInTheDocument();
    expect(screen.queryByTestId('pod-name')).not.toBeInTheDocument();
    expect(screen.queryByTestId('pod-node-name')).not.toBeInTheDocument();
  });
});
