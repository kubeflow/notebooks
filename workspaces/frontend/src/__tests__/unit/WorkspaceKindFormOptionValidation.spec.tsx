import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import {
  validateOptionId,
  validateOptionDisplayName,
  emptyImage,
  emptyPodConfig,
} from '~/app/pages/WorkspaceKinds/Form/helpers';
import { WorkspaceKindFormImageModal } from '~/app/pages/WorkspaceKinds/Form/image/WorkspaceKindFormImageModal';
import { WorkspaceKindFormImage } from '~/app/pages/WorkspaceKinds/Form/image/WorkspaceKindFormImage';
import { WorkspaceKindFormPodConfigModal } from '~/app/pages/WorkspaceKinds/Form/podConfig/WorkspaceKindFormPodConfigModal';
import { WorkspaceKindFormPodConfig } from '~/app/pages/WorkspaceKinds/Form/podConfig/WorkspaceKindFormPodConfig';
import {
  ImagePullPolicy,
  WorkspaceKindImageConfigData,
  WorkspaceKindImageConfigValue,
  WorkspaceKindPodConfigData,
  WorkspaceKindPodConfigValue,
} from '~/app/types';

jest.mock('mod-arch-kubeflow', () => ({
  useThemeContext: () => ({ isMUITheme: false }),
}));

describe('WorkspaceKind Option ID & DisplayName Validation Helpers', () => {
  describe('validateOptionId', () => {
    it('returns error for empty or whitespace-only IDs', () => {
      expect(validateOptionId('')).toBe('ID is required.');
      expect(validateOptionId('   ')).toBe('ID is required.');
    });

    it('returns error when exceeding max length (256 chars)', () => {
      const longId = 'a'.repeat(257);
      expect(validateOptionId(longId)).toBe('ID must not exceed 256 characters.');
    });

    it('returns error for invalid characters, spaces, or uppercase letters', () => {
      const invalidMsg =
        'ID must start and end with an alphanumeric character and contain only lowercase letters, numbers, hyphens, or underscores.';

      expect(validateOptionId('UpperCaseID')).toBe(invalidMsg);
      expect(validateOptionId('has space')).toBe(invalidMsg);
      expect(validateOptionId('has.dot')).toBe(invalidMsg);
      expect(validateOptionId('-starts-hyphen')).toBe(invalidMsg);
      expect(validateOptionId('ends-hyphen-')).toBe(invalidMsg);
      expect(validateOptionId('_starts-underscore')).toBe(invalidMsg);
      expect(validateOptionId('ends-underscore_')).toBe(invalidMsg);
      expect(validateOptionId('special@char')).toBe(invalidMsg);
    });

    it('accepts valid alphanumeric IDs with hyphens and underscores', () => {
      expect(validateOptionId('jupyterlab_scipy_190')).toBeNull();
      expect(validateOptionId('small-cpu')).toBeNull();
      expect(validateOptionId('cuda-12_2-v1')).toBeNull();
      expect(validateOptionId('a')).toBeNull();
      expect(validateOptionId('1')).toBeNull();
      expect(validateOptionId('a-1')).toBeNull();
      expect(validateOptionId('a_1')).toBeNull();
    });

    it('detects duplicate IDs within existing IDs', () => {
      const existing = ['jupyter-cpu', 'jupyter-gpu'];
      expect(validateOptionId('jupyter-cpu', existing)).toBe(
        'An option with this ID already exists.',
      );
      expect(validateOptionId('jupyter-gpu', existing)).toBe(
        'An option with this ID already exists.',
      );
      expect(validateOptionId('jupyter-tpu', existing)).toBeNull();
    });

    it('allows keeping the same ID when editing the current option', () => {
      const existing = ['jupyter-cpu', 'jupyter-gpu'];
      expect(validateOptionId('jupyter-cpu', existing, 'jupyter-cpu')).toBeNull();
      expect(validateOptionId('jupyter-gpu', existing, 'jupyter-cpu')).toBe(
        'An option with this ID already exists.',
      );
    });
  });

  describe('validateOptionDisplayName', () => {
    it('returns error for empty display name', () => {
      expect(validateOptionDisplayName('')).toBe('Display Name is required.');
      expect(validateOptionDisplayName('   ')).toBe('Display Name is required.');
    });

    it('returns error when length is less than 2 characters', () => {
      expect(validateOptionDisplayName('a')).toBe('Display Name must be at least 2 characters.');
    });

    it('returns error when length exceeds 128 characters', () => {
      const longName = 'x'.repeat(129);
      expect(validateOptionDisplayName(longName)).toBe(
        'Display Name must not exceed 128 characters.',
      );
    });

    it('accepts valid display names', () => {
      expect(validateOptionDisplayName('JupyterLab with SciPy')).toBeNull();
      expect(validateOptionDisplayName('Small CPU (1 Core, 2Gi)')).toBeNull();
      expect(validateOptionDisplayName('ab')).toBeNull();
    });
  });
});

