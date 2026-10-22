import React, { useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { WorkspaceKindFormPodTemplate } from '~/app/pages/WorkspaceKinds/Form/podTemplate/WorkspaceKindFormPodTemplate';
import { WorkspaceKindPodTemplateData } from '~/app/types';

jest.mock('mod-arch-kubeflow', () => ({
  useThemeContext: () => ({ isMUITheme: false }),
}));

jest.mock('@patternfly/react-code-editor', () => ({
  Language: { shell: 'shell' },
  CodeEditor: ({ code, onChange }: { code: string; onChange: (value: string) => void }) => (
    <textarea aria-label="Probe Script" value={code} onChange={(e) => onChange(e.target.value)} />
  ),
}));

const customProbe = {
  probeIntervalSeconds: 7200,
  minProbeIntervalSeconds: 120,
  podExec: { timeoutSeconds: 30, script: '#!/bin/sh\nexit 0' },
};
const metadata = { labels: { team: 'science' }, annotations: { owner: 'admin' } };

const setup = async (activityProbe?: WorkspaceKindPodTemplateData['activityProbe']) => {
  const onUpdate = jest.fn();
  const Harness = () => {
    const [podTemplate, setPodTemplate] = useState<WorkspaceKindPodTemplateData>({
      podMetadata: metadata,
      volumeMountPaths: { home: '/home/user' },
      activityProbe,
    });
    return (
      <WorkspaceKindFormPodTemplate
        podTemplate={podTemplate}
        updatePodTemplate={(next) => {
          onUpdate(next);
          setPodTemplate(next);
        }}
        activityRules={[]}
        updateActivityRules={jest.fn()}
      />
    );
  };
  render(<Harness />);
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Pod Lifecycle & Customization' }));
  return { user, onUpdate };
};

const probeSwitch = () => screen.getByTestId('workspace-kind-pod-template-activity-probe-switch');

describe('WorkspaceKindFormPodTemplate activity probe', () => {
  it('exposes the disabled probe and initializes defaults when enabled', async () => {
    const { user, onUpdate } = await setup();
    expect(probeSwitch()).not.toBeChecked();
    expect(screen.queryByLabelText('probe interval input')).not.toBeInTheDocument();
    await user.click(probeSwitch());
    const settings = screen.getByRole('group', { name: 'Activity Probe settings' });
    expect(within(settings).getByLabelText('probe interval input')).toBeVisible();
    expect(within(settings).getByLabelText('Probe Script')).toBeVisible();
    expect(within(settings).queryByText('Timing')).not.toBeInTheDocument();
    expect(within(settings).queryByText('Script', { exact: true })).not.toBeInTheDocument();
    expect(screen.getByText('Activity Check Interval')).toBeVisible();
    expect(screen.getByText('Minimum Time Between Checks')).toBeVisible();
    expect(
      screen.getByText(
        'After a successful check, wait this long before checking workspace activity again.',
      ),
    ).toBeVisible();
    expect(
      screen.getByText(
        'Wait at least this long between checks. If a check fails, retry after this delay.',
      ),
    ).toBeVisible();
    expect(screen.getByLabelText('probe interval input')).toHaveValue(1);
    expect(screen.getByLabelText('minimum probe interval input')).toHaveValue(5);
    expect(screen.getByLabelText('probe script timeout input')).toHaveValue(1);
    expect(screen.getByDisplayValue(/^#!/)).toBeInTheDocument();
    expect(onUpdate).toHaveBeenLastCalledWith(expect.objectContaining({ podMetadata: metadata }));
  });

  it('displays optional timing defaults without mutating an existing script-only probe', async () => {
    const { onUpdate } = await setup({ podExec: { script: customProbe.podExec.script } });
    expect(screen.getByLabelText('probe interval input')).toHaveValue(1);
    expect(screen.getByLabelText('minimum probe interval input')).toHaveValue(5);
    expect(screen.getByLabelText('probe script timeout input')).toHaveValue(1);
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it.each([
    ['probe interval input', '3', { ...customProbe, probeIntervalSeconds: 10800 }],
    ['minimum probe interval input', '3', { ...customProbe, minProbeIntervalSeconds: 180 }],
    [
      'probe script timeout input',
      '15',
      { ...customProbe, podExec: { ...customProbe.podExec, timeoutSeconds: 15 } },
    ],
  ])(
    'updates %s while preserving the other probe fields and metadata',
    async (label, value, expected) => {
      const { onUpdate } = await setup(customProbe);
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
      expect(onUpdate).toHaveBeenLastCalledWith({
        podMetadata: metadata,
        volumeMountPaths: { home: '/home/user' },
        activityProbe: expected,
      });
    },
  );

  it('allows clearing and replacing a duration without inserting a fallback digit', async () => {
    const { user, onUpdate } = await setup(customProbe);
    const timeout = screen.getByLabelText('probe script timeout input');
    await user.clear(timeout);
    expect(timeout).toHaveValue(null);
    await user.type(timeout, '15');
    expect(timeout).toHaveValue(15);
    expect(onUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        activityProbe: { ...customProbe, podExec: { ...customProbe.podExec, timeoutSeconds: 15 } },
      }),
    );
  });

  it('preserves timing settings when editing the script, including an empty draft', async () => {
    const { onUpdate } = await setup(customProbe);
    fireEvent.change(screen.getByLabelText('Probe Script'), { target: { value: '' } });
    expect(onUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        activityProbe: { ...customProbe, podExec: { ...customProbe.podExec, script: '' } },
      }),
    );
  });

  it('preserves seconds when the display unit changes', async () => {
    const { user, onUpdate } = await setup(customProbe);
    const timing = screen.getByTestId('workspace-kind-activity-probe-timing');
    await user.selectOptions(within(timing).getAllByRole('combobox')[0], '60');
    expect(screen.getByLabelText('probe interval input')).toHaveValue(120);
    expect(onUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({ activityProbe: customProbe }),
    );
  });

  it('does not decrement timing values below one second', async () => {
    const { user, onUpdate } = await setup({
      probeIntervalSeconds: 1,
      minProbeIntervalSeconds: 1,
      podExec: { timeoutSeconds: 1, script: customProbe.podExec.script },
    });
    for (const label of [
      'probe interval input',
      'minimum probe interval input',
      'probe script timeout input',
    ]) {
      await user.click(screen.getByLabelText(`${label}-minus`));
      expect(screen.getByLabelText(label)).toHaveValue(1);
    }
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('removes the probe when disabled and uses defaults when re-enabled', async () => {
    const { user, onUpdate } = await setup(customProbe);
    await user.click(probeSwitch());
    expect(screen.queryByLabelText('Probe Script')).not.toBeInTheDocument();
    expect(onUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({ activityProbe: undefined, podMetadata: metadata }),
    );
    await user.click(probeSwitch());
    expect(screen.getByLabelText('probe interval input')).toHaveValue(1);
    expect(screen.getByDisplayValue(/has_activity/)).toBeInTheDocument();
  });

  it('retains edited values after collapsing and reopening the lifecycle section', async () => {
    const { user } = await setup(customProbe);
    fireEvent.change(screen.getByLabelText('probe script timeout input'), {
      target: { value: '10' },
    });
    const toggle = screen.getByRole('button', { name: 'Pod Lifecycle & Customization' });
    await user.click(toggle);
    await user.click(toggle);
    expect(screen.getByLabelText('probe script timeout input')).toHaveValue(10);
    expect(screen.getByLabelText('Probe Script')).toHaveValue(customProbe.podExec.script);
  });
});
