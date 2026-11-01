import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  WorkspaceKindFormImageRedirect,
  RedirectTargetOption,
} from '~/app/pages/WorkspaceKinds/Form/image/WorkspaceKindFormImageRedirect';
import { OptionsOptionRedirect, OptionsRedirectMessageLevel } from '~/generated/data-contracts';

describe('WorkspaceKindFormImageRedirect', () => {
  const defaultTargets: RedirectTargetOption[] = [
    { id: 'jupyter-minimal', displayName: 'Jupyter Minimal' },
    { id: 'jupyter-scipy', displayName: 'Jupyter SciPy' },
    { id: 'codeserver' }, // no separate displayName
  ];

  const defaultRedirect: OptionsOptionRedirect = {
    to: 'jupyter-scipy',
    message: {
      level: OptionsRedirectMessageLevel.RedirectMessageLevelInfo,
      text: 'Redirecting to Jupyter SciPy',
    },
  };

  it('renders a dropdown for redirect targets instead of a text input', () => {
    const setRedirect = jest.fn();
    render(
      <WorkspaceKindFormImageRedirect
        redirect={defaultRedirect}
        setRedirect={setRedirect}
        eligibleTargets={defaultTargets}
      />,
    );

    const select = screen.getByTestId('redirect-to-select');
    expect(select).toBeInTheDocument();
    expect(select.tagName.toLowerCase()).toBe('select');
    expect(screen.queryByRole('textbox', { name: /redirect to/i })).not.toBeInTheDocument();
  });

  it('populates eligible targets with formatted display names and ids', () => {
    const setRedirect = jest.fn();
    render(
      <WorkspaceKindFormImageRedirect
        redirect={defaultRedirect}
        setRedirect={setRedirect}
        eligibleTargets={defaultTargets}
      />,
    );

    expect(
      screen.getByRole('option', { name: 'Jupyter Minimal (jupyter-minimal)' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: 'Jupyter SciPy (jupyter-scipy)' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'codeserver' })).toBeInTheDocument();
  });

  it('calls setRedirect with selected target when changed', () => {
    const setRedirect = jest.fn();
    render(
      <WorkspaceKindFormImageRedirect
        redirect={defaultRedirect}
        setRedirect={setRedirect}
        eligibleTargets={defaultTargets}
      />,
    );

    const select = screen.getByTestId('redirect-to-select');
    fireEvent.change(select, { target: { value: 'jupyter-minimal' } });

    expect(setRedirect).toHaveBeenCalledWith({
      ...defaultRedirect,
      to: 'jupyter-minimal',
    });
  });

  it('calls setRedirect with empty string when clearing redirect target', () => {
    const setRedirect = jest.fn();
    render(
      <WorkspaceKindFormImageRedirect
        redirect={defaultRedirect}
        setRedirect={setRedirect}
        eligibleTargets={defaultTargets}
      />,
    );

    const select = screen.getByTestId('redirect-to-select');
    fireEvent.change(select, { target: { value: '' } });

    expect(setRedirect).toHaveBeenCalledWith({
      ...defaultRedirect,
      to: '',
    });
  });

  it('identifies missing target references and displays an error message', () => {
    const setRedirect = jest.fn();
    const missingRedirect: OptionsOptionRedirect = {
      to: 'old-deleted-target',
      message: {
        level: OptionsRedirectMessageLevel.RedirectMessageLevelWarning,
        text: 'Target removed',
      },
    };

    render(
      <WorkspaceKindFormImageRedirect
        redirect={missingRedirect}
        setRedirect={setRedirect}
        eligibleTargets={defaultTargets}
      />,
    );

    expect(
      screen.getByRole('option', { name: /old-deleted-target \(Target missing or deleted\)/i }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('redirect-missing-target-error')).toHaveTextContent(
      'Target configuration "old-deleted-target" does not exist',
    );
  });

  it('handles empty list of eligible targets with disabled dropdown and helper text', () => {
    const setRedirect = jest.fn();
    render(
      <WorkspaceKindFormImageRedirect
        redirect={{ to: '' }}
        setRedirect={setRedirect}
        eligibleTargets={[]}
        configurationType="image"
        isExpanded
      />,
    );

    const select = screen.getByTestId('redirect-to-select');
    expect(select).toBeDisabled();
    expect(
      screen.getByRole('option', { name: 'No eligible image redirect targets available' }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('redirect-no-targets-helper')).toHaveTextContent(
      'At least one other image configuration must exist',
    );
  });

  it('preserves message text when updating message level', () => {
    const setRedirect = jest.fn();
    render(
      <WorkspaceKindFormImageRedirect
        redirect={defaultRedirect}
        setRedirect={setRedirect}
        eligibleTargets={defaultTargets}
      />,
    );

    const levelSelect = screen.getByTestId('redirect-msg-level-select');
    fireEvent.change(levelSelect, {
      target: { value: OptionsRedirectMessageLevel.RedirectMessageLevelDanger },
    });

    expect(setRedirect).toHaveBeenCalledWith({
      ...defaultRedirect,
      message: {
        level: OptionsRedirectMessageLevel.RedirectMessageLevelDanger,
        text: 'Redirecting to Jupyter SciPy',
      },
    });
  });

  it('preserves message level when updating message text', () => {
    const setRedirect = jest.fn();
    render(
      <WorkspaceKindFormImageRedirect
        redirect={defaultRedirect}
        setRedirect={setRedirect}
        eligibleTargets={defaultTargets}
      />,
    );

    const textInput = screen.getByTestId('redirect-message-text-input');
    fireEvent.change(textInput, { target: { value: 'Updated notice' } });

    expect(setRedirect).toHaveBeenCalledWith({
      ...defaultRedirect,
      message: {
        level: OptionsRedirectMessageLevel.RedirectMessageLevelInfo,
        text: 'Updated notice',
      },
    });
  });
});
