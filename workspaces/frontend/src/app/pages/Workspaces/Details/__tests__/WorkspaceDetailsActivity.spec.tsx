import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { format } from 'date-fns/format';
import { WorkspaceDetailsActivity } from '~/app/pages/Workspaces/Details/WorkspaceDetailsActivity';
import { buildMockWorkspace } from '~/shared/mock/mockBuilder';

const DATE_FORMAT = 'PPpp';

describe('WorkspaceDetailsActivity', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('hides pauses after and paused since when not applicable (timestamps are 0)', () => {
    const mockWorkspace = buildMockWorkspace({
      name: 'test-workspace',
      pausedTime: 0,
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

  it('renders formatted date when eligibleAfter and pausedTime are valid timestamps', () => {
    const testTimestamp = 1791662049404;
    const expectedDate = format(new Date(testTimestamp), DATE_FORMAT);

    const mockWorkspace = buildMockWorkspace({
      name: 'test-workspace',
      pausedTime: testTimestamp,
      activity: {
        lastActivity: testTimestamp,
        lastUpdate: testTimestamp,
        rules: {
          pauseWorkspace: {
            eligibleAfter: testTimestamp,
          },
        },
      },
    });

    render(<WorkspaceDetailsActivity workspace={mockWorkspace} />);

    expect(screen.getByTestId('pausesIn')).toHaveTextContent(expectedDate);
    expect(screen.getByTestId('pauseTime')).toHaveTextContent(expectedDate);
  });
});
