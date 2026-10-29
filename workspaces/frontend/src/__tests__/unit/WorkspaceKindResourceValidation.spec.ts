import {
  getResourceErrors,
  isExtendedResourceName,
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

  // cspell:ignore gaudi neuroncore xilinx sriov rdma millicores
  it.each([
    'google.com/tpu',
    'habana.ai/gaudi',
    'aws.amazon.com/neuron',
    'aws.amazon.com/neuroncore',
    'nvidia.com/gpu.shared',
    'xilinx.com/fpga-device',
    'amd.com/xilinx_device',
    'gpu.intel.com/millicores',
    'gpu.intel.com/memory.max',
    'rdma/hca',
    'intel.com/sriov_device',
  ])('classifies and validates extended resource %s', (name) => {
    expect(isExtendedResourceName(name)).toBe(true);
    expect(errors(name, '1', '1')).toEqual([]);
    expect(errors(name, '1', '')).toEqual([]);
    expect(errors(name, '', '0.5').join(' ')).toContain('whole number');
    expect(errors(name, '1', '2').join(' ')).toContain('must equal');
  });

  it.each([
    'cpu',
    'memory',
    'ephemeral-storage',
    'device',
    'kubernetes.io/device',
    'example.kubernetes.io/device',
    'requests.example.com/device',
    'Example.com/device',
    'example.com/',
    '/device',
    'example.com/a/b',
    'example.com/-device',
    `example.com/${'a'.repeat(64)}`,
    `${'a'.repeat(245)}/device`,
  ])('does not classify %s as an extended resource', (name) => {
    expect(isExtendedResourceName(name)).toBe(false);
  });

  it('checks unknown names and independent storage quantities', () => {
    expect(errors('device', '', '1').join(' ')).toContain('domain prefix');
    expect(errors('ephemeral-storage', '1Gi', '4Gi')).toEqual([]);
    expect(errors('ephemeral-storage', '1Gi', '')).toEqual([]);
    expect(errors('ephemeral-storage', '2Gi', '1024Mi').join(' ')).toContain('must not exceed');
  });

  // cspell:ignore hugepages
  it('validates huge pages as byte quantities rather than device counts', () => {
    expect(errors('hugepages-2Mi', '', '80Mi')).toEqual([]);
    expect(errors('hugepages-2Mi', '', '0.5Gi')).toEqual([]);
    expect(errors('hugepages-2Mi', '2Mi', '4Mi').join(' ')).toContain('must equal');
    expect(errors('hugepages-2Mi', '', '3Mi').join(' ')).toContain('multiples');
    expect(errors('hugepages-invalid', '', '2Mi').join(' ')).toContain('page size');
  });
});
