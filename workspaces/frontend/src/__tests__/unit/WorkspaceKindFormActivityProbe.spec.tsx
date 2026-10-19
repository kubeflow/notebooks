import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { WorkspaceKindForm } from '~/app/pages/WorkspaceKinds/Form/WorkspaceKindForm';
import useWorkspaceKindByName from '~/app/hooks/useWorkspaceKindByName';
import { buildMockWorkspaceKind, buildMockWorkspaceKindUpdate } from '~/shared/mock/mockBuilder';

jest.mock('mod-arch-kubeflow', () => ({
  Theme: { MUI: 'mui' },
  useThemeContext: () => ({ isMUITheme: false }),
}));
jest.mock('~/app/hooks/useWorkspaceKindByName', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('~/app/hooks/useCurrentRouteKey', () => ({
  useCurrentRouteKey: () => 'workspaceKindEdit',
}));
jest.mock('~/app/routerHelper', () => ({
  useTypedNavigate: () => jest.fn(),
  useTypedParams: () => ({ kind: 'test-kind' }),
}));
jest.mock('~/app/hooks/useNotebookAPI', () => ({
  useNotebookAPI: () => ({ api: { workspaceKinds: {} } }),
}));
jest.mock('mod-arch-core', () => ({
  ...jest.requireActual('mod-arch-core'),
  useNotification: () => ({ success: jest.fn(), error: jest.fn() }),
}));
jest.mock('~/app/pages/WorkspaceKinds/Form/properties/WorkspaceKindFormProperties', () => ({
  WorkspaceKindFormProperties: () => null,
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
jest.mock('@patternfly/react-code-editor', () => ({
  Language: { shell: 'shell' },
  CodeEditor: ({ code, onChange }: { code: string; onChange: (value: string) => void }) => (
    <textarea aria-label="Probe Script" value={code} onChange={(e) => onChange(e.target.value)} />
  ),
}));

const pauseRule = { config: { secondsSinceActive: 3600 }, effect: { pauseWorkspace: true } };
const probe = { podExec: { script: '#!/bin/sh\nexit 0', timeoutSeconds: 30 } };

const setup = async (withProbe = false) => {
  const update = buildMockWorkspaceKindUpdate(buildMockWorkspaceKind());
  update.activityRules = [pauseRule];
  update.podTemplate.activityProbe = withProbe ? probe : undefined;
  jest.mocked(useWorkspaceKindByName).mockReturnValue([update, true, undefined, jest.fn()]);
  render(<WorkspaceKindForm />);
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Pod Lifecycle & Customization' }));
  return { user, update };
};

describe('Workspace Kind activity probe dependency', () => {
  it('blocks an invalid loaded configuration and clears the error when a probe is enabled', async () => {
    const { user } = await setup();
    expect(screen.getByTestId('activity-probe-dependency-error')).toBeVisible();
    expect(screen.getByTestId('submit-button')).toBeDisabled();
    await user.click(screen.getByTestId('workspace-kind-pod-template-activity-probe-switch'));
    expect(screen.queryByTestId('activity-probe-dependency-error')).not.toBeInTheDocument();
    expect(screen.getByTestId('submit-button')).toBeEnabled();
  });

  it('preserves pause rules when disabling a probe and allows saving after removing the last rule', async () => {
    const { user } = await setup(true);
    await user.click(screen.getByTestId('workspace-kind-pod-template-activity-probe-switch'));
    expect(screen.getByTestId('activity-rule-row-0')).toBeInTheDocument();
    expect(screen.getByTestId('submit-button')).toBeDisabled();
    await user.click(screen.getByTestId('activity-rule-remove-0'));
    expect(screen.queryByTestId('activity-probe-dependency-error')).not.toBeInTheDocument();
    expect(screen.getByTestId('submit-button')).toBeEnabled();
  });

  it('checks the current YAML draft rather than stale form state', async () => {
    const { user, update } = await setup(true);
    await user.click(screen.getByTestId('yaml-tab'));
    fireEvent.change(screen.getByLabelText('Workspace Kind YAML'), {
      target: {
        value: JSON.stringify({
          ...update,
          podTemplate: { ...update.podTemplate, activityProbe: undefined },
        }),
      },
    });
    expect(screen.getByTestId('activity-probe-dependency-error')).toBeVisible();
    expect(screen.getByTestId('submit-button')).toBeDisabled();
    await user.click(screen.getByTestId('form-tab'));
    expect(
      screen.getByTestId('workspace-kind-pod-template-activity-probe-switch'),
    ).not.toBeChecked();
    expect(screen.getByTestId('submit-button')).toBeDisabled();
  });

  it('clears the error when YAML adds a probe and preserves its settings in the form', async () => {
    const { user, update } = await setup();
    await user.click(screen.getByTestId('yaml-tab'));
    fireEvent.change(screen.getByLabelText('Workspace Kind YAML'), {
      target: {
        value: JSON.stringify({
          ...update,
          podTemplate: { ...update.podTemplate, activityProbe: probe },
        }),
      },
    });
    expect(screen.queryByTestId('activity-probe-dependency-error')).not.toBeInTheDocument();
    expect(screen.getByTestId('submit-button')).toBeEnabled();
    await user.click(screen.getByTestId('form-tab'));
    expect(screen.getByLabelText('probe script timeout input')).toHaveValue(30);
    expect(screen.getByLabelText('Probe Script')).toHaveValue(probe.podExec.script);
  });

  it('refreshes visible timing values after an existing probe is edited in YAML', async () => {
    const { user, update } = await setup(true);
    expect(screen.getByLabelText('probe script timeout input')).toHaveValue(30);
    await user.click(screen.getByTestId('yaml-tab'));
    fireEvent.change(screen.getByLabelText('Workspace Kind YAML'), {
      target: {
        value: JSON.stringify({
          ...update,
          podTemplate: {
            ...update.podTemplate,
            activityProbe: { ...probe, podExec: { ...probe.podExec, timeoutSeconds: 15 } },
          },
        }),
      },
    });
    await user.click(screen.getByTestId('form-tab'));
    expect(screen.getByLabelText('probe script timeout input')).toHaveValue(15);
  });

  it('defers malformed YAML errors to the editor without crashing dependency validation', async () => {
    const { user } = await setup();
    await user.click(screen.getByTestId('yaml-tab'));
    fireEvent.change(screen.getByLabelText('Workspace Kind YAML'), {
      target: { value: 'podTemplate: [' },
    });
    expect(screen.queryByTestId('activity-probe-dependency-error')).not.toBeInTheDocument();
    expect(screen.getByTestId('submit-button')).toBeDisabled();
  });
});
