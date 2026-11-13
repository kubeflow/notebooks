import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { WorkspaceKindForm } from '~/app/pages/WorkspaceKinds/Form/WorkspaceKindForm';
import useWorkspaceKindByName from '~/app/hooks/useWorkspaceKindByName';
import { useCurrentRouteKey } from '~/app/hooks/useCurrentRouteKey';
import { useTypedNavigate } from '~/app/routerHelper';
import { buildMockWorkspaceKind, buildMockWorkspaceKindUpdate } from '~/shared/mock/mockBuilder';

jest.mock('mod-arch-kubeflow', () => ({
  Theme: { MUI: 'mui' },
  useThemeContext: () => ({ isMUITheme: false }),
}));

jest.mock('~/app/hooks/useWorkspaceKindByName', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('~/app/hooks/useCurrentRouteKey', () => ({
  useCurrentRouteKey: jest.fn(),
}));

jest.mock('~/app/routerHelper', () => ({
  useTypedNavigate: jest.fn(),
  useTypedParams: () => ({ kind: 'test-kind' }),
}));

jest.mock('~/app/hooks/useNotebookAPI', () => ({
  useNotebookAPI: () => ({
    api: {
      workspaceKinds: {
        updateWorkspaceKind: mockUpdateWorkspaceKind,
        createWorkspaceKind: mockCreateWorkspaceKind,
      },
    },
  }),
}));

jest.mock('mod-arch-core', () => ({
  ...jest.requireActual('mod-arch-core'),
  useNotification: () => ({ success: mockNotificationSuccess, error: mockNotificationError }),
}));

jest.mock('~/app/pages/WorkspaceKinds/Form/properties/WorkspaceKindFormProperties', () => ({
  WorkspaceKindFormProperties: ({
    properties,
    updateField,
  }: {
    properties: { displayName: string };
    updateField: (p: { displayName: string }) => void;
  }) => (
    <input
      aria-label="Display Name Input"
      data-testid="display-name-input"
      value={properties.displayName}
      onChange={(e) => updateField({ ...properties, displayName: e.target.value })}
    />
  ),
}));

jest.mock('~/app/pages/WorkspaceKinds/Form/image/WorkspaceKindFormImage', () => ({
  WorkspaceKindFormImage: () => null,
}));

jest.mock('~/app/pages/WorkspaceKinds/Form/podConfig/WorkspaceKindFormPodConfig', () => ({
  WorkspaceKindFormPodConfig: () => null,
}));

jest.mock('~/app/pages/WorkspaceKinds/Form/yamlEditor/WorkspaceKindYamlEditor', () => ({
  WorkspaceKindYamlEditor: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (value: string) => void;
  }) => (
    <textarea
      aria-label="Workspace Kind YAML"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

const mockNavigate = jest.fn();
const mockUpdateWorkspaceKind = jest.fn();
const mockCreateWorkspaceKind = jest.fn();
const mockNotificationSuccess = jest.fn();
const mockNotificationError = jest.fn();

const setupEdit = () => {
  const update = buildMockWorkspaceKindUpdate(buildMockWorkspaceKind());
  jest.mocked(useCurrentRouteKey).mockReturnValue('workspaceKindEdit');
  jest.mocked(useWorkspaceKindByName).mockReturnValue([update, true, undefined, jest.fn()]);
  jest.mocked(useTypedNavigate).mockReturnValue(mockNavigate);
  render(<WorkspaceKindForm />);
  const user = userEvent.setup();
  return { user, update };
};

const setupCreate = () => {
  jest.mocked(useCurrentRouteKey).mockReturnValue('workspaceKindCreate');
  jest.mocked(useWorkspaceKindByName).mockReturnValue([null, false, undefined, jest.fn()]);
  jest.mocked(useTypedNavigate).mockReturnValue(mockNavigate);
  render(<WorkspaceKindForm />);
  const user = userEvent.setup();
  return { user };
};

describe('WorkspaceKindForm unsaved changes warning', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Clean configuration', () => {
    it('navigates away on Cancel without prompt when there are no changes', async () => {
      const { user } = setupEdit();

      await user.click(screen.getByTestId('cancel-button'));

      expect(screen.queryByTestId('discard-changes-modal')).not.toBeInTheDocument();
      expect(mockNavigate).toHaveBeenCalledWith('workspaceKinds');
    });

    it('navigates away on Cancel in create mode when no YAML is provided', async () => {
      const { user } = setupCreate();

      await user.click(screen.getByTestId('cancel-button'));

      expect(screen.queryByTestId('discard-changes-modal')).not.toBeInTheDocument();
      expect(mockNavigate).toHaveBeenCalledWith('workspaceKinds');
    });

    it('does not trigger beforeunload warning when clean', () => {
      setupEdit();

      const event = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(event);

      expect(event.defaultPrevented).toBe(false);
    });
  });

  describe('Form editor changes', () => {
    it('prompts confirmation when canceling with unsaved form edits', async () => {
      const { user } = setupEdit();

      const input = screen.getByTestId('display-name-input');
      await user.clear(input);
      await user.type(input, 'Modified WorkspaceKind Name');

      await user.click(screen.getByTestId('cancel-button'));

      expect(screen.getByTestId('discard-changes-modal')).toBeInTheDocument();
      expect(screen.getByText('Discard unsaved changes?')).toBeInTheDocument();
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('preserves edits when staying after prompt', async () => {
      const { user } = setupEdit();

      const input = screen.getByTestId('display-name-input');
      await user.clear(input);
      await user.type(input, 'Modified WorkspaceKind Name');

      await user.click(screen.getByTestId('cancel-button'));
      expect(screen.getByTestId('discard-changes-modal')).toBeInTheDocument();

      // Click "Keep editing" (cancel-button inside modal)
      const modalCancelButton = screen.getAllByTestId('cancel-button')[1];
      await user.click(modalCancelButton);

      expect(screen.queryByTestId('discard-changes-modal')).not.toBeInTheDocument();
      expect(mockNavigate).not.toHaveBeenCalled();
      expect(screen.getByTestId('display-name-input')).toHaveValue('Modified WorkspaceKind Name');
    });

    it('discards edits and completes navigation when confirmed', async () => {
      const { user } = setupEdit();

      const input = screen.getByTestId('display-name-input');
      await user.clear(input);
      await user.type(input, 'Modified WorkspaceKind Name');

      await user.click(screen.getByTestId('cancel-button'));
      expect(screen.getByTestId('discard-changes-modal')).toBeInTheDocument();

      await user.click(screen.getByTestId('confirm-button'));

      expect(mockNavigate).toHaveBeenCalledWith('workspaceKinds');
    });

    it('triggers beforeunload warning when dirty', () => {
      setupEdit();

      fireEvent.change(screen.getByTestId('display-name-input'), {
        target: { value: 'Modified Name' },
      });

      const event = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(event);

      expect(event.defaultPrevented).toBe(true);
    });
  });

  describe('Tab switching and editor synchronization', () => {
    it('preserves dirty state when switching from Form to YAML editor and prompts on Cancel', async () => {
      const { user } = setupEdit();

      const input = screen.getByTestId('display-name-input');
      await user.clear(input);
      await user.type(input, 'Changed in Form Tab');

      // Switch to YAML tab
      await user.click(screen.getByTestId('yaml-tab'));

      // Cancel button should prompt confirmation modal
      await user.click(screen.getByTestId('cancel-button'));

      expect(screen.getByTestId('discard-changes-modal')).toBeInTheDocument();
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('preserves dirty state when editing YAML directly and switching to Form editor', async () => {
      const { user, update } = setupEdit();

      // Switch to YAML tab and modify YAML
      await user.click(screen.getByTestId('yaml-tab'));
      fireEvent.change(screen.getByLabelText('Workspace Kind YAML'), {
        target: {
          value: JSON.stringify({
            ...update,
            spawner: { ...update.spawner, displayName: 'Changed in YAML Tab' },
          }),
        },
      });

      // Switch back to Form tab
      await user.click(screen.getByTestId('form-tab'));

      // Cancel button should prompt confirmation modal
      await user.click(screen.getByTestId('cancel-button'));

      expect(screen.getByTestId('discard-changes-modal')).toBeInTheDocument();
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('allows clean navigation after reverting changes', async () => {
      const { user } = setupEdit();

      const input = screen.getByTestId('display-name-input');
      await user.clear(input);
      await user.type(input, 'Temporary Edit');

      expect(screen.getByTestId('revert-button')).toBeEnabled();
      await user.click(screen.getByTestId('revert-button'));

      // After revert, cancel navigates without modal
      await user.click(screen.getByTestId('cancel-button'));

      expect(screen.queryByTestId('discard-changes-modal')).not.toBeInTheDocument();
      expect(mockNavigate).toHaveBeenCalledWith('workspaceKinds');
    });
  });

  describe('Navigation away via links', () => {
    it('intercepts link navigation when dirty and completes navigation on discard', async () => {
      const { user } = setupEdit();

      // Add a test link to simulate sidebar/external nav link
      const testLink = document.createElement('a');
      testLink.href = `${window.location.origin}/workspaces`;
      testLink.setAttribute('data-testid', 'test-nav-link');
      testLink.textContent = 'Workspaces Nav Link';
      const linkClickSpy = jest.fn((e: MouseEvent) => {
        e.preventDefault(); // Prevent JSDOM unhandled navigation error
      });
      testLink.addEventListener('click', linkClickSpy);
      document.body.appendChild(testLink);

      // Make form dirty
      const input = screen.getByTestId('display-name-input');
      await user.clear(input);
      await user.type(input, 'New Name');

      // Click link
      fireEvent.click(testLink);

      // Discard modal should appear
      expect(screen.getByTestId('discard-changes-modal')).toBeInTheDocument();

      // Confirm discard
      await user.click(screen.getByTestId('confirm-button'));

      expect(screen.queryByTestId('discard-changes-modal')).not.toBeInTheDocument();
      expect(linkClickSpy).toHaveBeenCalled();
      document.body.removeChild(testLink);
    });
  });

  describe('Create mode', () => {
    it('prompts confirmation when canceling in create mode with non-empty YAML', async () => {
      const { user } = setupCreate();

      const file = new File(['kind: WorkspaceKind\nname: test'], 'test.yaml', {
        type: 'application/x-yaml',
      });
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      await user.upload(fileInput, file);

      await user.click(screen.getByTestId('cancel-button'));

      expect(screen.getByTestId('discard-changes-modal')).toBeInTheDocument();
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  describe('Successful save', () => {
    it('does not prompt on navigation after successful form submission', async () => {
      const { user } = setupEdit();

      mockUpdateWorkspaceKind.mockResolvedValueOnce({
        ok: true,
        result: { data: {} },
      });

      const input = screen.getByTestId('display-name-input');
      await user.clear(input);
      await user.type(input, 'Saved Name');

      await user.click(screen.getByTestId('submit-button'));

      expect(mockUpdateWorkspaceKind).toHaveBeenCalled();
      expect(mockNotificationSuccess).toHaveBeenCalledWith(
        "Workspace kind 'test-kind' updated successfully",
      );
      expect(screen.queryByTestId('discard-changes-modal')).not.toBeInTheDocument();
      expect(mockNavigate).toHaveBeenCalledWith('workspaceKinds');
    });
  });
});
