import {
  ActionsWorkspaceActionPause,
  HealthCheckHealthCheck,
  HealthCheckServiceStatus,
  NamespacesNamespace,
  PvcsPVCCreate,
  PvcsPVCListItem,
  V1PersistentVolumeAccessMode,
  V1PersistentVolumeMode,
  SecretsSecretListItem,
  StorageclassesStorageClassListItem,
  WorkspacekindsRedirectMessageLevel,
  WorkspacekindsWorkspaceKind,
  WorkspacesImageConfig,
  WorkspacesOptionInfo,
  WorkspacesPodConfig,
  WorkspacesPodMetadata,
  WorkspacesPodMetadataMutate,
  WorkspacesPodTemplate,
  WorkspacesPodTemplateMutate,
  WorkspacesPodTemplateOptions,
  WorkspacesPodTemplateOptionsMutate,
  WorkspacesPodVolumesMutate,
  WorkspacesRedirectMessageLevel,
  WorkspacesRedirectStep,
  WorkspacesWorkspaceCreate,
  WorkspacesWorkspaceKindInfo,
  WorkspacesWorkspaceListItem,
  V1Beta1WorkspaceState,
  WorkspacesWorkspaceUpdate,
} from '~/generated/data-contracts';

export const buildMockHealthCheckResponse = (
  healthCheckResponse?: Partial<HealthCheckHealthCheck>,
): HealthCheckHealthCheck => ({
  status: HealthCheckServiceStatus.ServiceStatusHealthy,
  systemInfo: { version: '1.0.0' },
  ...healthCheckResponse,
});

export const buildMockNamespace = (
  namespace?: Partial<NamespacesNamespace>,
): NamespacesNamespace => ({
  name: 'default',
  ...namespace,
});

export const buildMockWorkspaceKindInfo = (
  workspaceKindInfo?: Partial<WorkspacesWorkspaceKindInfo>,
): WorkspacesWorkspaceKindInfo => ({
  name: 'jupyterlab',
  missing: false,
  icon: {
    url: 'https://jupyter.org/assets/favicons/apple-touch-icon-152x152.png',
  },
  logo: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/3/38/Jupyter_logo.svg',
  },
  ...workspaceKindInfo,
});

export const buildMockOptionInfo = (
  optionInfo?: Partial<WorkspacesOptionInfo>,
): WorkspacesOptionInfo => ({
  id: 'jupyterlab_scipy_190',
  displayName: 'jupyter-scipy:v1.9.0',
  description: 'JupyterLab, with SciPy Packages',
  labels: [
    {
      key: 'pythonVersion',
      value: '3.11',
    },
    {
      key: 'jupyterlabVersion',
      value: '1.9.0',
    },
  ],
  ...optionInfo,
});

export const buildMockImageConfig = (
  imageConfig?: Partial<WorkspacesImageConfig>,
): WorkspacesImageConfig => ({
  current: buildMockOptionInfo({}),
  ...imageConfig,
});

export const buildMockPodConfig = (
  podConfig?: Partial<WorkspacesPodConfig>,
): WorkspacesPodConfig => ({
  current: {
    id: 'tiny_cpu',
    displayName: 'Tiny CPU',
    description: 'Pod with 0.1 CPU, 128 Mb RAM',
    labels: [
      {
        key: 'cpu',
        value: '100m',
      },
      {
        key: 'memory',
        value: '128Mi',
      },
      {
        key: 'gpu',
        value: '1',
      },
    ],
  },
  ...podConfig,
});

type ImageVersionKey = '1.8.0' | '1.9.0' | '2.0.0' | '2.1.0';

const IMAGE_VERSION_MAP: Record<
  ImageVersionKey,
  {
    id: string;
    displayName: string;
    description: string;
    labels: { key: string; value: string }[];
  }
