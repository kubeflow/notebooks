import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { TolerationModal } from '~/app/pages/WorkspaceKinds/Form/podConfig/TolerationModal';
import { TolerationEffect, TolerationEntry, TolerationOperator } from '~/app/types';

jest.mock('mod-arch-kubeflow', () => ({
  useThemeContext: () => ({ isMUITheme: false }),
}));

const baseToleration: TolerationEntry = {
  id: 'test-id-1',
  operator: TolerationOperator.Equal,
  effect: TolerationEffect.NoSchedule,
  key: 'gpu',
  value: 'true',
  tolerationSeconds: null,
};

describe('TolerationModal', () => {
  const onClose = jest.fn();
  const onSubmit = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders in add mode with empty fields', () => {
    render(
      <TolerationModal isOpen onClose={onClose} onSubmit={onSubmit} existingToleration={null} />,
    );
    expect(screen.getByText('Add Toleration')).toBeInTheDocument();
    expect(screen.getByTestId('toleration-modal-submit-button')).toHaveTextContent('Add');
  });

  it('renders in edit mode with pre-filled fields', () => {
    render(
      <TolerationModal
        isOpen
        onClose={onClose}
        onSubmit={onSubmit}
        existingToleration={baseToleration}
      />,
    );
    expect(screen.getByText('Edit Toleration')).toBeInTheDocument();
    expect(screen.getByTestId('toleration-modal-submit-button')).toHaveTextContent('Save');
    expect(screen.getByTestId('toleration-key-input')).toHaveValue('gpu');
    expect(screen.getByTestId('toleration-value-input')).toHaveValue('true');
  });

  it('disables submit when key is empty', () => {
    render(
      <TolerationModal isOpen onClose={onClose} onSubmit={onSubmit} existingToleration={null} />,
    );
    expect(screen.getByTestId('toleration-modal-submit-button')).toBeDisabled();
  });

  it('enables submit when key is provided', async () => {
    const user = userEvent.setup();
    render(
      <TolerationModal isOpen onClose={onClose} onSubmit={onSubmit} existingToleration={null} />,
    );
    await user.type(screen.getByTestId('toleration-key-input'), 'my-key');
    expect(screen.getByTestId('toleration-modal-submit-button')).toBeEnabled();
  });

  it('disables value field when operator is Exists', async () => {
    const existsToleration: TolerationEntry = {
      ...baseToleration,
      operator: TolerationOperator.Exists,
    };
    render(
      <TolerationModal
        isOpen
        onClose={onClose}
        onSubmit={onSubmit}
        existingToleration={existsToleration}
      />,
    );
    expect(screen.getByTestId('toleration-value-input')).toBeDisabled();
  });

  it('clears value when submitting with Exists operator', async () => {
    const user = userEvent.setup();
    const existsToleration: TolerationEntry = {
      ...baseToleration,
      operator: TolerationOperator.Exists,
      value: 'should-be-cleared',
    };
    render(
      <TolerationModal
        isOpen
        onClose={onClose}
        onSubmit={onSubmit}
        existingToleration={existsToleration}
      />,
    );
    await user.click(screen.getByTestId('toleration-modal-submit-button'));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        operator: TolerationOperator.Exists,
        value: '',
      }),
    );
  });

  it('shows toleration seconds only when effect is NoExecute', () => {
    render(
      <TolerationModal
        isOpen
        onClose={onClose}
        onSubmit={onSubmit}
        existingToleration={{
          ...baseToleration,
          effect: TolerationEffect.NoExecute,
          tolerationSeconds: 300,
        }}
      />,
    );
    expect(screen.getByTestId('toleration-seconds-forever')).toBeInTheDocument();
    expect(screen.getByTestId('toleration-seconds-custom')).toBeInTheDocument();
  });

  it('disables toleration seconds when effect is not NoExecute', () => {
    render(
      <TolerationModal
        isOpen
        onClose={onClose}
        onSubmit={onSubmit}
        existingToleration={baseToleration}
      />,
    );
    expect(screen.getByTestId('toleration-seconds-forever')).toBeDisabled();
    expect(screen.getByTestId('toleration-seconds-custom')).toBeDisabled();
  });

  it('submits with tolerationSeconds=null when effect is NoExecute and forever is selected', async () => {
    const user = userEvent.setup();
    render(
      <TolerationModal
        isOpen
        onClose={onClose}
        onSubmit={onSubmit}
        existingToleration={{
          ...baseToleration,
          effect: TolerationEffect.NoExecute,
          tolerationSeconds: null,
        }}
      />,
    );
    await user.click(screen.getByTestId('toleration-modal-submit-button'));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        tolerationSeconds: null,
      }),
    );
  });

  it('calls onClose when cancel is clicked', async () => {
    const user = userEvent.setup();
    render(
      <TolerationModal isOpen onClose={onClose} onSubmit={onSubmit} existingToleration={null} />,
    );
    await user.click(screen.getByTestId('toleration-modal-cancel-button'));
    expect(onClose).toHaveBeenCalled();
  });

  it('preserves existing id when editing', async () => {
    const user = userEvent.setup();
    render(
      <TolerationModal
        isOpen
        onClose={onClose}
        onSubmit={onSubmit}
        existingToleration={baseToleration}
      />,
    );
    await user.click(screen.getByTestId('toleration-modal-submit-button'));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'test-id-1',
      }),
    );
  });

  it('does not render when isOpen is false', () => {
    render(
      <TolerationModal
        isOpen={false}
        onClose={onClose}
        onSubmit={onSubmit}
        existingToleration={null}
      />,
    );
    expect(screen.queryByText('Add Toleration')).not.toBeInTheDocument();
  });
});
