import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import useWorkspacePodTemplateDetails from '~/app/hooks/useWorkspacePodTemplateDetails';
import { WorkspaceDetailsOverview } from '~/app/pages/Workspaces/Details/WorkspaceDetailsOverview';
import { buildMockWorkspace, buildMockWorkspaceDetails } from '~/shared/mock/mockBuilder';

jest.mock('~/app/hooks/useWorkspacePodTemplateDetails', () => ({
  __esModule: true,
  default: jest.fn(),
}));

const mockUseWorkspacePodTemplateDetails = useWorkspacePodTemplateDetails as jest.Mock;

describe('WorkspaceDetailsOverview', () => {
  const mockWorkspace = buildMockWorkspace({ name: 'test-workspace', namespace: 'test-ns' });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders Pod Information when pod is non-null', () => {
    const mockDetails = buildMockWorkspaceDetails({
      pod: { name: 'workspace-abc-0', nodeName: 'node-gpu-01' },
    });

    mockUseWorkspacePodTemplateDetails.mockReturnValue([mockDetails, true, undefined]);

    render(
      <WorkspaceDetailsOverview
        workspace={mockWorkspace}
        details={mockDetails}
        detailsLoaded // boolean
      />,
    );

    expect(screen.getByTestId('pod-info-title')).toBeInTheDocument();
    expect(screen.getByTestId('pod-name')).toBeInTheDocument();
    expect(screen.getByTestId('pod-node-name')).toBeInTheDocument();
  });

  it('hides Pod Information when pod is null (e.g., paused or pending)', () => {
    const mockDetails = buildMockWorkspaceDetails({ pod: undefined });

    mockUseWorkspacePodTemplateDetails.mockReturnValue([mockDetails, true, undefined]);

    render(
      <WorkspaceDetailsOverview workspace={mockWorkspace} details={mockDetails} detailsLoaded />,
    );

    expect(screen.queryByTestId('pod-info-title')).not.toBeInTheDocument();
    expect(screen.queryByTestId('pod-name')).not.toBeInTheDocument();
    expect(screen.queryByTestId('pod-node-name')).not.toBeInTheDocument();
  });
});
