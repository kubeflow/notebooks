import {
  getResourceErrors,
  isDevicePluginGpu,
} from '~/app/pages/WorkspaceKinds/Form/podConfig/resourceValidation';

const errors = (type: string, request: string, limit: string) =>
  getResourceErrors({ id: 'resource', type, request, limit });

describe('WorkspaceKind resource validation', () => {
  it.each([
    ['cpu', '', ''],
    ['cpu', '1', ''],
    ['cpu', '', '500m'],
    ['cpu', '500m', '1'],
    ['cpu', '1000m', '1'],
    ['cpu', '1e-3', '1m'],
    ['memory', '', '1Gi'],
    ['memory', '1024Mi', '1Gi'],
    ['memory', '1G', '1Gi'],
    ['memory', '1e9', '1G'],
    ['memory', '0', '0'],
    ['nvidia.com/gpu', '', ''],
    ['nvidia.com/gpu', '', '1'],
    ['nvidia.com/gpu', '1', '1'],
    ['amd.com/gpu', '', '0'],
    ['nvidia.com/gpu', '1000m', '1'],
    ['nvidia.com/gpu', '1e0', '1.0'],
    ['nvidia.com/mig-1g.5gb', '', '1'],
    ['gpu.intel.com/i915', '2', '2'],
  ])('accepts %s request=%s limit=%s', (type, request, limit) => {
    expect(errors(type, request, limit)).toEqual([]);
  });

  it.each([
    ['cpu', '1001m', '1', 'must not exceed'],
    ['cpu', '1', '500m', 'must not exceed'],
    ['memory', '1Gi', '1000Mi', 'must not exceed'],
    ['memory', '1Gi', '1G', 'must not exceed'],
    ['cpu', 'invalid', '1', 'Kubernetes quantity'],
    ['nvidia.com/gpu', '1', '', 'requires a limit'],
    ['nvidia.com/gpu', '1', '2', 'must equal'],
    ['nvidia.com/gpu', '2', '1', 'must equal'],
    ['nvidia.com/gpu', '', '-1', 'non-negative whole number'],
    ['nvidia.com/gpu', '-1', '1', 'non-negative whole number'],
    ['nvidia.com/gpu', '', '0.5', 'non-negative whole number'],
    ['nvidia.com/gpu', '1.5', '1.5', 'non-negative whole number'],
    ['nvidia.com/gpu', '', '1500m', 'non-negative whole number'],
    ['nvidia.com/gpu', '', '1junk', 'non-negative whole number'],
    ['nvidia.com/gpu', '9007199254740992', '9007199254740993', 'must equal'],
  ])('rejects %s request=%s limit=%s', (type, request, limit, message) => {
    expect(errors(type, request, limit).join(' ')).toContain(message);
  });

  it('does not apply GPU rules to unrelated custom resources', () => {
    expect(isDevicePluginGpu('example.com/fpga')).toBe(false);
    expect(errors('example.com/fpga', '0.5', '')).toEqual([]);
    expect(errors('example.com/fpga', '1', '2')).toEqual([]);
  });
});
