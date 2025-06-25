import { ImagePullPolicy, WorkspaceKindImagePort } from '~/app/types';
import { WorkspaceOptionLabel } from '~/shared/api/backendApiTypes';

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
  labels: [] as WorkspaceOptionLabel[],
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
