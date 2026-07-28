import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import useWorkspacePodTemplateDetails from '~/app/hooks/useWorkspacePodTemplateDetails';
import { WorkspaceDetailsOverview } from '~/app/pages/Workspaces/Details/WorkspaceDetailsOverview';
import { buildMockWorkspace } from '~/shared/mock/mockBuilder';

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
    mockUseWorkspacePodTemplateDetails.mockReturnValue([
      {
        podMetadata: { labels: {}, annotations: {} },
        volumes: {},
        pod: { name: 'workspace-abc-0', nodeName: 'node-gpu-01' },
      },
      true,
      undefined,
    ]);

    render(<WorkspaceDetailsOverview workspace={mockWorkspace} />);

    expect(screen.getByTestId('pod-info-section')).toBeInTheDocument();
    expect(screen.getByTestId('pod-name')).toBeInTheDocument();
    expect(screen.getByTestId('node-name')).toBeInTheDocument();
  });

  it('hides Pod Information when pod is null (e.g., paused or pending)', () => {
    mockUseWorkspacePodTemplateDetails.mockReturnValue([
      { podMetadata: { labels: {}, annotations: {} }, volumes: {}, pod: null },
      true,
      undefined,
    ]);

    render(<WorkspaceDetailsOverview workspace={mockWorkspace} />);

    expect(screen.queryByTestId('pod-info-section')).not.toBeInTheDocument();
    expect(screen.queryByTestId('pod-name')).not.toBeInTheDocument();
    expect(screen.queryByTestId('node-name')).not.toBeInTheDocument();
  });
});