> = {
  '1.8.0': {
    id: 'jupyterlab_scipy_180',
    displayName: 'jupyter-scipy:v1.8.0',
    description: 'JupyterLab, with SciPy Packages',
    labels: [
      { key: 'pythonVersion', value: '3.11' },
      { key: 'jupyterlabVersion', value: '1.8.0' },
    ],
  },
  '1.9.0': {
    id: 'jupyterlab_scipy_190',
    displayName: 'jupyter-scipy:v1.9.0',
    description: 'JupyterLab, with SciPy Packages',
    labels: [
      { key: 'pythonVersion', value: '3.12' },
      { key: 'jupyterlabVersion', value: '1.9.0' },
    ],
  },
  '2.0.0': {
    id: 'jupyterlab_scipy_200',
    displayName: 'jupyter-scipy:v2.0.0',
    description: 'JupyterLab, with SciPy Packages',
    labels: [
      { key: 'pythonVersion', value: '3.12' },
      { key: 'jupyterlabVersion', value: '2.0.0' },
    ],
  },
  '2.1.0': {
    id: 'jupyterlab_scipy_210',
    displayName: 'jupyter-scipy:v2.1.0',
    description: 'JupyterLab, with SciPy Packages',
    labels: [
      { key: 'pythonVersion', value: '3.13' },
      { key: 'jupyterlabVersion', value: '2.1.0' },
    ],
  },
};

const IMAGE_VERSIONS: ImageVersionKey[] = ['1.8.0', '1.9.0', '2.0.0', '2.1.0'];

type PodConfigKey = 'tinyCpu' | 'smallCpu' | 'mediumCpu' | 'largeCpu';

const POD_CONFIG_MAP: Record<
  PodConfigKey,
  {
    id: string;
    displayName: string;
    description: string;
    labels: { key: string; value: string }[];
  }
> = {
  tinyCpu: {
    id: 'tiny_cpu',
    displayName: 'Tiny CPU',
    description: 'Pod with 0.1 CPU, 128 Mb RAM',
    labels: [
      { key: 'cpu', value: '100m' },
      { key: 'memory', value: '128Mi' },
    ],
  },
  smallCpu: {
    id: 'small_cpu',
    displayName: 'Small CPU',
    description: 'Pod with 0.5 CPU, 512 Mb RAM',
    labels: [
      { key: 'cpu', value: '500m' },
      { key: 'memory', value: '512Mi' },
    ],
  },
  mediumCpu: {
    id: 'medium_cpu',
    displayName: 'Medium CPU',
    description: 'Pod with 1 CPU, 1 Gb RAM',
    labels: [
      { key: 'cpu', value: '1000m' },
      { key: 'memory', value: '1Gi' },
    ],
  },
  largeCpu: {
    id: 'large_cpu',
    displayName: 'Large CPU',
    description: 'Pod with 4 CPU, 4 Gb RAM',
    labels: [
      { key: 'cpu', value: '4000m' },
      { key: 'memory', value: '4Gi' },
    ],
  },
};

const POD_CONFIGS: PodConfigKey[] = ['tinyCpu', 'smallCpu', 'mediumCpu', 'largeCpu'];

export const buildImageRedirectChain = (args: {
  startVersion: ImageVersionKey;
  endVersion: ImageVersionKey;
}): WorkspacesRedirectStep[] => {
  const startIdx = IMAGE_VERSIONS.indexOf(args.startVersion);
  const endIdx = IMAGE_VERSIONS.indexOf(args.endVersion);

  const chain: WorkspacesRedirectStep[] = [];
  for (let i = startIdx; i < endIdx; i++) {
    const sourceVer = IMAGE_VERSIONS[i];
    const targetVer = IMAGE_VERSIONS[i + 1];

    let messageLevel: WorkspacesRedirectMessageLevel;
    if (i === startIdx) {
      messageLevel = WorkspacesRedirectMessageLevel.RedirectMessageLevelDanger;
    } else if (i === endIdx - 1) {
      messageLevel = WorkspacesRedirectMessageLevel.RedirectMessageLevelInfo;
    } else {
      messageLevel = WorkspacesRedirectMessageLevel.RedirectMessageLevelWarning;
    }

    chain.push({
      source: IMAGE_VERSION_MAP[sourceVer],
      target: IMAGE_VERSION_MAP[targetVer],
      message: {
        level: messageLevel,
        text: `Your admin has upgraded the image from ${IMAGE_VERSION_MAP[sourceVer].displayName} to ${IMAGE_VERSION_MAP[targetVer].displayName}`,
      },
    });
  }

  return chain;
};

