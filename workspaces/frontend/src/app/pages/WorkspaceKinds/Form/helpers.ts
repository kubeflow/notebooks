import {
  ImagePullPolicy,
  TolerationEntry,
  WorkspaceKindFormData,
  WorkspaceKindImagePort,
  WorkspaceKindPodConfigValue,
} from '~/app/types';
import {
  OptionsOptionLabel,
  OptionsPodConfigValue,
  V1Beta1OptionRedirect,
  V1Beta1RedirectMessageLevel,
  V1PullPolicy,
  V1ResourceList,
  V1Toleration,
  V1TolerationOperator,
  WorkspacekindsWorkspaceKindUpdate,
} from '~/generated/data-contracts';
import { PodResourceEntry } from './podConfig/WorkspaceKindFormResource';

// Simple ID generator to avoid PatternFly dependency in tests
export const generateUniqueId = (): string =>
  `id-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
export const isValidWorkspaceKindYaml = (data: any): boolean => {
  if (!data || typeof data !== 'object') {
    return false;
  }
  // Type assertion to access properties safely
  const obj = data as Record<string, unknown>;

  // Check required top-level properties
  if (
    obj.apiVersion !== 'kubeflow.org/v1beta1' ||
    obj.kind !== 'WorkspaceKind' ||
    typeof obj.metadata !== 'object' ||
    !obj.metadata ||
    typeof (obj.metadata as Record<string, unknown>).name !== 'string' ||
    typeof obj.spec !== 'object' ||
    !obj.spec
  ) {
    return false;
  }
  const spec = obj.spec as Record<string, unknown>;

  // Check spawner configuration
  if (
    typeof spec.spawner !== 'object' ||
    !spec.spawner ||
    typeof (spec.spawner as Record<string, unknown>).displayName !== 'string' ||
    typeof (spec.spawner as Record<string, unknown>).description !== 'string'
  ) {
    return false;
  }

  // Check podTemplate configuration
  if (typeof spec.podTemplate !== 'object' || !spec.podTemplate) {
    return false;
  }

  const podTemplate = spec.podTemplate as Record<string, unknown>;

  // Check options configuration
  if (typeof podTemplate.options !== 'object' || !podTemplate.options) {
    return false;
  }

  const options = podTemplate.options as Record<string, unknown>;

  // Check imageConfig
  if (
    typeof options.imageConfig !== 'object' ||
    !options.imageConfig ||
    !Array.isArray((options.imageConfig as Record<string, unknown>).values)
  ) {
    return false;
  }

  // Check podConfig
  if (
    typeof options.podConfig !== 'object' ||
    !options.podConfig ||
    !Array.isArray((options.podConfig as Record<string, unknown>).values)
  ) {
    return false;
  }

  return true;
};

export const emptyImage = {
  id: '',
  displayName: '',
  description: '',
  hidden: false,
  imagePullPolicy: ImagePullPolicy.IfNotPresent,
  labels: [] as OptionsOptionLabel[],
  image: '',
  ports: [
    {
      displayName: 'default',
      id: 'default',
      port: 8888,
      protocol: 'HTTP',
    } as WorkspaceKindImagePort,
  ],
  redirect: {
    to: '',
  },
};

export const emptyPodConfig: OptionsPodConfigValue = {
  id: '',
  displayName: '',
  description: '',
  labels: [],
  hidden: false,
  redirect: {
    to: '',
  },
};

export const EMPTY_WORKSPACE_KIND_FORM_DATA = {
  properties: {
    displayName: '',
    description: '',
    deprecated: false,
    deprecationMessage: '',
    hidden: false,
    icon: { url: '' },
    logo: { url: '' },
  },
  imageConfig: {
    default: '',
    values: [],
  },
  podConfig: {
    default: '',
    values: [],
  },
  podTemplate: {
    podMetadata: {
      labels: {},
      annotations: {},
    },
    volumeMounts: {
      home: '',
    },
    extraVolumeMounts: [],
    culling: {
      enabled: false,
      maxInactiveSeconds: 86400,
      activityProbe: {
        jupyter: {
          lastActivity: true,
        },
      },
    },
  },
};
export const emptyToleration = (): TolerationEntry => ({
  id: generateUniqueId(),
  operator: V1TolerationOperator.TolerationOpEqual,
  key: '',
  value: '',
});

const convertRedirectToApi = (
  redirect: WorkspaceKindPodConfigValue['redirect'],
): V1Beta1OptionRedirect | undefined => {
  if (!redirect?.to) {
    return undefined;
  }
  return {
    to: redirect.to,
    message: redirect.message
      ? {
          level: redirect.message.level as unknown as V1Beta1RedirectMessageLevel,
          text: redirect.message.text,
        }
      : undefined,
  };
};

export const convertFormDataToUpdate = (
  formData: WorkspaceKindFormData,
  original: WorkspacekindsWorkspaceKindUpdate,
): WorkspacekindsWorkspaceKindUpdate => ({
  revision: original.revision,
  spawner: {
    displayName: formData.properties.displayName,
    description: formData.properties.description,
    deprecated: formData.properties.deprecated,
    deprecationMessage: formData.properties.deprecationMessage || undefined,
    hidden: formData.properties.hidden,
    icon: { url: formData.properties.icon.url || undefined },
    logo: { url: formData.properties.logo.url || undefined },
  },
  podTemplate: {
    ...original.podTemplate,
    podMetadata: {
      labels: formData.podTemplate.podMetadata.labels,
      annotations: formData.podTemplate.podMetadata.annotations,
    },
    volumeMounts: {
      home: formData.podTemplate.volumeMounts.home,
    },
    culling: formData.podTemplate.culling
      ? {
          enabled: formData.podTemplate.culling.enabled,
          maxInactiveSeconds: formData.podTemplate.culling.maxInactiveSeconds,
          activityProbe: {
            jupyter: {
              lastActivity: formData.podTemplate.culling.activityProbe.jupyter.lastActivity,
            },
          },
        }
      : original.podTemplate.culling,
    options: {
      imageConfig: {
        spawner: { default: formData.imageConfig.default },
        values: (formData.imageConfig.values ?? []).map((v) => ({
          id: v.id,
          redirect: convertRedirectToApi(v.redirect),
          spawner: {
            displayName: v.displayName,
            description: v.description || undefined,
            hidden: v.hidden,
            labels: v.labels?.map((l) => ({ key: l.key, value: l.value })),
          },
          spec: {
            image: v.image ?? '',
            imagePullPolicy: (v.imagePullPolicy ??
              ImagePullPolicy.IfNotPresent) as unknown as V1PullPolicy,
            ports: (v.ports ?? []).map((p) => ({
              id: p.id,
              displayName: p.displayName || undefined,
              port: p.port,
            })),
          },
        })),
      },
      podConfig: {
        spawner: { default: formData.podConfig.default },
        values: (formData.podConfig.values ?? []).map((v) => ({
          id: v.id,
          redirect: convertRedirectToApi(v.redirect),
          spawner: {
            displayName: v.displayName,
            description: v.description || undefined,
            hidden: v.hidden,
            labels: v.labels?.map((l) => ({ key: l.key, value: l.value })),
          },
          spec: {
            resources: v.resources
              ? {
                  requests: v.resources.requests as V1ResourceList,
                  limits: v.resources.limits as V1ResourceList,
                }
              : undefined,
            nodeSelector: v.nodeSelector,
            tolerations: v.tolerations?.map(
              (t): V1Toleration => ({
                operator: t.operator,
                effect: t.effect,
                key: t.key,
                value: t.value,
                tolerationSeconds: t.tolerationSeconds,
              }),
            ),
          },
        })),
      },
    },
  },
});

// convert from k8s resource object {limits: {}, requests{}} to array of {type: '', limit: '', request: ''} for each type of resource (e.g. CPU, memory, nvidia.com/gpu)
export const getResources = (currConfig: WorkspaceKindPodConfigValue): PodResourceEntry[] => {
  const grouped = new Map<string, { request: string; limit: string }>([
    ['cpu', { request: '', limit: '' }],
    ['memory', { request: '', limit: '' }],
  ]);
  const { requests = {}, limits = {} } = currConfig.resources || {};
  const types = new Set([...Object.keys(requests), ...Object.keys(limits), 'cpu', 'memory']);
  types.forEach((type) => {
    const entry = grouped.get(type) || { request: '', limit: '' };
    if (type in requests) {
      entry.request = String(requests[type]);
    }
    if (type in limits) {
      entry.limit = String(limits[type]);
    }
    grouped.set(type, entry);
  });

  // Convert to UI-types with consistent IDs
  return Array.from(grouped.entries()).map(([type, { request, limit }]) => ({
    id:
      type === 'cpu'
        ? 'cpu-resource'
        : type === 'memory'
          ? 'memory-resource'
          : `${type}-${generateUniqueId()}`,
    type,
    request,
    limit,
  }));
};
