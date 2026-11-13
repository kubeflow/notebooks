import yaml from 'js-yaml';
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { WorkspaceKindForm } from '~/app/pages/WorkspaceKinds/Form/WorkspaceKindForm';
import useWorkspaceKindByName from '~/app/hooks/useWorkspaceKindByName';
import { buildMockWorkspaceKind, buildMockWorkspaceKindUpdate } from '~/shared/mock/mockBuilder';

jest.mock('mod-arch-kubeflow', () => ({
  ...jest.requireActual('mod-arch-kubeflow'),
  useThemeContext: () => ({ isMUITheme: false }),
}));

jest.mock('~/app/hooks/useWorkspaceKindByName', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('~/app/hooks/useCurrentRouteKey', () => ({
  useCurrentRouteKey: () => 'workspaceKindEdit',
}));

const mockUpdate = jest.fn();
jest.mock('~/app/hooks/useNotebookAPI', () => ({
  useNotebookAPI: () => ({ api: { workspaceKinds: { updateWorkspaceKind: mockUpdate } } }),
}));

jest.mock('~/app/routerHelper', () => ({
  useTypedNavigate: () => jest.fn(),
  useTypedParams: () => ({ kind: 'test-workspace-kind' }),
}));

// The Monaco editor is replaced by a stub, it cannot be rendered in jsdom.
jest.mock('~/app/pages/WorkspaceKinds/Form/yamlEditor/WorkspaceKindYamlEditor', () => ({
  WorkspaceKindYamlEditor: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (value: string) => void;
  }) => (
    <textarea
      data-testid="yaml-editor"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}));

jest.mock('~/app/pages/WorkspaceKinds/Form/fileUpload/WorkspaceKindFileUpload', () => ({
  WorkspaceKindFileUpload: () => null,
}));

jest.mock('~/app/pages/WorkspaceKinds/Form/properties/WorkspaceKindFormProperties', () => ({
  WorkspaceKindFormProperties: () => <div data-testid="workspace-kind-form-properties" />,
}));

jest.mock('~/app/pages/WorkspaceKinds/Form/podTemplate/WorkspaceKindFormPodTemplate', () => ({
  WorkspaceKindFormPodTemplate: () => null,
}));

const setup = () => {
  const update = buildMockWorkspaceKindUpdate(
    buildMockWorkspaceKind({ name: 'test-workspace-kind' }),
  );
  update.podTemplate.options.imageConfig.values = Array.from({ length: 12 }, (_, index) => ({
    ...update.podTemplate.options.imageConfig.values[0],
    id: `image-${index}`,
    redirect: index === 11 ? { to: 'missing' } : undefined,
  }));
  update.podTemplate.options.imageConfig.spawner.default = 'image-0';
  jest.mocked(useWorkspaceKindByName).mockReturnValue([update, true, undefined, jest.fn()]);
  render(<WorkspaceKindForm />);
  return { update, user: userEvent.setup() };
};

beforeEach(() => mockUpdate.mockReset());

it('opens an invalid image beyond the first page and restores submission after repair', async () => {
  const { user } = setup();
  expect(screen.getByTestId('redirect-validation-summary')).toHaveTextContent('image-11');
  expect(screen.getByTestId('submit-button')).toBeDisabled();
  await user.click(screen.getByTestId('edit-redirect-imageConfig-11'));
  expect(screen.getByTestId('workspace-kind-image-id-input')).toHaveValue('image-11');
  await user.click(screen.getByRole('button', { name: /Redirect/ }));
  await user.selectOptions(screen.getByTestId('workspace-kind-image-redirect-to-select'), '');
  await user.click(screen.getByTestId('image-modal-submit-button'));
  expect(screen.queryByTestId('redirect-validation-summary')).not.toBeInTheDocument();
  expect(screen.getByTestId('submit-button')).toBeEnabled();
  await user.click(screen.getByTestId('yaml-tab'));
  expect(screen.getByTestId('submit-button')).toBeEnabled();
});

it('blocks YAML cycles and exposes the same errors when returning to Form', async () => {
  const { update, user } = setup();
  await user.click(screen.getByTestId('yaml-tab'));
  update.podTemplate.options.imageConfig.values[11].redirect = { to: 'image-11' };
  fireEvent.change(screen.getByTestId('yaml-editor'), { target: { value: yaml.dump(update) } });
  expect(screen.getByTestId('redirect-validation-summary')).toHaveTextContent(
    'image-11 → image-11',
  );
  expect(screen.getByTestId('submit-button')).toBeDisabled();
  await user.click(screen.getByTestId('submit-button'));
  expect(mockUpdate).not.toHaveBeenCalled();
  await user.click(screen.getByTestId('form-tab'));
  expect(screen.getByTestId('redirect-validation-summary')).toHaveTextContent(
    'image-11 → image-11',
  );
  await user.click(screen.getByTestId('yaml-tab'));
  delete update.podTemplate.options.imageConfig.values[11].redirect;
  fireEvent.change(screen.getByTestId('yaml-editor'), { target: { value: yaml.dump(update) } });
  await waitFor(() => expect(screen.getByTestId('submit-button')).toBeEnabled());
  expect(screen.queryByTestId('redirect-validation-summary')).not.toBeInTheDocument();
});

it('opens the current YAML draft directly from its validation feedback', async () => {
  const { update, user } = setup();
  await user.click(screen.getByTestId('yaml-tab'));
  update.podTemplate.options.imageConfig.values[11].id = 'renamed-image';
  fireEvent.change(screen.getByTestId('yaml-editor'), { target: { value: yaml.dump(update) } });
  await user.click(screen.getByTestId('edit-redirect-imageConfig-11'));
  expect(screen.getByTestId('workspace-kind-image-id-input')).toHaveValue('renamed-image');
  expect(screen.getByTestId('redirect-validation-error')).toHaveTextContent('renamed-image');
});