export const buildPodRedirectChain = (args: {
  startConfig: PodConfigKey;
  endConfig: PodConfigKey;
}): WorkspacesRedirectStep[] => {
  const startIdx = POD_CONFIGS.indexOf(args.startConfig);
  const endIdx = POD_CONFIGS.indexOf(args.endConfig);

  const chain: WorkspacesRedirectStep[] = [];
  for (let i = startIdx; i < endIdx; i++) {
    const sourceConfig = POD_CONFIGS[i];
    const targetConfig = POD_CONFIGS[i + 1];

    chain.push({
      source: POD_CONFIG_MAP[sourceConfig],
      target: POD_CONFIG_MAP[targetConfig],
      message: {
        level: WorkspacesRedirectMessageLevel.RedirectMessageLevelWarning,
        text: `Your admin has upgraded the pod configuration from ${POD_CONFIG_MAP[sourceConfig].displayName} to ${POD_CONFIG_MAP[targetConfig].displayName}`,
      },
    });
  }

  return chain;
};

const buildMockImageConfigWithRedirects = (
  index: number,
  imageConfig: { id: string; displayName: string; labels: { key: string; value: string }[] },
): WorkspacesImageConfig => {
  if (index % 5 === 1 || index % 5 === 4) {
    return {
      current: IMAGE_VERSION_MAP['1.8.0'],
      redirectChain: buildImageRedirectChain({
        startVersion: '1.8.0',
        endVersion: '2.1.0',
      }),
    };
  }
  if (index % 5 === 2) {
    return {
      current: IMAGE_VERSION_MAP['1.9.0'],
      redirectChain: buildImageRedirectChain({
        startVersion: '1.9.0',
        endVersion: '2.1.0',
      }),
    };
  }

  return {
    current: {
      id: imageConfig.id,
      displayName: imageConfig.displayName,
      description: 'JupyterLab, with SciPy Packages',
      labels: imageConfig.labels,
    },
  };
};

const buildMockPodConfigWithRedirects = (
  index: number,
  podConfig: { id: string; displayName: string },
): WorkspacesPodConfig => {
  if (index % 5 === 3 || index % 5 === 4) {
    return {
      current: POD_CONFIG_MAP.smallCpu,
      redirectChain: buildPodRedirectChain({
        startConfig: 'smallCpu',
        endConfig: 'largeCpu',
      }),
    };
  }

  return {
    current: {
      id: podConfig.id,
      displayName: podConfig.displayName,
      description: `Pod with ${index}00 Millicores, ${index} GiB RAM`,
      labels: [
        {
          key: 'cpu',
          value: `${index}00m`,
        },
        {
          key: 'memory',
          value: `${index}Gi`,
        },
        {
          key: 'gpu',
          value: String(index % 2 === 0 ? 2 : 1),
        },
      ],
    },
  };
};

export const buildPodTemplateOptions = (
  podTemplateOptions?: Partial<WorkspacesPodTemplateOptions>,
): WorkspacesPodTemplateOptions => ({
  imageConfig: buildMockImageConfig({}),
  podConfig: buildMockPodConfig({}),
  ...podTemplateOptions,
});

export const buildMockPodMetadata = (
  podMetadata?: Partial<WorkspacesPodMetadata>,
): WorkspacesPodMetadata => ({
  labels: { labelKey1: 'labelValue1', labelKey2: 'labelValue2' },
  annotations: { annotationKey1: 'annotationValue1', annotationKey2: 'annotationValue2' },
  ...podMetadata,
});

export const buildMockPodTemplate = (
  podTemplate?: Partial<WorkspacesPodTemplate>,
): WorkspacesPodTemplate => ({
  podMetadata: buildMockPodMetadata({}),
  volumes: {
    home: {
      pvcName: 'Volume-Home',
      mountPath: '/home',
      readOnly: false,
    },
    data: [
      {
        pvcName: 'Volume-Data1',
        mountPath: '/data',
        readOnly: true,
      },
      {
        pvcName: 'Volume-Data2',
        mountPath: '/data',
        readOnly: false,
      },
    ],
    secrets: [
      {
        defaultMode: 0o644,
        mountPath: '/secrets',
        secretName: 'secret-1',
      },
    ],
  },
  options: buildPodTemplateOptions({}),
  ...podTemplate,
});

