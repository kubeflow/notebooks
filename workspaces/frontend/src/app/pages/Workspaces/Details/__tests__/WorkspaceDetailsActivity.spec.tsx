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

  it('renders not eligible for pauses after when eligibleAfter is 0', () => {
    const mockWorkspace = buildMockWorkspace({
      name: 'test-workspace',
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

    expect(screen.getByTestId('pausesIn')).toHaveTextContent('not eligible');
    expect(screen.getByTestId('lastActivity')).toHaveTextContent('unknown');
    expect(screen.getByTestId('lastUpdate')).toHaveTextContent('unknown');
  });

  it('renders formatted date when eligibleAfter is a valid timestamp', () => {
    const testTimestamp = 1791662049404;
    const expectedDate = format(new Date(testTimestamp), DATE_FORMAT);

    const mockWorkspace = buildMockWorkspace({
      name: 'test-workspace',
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
  });
});