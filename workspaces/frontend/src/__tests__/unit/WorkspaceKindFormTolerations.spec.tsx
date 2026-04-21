import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { WorkspaceKindFormTolerations } from '~/app/pages/WorkspaceKinds/Form/podConfig/WorkspaceKindFormTolerations';
import { TolerationEffect, TolerationEntry, TolerationOperator } from '~/app/types';

jest.mock('mod-arch-kubeflow', () => ({
  useThemeContext: () => ({ isMUITheme: false }),
}));

const makeToleration = (overrides: Partial<TolerationEntry> = {}): TolerationEntry => ({
  id: 'tol-1',
  operator: TolerationOperator.Equal,
  effect: TolerationEffect.NoSchedule,
  key: 'gpu',
  value: 'true',
  tolerationSeconds: null,
  ...overrides,
});

describe('WorkspaceKindFormTolerations', () => {
  const setTolerations = jest.fn();
  const setIsTolerationModalOpen = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders nothing when tolerations list is empty', () => {
    const { container } = render(
      <WorkspaceKindFormTolerations
        tolerations={[]}
        setTolerations={setTolerations}
        isTolerationModalOpen={false}
        setIsTolerationModalOpen={setIsTolerationModalOpen}
      />,
    );
    expect(container.querySelector('table')).not.toBeInTheDocument();
  });

  it('renders a table row for each toleration', () => {
    const tolerations = [
      makeToleration({ id: 'tol-1', key: 'gpu' }),
      makeToleration({ id: 'tol-2', key: 'disk', effect: TolerationEffect.NoExecute }),
    ];
    render(
      <WorkspaceKindFormTolerations
        tolerations={tolerations}
        setTolerations={setTolerations}
        isTolerationModalOpen={false}
        setIsTolerationModalOpen={setIsTolerationModalOpen}
      />,
    );
    const rows = screen.getAllByRole('row');
    // 1 header row + 2 data rows
    expect(rows).toHaveLength(3);
  });

  it('displays dash for value when operator is Exists', () => {
    const tolerations = [makeToleration({ operator: TolerationOperator.Exists, value: 'ignored' })];
    render(
      <WorkspaceKindFormTolerations
        tolerations={tolerations}
        setTolerations={setTolerations}
        isTolerationModalOpen={false}
        setIsTolerationModalOpen={setIsTolerationModalOpen}
      />,
    );
    const row = screen.getAllByRole('row')[1];
    expect(within(row).getByText('-')).toBeInTheDocument();
  });

  it('displays Forever when tolerationSeconds is null', () => {
    const tolerations = [makeToleration({ tolerationSeconds: null })];
    render(
      <WorkspaceKindFormTolerations
        tolerations={tolerations}
        setTolerations={setTolerations}
        isTolerationModalOpen={false}
        setIsTolerationModalOpen={setIsTolerationModalOpen}
      />,
    );
    expect(screen.getByText('Forever')).toBeInTheDocument();
  });

  it('displays seconds value when tolerationSeconds is set', () => {
    const tolerations = [makeToleration({ tolerationSeconds: 300 })];
    render(
      <WorkspaceKindFormTolerations
        tolerations={tolerations}
        setTolerations={setTolerations}
        isTolerationModalOpen={false}
        setIsTolerationModalOpen={setIsTolerationModalOpen}
      />,
    );
    expect(screen.getByText('300s')).toBeInTheDocument();
  });

  it('calls setTolerations to remove a toleration when remove button is clicked', async () => {
    const user = userEvent.setup();
    const tolerations = [
      makeToleration({ id: 'tol-1', key: 'gpu' }),
      makeToleration({ id: 'tol-2', key: 'disk' }),
    ];
    render(
      <WorkspaceKindFormTolerations
        tolerations={tolerations}
        setTolerations={setTolerations}
        isTolerationModalOpen={false}
        setIsTolerationModalOpen={setIsTolerationModalOpen}
      />,
    );
    await user.click(screen.getByTestId('toleration-remove-0'));
    expect(setTolerations).toHaveBeenCalledWith(expect.any(Function));
    const updater = setTolerations.mock.calls[0][0];
    const result = updater(tolerations);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('tol-2');
  });

  it('opens modal in edit mode when edit button is clicked', async () => {
    const user = userEvent.setup();
    const tolerations = [makeToleration()];
    render(
      <WorkspaceKindFormTolerations
        tolerations={tolerations}
        setTolerations={setTolerations}
        isTolerationModalOpen={false}
        setIsTolerationModalOpen={setIsTolerationModalOpen}
      />,
    );
    await user.click(screen.getByTestId('toleration-edit-0'));
    expect(setIsTolerationModalOpen).toHaveBeenCalledWith(true);
  });
});
