import { getResources, convertFormDataToUpdate } from '~/app/pages/WorkspaceKinds/Form/helpers';
import { mockPodConfig } from '~/__mocks__/mockResources';
import { WorkspaceKindFormData, WorkspaceKindPodConfigValue, ImagePullPolicy } from '~/app/types';
import {
  WorkspacekindsWorkspaceKindUpdate,
  V1Beta1WorkspaceKindAssetMediaType,
  V1PullPolicy,
  V1ResourceList,
} from '~/generated/data-contracts';

const buildMockApiUpdate = (
  overrides?: Partial<WorkspacekindsWorkspaceKindUpdate>,
): WorkspacekindsWorkspaceKindUpdate => ({
  revision: 'rev-1',
  spawner: {
    displayName: 'Test WK',
    description: 'A test workspace kind',
    deprecated: false,
    deprecationMessage: '',
    hidden: false,
    icon: { url: 'https://example.com/icon.png' },
    logo: { url: 'https://example.com/logo.png' },
  },
  podTemplate: {
    options: {
      imageConfig: {
        spawner: { default: 'img-1' },
        values: [
          {
            id: 'img-1',
            spawner: {
              displayName: 'Image One',
              description: 'First image',
              hidden: false,
              labels: [{ key: 'lang', value: 'python' }],
            },
            spec: {
              image: 'registry.io/img:v1',
              imagePullPolicy: V1PullPolicy.PullIfNotPresent,
              ports: [{ id: 'http', port: 8888, displayName: 'HTTP' }],
            },
          },
        ],
      },
      podConfig: {
        spawner: { default: 'pod-1' },
        values: [
          {
            id: 'pod-1',
            spawner: {
              displayName: 'Pod One',
              description: 'First pod config',
              hidden: false,
              labels: [{ key: 'size', value: 'small' }],
            },
            spec: {
              resources: {
                requests: { cpu: '1', memory: '2Gi' } as unknown as V1ResourceList,
                limits: { cpu: '2', memory: '4Gi' } as unknown as V1ResourceList,
              },
              nodeSelector: { 'kubernetes.io/os': 'linux' },
            },
          },
        ],
      },
    },
    podMetadata: {
      labels: { app: 'test' },
      annotations: { note: 'test-annotation' },
    },
    ports: [{ id: 'http', defaultDisplayName: 'HTTP', protocol: 'HTTP' as never }],
    serviceAccount: { name: 'default-editor' },
    volumeMounts: { home: '/home/jovyan' },
  },
  ...overrides,
});