describe('WorkspaceKindFormImageModal Component', () => {
  const onClose = jest.fn();
  const onSubmit = jest.fn();
  const setImage = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders in add mode with disabled submit button when required fields are empty', () => {
    render(
      <WorkspaceKindFormImageModal
        mode="create"
        isOpen
        onClose={onClose}
        onSubmit={onSubmit}
        editIndex={null}
        image={{ ...emptyImage }}
        setImage={setImage}
        existingIds={['existing-image']}
      />,
    );

    const submitBtn = screen.getByTestId('image-modal-submit-button');
    expect(submitBtn).toBeDisabled();
    expect(submitBtn).toHaveTextContent('Add');
  });

  it('shows validation error when an invalid ID format is entered', async () => {
    const user = userEvent.setup();
    let currentImage: WorkspaceKindImageConfigValue = { ...emptyImage };
    const handleSetImage = jest.fn((next: WorkspaceKindImageConfigValue) => {
      currentImage = next;
    });

    const { rerender } = render(
      <WorkspaceKindFormImageModal
        mode="create"
        isOpen
        onClose={onClose}
        onSubmit={onSubmit}
        editIndex={null}
        image={currentImage}
        setImage={handleSetImage}
        existingIds={[]}
      />,
    );

    const idInput = screen.getByTestId('workspace-kind-image-id-input');
    await user.type(idInput, 'Invalid_Uppercase');

    rerender(
      <WorkspaceKindFormImageModal
        mode="create"
        isOpen
        onClose={onClose}
        onSubmit={onSubmit}
        editIndex={null}
        image={{ ...currentImage, id: 'Invalid_Uppercase' }}
        setImage={handleSetImage}
        existingIds={[]}
      />,
    );

    expect(screen.getByTestId('image-id-error')).toBeInTheDocument();
    expect(screen.getByTestId('image-modal-submit-button')).toBeDisabled();
  });

  it('shows duplicate error when entering an ID that already exists', async () => {
    const user = userEvent.setup();
    let currentImage: WorkspaceKindImageConfigValue = { ...emptyImage };
    const handleSetImage = jest.fn((next: WorkspaceKindImageConfigValue) => {
      currentImage = next;
    });

    const { rerender } = render(
      <WorkspaceKindFormImageModal
        mode="create"
        isOpen
        onClose={onClose}
        onSubmit={onSubmit}
        editIndex={null}
        image={currentImage}
        setImage={handleSetImage}
        existingIds={['jupyter-scipy']}
      />,
    );

    const idInput = screen.getByTestId('workspace-kind-image-id-input');
    await user.type(idInput, 'jupyter-scipy');

    rerender(
      <WorkspaceKindFormImageModal
        mode="create"
        isOpen
        onClose={onClose}
        onSubmit={onSubmit}
        editIndex={null}
        image={{ ...currentImage, id: 'jupyter-scipy' }}
        setImage={handleSetImage}
        existingIds={['jupyter-scipy']}
      />,
    );

    expect(screen.getByTestId('image-id-error')).toHaveTextContent(
      'An option with this ID already exists.',
    );
    expect(screen.getByTestId('image-modal-submit-button')).toBeDisabled();
  });

  it('enables submit button and calls onSubmit when all required fields are valid', async () => {
    const validImage: WorkspaceKindImageConfigValue = {
      ...emptyImage,
      id: 'valid-image',
      displayName: 'Valid Image Display Name',
      image: 'quay.io/kubeflow/jupyter:v1.0',
    };

    render(
      <WorkspaceKindFormImageModal
        mode="create"
        isOpen
        onClose={onClose}
        onSubmit={onSubmit}
        editIndex={null}
        image={validImage}
        setImage={setImage}
        existingIds={['other-image']}
      />,
    );

    const submitBtn = screen.getByTestId('image-modal-submit-button');
    expect(submitBtn).toBeEnabled();
    await userEvent.click(submitBtn);
    expect(onSubmit).toHaveBeenCalledWith(validImage);
  });
});

