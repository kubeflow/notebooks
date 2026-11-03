import React from 'react';
import { render, screen } from '@testing-library/react';
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

jest.mock('~/app/hooks/useNotebookAPI', () => ({
  useNotebookAPI: () => ({ api: {} }),
}));

jest.mock('~/app/routerHelper', () => ({
  useTypedNavigate: () => jest.fn(),
  useTypedParams: () => ({ kind: 'test-workspace-kind' }),
}));

// The Monaco editor is replaced by a stub, it cannot be rendered in jsdom.
jest.mock('~/app/pages/WorkspaceKinds/Form/yamlEditor/WorkspaceKindYamlEditor', () => ({
  WorkspaceKindYamlEditor: () => <div data-testid="yaml-editor" />,
}));

jest.mock('~/app/pages/WorkspaceKinds/Form/fileUpload/WorkspaceKindFileUpload', () => ({
  WorkspaceKindFileUpload: () => null,
}));

jest.mock('~/app/pages/WorkspaceKinds/Form/properties/WorkspaceKindFormProperties', () => ({
  WorkspaceKindFormProperties: () => <div data-testid="workspace-kind-form-properties" />,
}));

jest.mock('~/app/pages/WorkspaceKinds/Form/image/WorkspaceKindFormImage', () => ({
  WorkspaceKindFormImage: () => null,
}));

jest.mock('~/app/pages/WorkspaceKinds/Form/podConfig/WorkspaceKindFormPodConfig', () => ({
  WorkspaceKindFormPodConfig: () => null,
}));

jest.mock('~/app/pages/WorkspaceKinds/Form/podTemplate/WorkspaceKindFormPodTemplate', () => ({
  WorkspaceKindFormPodTemplate: () => null,
}));

const mockWorkspaceKind = buildMockWorkspaceKind({
  name: 'test-workspace-kind',
  displayName: 'Test Workspace Kind',
});

describe('WorkspaceKindForm YAML editor', () => {
  beforeEach(() => {
    jest
      .mocked(useWorkspaceKindByName)
      .mockReturnValue([
        buildMockWorkspaceKindUpdate(mockWorkspaceKind),
        true,
        undefined,
        jest.fn(),
      ]);
  });

  it('does not create the YAML editor while the form is being edited', () => {
    render(<WorkspaceKindForm />);

    expect(screen.getByTestId('form-tab')).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByTestId('yaml-editor')).not.toBeInTheDocument();
  });

  it('creates the YAML editor once the YAML tab is opened', async () => {
    const user = userEvent.setup();

    render(<WorkspaceKindForm />);

    await user.click(screen.getByTestId('yaml-tab'));

    expect(screen.getByTestId('yaml-tab')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('yaml-editor')).toBeInTheDocument();
  });
});
