import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { format } from 'date-fns/format';
import { WorkspaceDetailsActivity } from '~/app/pages/Workspaces/Details/WorkspaceDetailsActivity';
import { buildMockWorkspace } from '~/shared/mock/mockBuilder';

const DATE_FORMAT = 'PPpp';
const TEST_TIMESTAMP = 1791662049404;

describe('WorkspaceDetailsActivity', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('hides pauses after and paused since when automatic pausing is not eligible', () => {
    const mockWorkspace = buildMockWorkspace({
      name: 'test-workspace',
      pausedTime: TEST_TIMESTAMP,
      activity: {
        lastActivity: 0,
        lastUpdate: 0,
        rules: {
          pauseWorkspace: {
            eligibleAfter: 0,
          },
        },
      },
    });

    render(<WorkspaceDetailsActivity workspace={mockWorkspace} />);

    expect(screen.queryByTestId('pausesIn')).not.toBeInTheDocument();
    expect(screen.queryByTestId('pauseTime')).not.toBeInTheDocument();
    expect(screen.getByTestId('lastActivity')).toHaveTextContent('unknown');
    expect(screen.getByTestId('lastUpdate')).toHaveTextContent('unknown');
  });

  it('renders formatted dates when eligibleAfter and pausedTime are valid timestamps', () => {
    const expectedDate = format(new Date(TEST_TIMESTAMP), DATE_FORMAT);

    const mockWorkspace = buildMockWorkspace({
      name: 'test-workspace',
      pausedTime: TEST_TIMESTAMP,
      activity: {
        lastActivity: TEST_TIMESTAMP,
        lastUpdate: TEST_TIMESTAMP,
        rules: {
          pauseWorkspace: {
            eligibleAfter: TEST_TIMESTAMP,
          },
        },
      },
    });

    render(<WorkspaceDetailsActivity workspace={mockWorkspace} />);

    expect(screen.getByTestId('pausesIn')).toHaveTextContent(expectedDate);
    expect(screen.getByTestId('pauseTime')).toHaveTextContent(expectedDate);
  });

  it('renders "Not paused" when the workspace is eligible but not currently paused', () => {
    const expectedDate = format(new Date(TEST_TIMESTAMP), DATE_FORMAT);

    const mockWorkspace = buildMockWorkspace({
      name: 'test-workspace',
      pausedTime: 0,
      activity: {
        lastActivity: TEST_TIMESTAMP,
        lastUpdate: TEST_TIMESTAMP,
        rules: {
          pauseWorkspace: {
            eligibleAfter: TEST_TIMESTAMP,
          },
        },
      },
    });

    render(<WorkspaceDetailsActivity workspace={mockWorkspace} />);

    expect(screen.getByTestId('pausesIn')).toHaveTextContent(expectedDate);
    expect(screen.getByTestId('pauseTime')).toHaveTextContent('Not paused');
  });
});