describe('WorkspaceKindFormImage State & Defaults Management', () => {
  it('automatically sets default to first added image configuration', async () => {
    const updateImageConfig = jest.fn();
    const imageConfig: WorkspaceKindImageConfigData = {
      default: '',
      values: [],
    };

    render(
      <WorkspaceKindFormImage
        mode="create"
        imageConfig={imageConfig}
        updateImageConfig={updateImageConfig}
      />,
    );

    // Expand section
    await userEvent.click(screen.getByRole('button', { name: /Workspace Images/i }));

    // Open Add Image Modal
    const addBtn = screen.getByRole('button', { name: /Add Image/i });
    await userEvent.click(addBtn);

    // Fill valid image
    await userEvent.type(screen.getByTestId('workspace-kind-image-id-input'), 'first-image');
    await userEvent.type(screen.getByTestId('workspace-kind-image-name-input'), 'First Image');
    await userEvent.type(
      screen.getByTestId('workspace-kind-image-url-input'),
      'quay.io/kubeflow/jupyter:v1.0',
    );

    const submitBtn = screen.getByTestId('image-modal-submit-button');
    expect(submitBtn).toBeEnabled();
    await userEvent.click(submitBtn);

    expect(updateImageConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        default: 'first-image',
        values: [
          expect.objectContaining({
            id: 'first-image',
            displayName: 'First Image',
          }),
        ],
      }),
    );
  });

  it('updates default ID when default configuration is renamed', async () => {
    const updateImageConfig = jest.fn();
    const initialConfig: WorkspaceKindImageConfigData = {
      default: 'cpu-image',
      values: [
        {
          ...emptyImage,
          id: 'cpu-image',
          displayName: 'CPU Image',
          image: 'docker.io/jupyter/minimal:latest',
          imagePullPolicy: ImagePullPolicy.IfNotPresent,
          hidden: false,
        },
      ],
    };

    render(
      <WorkspaceKindFormImage
        mode="edit"
        imageConfig={initialConfig}
        updateImageConfig={updateImageConfig}
      />,
    );

    // Expand section to show table
    await userEvent.click(screen.getByRole('button', { name: /Workspace Images/i }));

    // Open kebab menu and click edit
    const kebab = screen.getByTestId('images-table-row-0-kebab');
    await userEvent.click(kebab);
    const editItem = screen.getByRole('menuitem', { name: /Edit/i });
    await userEvent.click(editItem);

    // Modal opens with pre-filled ID 'cpu-image'
    const idInput = screen.getByTestId('workspace-kind-image-id-input');
    await userEvent.clear(idInput);
    await userEvent.type(idInput, 'cpu-image-v2');

    const saveBtn = screen.getByTestId('image-modal-submit-button');
    expect(saveBtn).toBeEnabled();
    await userEvent.click(saveBtn);

    expect(updateImageConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        default: 'cpu-image-v2',
        values: [
          expect.objectContaining({
            id: 'cpu-image-v2',
          }),
        ],
      }),
    );
  });

  it('reassigns default to next available configuration when default image is deleted', async () => {
    const updateImageConfig = jest.fn();
    const initialConfig: WorkspaceKindImageConfigData = {
      default: 'img-1',
      values: [
        {
          ...emptyImage,
          id: 'img-1',
          displayName: 'Image 1',
          image: 'docker.io/jupyter/1:latest',
          imagePullPolicy: ImagePullPolicy.IfNotPresent,
          hidden: false,
        },
        {
          ...emptyImage,
          id: 'img-2',
          displayName: 'Image 2',
          image: 'docker.io/jupyter/2:latest',
          imagePullPolicy: ImagePullPolicy.IfNotPresent,
          hidden: false,
        },
      ],
    };

    render(
      <WorkspaceKindFormImage
        mode="edit"
        imageConfig={initialConfig}
        updateImageConfig={updateImageConfig}
      />,
    );

    // Expand section to show table
    await userEvent.click(screen.getByRole('button', { name: /Workspace Images/i }));

    // Open kebab menu for first row and click remove
    const kebab = screen.getByTestId('images-table-row-0-kebab');
    await userEvent.click(kebab);
    const removeItem = screen.getByRole('menuitem', { name: /Remove/i });
    await userEvent.click(removeItem);

    // Confirm remove in modal
    const confirmBtn = screen.getByTestId('remove-image-confirm-button');
    await userEvent.click(confirmBtn);

    expect(updateImageConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        default: 'img-2',
        values: [
          expect.objectContaining({
            id: 'img-2',
          }),
        ],
      }),
    );
  });
});

