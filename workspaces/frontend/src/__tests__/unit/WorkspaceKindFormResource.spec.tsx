import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { WorkspaceKindFormPodConfigModal } from '~/app/pages/WorkspaceKinds/Form/podConfig/WorkspaceKindFormPodConfigModal';
import { WorkspaceKindPodConfigValue } from '~/app/types';

jest.mock('mod-arch-kubeflow', () => ({
  useThemeContext: () => ({ isMUITheme: false }),
}));

const setup = async (
  resources: Partial<NonNullable<WorkspaceKindPodConfigValue['resources']>> = {},
) => {
  const onSubmit = jest.fn();
  const Harness = () => {
    const [config, setConfig] = useState<WorkspaceKindPodConfigValue>({
      id: 'test',
      displayName: 'Test',
      description: '',
      hidden: false,
      podMetadata: { labels: {}, annotations: {} },
      statefulSetMetadata: { labels: {}, annotations: {} },
      restrictions: { deny: false },
      resources: { requests: {}, limits: {}, ...resources },
    });
    return (
      <WorkspaceKindFormPodConfigModal
        isOpen
        onClose={jest.fn()}
        onSubmit={onSubmit}
        editIndex={0}
        currConfig={config}
        setCurrConfig={setConfig}
      />
    );
  };
  render(<Harness />);
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: /^Resources/ }));
  return { user, onSubmit };
};

