import {
  buildMockOptionInfo,
  buildMockPodConfig,
  buildMockPodTemplate,
  buildMockWorkspace,
  buildMockWorkspaceKindInfo,
  buildPodTemplateOptions,
  buildMockImageConfig,
} from '~/shared/mock/mockBuilder';
import { V1Beta1WorkspaceState } from '~/generated/data-contracts';

export const buildMockWorkspaceWithGPU = (args: {
  name: string;
  namespace: string;
  workspaceKindName: string;
  gpuCount: number;
  state?: V1Beta1WorkspaceState;
  activity?: { lastActivity: number; lastUpdate: number };
}): ReturnType<typeof buildMockWorkspace> => {
  const { name, namespace, workspaceKindName, gpuCount, state, activity } = args;
  return buildMockWorkspace({
    name,
    namespace,
    workspaceKind: buildMockWorkspaceKindInfo({ name: workspaceKindName }),
    state: state || V1Beta1WorkspaceState.WorkspaceStateRunning,
    ...(activity && { activity }),
    podTemplate: buildMockPodTemplate({
      options: buildPodTemplateOptions({
        podConfig: buildMockPodConfig({
          current: buildMockOptionInfo({
            id: 'gpu_pod',
            displayName: 'GPU Pod',
            description: `Pod with ${gpuCount} GPUs`,
            labels: [{ key: 'gpu', value: String(gpuCount) }],
          }),
        }),
      }),
    }),
  });
};

export const buildMockWorkspaceWithImage = (args: {
  name: string;
  namespace: string;
  workspaceKindName: string;
  imageId: string;
  imageDisplayName: string;
  state?: V1Beta1WorkspaceState;
}): ReturnType<typeof buildMockWorkspace> => {
  const { name, namespace, workspaceKindName, imageId, imageDisplayName, state } = args;
  return buildMockWorkspace({
    name,
    namespace,
    workspaceKind: buildMockWorkspaceKindInfo({ name: workspaceKindName }),
    state: state || V1Beta1WorkspaceState.WorkspaceStateRunning,
    podTemplate: buildMockPodTemplate({
      options: buildPodTemplateOptions({
        imageConfig: buildMockImageConfig({
          current: buildMockOptionInfo({
            id: imageId,
            displayName: imageDisplayName,
            description: `${imageDisplayName} description`,
            labels: [],
          }),
        }),
      }),
    }),
  });
};

export const buildMockWorkspaceWithPodConfig = (args: {
  name: string;
  namespace: string;
  workspaceKindName: string;
  podConfigId: string;
  podConfigDisplayName: string;
  podConfigDescription: string;
  labels: Array<{ key: string; value: string }>;
  state?: V1Beta1WorkspaceState;
}): ReturnType<typeof buildMockWorkspace> => {
  const {
    name,
    namespace,
    workspaceKindName,
    podConfigId,
    podConfigDisplayName,
    podConfigDescription,
    labels,
    state,
  } = args;
  return buildMockWorkspace({
    name,
    namespace,
    workspaceKind: buildMockWorkspaceKindInfo({ name: workspaceKindName }),
    state: state || V1Beta1WorkspaceState.WorkspaceStateRunning,
    podTemplate: buildMockPodTemplate({
      options: buildPodTemplateOptions({
        podConfig: buildMockPodConfig({
          current: buildMockOptionInfo({
            id: podConfigId,
            displayName: podConfigDisplayName,
            description: podConfigDescription,
            labels,
          }),
        }),
      }),
    }),
  });
};

export const createMockPodTemplateWithImage = (
  imageName: string,
): ReturnType<typeof buildMockPodTemplate> =>
  buildMockPodTemplate({
    options: buildPodTemplateOptions({
      imageConfig: buildMockImageConfig({
        current: buildMockOptionInfo({ id: imageName, displayName: imageName }),
      }),
    }),
  });

export const buildMockImageWithLabels = (
  id: string,
  displayName: string,
  labels: { key: string; value: string }[],
  hidden = false,
): {
  id: string;
  displayName: string;
  description: string;
  labels: { key: string; value: string }[];
  hidden: boolean;
  redirect?: undefined;
  clusterMetrics?: undefined;
} => ({
  id,
  displayName,
  description: `Image: ${displayName}`,
  labels,
  hidden,
  redirect: undefined,
  clusterMetrics: undefined,
});

export const buildMockPodConfigWithLabels = (
  id: string,
  displayName: string,
  labels: { key: string; value: string }[],
): {
  id: string;
  displayName: string;
  description: string;
  labels: { key: string; value: string }[];
  hidden: boolean;
  redirect?: undefined;
  clusterMetrics?: undefined;
} => ({
  id,
  displayName,
  description: `Pod config: ${displayName}`,
  labels,
  hidden: false,
  redirect: undefined,
  clusterMetrics: undefined,
});