describe('WorkspaceKindFormPodConfig State & Defaults Management', () => {
  it('automatically initializes podConfig.default on first added configuration', async () => {
    const updatePodConfig = jest.fn();
    const podConfigData: WorkspaceKindPodConfigData = {
      default: '',
      values: [],
    };

    render(
      <WorkspaceKindFormPodConfig podConfig={podConfigData} updatePodConfig={updatePodConfig} />,
    );

    // Expand section
    await userEvent.click(screen.getByRole('button', { name: /Pod Configurations/i }));

    // Click Add Config button
    const addBtn = screen.getByRole('button', { name: /Add Config/i });
    await userEvent.click(addBtn);

    // Fill valid pod config
    await userEvent.type(screen.getByTestId('workspace-kind-pod-config-id-input'), 'initial-gpu');
    await userEvent.type(screen.getByTestId('workspace-kind-pod-config-name-input'), 'Initial GPU');

    const createBtn = screen.getByTestId('pod-config-modal-submit-button');
    expect(createBtn).toBeEnabled();
    await userEvent.click(createBtn);

    expect(updatePodConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        default: 'initial-gpu',
        values: [
          expect.objectContaining({
            id: 'initial-gpu',
            displayName: 'Initial GPU',
          }),
        ],
      }),
    );
  });

  it('updates default ID when default pod configuration is renamed', async () => {
    const updatePodConfig = jest.fn();
    const initialConfig: WorkspaceKindPodConfigData = {
      default: 'pod-cfg-1',
      values: [
        {
          ...emptyPodConfig,
          id: 'pod-cfg-1',
          displayName: 'Pod Config 1',
        },
      ],
    };

    render(
      <WorkspaceKindFormPodConfig podConfig={initialConfig} updatePodConfig={updatePodConfig} />,
    );

    // Expand section to show table
    await userEvent.click(screen.getByRole('button', { name: /Pod Configurations/i }));

    // Open kebab menu and click edit
    const kebab = screen.getByTestId('pod-configs-table-row-0-kebab');
    await userEvent.click(kebab);
    const editItem = screen.getByRole('menuitem', { name: /Edit/i });
    await userEvent.click(editItem);

    // Clear and change ID
    const idInput = screen.getByTestId('workspace-kind-pod-config-id-input');
    await userEvent.clear(idInput);
    await userEvent.type(idInput, 'pod-cfg-renamed');

    const saveBtn = screen.getByTestId('pod-config-modal-submit-button');
    expect(saveBtn).toBeEnabled();
    await userEvent.click(saveBtn);

    expect(updatePodConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        default: 'pod-cfg-renamed',
        values: [
          expect.objectContaining({
            id: 'pod-cfg-renamed',
          }),
        ],
      }),
    );
  });

  it('reassigns default to next available pod configuration when default is deleted', async () => {
    const updatePodConfig = jest.fn();
    const initialConfig: WorkspaceKindPodConfigData = {
      default: 'cfg-a',
      values: [
        {
          ...emptyPodConfig,
          id: 'cfg-a',
          displayName: 'Config A',
        },
        {
          ...emptyPodConfig,
          id: 'cfg-b',
          displayName: 'Config B',
        },
      ],
    };

    render(
      <WorkspaceKindFormPodConfig podConfig={initialConfig} updatePodConfig={updatePodConfig} />,
    );

    // Expand section
    await userEvent.click(screen.getByRole('button', { name: /Pod Configurations/i }));

    // Delete first row (cfg-a, which is default)
    const kebab = screen.getByTestId('pod-configs-table-row-0-kebab');
    await userEvent.click(kebab);
    const removeItem = screen.getByRole('menuitem', { name: /Remove/i });
    await userEvent.click(removeItem);

    // Confirm remove in modal
    const confirmBtn = screen.getByTestId('remove-pod-config-confirm-button');
    await userEvent.click(confirmBtn);

    expect(updatePodConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        default: 'cfg-b',
        values: [
          expect.objectContaining({
            id: 'cfg-b',
          }),
        ],
      }),
    );
  });
});