export const buildMockWorkspace = (
  workspace?: Partial<WorkspacesWorkspaceListItem>,
): WorkspacesWorkspaceListItem => ({
  name: 'My First Jupyter Notebook',
  audit: {
    createdAt: new Date(2025, 5, 1).toISOString(),
    createdBy: 'test-user',
    updatedAt: new Date(2025, 6, 1).toISOString(),
    updatedBy: 'test-user',
    deletedAt: '',
  },
  namespace: 'default',
  workspaceKind: buildMockWorkspaceKindInfo(),
  paused: true,
  pausedTime: new Date(2025, 3, 1).getTime(),
  state: V1Beta1WorkspaceState.WorkspaceStateRunning,
  stateMessage: 'Workspace is running',
  podTemplate: buildMockPodTemplate({}),
  activity: {
    lastActivity: new Date(2025, 5, 1).getTime(),
    lastUpdate: new Date(2025, 4, 1).getTime(),
  },
  pendingRestart: false,
  services: [
    {
      httpService: {
        displayName: 'JupyterLab',
        httpPath: 'https://jupyterlab.example.com',
      },
    },
    {
      httpService: {
        displayName: 'Spark Master',
        httpPath: 'https://spark-master.example.com',
      },
    },
  ],
  ...workspace,
});

export const buildMockWorkspaceKind = (
  workspaceKind?: Partial<WorkspacekindsWorkspaceKind>,
): WorkspacekindsWorkspaceKind => ({
  name: 'jupyterlab',
  displayName: 'JupyterLab Notebook',
  description: 'A Workspace which runs JupyterLab in a Pod',
  deprecated: false,
  deprecationMessage:
    'This WorkspaceKind will be removed on 20XX-XX-XX, please use another WorkspaceKind.',
  hidden: false,
  icon: {
    url: 'https://jupyter.org/assets/favicons/apple-touch-icon-152x152.png',
  },
  logo: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/3/38/Jupyter_logo.svg',
  },
  clusterMetrics: {
    workspacesCount: 10,
  },
  podTemplate: {
    podMetadata: {
      labels: {
        myWorkspaceKindLabel: 'my-value',
      },
      annotations: {
        myWorkspaceKindAnnotation: 'my-value',
      },
    },
    volumeMounts: {
      home: '/home/jovyan',
    },
    options: {
      imageConfig: {
        default: 'jupyterlab_scipy_190',
        values: [
          {
            id: 'jupyterlab_scipy_180',
            displayName: 'jupyter-scipy:v1.8.0',
            description: 'JupyterLab, with SciPy Packages',
            labels: [
              { key: 'pythonVersion', value: '3.11' },
              { key: 'jupyterlabVersion', value: '1.8.0' },
            ],
            hidden: false,
            clusterMetrics: {
              workspacesCount: 0,
            },
            redirect: {
              to: 'jupyterlab_scipy_190',
              message: {
                text: 'This update will change...',
                level: WorkspacekindsRedirectMessageLevel.RedirectMessageLevelInfo,
              },
            },
          },
          {
            id: 'jupyterlab_scipy_190',
            displayName: 'jupyter-scipy:v1.9.0',
            description: 'JupyterLab, with SciPy Packages',
            labels: [
              { key: 'pythonVersion', value: '3.12' },
              { key: 'jupyterlabVersion', value: '1.9.0' },
            ],
            hidden: false,
            redirect: {
              to: 'jupyterlab_scipy_200',
              message: {
                text: 'This update will change...',
                level: WorkspacekindsRedirectMessageLevel.RedirectMessageLevelWarning,
              },
            },
            clusterMetrics: {
              workspacesCount: 1,
            },
          },
          {
            id: 'jupyterlab_scipy_200',
            displayName: 'jupyter-scipy:v2.0.0 (Hidden)',
            description: 'JupyterLab, with SciPy Packages',
            labels: [
              { key: 'pythonVersion', value: '3.12' },
              { key: 'jupyterlabVersion', value: '2.0.0' },
            ],
            hidden: true,
            redirect: {
              to: 'jupyterlab_scipy_210',
              message: {
                text: 'This update will change...',
                level: WorkspacekindsRedirectMessageLevel.RedirectMessageLevelWarning,
              },
            },
            clusterMetrics: {
              workspacesCount: 2,
            },
          },
          {
            id: 'jupyterlab_scipy_210',
            displayName: 'jupyter-scipy:v2.1.0',
            description: 'JupyterLab, with SciPy Packages',
            labels: [
              { key: 'pythonVersion', value: '3.13' },
              { key: 'jupyterlabVersion', value: '2.1.0' },
            ],
            hidden: false,
            clusterMetrics: {
              workspacesCount: 3,
            },
          },
          {
            id: 'jupyterlab_scipy_220_hidden',
            displayName: 'jupyter-scipy:v2.2.0 (Hidden)',
            description: 'JupyterLab, with SciPy Packages',
            labels: [
              { key: 'pythonVersion', value: '3.13' },
              { key: 'jupyterlabVersion', value: '2.2.0' },
            ],
            hidden: true,
            clusterMetrics: {
              workspacesCount: 0,
            },
          },
        ],
      },
      podConfig: {
        default: 'tiny_cpu',
        values: [
          {
            id: 'tiny_cpu',
            displayName: 'Tiny CPU',
            description: 'Pod with 0.1 CPU, 128 Mb RAM',
            hidden: false,
            labels: [
              { key: 'cpu', value: '100m' },
              { key: 'memory', value: '128Mi' },
            ],
            redirect: {
              to: 'small_cpu',
              message: {
                text: 'This update will change...',
                level: WorkspacekindsRedirectMessageLevel.RedirectMessageLevelDanger,
              },
            },
            clusterMetrics: {
              workspacesCount: 0,
            },
          },
          {
            id: 'small_cpu',
            displayName: 'Small CPU',
            description: 'Pod with 0.5 CPU, 512 Mb RAM',
            hidden: false,
            labels: [
              { key: 'cpu', value: '500m' },
              { key: 'memory', value: '512Mi' },
            ],
          },
          {
            id: 'medium_cpu',
            displayName: 'Medium CPU',
            description: 'Pod with 1 CPU, 1 Gb RAM',
            hidden: false,
            labels: [
              { key: 'cpu', value: '1000m' },
              { key: 'memory', value: '1Gi' },
            ],
          },
          {
            id: 'large_cpu',
            displayName: 'Large CPU',
            description: 'Pod with 4 CPU, 4 Gb RAM',
            hidden: false,
            labels: [
              { key: 'cpu', value: '4000m' },
              { key: 'memory', value: '4Gi' },
              { key: 'gpu', value: '1' },
            ],
            redirect: {
              to: 'large_cpu_hidden',
              message: {
                text: 'This update will change...',
                level: WorkspacekindsRedirectMessageLevel.RedirectMessageLevelDanger,
              },
            },
            clusterMetrics: {
              workspacesCount: 5,
            },
          },
          {
            id: 'large_cpu_hidden',
            displayName: 'Large CPU (Hidden)',
            description: 'Pod with 4 CPU, 4 Gb RAM',
            hidden: true,
            labels: [
              { key: 'cpu', value: '4000m' },
              { key: 'memory', value: '4Gi' },
              { key: 'gpu', value: '1' },
            ],
            clusterMetrics: {
              workspacesCount: 0,
            },
          },
        ],
      },
    },
  },
  ...workspaceKind,
});

