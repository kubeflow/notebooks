import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { RedirectConfirmationModal } from '~/app/pages/Workspaces/Form/shared/RedirectConfirmationModal';

import { WorkspacesRedirectStep } from '~/generated/data-contracts';

describe('RedirectConfirmationModal', () => {
  const onConfirm = jest.fn();
  const onCancel = jest.fn();
  const redirectChain = [
    {
      source: { displayName: 'Option A' },
      target: { displayName: 'Option B' },
      message: { level: 'info', text: 'Redirected for maintenance' },
    },
  ] as unknown as WorkspacesRedirectStep[];

  it('renders redirect information when not hidden', () => {
    render(
      <RedirectConfirmationModal
        isOpen
        onConfirm={onConfirm}
        onCancel={onCancel}
        redirectChain={redirectChain}
      />,
    );

    expect(screen.getByText('Redirected Option Selected')).toBeInTheDocument();
    expect(screen.getByText('Option A → Option B')).toBeInTheDocument();
    expect(screen.getByText('Redirected for maintenance')).toBeInTheDocument();
    expect(screen.getByText('Info')).toBeInTheDocument();
  });

  it('renders hidden warning when isHidden is true', () => {
    render(
      <RedirectConfirmationModal
        isOpen
        onConfirm={onConfirm}
        onCancel={onCancel}
        redirectChain={[]}
        isHidden
      />,
    );

    expect(screen.getByText('Hidden Option Selected')).toBeInTheDocument();
    expect(screen.getByText(/has been hidden or deprecated/)).toBeInTheDocument();
    expect(screen.queryByText('Option A → Option B')).not.toBeInTheDocument();
  });

  it('calls onConfirm when confirm button is clicked', () => {
    render(
      <RedirectConfirmationModal
        isOpen
        onConfirm={onConfirm}
        onCancel={onCancel}
        redirectChain={[]}
      />,
    );

    fireEvent.click(screen.getByTestId('confirm-button'));
    expect(onConfirm).toHaveBeenCalled();
  });

  it('calls onCancel when cancel button is clicked', () => {
    render(
      <RedirectConfirmationModal
        isOpen
        onConfirm={onConfirm}
        onCancel={onCancel}
        redirectChain={[]}
      />,
    );

    fireEvent.click(screen.getByTestId('cancel-button'));
    expect(onCancel).toHaveBeenCalled();
  });
});
