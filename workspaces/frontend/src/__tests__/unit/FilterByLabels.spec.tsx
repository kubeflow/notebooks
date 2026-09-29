import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { FilterByLabels } from '~/app/pages/Workspaces/Form/labelFilter/FilterByLabels';

describe('FilterByLabels help', () => {
  it('supports keyboard help without changing the filter or submitting the form', async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn((event: React.FormEvent) => event.preventDefault());
    const setLabelledObjects = jest.fn();
    const hiddenObject = { hidden: true };
    render(
      <div onSubmit={onSubmit}>
        <FilterByLabels
          labelledObjects={[hiddenObject]}
          setLabelledObjects={setLabelledObjects}
          extraFilters={[
            {
              key: 'showHidden',
              label: 'Show hidden',
              tooltip: 'Show hidden objects.',
              value: false,
              matchesFilter: (obj, value) => value || !obj.hidden,
            },
          ]}
        />
      </div>,
    );

    await user.tab();
    expect(screen.getByRole('checkbox', { name: 'Show hidden' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'About Show hidden' })).toHaveFocus();
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Show hidden objects.');
    await user.keyboard('{Enter}');
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('checkbox')).not.toBeChecked();
    expect(setLabelledObjects).toHaveBeenLastCalledWith([]);

    await user.tab({ shift: true });
    await user.keyboard(' ');
    expect(screen.getByRole('checkbox')).toBeChecked();
    expect(setLabelledObjects).toHaveBeenLastCalledWith([hiddenObject]);
    await user.tab();
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Show hidden objects.');
  });

  it('does not add a help button for filters without tooltip text', () => {
    render(
      <FilterByLabels
        labelledObjects={[]}
        setLabelledObjects={jest.fn()}
        extraFilters={[{ key: 'all', label: 'Show all', value: false, matchesFilter: () => true }]}
      />,
    );
    expect(screen.getByRole('checkbox', { name: 'Show all' })).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