const buildMockFormData = (overrides?: Partial<WorkspaceKindFormData>): WorkspaceKindFormData => ({
  properties: {
    displayName: 'Test WK',
    description: 'A test workspace kind',
    deprecated: false,
    deprecationMessage: '',
    hidden: false,
    icon: { url: 'https://example.com/icon.png' },
    logo: { url: 'https://example.com/logo.png' },
  },
  imageConfig: {
    default: 'img-1',
    values: [
      {
        id: 'img-1',
        displayName: 'Image One',
        description: 'First image',
        hidden: false,
        labels: [{ key: 'lang', value: 'python' }],
        image: 'registry.io/img:v1',
        imagePullPolicy: ImagePullPolicy.IfNotPresent,
        ports: [{ id: 'http', port: 8888, displayName: 'HTTP', protocol: 'HTTP' as const }],
        restrictions: { deny: false },
      },
    ],
  },
  podConfig: {
    default: 'pod-1',
    values: [
      {
        id: 'pod-1',
        displayName: 'Pod One',
        description: 'First pod config',
        hidden: false,
        labels: [{ key: 'size', value: 'small' }],
        resources: {
          requests: { cpu: '1', memory: '2Gi' },
          limits: { cpu: '2', memory: '4Gi' },
        },
        nodeSelector: { 'kubernetes.io/os': 'linux' },
        restrictions: { deny: false },
      },
    ],
  },
  podTemplate: {
    podMetadata: {
      labels: { app: 'test' },
      annotations: { note: 'test-annotation' },
    },
    volumeMounts: { home: '/home/jovyan' },
    activityProbe: {
      probeIntervalSeconds: 3600,
      jupyter: { lastActivity: true, portId: 'http' },
    },
  },
  ...overrides,
});

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

  it('should handle empty or missing resources and return default CPU and memory entries', () => {
    const emptyConfig: WorkspaceKindPodConfigValue = {
      id: 'test-config',
      displayName: 'Test Config',
      description: 'Test Description',
      labels: [],
      hidden: false,
      restrictions: { deny: false },
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

describe('convertFormDataToUpdate', () => {
  it('should preserve spawner properties from form data', () => {
    const formData = buildMockFormData();
    const original = buildMockApiUpdate();

    const result = convertFormDataToUpdate(formData, original);

    expect(result.revision).toBe('rev-1');
    expect(result.spawner.displayName).toBe('Test WK');
    expect(result.spawner.description).toBe('A test workspace kind');
    expect(result.spawner.deprecated).toBe(false);
    expect(result.spawner.hidden).toBe(false);
    expect(result.spawner.icon).toEqual({ url: 'https://example.com/icon.png' });
    expect(result.spawner.logo).toEqual({ url: 'https://example.com/logo.png' });
  });

  it('should preserve podTemplate metadata from form data', () => {
    const formData = buildMockFormData();
    const original = buildMockApiUpdate();

    const result = convertFormDataToUpdate(formData, original);

    expect(result.podTemplate.podMetadata).toEqual({
      labels: { app: 'test' },
      annotations: { note: 'test-annotation' },
    });
    expect(result.podTemplate.volumeMounts).toEqual({ home: '/home/jovyan' });
  });

  it('should map image config values correctly', () => {
    const formData = buildMockFormData();
    const original = buildMockApiUpdate();

    const result = convertFormDataToUpdate(formData, original);
    const img = result.podTemplate.options.imageConfig.values[0];

    expect(img.id).toBe('img-1');
    expect(img.spawner.displayName).toBe('Image One');
    expect(img.spawner.description).toBe('First image');
    expect(img.spec.image).toBe('registry.io/img:v1');
    expect(img.spec.ports).toEqual([{ id: 'http', port: 8888, displayName: 'HTTP' }]);
  });

  it('should map pod config values with resources correctly', () => {
    const formData = buildMockFormData();
    const original = buildMockApiUpdate();

    const result = convertFormDataToUpdate(formData, original);
    const pod = result.podTemplate.options.podConfig.values[0];

    expect(pod.id).toBe('pod-1');
    expect(pod.spawner.displayName).toBe('Pod One');
    expect(pod.spec.resources).toEqual({
      requests: { cpu: '1', memory: '2Gi' },
      limits: { cpu: '2', memory: '4Gi' },
    });
    expect(pod.spec.nodeSelector).toEqual({ 'kubernetes.io/os': 'linux' });
  });

  it('should preserve non-form fields from original via spreading', () => {
    const original = buildMockApiUpdate();
    // Add a non-form field to a pod config spec
    (
      original.podTemplate.options.podConfig.values[0].spec as unknown as Record<string, unknown>
    ).affinity = {
      nodeAffinity: {
        requiredDuringSchedulingIgnoredDuringExecution: {
          nodeSelectorTerms: [{ matchExpressions: [{ key: 'gpu', operator: 'Exists' }] }],
        },
      },
    };

    const formData = buildMockFormData();
    const result = convertFormDataToUpdate(formData, original);

    // The affinity field should be preserved from the original via ...originalValue?.spec spread
    expect(
      (result.podTemplate.options.podConfig.values[0].spec as unknown as Record<string, unknown>)
        .affinity,
    ).toBeDefined();
  });

  it('should preserve non-form podTemplate fields from original via spreading', () => {
    const original = buildMockApiUpdate();
    // Add non-form podTemplate fields
    (original.podTemplate as unknown as Record<string, unknown>).extraEnv = [
      { name: 'MY_VAR', value: 'test' },
    ];

    const formData = buildMockFormData();
    const result = convertFormDataToUpdate(formData, original);

    // extraEnv should be preserved via ...original.podTemplate spread
    expect((result.podTemplate as unknown as Record<string, unknown>).extraEnv).toEqual([
      { name: 'MY_VAR', value: 'test' },
    ]);
  });

  it('should preserve culling config from form data', () => {
    const formData = buildMockFormData();
    const original = buildMockApiUpdate();

    const result = convertFormDataToUpdate(formData, original);

    expect(result.podTemplate.activityProbe).toEqual({
      probeIntervalSeconds: 3600,
      jupyter: { lastActivity: true, portId: 'http' },
    });
  });

  it('should convert empty string optional fields to undefined', () => {
    const formData = buildMockFormData();
    formData.properties.deprecationMessage = '';
    formData.properties.icon = { url: '' };
    formData.properties.logo = { url: '' };

    const original = buildMockApiUpdate();
    const result = convertFormDataToUpdate(formData, original);

    expect(result.spawner.deprecationMessage).toBeUndefined();
    expect(result.spawner.icon).toEqual({ url: undefined });
    expect(result.spawner.logo).toEqual({ url: undefined });
  });

  it('should use configMap-based icon when configMap is set', () => {
    const formData = buildMockFormData({
      properties: {
        displayName: 'Test WK',
        description: 'A test workspace kind',
        deprecated: false,
        deprecationMessage: '',
        hidden: false,
        icon: {
          configMap: {
            name: 'my-icons',
            namespace: 'default',
            key: 'icon.svg',
            mediaType: V1Beta1WorkspaceKindAssetMediaType.WorkspaceKindAssetMediaTypeSVG,
          },
        },
        logo: { url: 'https://example.com/logo.png' },
      },
    });
    const original = buildMockApiUpdate();
    const result = convertFormDataToUpdate(formData, original);

    expect(result.spawner.icon).toEqual({
      configMap: {
        name: 'my-icons',
        namespace: 'default',
        key: 'icon.svg',
        mediaType: V1Beta1WorkspaceKindAssetMediaType.WorkspaceKindAssetMediaTypeSVG,
      },
    });
    expect(result.spawner.logo).toEqual({ url: 'https://example.com/logo.png' });
  });

  it('should use configMap-based logo when configMap is set', () => {
    const formData = buildMockFormData({
      properties: {
        displayName: 'Test WK',
        description: 'A test workspace kind',
        deprecated: false,
        deprecationMessage: '',
        hidden: false,
        icon: { url: 'https://example.com/icon.png' },
        logo: {
          configMap: {
            name: 'my-logos',
            namespace: 'kubeflow',
            key: 'logo.svg',
            mediaType: V1Beta1WorkspaceKindAssetMediaType.WorkspaceKindAssetMediaTypeSVG,
          },
        },
      },
    });
    const original = buildMockApiUpdate();
    const result = convertFormDataToUpdate(formData, original);

    expect(result.spawner.icon).toEqual({ url: 'https://example.com/icon.png' });
    expect(result.spawner.logo).toEqual({
      configMap: {
        name: 'my-logos',
        namespace: 'kubeflow',
        key: 'logo.svg',
        mediaType: V1Beta1WorkspaceKindAssetMediaType.WorkspaceKindAssetMediaTypeSVG,
      },
    });
  });

  it('should preserve the original volumeMounts.home (immutable field)', () => {
    const formData = buildMockFormData({
      podTemplate: {
        podMetadata: { labels: {}, annotations: {} },
        volumeMounts: { home: '/home/changed-by-user' },
      },
    });
    const original = buildMockApiUpdate();
    const result = convertFormDataToUpdate(formData, original);

    expect(result.podTemplate.volumeMounts).toEqual({ home: '/home/jovyan' });
  });
});