export const buildMockActionsWorkspaceActionPause = (
  pauseState?: Partial<ActionsWorkspaceActionPause>,
): ActionsWorkspaceActionPause => ({
  paused: true,
  ...pauseState,
});

export const buildMockWorkspaceList = (args: {
  count: number;
  namespace: string;
  kind: WorkspacesWorkspaceKindInfo;
  state?: V1Beta1WorkspaceState;
}): WorkspacesWorkspaceListItem[] => {
  const states = Object.values(V1Beta1WorkspaceState);
  const imageConfigs = [
    {
      id: 'jupyterlab_scipy_190',
      displayName: `jupyter-scipy:v1.9.0`,
      labels: [
        { key: 'pythonVersion', value: '3.12' },
        { key: 'jupyterlabVersion', value: '1.9.0' },
      ],
    },
    {
      id: 'jupyterlab_scipy_200',
      displayName: `jupyter-scipy:v2.0.0`,
      labels: [
        { key: 'pythonVersion', value: '3.12' },
        { key: 'jupyterlabVersion', value: '2.0.0' },
      ],
    },
    {
      id: 'jupyterlab_scipy_210',
      displayName: `jupyter-scipy:v2.1.0`,
      labels: [
        { key: 'pythonVersion', value: '3.13' },
        { key: 'jupyterlabVersion', value: '2.1.0' },
      ],
    },
  ];
  const podConfigs = [
    { id: 'tiny_cpu', displayName: 'Tiny CPU' },
    { id: 'small_cpu', displayName: 'Small CPU' },
    { id: 'medium_cpu', displayName: 'Medium CPU' },
    { id: 'large_cpu', displayName: 'Large CPU' },
  ];

  const workspaces: WorkspacesWorkspaceListItem[] = [];
  for (let i = 1; i <= args.count; i++) {
    const state = args.state || states[(i - 1) % states.length];
    const labels = {
      [`labelKey${i}`]: `labelValue${i}`,
      [`labelKey${i + 1}`]: `labelValue${i + 1}`,
    };
    const annotations = {
      [`annotationKey${i}`]: `annotationValue${i}`,
      [`annotationKey${i + 1}`]: `annotationValue${i + 1}`,
    };
    const activityTime = new Date().getTime() - i * 100000;
    const booleanValue = i % 2 === 0;
    const imageConfig = imageConfigs[i % imageConfigs.length];
    const podConfig = podConfigs[i % podConfigs.length];

    workspaces.push(
      buildMockWorkspace({
        name: `My Notebook ${i}`,
        namespace: args.namespace,
        workspaceKind: args.kind,
        state,
        stateMessage: `Workspace is in ${state} state`,
        paused: state === V1Beta1WorkspaceState.WorkspaceStatePaused,
        pendingRestart: booleanValue,
        podTemplate: {
          podMetadata: { labels, annotations },
          volumes: {
            home: {
              pvcName: `Volume-Home-${i}`,
              mountPath: `/home${i}`,
              readOnly: booleanValue,
            },
            data: [
              {
                pvcName: `Volume-Data1-${i}`,
                mountPath: `/data${i}`,
                readOnly: booleanValue,
              },
              {
                pvcName: `Volume-Data2-${i}`,
                mountPath: `/data${i}`,
                readOnly: booleanValue,
              },
            ],
          },
          options: {
            imageConfig: buildMockImageConfigWithRedirects(i, imageConfig),
            podConfig: buildMockPodConfigWithRedirects(i, podConfig),
          },
        },
        activity: {
          lastActivity: activityTime,
          lastUpdate: activityTime,
        },
      }),
    );
  }
  return workspaces;
};

