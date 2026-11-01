import React, { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { WorkspaceKindFormPodConfigModal } from '~/app/pages/WorkspaceKinds/Form/podConfig/WorkspaceKindFormPodConfigModal';
import { WorkspaceKindPodConfigValue } from '~/app/types';
import { OptionsRedirectMessageLevel } from '~/generated/data-contracts';

jest.mock('mod-arch-kubeflow', () => ({
  useThemeContext: () => ({ isMUITheme: false }),
}));

const mockPodConfigs: WorkspaceKindPodConfigValue[] = [
  {
    id: 'small',
    displayName: 'Small (1 CPU / 2GB)',
    description: '',
    hidden: false,
    podMetadata: { labels: {}, annotations: {} },
    statefulSetMetadata: { labels: {}, annotations: {} },
    restrictions: { deny: false },
    resources: { requests: {}, limits: {} },
  },
  {
    id: 'medium',
    displayName: 'Medium (2 CPU / 4GB)',
    description: '',
    hidden: false,
    podMetadata: { labels: {}, annotations: {} },
    statefulSetMetadata: { labels: {}, annotations: {} },
    restrictions: { deny: false },
    resources: { requests: {}, limits: {} },
  },
  {
    id: 'large',
    displayName: 'Large (4 CPU / 8GB)',
    description: '',
    hidden: false,
    podMetadata: { labels: {}, annotations: {} },
    statefulSetMetadata: { labels: {}, annotations: {} },
    restrictions: { deny: false },
    resources: { requests: {}, limits: {} },
  },
];

const setup = (
  currConfigOverrides: Partial<WorkspaceKindPodConfigValue> = {},
  availableConfigs: WorkspaceKindPodConfigValue[] = mockPodConfigs,
  mode = 'edit',
) => {
  const onSubmit = jest.fn();
  const Harness = () => {
    const [config, setConfig] = useState<WorkspaceKindPodConfigValue>({
      ...mockPodConfigs[0],
      ...currConfigOverrides,
    });
    return (
      <WorkspaceKindFormPodConfigModal
        mode={mode}
        isOpen
        onClose={jest.fn()}
        onSubmit={onSubmit}
        editIndex={0}
        currConfig={config}
        setCurrConfig={setConfig}
        podConfigOptions={availableConfigs}
      />
    );
  };
  render(<Harness />);
  const user = userEvent.setup();
  return { user, onSubmit };
};

describe('WorkspaceKindFormPodConfigRedirect', () => {
  it('renders the redirect section with candidate targets excluding current config', async () => {
    const { user } = setup();

    const redirectToggle = screen.getByRole('button', { name: /Redirect/i });
    expect(redirectToggle).toBeInTheDocument();
    await user.click(redirectToggle);

    const select = screen.getByTestId('workspace-kind-pod-config-redirect-to-select');
    expect(select).toBeInTheDocument();

    // Candidates should include medium and large, but NOT small
    expect(
      screen.getByRole('option', { name: /Medium \(2 CPU \/ 4GB\) \(medium\)/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: /Large \(4 CPU \/ 8GB\) \(large\)/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('option', { name: /Small \(1 CPU \/ 2GB\) \(small\)/ }),
    ).not.toBeInTheDocument();
  });

  it('displays existing redirect target, message level, and text', async () => {
    const { user } = setup({
      redirect: {
        to: 'medium',
        message: {
          level: OptionsRedirectMessageLevel.RedirectMessageLevelWarning,
          text: 'Small size is deprecated; using medium instead.',
        },
      },
    });

    const redirectToggle = screen.getByRole('button', { name: /Redirect/i });
    await user.click(redirectToggle);

    const select = screen.getByTestId('workspace-kind-pod-config-redirect-to-select');
    expect(select).toHaveValue('medium');

    const levelSelect = screen.getByTestId('workspace-kind-pod-config-redirect-msg-lvl-select');
    expect(levelSelect).toHaveValue(OptionsRedirectMessageLevel.RedirectMessageLevelWarning);

    const textInput = screen.getByTestId('workspace-kind-pod-config-redirect-message-text-input');
    expect(textInput).toHaveValue('Small size is deprecated; using medium instead.');
  });

  it('allows configuring and submitting a new redirect', async () => {
    const { user, onSubmit } = setup();

    await user.click(screen.getByRole('button', { name: /Redirect/i }));
    await user.selectOptions(
      screen.getByTestId('workspace-kind-pod-config-redirect-to-select'),
      'large',
    );

    const textInput = screen.getByTestId('workspace-kind-pod-config-redirect-message-text-input');
    await user.type(textInput, 'Redirected to large');

    await user.click(screen.getByTestId('pod-config-modal-submit-button'));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'small',
        redirect: {
          to: 'large',
          message: {
            level: OptionsRedirectMessageLevel.RedirectMessageLevelInfo,
            text: 'Redirected to large',
          },
        },
      }),
    );
  });

  it('allows removing an existing redirect by selecting no redirect', async () => {
    const { user, onSubmit } = setup({
      redirect: {
        to: 'medium',
        message: {
          level: OptionsRedirectMessageLevel.RedirectMessageLevelInfo,
          text: 'Temporary redirect',
        },
      },
    });

    await user.click(screen.getByRole('button', { name: /Redirect/i }));
    await user.selectOptions(
      screen.getByTestId('workspace-kind-pod-config-redirect-to-select'),
      '',
    );

    await user.click(screen.getByTestId('pod-config-modal-submit-button'));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'small',
        redirect: undefined,
      }),
    );
  });

  it('identifies and displays missing target warning when redirect points to an unknown ID', async () => {
    const { user } = setup({
      redirect: {
        to: 'non-existent-pod-config',
      },
    });

    await user.click(screen.getByRole('button', { name: /Redirect/i }));

    expect(
      screen.getByRole('option', { name: 'non-existent-pod-config (Missing)' }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('missing-target-warning')).toBeInTheDocument();
  });

  it('shows indeterminate helper text when no other pod configurations are available', async () => {
    // Only one pod config exists (itself)
    const { user } = setup({}, [mockPodConfigs[0]]);

    await user.click(screen.getByRole('button', { name: /Redirect/i }));

    expect(
      screen.getByText('No other pod configurations available to redirect to.'),
    ).toBeInTheDocument();
  });

  it('does not render the redirect section when mode is create', () => {
    setup({}, mockPodConfigs, 'create');
    expect(screen.queryByRole('button', { name: /Redirect/i })).not.toBeInTheDocument();
  });

  it('allows configuring and submitting a redirect without a message (omits message)', async () => {
    const { user, onSubmit } = setup();

    await user.click(screen.getByRole('button', { name: /Redirect/i }));
    await user.selectOptions(
      screen.getByTestId('workspace-kind-pod-config-redirect-to-select'),
      'large',
    );

    await user.click(screen.getByTestId('pod-config-modal-submit-button'));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'small',
        redirect: {
          to: 'large',
          message: undefined,
        },
      }),
    );
  });

  it('shows error and disables submit button when message text is less than 2 characters', async () => {
    const { user } = setup();

    await user.click(screen.getByRole('button', { name: /Redirect/i }));
    await user.selectOptions(
      screen.getByTestId('workspace-kind-pod-config-redirect-to-select'),
      'large',
    );

    const textInput = screen.getByTestId('workspace-kind-pod-config-redirect-message-text-input');
    await user.type(textInput, 'x');

    expect(screen.getByTestId('redirect-message-error')).toBeInTheDocument();
    expect(screen.getByText('Message text must be at least 2 characters.')).toBeInTheDocument();
    expect(screen.getByTestId('pod-config-modal-submit-button')).toBeDisabled();
  });
});
