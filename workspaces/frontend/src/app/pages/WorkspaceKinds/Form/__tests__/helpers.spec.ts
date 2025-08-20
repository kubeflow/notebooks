import { getResources } from '~/app/pages/WorkspaceKinds/Form/helpers';
import { mockPodConfig } from '~/__mocks__/mockResources';
import { WorkspaceKindPodConfigValue } from '~/app/types';

describe('getResources', () => {
  it('should convert k8s resource object to PodResourceEntry array with correct structure', () => {
    const result = getResources(mockPodConfig);
    expect(result).toHaveLength(3);

    const cpu = result.find((r) => r.type === 'cpu');
    expect(cpu).toBeDefined();
    expect(cpu).toEqual({
      id: 'cpu-resource',
      type: 'cpu',
      request: '8000m',
      limit: '',
    });

    const memory = result.find((r) => r.type === 'memory');
    expect(memory).toBeDefined();
    expect(memory).toEqual({
      id: 'memory-resource',
      type: 'memory',
      request: '2Gi',
      limit: '',
    });

    // Check custom GPU resource
    const gpu = result.find((r) => r.type === 'nvidia.com/gpu');
    expect(gpu).toBeDefined();
    expect(gpu?.type).toBe('nvidia.com/gpu');
    expect(gpu?.request).toBe('');
    expect(gpu?.limit).toBe('2');
    expect(gpu?.id).toMatch(/nvidia\.com\/gpu-/);
  });

  it(' handle empty or missing resources and return default CPU and memory entries', () => {
    const emptyConfig: WorkspaceKindPodConfigValue = {
      id: 'test-config',
      displayName: 'Test Config',
      description: 'Test Description',
      labels: [],
      hidden: false,
    };

    const result = getResources(emptyConfig);

    // Should return CPU and memory with empty values
    expect(result).toHaveLength(2);

    const cpu = result.find((r) => r.type === 'cpu');
    expect(cpu).toEqual({
      id: 'cpu-resource',
      type: 'cpu',
      request: '',
      limit: '',
    });

    const memory = result.find((r) => r.type === 'memory');
    expect(memory).toEqual({
      id: 'memory-resource',
      type: 'memory',
      request: '',
      limit: '',
    });
  });
});