export const buildMockPodTemplateOptionsMutate = (
  podTemplateOptionsMutate?: Partial<WorkspacesPodTemplateOptionsMutate>,
): WorkspacesPodTemplateOptionsMutate => ({
  imageConfig: 'jupyterlab_scipy_190',
  podConfig: 'tiny_cpu',
  ...podTemplateOptionsMutate,
});

export const buildMockPodMetadataMutate = (
  podMetadataMutate?: Partial<WorkspacesPodMetadataMutate>,
): WorkspacesPodMetadataMutate => ({
  labels: { labelKey1: 'labelValue1', labelKey2: 'labelValue2' },
  annotations: { annotationKey1: 'annotationValue1', annotationKey2: 'annotationValue2' },
  ...podMetadataMutate,
});

export const buildMockPodVolumesMutate = (
  podVolumesMutate?: Partial<WorkspacesPodVolumesMutate>,
): WorkspacesPodVolumesMutate => ({
  data: [
    {
      pvcName: 'Volume-Data1',
      mountPath: '/data',
      readOnly: true,
    },
  ],
  ...podVolumesMutate,
});

export const buildMockPodTemplateMutate = (
  podTemplateMutate?: Partial<WorkspacesPodTemplateMutate>,
): WorkspacesPodTemplateMutate => ({
  options: buildMockPodTemplateOptionsMutate({}),
  podMetadata: buildMockPodMetadataMutate({}),
  volumes: buildMockPodVolumesMutate({}),
  ...podTemplateMutate,
});