describe('WorkspaceKindFormPodConfigModal Component', () => {
  const onClose = jest.fn();
  const onSubmit = jest.fn();
  const setCurrConfig = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders with disabled submit button when required fields are empty', () => {
    render(
      <WorkspaceKindFormPodConfigModal
        isOpen
        onClose={onClose}
        onSubmit={onSubmit}
        editIndex={null}
        currConfig={{ ...emptyPodConfig }}
        setCurrConfig={setCurrConfig}
        existingIds={['small-cpu']}
      />,
    );

    const submitBtn = screen.getByTestId('pod-config-modal-submit-button');
    expect(submitBtn).toBeDisabled();
    expect(submitBtn).toHaveTextContent('Create');
  });

  it('shows error on duplicate pod config ID', async () => {
    const user = userEvent.setup();
    let currentConfig = { ...emptyPodConfig };
    const handleSetConfig = jest.fn((next: WorkspaceKindPodConfigValue) => {
      currentConfig = next;
    });

    const { rerender } = render(
      <WorkspaceKindFormPodConfigModal
        isOpen
        onClose={onClose}
        onSubmit={onSubmit}
        editIndex={null}
        currConfig={currentConfig}
        setCurrConfig={handleSetConfig}
        existingIds={['small-cpu']}
      />,
    );

    const idInput = screen.getByTestId('workspace-kind-pod-config-id-input');
    await user.type(idInput, 'small-cpu');

    rerender(
      <WorkspaceKindFormPodConfigModal
        isOpen
        onClose={onClose}
        onSubmit={onSubmit}
        editIndex={null}
        currConfig={{ ...currentConfig, id: 'small-cpu' }}
        setCurrConfig={handleSetConfig}
        existingIds={['small-cpu']}
      />,
    );

    expect(screen.getByTestId('pod-config-id-error')).toHaveTextContent(
      'An option with this ID already exists.',
    );
    expect(screen.getByTestId('pod-config-modal-submit-button')).toBeDisabled();
  });

  it('enables submit button and calls onSubmit when pod config is valid', async () => {
    const validConfig: WorkspaceKindPodConfigValue = {
      ...emptyPodConfig,
      id: 'medium-cpu',
      displayName: 'Medium CPU',
    };

    render(
      <WorkspaceKindFormPodConfigModal
        isOpen
        onClose={onClose}
        onSubmit={onSubmit}
        editIndex={null}
        currConfig={validConfig}
        setCurrConfig={setCurrConfig}
        existingIds={['small-cpu']}
      />,
    );

    const submitBtn = screen.getByTestId('pod-config-modal-submit-button');
    expect(submitBtn).toBeEnabled();
    await userEvent.click(submitBtn);
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'medium-cpu',
        displayName: 'Medium CPU',
      }),
    );
  });
});
