import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { WorkspaceKindFormActivityRules } from '~/app/pages/WorkspaceKinds/Form/activityRules/WorkspaceKindFormActivityRules';
import { ActivityRuleEntry } from '~/app/types';

jest.mock('mod-arch-kubeflow', () => ({
  useThemeContext: () => ({ isMUITheme: false }),
}));

const makeRule = (overrides: Partial<ActivityRuleEntry> = {}): ActivityRuleEntry => ({
  id: 'rule-1',
  config: { secondsSinceActive: 3600 },
  effect: { pauseWorkspace: true },
  ...overrides,
});

describe('WorkspaceKindFormActivityRules', () => {
  const updateActivityRules = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders no table when activity rules list is empty', () => {
    render(
      <WorkspaceKindFormActivityRules
        activityRules={[]}
        updateActivityRules={updateActivityRules}
      />,
    );
    expect(screen.queryByTestId('activity-rules-table')).not.toBeInTheDocument();
  });

  it('renders the add button when list is empty', () => {
    render(
      <WorkspaceKindFormActivityRules
        activityRules={[]}
        updateActivityRules={updateActivityRules}
      />,
    );
    expect(screen.getByTestId('add-activity-rule-button')).toBeInTheDocument();
  });

  it('renders a table row for each activity rule', () => {
    const rules = [
      makeRule({ id: 'rule-1', config: { secondsSinceActive: 3600 } }),
      makeRule({ id: 'rule-2', config: { secondsSinceActive: 86400 } }),
    ];
    render(
      <WorkspaceKindFormActivityRules
        activityRules={rules}
        updateActivityRules={updateActivityRules}
      />,
    );
    const rows = screen.getAllByRole('row');
    expect(rows).toHaveLength(3);
  });

  it('displays formatted idle timeout in table cells', () => {
    const rules = [makeRule({ config: { secondsSinceActive: 3600 } })];
    render(
      <WorkspaceKindFormActivityRules
        activityRules={rules}
        updateActivityRules={updateActivityRules}
      />,
    );
    expect(screen.getByTestId('activity-rule-timeout-cell-0')).toHaveTextContent('1 hour');
  });

  it('displays formatted min running time or dash', () => {
    const rules = [
      makeRule({ id: 'rule-1', config: { secondsSinceActive: 3600, minRunningSeconds: 300 } }),
      makeRule({ id: 'rule-2', config: { secondsSinceActive: 7200 } }),
    ];
    render(
      <WorkspaceKindFormActivityRules
        activityRules={rules}
        updateActivityRules={updateActivityRules}
      />,
    );
    expect(screen.getByTestId('activity-rule-min-running-cell-0')).toHaveTextContent('5 minutes');
    expect(screen.getByTestId('activity-rule-min-running-cell-1')).toHaveTextContent('-');
  });

  it('displays Pause Workspace for pauseWorkspace effect', () => {
    const rules = [makeRule()];
    render(
      <WorkspaceKindFormActivityRules
        activityRules={rules}
        updateActivityRules={updateActivityRules}
      />,
    );
    expect(screen.getByTestId('activity-rule-effect-cell-0')).toHaveTextContent('Pause Workspace');
  });

  it('calls updateActivityRules to remove a rule when remove button is clicked', async () => {
    const user = userEvent.setup();
    const rules = [
      makeRule({ id: 'rule-1' }),
      makeRule({ id: 'rule-2', config: { secondsSinceActive: 7200 } }),
    ];
    render(
      <WorkspaceKindFormActivityRules
        activityRules={rules}
        updateActivityRules={updateActivityRules}
      />,
    );
    await user.click(screen.getByTestId('activity-rule-remove-0'));
    expect(updateActivityRules).toHaveBeenCalledWith([rules[1]]);
  });

  it('opens modal when edit button is clicked', async () => {
    const user = userEvent.setup();
    const rules = [makeRule()];
    render(
      <WorkspaceKindFormActivityRules
        activityRules={rules}
        updateActivityRules={updateActivityRules}
      />,
    );
    await user.click(screen.getByTestId('activity-rule-edit-0'));
    expect(screen.getByTestId('activity-rule-modal')).toBeInTheDocument();
  });

  it('opens modal when add button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <WorkspaceKindFormActivityRules
        activityRules={[]}
        updateActivityRules={updateActivityRules}
      />,
    );
    await user.click(screen.getByTestId('add-activity-rule-button'));
    expect(screen.getByTestId('activity-rule-modal')).toBeInTheDocument();
  });
});