describe('WorkspaceKind pod resource editor', () => {
  it('defaults a new GPU to a limit of one and keeps request empty when limit changes', async () => {
    const { user, onSubmit } = await setup();
    await user.click(screen.getByTestId('add-custom-resource'));
    expect(screen.queryByRole('spinbutton', { name: 'Custom resource request' })).toBeVisible();
    await user.type(screen.getByTestId('custom-resource-type'), 'nvidia.com/gpu');
    const request = screen.queryByRole('spinbutton', { name: 'Custom resource request' });
    const limit = screen.getByRole('spinbutton', { name: 'nvidia.com/gpu limit' });
    expect(request).not.toBeInTheDocument();
    expect(limit).toHaveValue(1);
    expect(
      screen.getByText('Extended resources and huge pages use the limit as the request.'),
    ).toBeVisible();
    await user.clear(limit);
    await user.type(limit, '2');
    expect(request).not.toBeInTheDocument();
    await user.click(screen.getByTestId('pod-config-modal-submit-button'));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        resources: { requests: {}, limits: { 'nvidia.com/gpu': '2' } },
      }),
    );
  });

  it.each<NonNullable<WorkspaceKindPodConfigValue['resources']>>([
    { requests: { 'ephemeral-storage': '1Gi' }, limits: { 'ephemeral-storage': '4Gi' } },
    { requests: { 'ephemeral-storage': '1Gi' }, limits: {} },
  ])('preserves ephemeral storage on open and save: %j', async (resources) => {
    const { user, onSubmit } = await setup(resources);
    expect(screen.getByRole('spinbutton', { name: 'Custom resource request' })).toHaveValue(1);
    await user.click(screen.getByTestId('pod-config-modal-submit-button'));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ resources }));
  });

  // cspell:ignore hugepages
  it.each([
    ['google.com/tpu', '2', 2],
    ['example.com/fpga', '2', 2],
    ['hugepages-2Mi', '80Mi', 80],
  ])('derives limit-only mode for %s when opening', async (type, quantity, display) => {
    const { user, onSubmit } = await setup({
      requests: { [type]: String(quantity) },
      limits: { [type]: String(quantity) },
    });
    expect(
      screen.queryByRole('spinbutton', { name: 'Custom resource request' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: `${type} limit` })).toHaveValue(display);
    await user.click(screen.getByTestId('pod-config-modal-submit-button'));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        resources: { requests: {}, limits: { [type]: String(quantity) } },
      }),
    );
  });

  it('updates mode on rename and flags unknown names', async () => {
    const { user } = await setup();
    await user.click(screen.getByTestId('add-custom-resource'));
    const name = screen.getByTestId('custom-resource-type');
    await user.type(name, 'device');
    expect(screen.getByText(/valid domain prefix/)).toBeVisible();
    expect(screen.getByTestId('pod-config-modal-submit-button')).toBeDisabled();
    await user.clear(name);
    await user.type(name, 'example.com/device');
    expect(
      screen.queryByRole('spinbutton', { name: 'Custom resource request' }),
    ).not.toBeInTheDocument();
    await user.clear(name);
    await user.type(name, 'ephemeral-storage');
    expect(screen.getByRole('spinbutton', { name: 'Custom resource request' })).toBeVisible();
  });

  it('preserves storage units while replacing a request and validates the edited quantity', async () => {
    const { user, onSubmit } = await setup({
      requests: { 'ephemeral-storage': '1Gi' },
      limits: { 'ephemeral-storage': '4Gi' },
    });
    const request = screen.getByRole('spinbutton', { name: 'Custom resource request' });
    await user.clear(request);
    await user.type(request, '5');
    expect(screen.getByText(/request must not exceed/)).toBeVisible();
    expect(screen.getByTestId('pod-config-modal-submit-button')).toBeDisabled();
    await user.clear(request);
    await user.type(request, '2');
    await user.click(screen.getByTestId('pod-config-modal-submit-button'));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        resources: {
          requests: { 'ephemeral-storage': '2Gi' },
          limits: { 'ephemeral-storage': '4Gi' },
        },
      }),
    );
  });

  it('renders resource fields without nesting forms', async () => {
    await setup();
    expect(screen.getByTestId('pod-config-modal').querySelector('form form')).toBeNull();
  });

  it('enables and saves CPU and memory limits without requests', async () => {
    const { user, onSubmit } = await setup();
    await user.click(screen.getByLabelText('Enable CPU limit'));
    await user.click(screen.getByLabelText('Enable Memory limit'));
    expect(screen.getByRole('spinbutton', { name: 'CPU limit' })).toBeEnabled();
    expect(screen.getByRole('spinbutton', { name: 'Memory limit' })).toBeEnabled();
    expect(screen.getByLabelText('CPU Request')).not.toBeChecked();
    expect(screen.getByLabelText('Memory Request')).not.toBeChecked();
    await user.click(screen.getByTestId('pod-config-modal-submit-button'));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        resources: { requests: {}, limits: { cpu: '1', memory: '1Mi' } },
      }),
    );
  });

  it('keeps cleared fields editable and preserves explicit zero values on blur', async () => {
    const { user, onSubmit } = await setup({ limits: { cpu: '0', memory: '0Mi' } });
    expect(screen.getByRole('spinbutton', { name: 'CPU limit' })).toHaveValue(0);
    expect(screen.getByRole('spinbutton', { name: 'Memory limit' })).toHaveValue(0);
    const cpuLimit = screen.getByRole('spinbutton', { name: 'CPU limit' });
    await user.clear(cpuLimit);
    expect(cpuLimit).toBeEnabled();
    await user.type(cpuLimit, '2');
    await user.tab();
    await user.click(screen.getByTestId('pod-config-modal-submit-button'));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        resources: { requests: {}, limits: { cpu: '2', memory: '0Mi' } },
      }),
    );
  });

  it('preserves all stored limit-only quantities when opening and saving', async () => {
    const limits = { cpu: '500m', memory: '1Gi', 'nvidia.com/gpu': '2' };
    const { user, onSubmit } = await setup({ limits });
    expect(screen.getByLabelText('Enable CPU limit')).toBeChecked();
    expect(screen.getByLabelText('Enable Memory limit')).toBeChecked();
    expect(screen.getByRole('spinbutton', { name: 'nvidia.com/gpu limit' })).toHaveValue(2);
    expect(screen.getByText('2 standard and 1 custom resources added')).toBeVisible();
    await user.click(screen.getByTestId('pod-config-modal-submit-button'));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        resources: { requests: {}, limits },
      }),
    );
  });

  it.each(['CPU', 'Memory'])(
    'disabling the %s request preserves its limit and vice versa',
    async (name) => {
      const { user, onSubmit } = await setup({
        requests: { cpu: '1', memory: '1Mi' },
        limits: { cpu: '2', memory: '2Mi' },
      });
      await user.click(screen.getByLabelText(`${name} Request`));
      expect(screen.getByRole('spinbutton', { name: `${name} limit` })).toHaveValue(2);
      await user.click(screen.getByTestId('pod-config-modal-submit-button'));
      const type = name.toLowerCase();
      expect(onSubmit.mock.calls[0][0].resources.requests).not.toHaveProperty(type);
      expect(onSubmit.mock.calls[0][0].resources.limits[type]).toBe(type === 'cpu' ? '2' : '2Mi');
      await user.click(screen.getByLabelText(`${name} Request`));
      await user.click(screen.getByLabelText(`Enable ${name} limit`));
      expect(screen.getByRole('spinbutton', { name: `${name} request` })).toHaveValue(2);
      await user.click(screen.getByTestId('pod-config-modal-submit-button'));
      expect(onSubmit.mock.calls[1][0].resources.limits).not.toHaveProperty(type);
    },
  );

  it.each([
    [{ requests: { cpu: '1' }, limits: { cpu: '500m' } }, 'CPU request must not exceed'],
    [
      { requests: { memory: '2Gi' }, limits: { memory: '1024Mi' } },
      'Memory request must not exceed',
    ],
    [
      { requests: { 'ephemeral-storage': '2Gi' }, limits: { 'ephemeral-storage': '1Gi' } },
      'must not exceed',
    ],
    [{ limits: { 'nvidia.com/gpu': '-1' } }, 'non-negative whole number'],
    [{ limits: { 'nvidia.com/gpu': '0.5' } }, 'non-negative whole number'],
  ])('blocks invalid resources %j', async (resources, message) => {
    const { onSubmit } = await setup(resources);
    expect(screen.getByText(new RegExp(message))).toBeVisible();
    const submit = screen.getByTestId('pod-config-modal-submit-button');
    expect(submit).toBeDisabled();
    fireEvent.click(submit);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it.each([
    { requests: { 'nvidia.com/gpu': '1' }, limits: { 'nvidia.com/gpu': '1' } },
    { requests: { 'nvidia.com/gpu': '1' } },
  ])('uses the limit for existing GPU resources when checked: %j', async (resources) => {
    const { user, onSubmit } = await setup(resources);
    expect(
      screen.queryByRole('spinbutton', { name: 'Custom resource request' }),
    ).not.toBeInTheDocument();
    const limit = screen.getByRole('spinbutton', { name: 'nvidia.com/gpu limit' });
    expect(limit).toHaveValue(1);
    await user.clear(limit);
    await user.type(limit, '2');
    await user.click(screen.getByTestId('pod-config-modal-submit-button'));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ resources: { requests: {}, limits: { 'nvidia.com/gpu': '2' } } }),
    );
  });
});