export const buildMockWorkspaceCreate = (
  workspaceCreate?: Partial<WorkspacesWorkspaceCreate>,
): WorkspacesWorkspaceCreate => ({
  kind: 'jupyterlab',
  name: 'My Notebook',
  paused: false,
  podTemplate: buildMockPodTemplateMutate({}),
  ...workspaceCreate,
});

export const buildMockWorkspaceUpdate = (
  workspaceUpdate?: Partial<WorkspacesWorkspaceUpdate>,
): WorkspacesWorkspaceUpdate => ({
  paused: false,
  podTemplate: buildMockPodTemplateMutate({}),
  revision: '1234567890',
  ...workspaceUpdate,
});

export const buildMockWorkspaceUpdateFromWorkspace = (args: {
  workspace?: Partial<WorkspacesWorkspaceListItem>;
  workspaceUpdate?: Partial<WorkspacesWorkspaceUpdate>;
}): WorkspacesWorkspaceUpdate => ({
  paused: args.workspace?.paused ?? false,
  podTemplate: buildMockPodTemplateMutate({
    options: buildMockPodTemplateOptionsMutate({
      imageConfig: args.workspace?.podTemplate?.options.imageConfig.current.id ?? '',
      podConfig: args.workspace?.podTemplate?.options.podConfig.current.id ?? '',
    }),
    podMetadata: buildMockPodMetadataMutate({
      labels: args.workspace?.podTemplate?.podMetadata.labels,
      annotations: args.workspace?.podTemplate?.podMetadata.annotations,
    }),
    volumes: buildMockPodVolumesMutate({
      home: args.workspace?.podTemplate?.volumes.home?.mountPath ?? '',
      data: args.workspace?.podTemplate?.volumes.data.map((d) => ({
        pvcName: d.pvcName,
        mountPath: d.mountPath,
        readOnly: d.readOnly,
      })),
      secrets: args.workspace?.podTemplate?.volumes.secrets?.map((s) => ({
        defaultMode: s.defaultMode,
        mountPath: s.mountPath,
        secretName: s.secretName,
      })),
    }),
  }),
  revision: args.workspaceUpdate?.revision ?? '1234567890',
  ...args.workspaceUpdate,
});

export const buildMockSecret = (
  secret?: Partial<SecretsSecretListItem>,
): SecretsSecretListItem => ({
  name: 'secret-1',
  type: 'Opaque',
  immutable: false,
  canMount: true,
  canUpdate: true,
  audit: {
    createdAt: new Date(2025, 4, 1).toISOString(),
    createdBy: 'admin1',
    updatedAt: new Date(2025, 4, 1).toISOString(),
    deletedAt: '',
    updatedBy: 'user1',
  },
  ...secret,
});

export const buildMockStorageClass = (
  storageClass?: Partial<StorageclassesStorageClassListItem>,
): StorageclassesStorageClassListItem => ({
  name: 'standard',
  displayName: 'Standard',
  description: 'Standard storage class',
  canUse: true,
  ...storageClass,
});

export const buildMockPVC = (pvc?: Partial<PvcsPVCListItem>): PvcsPVCListItem => ({
  name: 'my-pvc',
  canMount: true,
  canUpdate: true,
  pods: [],
  workspaces: [],
  pvcSpec: {
    accessModes: [V1PersistentVolumeAccessMode.ReadWriteOnce],
    requests: { storage: '10Gi' },
    storageClassName: 'standard',
    volumeMode: V1PersistentVolumeMode.PersistentVolumeFilesystem,
  },
  audit: {
    createdAt: new Date(2025, 4, 1).toISOString(),
    createdBy: 'admin1',
    updatedAt: new Date(2025, 4, 1).toISOString(),
    deletedAt: '',
    updatedBy: 'user1',
  },
  ...pvc,
});

export const buildMockPVCCreate = (pvc?: Partial<PvcsPVCCreate>): PvcsPVCCreate => ({
  name: 'my-pvc',
  accessModes: [V1PersistentVolumeAccessMode.ReadWriteOnce],
  requests: { storage: '10Gi' },
  storageClassName: 'standard',
  ...pvc,
});
