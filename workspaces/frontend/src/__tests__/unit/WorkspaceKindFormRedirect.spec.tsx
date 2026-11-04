import React, { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { WorkspaceKindFormPodConfigModal } from '~/app/pages/WorkspaceKinds/Form/podConfig/WorkspaceKindFormPodConfigModal';
import { WorkspaceKindFormImageModal } from '~/app/pages/WorkspaceKinds/Form/image/WorkspaceKindFormImageModal';
import {
  WorkspaceKindPodConfigValue,
  WorkspaceKindImageConfigValue,
  ImagePullPolicy,
} from '~/app/types';
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

const mockImages: WorkspaceKindImageConfigValue[] = [
  {
    id: 'jupyter-minimal',
    displayName: 'Minimal Notebook',
    description: 'Python minimal environment',
    image: 'quay.io/jupyter/minimal-notebook:latest',
    hidden: false,
    imagePullPolicy: ImagePullPolicy.IfNotPresent,
    restrictions: { deny: false },
  },
  {
    id: 'jupyter-scipy',
    displayName: 'SciPy Notebook',
    description: 'Jupyter with SciPy, Pandas, etc.',
    image: 'quay.io/jupyter/scipy-notebook:latest',
    hidden: false,
    imagePullPolicy: ImagePullPolicy.IfNotPresent,
    restrictions: { deny: false },
  },
  {
    id: 'jupyter-pytorch',
    displayName: 'PyTorch Notebook',
    description: 'Jupyter with PyTorch and CUDA',
    image: 'quay.io/jupyter/pytorch-notebook:latest',
    hidden: false,
    imagePullPolicy: ImagePullPolicy.IfNotPresent,
    restrictions: { deny: false },
  },
];

const setupPodConfigHarness = (
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

const setupImageHarness = (
  currImageOverrides: Partial<WorkspaceKindImageConfigValue> = {},
  availableImages: WorkspaceKindImageConfigValue[] = mockImages,
  mode = 'edit',
) => {
  const onSubmit = jest.fn();
  const Harness = () => {
    const [image, setImage] = useState<WorkspaceKindImageConfigValue>({
      ...mockImages[0],
      ...currImageOverrides,
    });
    return (
      <WorkspaceKindFormImageModal
        mode={mode}
        isOpen
        onClose={jest.fn()}
        onSubmit={onSubmit}
        editIndex={0}
        image={image}
        setImage={setImage}
        imageOptions={availableImages}
      />
    );
  };
  render(<Harness />);
  const user = userEvent.setup();
  return { user, onSubmit };
};

describe('WorkspaceKindFormRedirect', () => {
  describe('Pod Configuration Consumer', () => {
    it('renders the redirect section with candidate targets excluding current config', async () => {
      const { user } = setupPodConfigHarness();

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

    it('renders initial redirect data in edit mode', async () => {
      const { user } = setupPodConfigHarness({
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
      const { user, onSubmit } = setupPodConfigHarness();

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

    it('preserves message text when changing message level', async () => {
      const { user } = setupPodConfigHarness({
        redirect: {
          to: 'medium',
          message: {
            level: OptionsRedirectMessageLevel.RedirectMessageLevelInfo,
            text: 'Important note on pod size',
          },
        },
      });

      await user.click(screen.getByRole('button', { name: /Redirect/i }));

      const levelSelect = screen.getByTestId('workspace-kind-pod-config-redirect-msg-lvl-select');
      await user.selectOptions(
        levelSelect,
        OptionsRedirectMessageLevel.RedirectMessageLevelWarning,
      );

      const textInput = screen.getByTestId('workspace-kind-pod-config-redirect-message-text-input');
      expect(textInput).toHaveValue('Important note on pod size');
    });

    it('allows removing an existing redirect by selecting no redirect', async () => {
      const { user, onSubmit } = setupPodConfigHarness({
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
      const { user } = setupPodConfigHarness({
        redirect: {
          to: 'non-existent-pod-config',
        },
      });

      await user.click(screen.getByRole('button', { name: /Redirect/i }));

      expect(
        screen.getByRole('option', { name: 'non-existent-pod-config (Missing)' }),
      ).toBeInTheDocument();
      expect(screen.getByTestId('missing-target-warning')).toBeInTheDocument();
      expect(
        screen.getByText(/The target pod configuration "non-existent-pod-config" is missing/),
      ).toBeInTheDocument();
    });

    it('disables Save button, blocks submission, and keeps modal open when redirect points to a missing target ID', async () => {
      const { user, onSubmit } = setupPodConfigHarness({
        redirect: {
          to: 'non-existent-pod-config',
        },
      });

      await user.click(screen.getByRole('button', { name: /Redirect/i }));

      const submitBtn = screen.getByTestId('pod-config-modal-submit-button');
      expect(submitBtn).toBeDisabled();

      await user.click(submitBtn);
      expect(onSubmit).not.toHaveBeenCalled();
      expect(screen.getByTestId('pod-config-modal')).toBeInTheDocument();
    });

    it('rejects save when redirect target was deleted or renamed from options', async () => {
      const { user, onSubmit } = setupPodConfigHarness({ redirect: { to: 'old-renamed-id' } }, [
        { ...mockPodConfigs[0], id: 'new-id', displayName: 'New Pod Config' },
      ]);

      await user.click(screen.getByRole('button', { name: /Redirect/i }));

      const submitBtn = screen.getByTestId('pod-config-modal-submit-button');
      expect(submitBtn).toBeDisabled();

      await user.click(submitBtn);
      expect(onSubmit).not.toHaveBeenCalled();
      expect(screen.getByTestId('pod-config-modal')).toBeInTheDocument();
    });

    it('re-enables Save button when missing redirect target is changed to an eligible candidate', async () => {
      const { user, onSubmit } = setupPodConfigHarness({
        redirect: {
          to: 'non-existent-pod-config',
        },
      });

      await user.click(screen.getByRole('button', { name: /Redirect/i }));

      const submitBtn = screen.getByTestId('pod-config-modal-submit-button');
      expect(submitBtn).toBeDisabled();

      await user.selectOptions(
        screen.getByTestId('workspace-kind-pod-config-redirect-to-select'),
        'medium',
      );

      expect(submitBtn).toBeEnabled();
      await user.click(submitBtn);

      expect(onSubmit).toHaveBeenCalledTimes(1);
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'small',
          redirect: {
            to: 'medium',
          },
        }),
      );
    });

    it('re-enables Save button when missing redirect target is cleared ("No redirect")', async () => {
      const { user, onSubmit } = setupPodConfigHarness({
        redirect: {
          to: 'non-existent-pod-config',
        },
      });

      await user.click(screen.getByRole('button', { name: /Redirect/i }));

      const submitBtn = screen.getByTestId('pod-config-modal-submit-button');
      expect(submitBtn).toBeDisabled();

      await user.selectOptions(
        screen.getByTestId('workspace-kind-pod-config-redirect-to-select'),
        '',
      );

      expect(submitBtn).toBeEnabled();
      await user.click(submitBtn);

      expect(onSubmit).toHaveBeenCalledTimes(1);
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'small',
          redirect: undefined,
        }),
      );
    });

    it('shows indeterminate helper text when no other pod configurations are available', async () => {
      const { user } = setupPodConfigHarness({}, [mockPodConfigs[0]]);

      await user.click(screen.getByRole('button', { name: /Redirect/i }));

      expect(
        screen.getByText('No other pod configurations available to redirect to.'),
      ).toBeInTheDocument();
    });

    it('does not render the redirect section when mode is create', () => {
      setupPodConfigHarness({}, mockPodConfigs, 'create');
      expect(screen.queryByRole('button', { name: /Redirect/i })).not.toBeInTheDocument();
    });

    it('allows configuring and submitting a redirect without a message (omits message)', async () => {
      const { user, onSubmit } = setupPodConfigHarness();

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
      const { user } = setupPodConfigHarness();

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

  describe('Image Configuration Consumer', () => {
    it('renders candidate image targets excluding the image currently being edited', async () => {
      const { user } = setupImageHarness();

      const redirectToggle = screen.getByRole('button', { name: /Redirect/i });
      expect(redirectToggle).toBeInTheDocument();
      await user.click(redirectToggle);

      const select = screen.getByTestId('workspace-kind-image-redirect-to-select');
      expect(select).toBeInTheDocument();

      expect(
        screen.getByRole('option', { name: /SciPy Notebook \(jupyter-scipy\)/ }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('option', { name: /PyTorch Notebook \(jupyter-pytorch\)/ }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('option', { name: /Minimal Notebook \(jupyter-minimal\)/ }),
      ).not.toBeInTheDocument();
    });

    it('excludes original ID when an image is renamed during edit', async () => {
      const { user } = setupImageHarness({ id: 'jupyter-custom' });

      const redirectToggle = screen.getByRole('button', { name: /Redirect/i });
      await user.click(redirectToggle);

      expect(screen.queryByRole('option', { name: /jupyter-custom/ })).not.toBeInTheDocument();
      expect(
        screen.queryByRole('option', { name: /Minimal Notebook \(jupyter-minimal\)/ }),
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole('option', { name: /SciPy Notebook \(jupyter-scipy\)/ }),
      ).toBeInTheDocument();
    });

    it('preserves message text when changing message level in image redirect', async () => {
      const { user } = setupImageHarness({
        redirect: {
          to: 'jupyter-scipy',
          message: {
            level: OptionsRedirectMessageLevel.RedirectMessageLevelInfo,
            text: 'Image has moved to scipy container',
          },
        },
      });

      await user.click(screen.getByRole('button', { name: /Redirect/i }));

      const levelSelect = screen.getByTestId('workspace-kind-image-redirect-msg-lvl-select');
      await user.selectOptions(
        levelSelect,
        OptionsRedirectMessageLevel.RedirectMessageLevelWarning,
      );

      const textInput = screen.getByTestId('workspace-kind-image-redirect-message-text-input');
      expect(textInput).toHaveValue('Image has moved to scipy container');
    });

    it('identifies and displays missing target warning for image redirects', async () => {
      const { user } = setupImageHarness({
        redirect: {
          to: 'deprecated-tensorflow',
        },
      });

      await user.click(screen.getByRole('button', { name: /Redirect/i }));

      expect(
        screen.getByRole('option', { name: 'deprecated-tensorflow (Missing)' }),
      ).toBeInTheDocument();
      expect(screen.getByTestId('missing-target-warning')).toBeInTheDocument();
      expect(
        screen.getByText(/The target image "deprecated-tensorflow" is missing/),
      ).toBeInTheDocument();
    });

    it('disables Save button, blocks submission, and keeps modal open when image redirect points to a missing target ID', async () => {
      const { user, onSubmit } = setupImageHarness({
        redirect: {
          to: 'deprecated-tensorflow',
        },
      });

      await user.click(screen.getByRole('button', { name: /Redirect/i }));

      const submitBtn = screen.getByTestId('image-modal-submit-button');
      expect(submitBtn).toBeDisabled();

      await user.click(submitBtn);
      expect(onSubmit).not.toHaveBeenCalled();
      expect(screen.getByTestId('image-modal')).toBeInTheDocument();
    });

    it('rejects save when image redirect target was deleted or renamed from options', async () => {
      const { user, onSubmit } = setupImageHarness({ redirect: { to: 'old-renamed-image' } }, [
        { ...mockImages[0], id: 'new-image', displayName: 'New Image' },
      ]);

      await user.click(screen.getByRole('button', { name: /Redirect/i }));

      const submitBtn = screen.getByTestId('image-modal-submit-button');
      expect(submitBtn).toBeDisabled();

      await user.click(submitBtn);
      expect(onSubmit).not.toHaveBeenCalled();
      expect(screen.getByTestId('image-modal')).toBeInTheDocument();
    });

    it('re-enables Save button when missing image redirect target is changed to an eligible candidate', async () => {
      const { user, onSubmit } = setupImageHarness({
        redirect: {
          to: 'deprecated-tensorflow',
        },
      });

      await user.click(screen.getByRole('button', { name: /Redirect/i }));

      const submitBtn = screen.getByTestId('image-modal-submit-button');
      expect(submitBtn).toBeDisabled();

      await user.selectOptions(
        screen.getByTestId('workspace-kind-image-redirect-to-select'),
        'jupyter-scipy',
      );

      expect(submitBtn).toBeEnabled();
      await user.click(submitBtn);

      expect(onSubmit).toHaveBeenCalledTimes(1);
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'jupyter-minimal',
          redirect: {
            to: 'jupyter-scipy',
          },
        }),
      );
    });

    it('re-enables Save button when missing image redirect target is cleared ("No redirect")', async () => {
      const { user, onSubmit } = setupImageHarness({
        redirect: {
          to: 'deprecated-tensorflow',
        },
      });

      await user.click(screen.getByRole('button', { name: /Redirect/i }));

      const submitBtn = screen.getByTestId('image-modal-submit-button');
      expect(submitBtn).toBeDisabled();

      await user.selectOptions(screen.getByTestId('workspace-kind-image-redirect-to-select'), '');

      expect(submitBtn).toBeEnabled();
      await user.click(submitBtn);

      expect(onSubmit).toHaveBeenCalledTimes(1);
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'jupyter-minimal',
          redirect: undefined,
        }),
      );
    });

    it('shows indeterminate helper text when no other images are available', async () => {
      const { user } = setupImageHarness({}, [mockImages[0]]);

      await user.click(screen.getByRole('button', { name: /Redirect/i }));

      expect(screen.getByText('No other images available to redirect to.')).toBeInTheDocument();
    });

    it('shows error and disables save button when message text is less than 2 characters', async () => {
      const { user } = setupImageHarness();

      await user.click(screen.getByRole('button', { name: /Redirect/i }));
      await user.selectOptions(
        screen.getByTestId('workspace-kind-image-redirect-to-select'),
        'jupyter-scipy',
      );

      const textInput = screen.getByTestId('workspace-kind-image-redirect-message-text-input');
      await user.type(textInput, '1');

      expect(screen.getByTestId('redirect-message-error')).toBeInTheDocument();
      expect(screen.getByText('Message text must be at least 2 characters.')).toBeInTheDocument();
      expect(screen.getByTestId('image-modal-submit-button')).toBeDisabled();
    });

    it('allows configuring and submitting a new redirect for an image', async () => {
      const { user, onSubmit } = setupImageHarness();

      await user.click(screen.getByRole('button', { name: /Redirect/i }));
      await user.selectOptions(
        screen.getByTestId('workspace-kind-image-redirect-to-select'),
        'jupyter-pytorch',
      );

      const textInput = screen.getByTestId('workspace-kind-image-redirect-message-text-input');
      await user.type(textInput, 'Use PyTorch image instead');

      await user.click(screen.getByTestId('image-modal-submit-button'));

      expect(onSubmit).toHaveBeenCalledTimes(1);
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'jupyter-minimal',
          redirect: {
            to: 'jupyter-pytorch',
            message: {
              level: OptionsRedirectMessageLevel.RedirectMessageLevelInfo,
              text: 'Use PyTorch image instead',
            },
          },
        }),
      );
    });
  });
});
