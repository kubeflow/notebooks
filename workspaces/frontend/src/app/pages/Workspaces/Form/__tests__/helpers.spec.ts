import {
  isPVCMountBlocked,
  getBlockedMountTooltip,
  buildPVCSelectOptions,
} from '~/app/pages/Workspaces/Form/helpers';
import { buildMockPVC, buildMockStorageClass } from '~/shared/mock/mockBuilder';
import {
  PvcsPVCSpec,
  PvcsWorkspaceInfo,
  V1Beta1WorkspaceState,
  V1PersistentVolumeAccessMode,
  V1PersistentVolumeMode,
  V1PodPhase,
} from '~/generated/data-contracts';

const CURRENT_WORKSPACE = 'current-workspace';
const OTHER_WORKSPACE = 'other-workspace';

const buildSpec = (accessMode: V1PersistentVolumeAccessMode): PvcsPVCSpec => ({
  accessModes: [accessMode],
  requests: { storage: '1Gi' },
  storageClassName: 'standard',
  volumeMode: V1PersistentVolumeMode.PersistentVolumeFilesystem,
});

const buildWorkspaceInfo = (name: string, podName?: string): PvcsWorkspaceInfo => ({
  name,
  state: V1Beta1WorkspaceState.WorkspaceStateRunning,
  stateMessage: '',
  ...(podName ? { podTemplatePod: { name: podName } } : {}),
});

const CURRENT_POD = `${CURRENT_WORKSPACE}-0`;

describe('isPVCMountBlocked', () => {
  it('is not blocked when the PVC has no pods or workspaces', () => {
    const pvc = buildMockPVC({
      pvcSpec: buildSpec(V1PersistentVolumeAccessMode.ReadWriteOnce),
      pods: [],
      workspaces: [],
    });
    expect(isPVCMountBlocked(pvc)).toBe(false);
  });

  it('blocks a ReadWriteOnce PVC already mounted by another workspace', () => {
    const pvc = buildMockPVC({
      pvcSpec: buildSpec(V1PersistentVolumeAccessMode.ReadWriteOnce),
      pods: [],
      workspaces: [buildWorkspaceInfo(OTHER_WORKSPACE)],
    });
    expect(isPVCMountBlocked(pvc)).toBe(true);
    expect(isPVCMountBlocked(pvc, CURRENT_WORKSPACE)).toBe(true);
  });

  it('does not block a ReadWriteOnce PVC mounted only by the current workspace', () => {
    const pvc = buildMockPVC({
      pvcSpec: buildSpec(V1PersistentVolumeAccessMode.ReadWriteOnce),
      pods: [],
      workspaces: [buildWorkspaceInfo(CURRENT_WORKSPACE)],
    });
    expect(isPVCMountBlocked(pvc, CURRENT_WORKSPACE)).toBe(false);
  });

  it('blocks when mounted by the current workspace AND another workspace', () => {
    const pvc = buildMockPVC({
      pvcSpec: buildSpec(V1PersistentVolumeAccessMode.ReadWriteOnce),
      pods: [],
      workspaces: [buildWorkspaceInfo(CURRENT_WORKSPACE), buildWorkspaceInfo(OTHER_WORKSPACE)],
    });
    expect(isPVCMountBlocked(pvc, CURRENT_WORKSPACE)).toBe(true);
  });

  it('blocks a ReadWriteOncePod PVC already mounted by a pod', () => {
    const pvc = buildMockPVC({
      pvcSpec: buildSpec(V1PersistentVolumeAccessMode.ReadWriteOncePod),
      pods: [{ name: 'some-pod', phase: V1PodPhase.PodRunning }],
      workspaces: [],
    });
    expect(isPVCMountBlocked(pvc)).toBe(true);
  });

  it('blocks a ReadWriteOncePod PVC already mounted by another workspace', () => {
    const pvc = buildMockPVC({
      pvcSpec: buildSpec(V1PersistentVolumeAccessMode.ReadWriteOncePod),
      pods: [],
      workspaces: [buildWorkspaceInfo(OTHER_WORKSPACE)],
    });
    expect(isPVCMountBlocked(pvc, CURRENT_WORKSPACE)).toBe(true);
  });

  it('does not block a ReadWriteOncePod PVC mounted only by the current workspace', () => {
    const pvc = buildMockPVC({
      pvcSpec: buildSpec(V1PersistentVolumeAccessMode.ReadWriteOncePod),
      pods: [],
      workspaces: [buildWorkspaceInfo(CURRENT_WORKSPACE)],
    });
    expect(isPVCMountBlocked(pvc, CURRENT_WORKSPACE)).toBe(false);
  });

  it('does not block a ReadWriteOncePod PVC whose only pod belongs to the current workspace', () => {
    const pvc = buildMockPVC({
      pvcSpec: buildSpec(V1PersistentVolumeAccessMode.ReadWriteOncePod),
      pods: [{ name: CURRENT_POD, phase: V1PodPhase.PodRunning }],
      workspaces: [buildWorkspaceInfo(CURRENT_WORKSPACE, CURRENT_POD)],
    });
    expect(isPVCMountBlocked(pvc, CURRENT_WORKSPACE)).toBe(false);
    expect(isPVCMountBlocked(pvc)).toBe(true);
  });

  it('blocks a ReadWriteOncePod PVC used by another pod, even if the current workspace references it', () => {
    const pvc = buildMockPVC({
      pvcSpec: buildSpec(V1PersistentVolumeAccessMode.ReadWriteOncePod),
      pods: [{ name: 'other-pod', phase: V1PodPhase.PodRunning }],
      workspaces: [buildWorkspaceInfo(CURRENT_WORKSPACE, CURRENT_POD)],
    });
    expect(isPVCMountBlocked(pvc, CURRENT_WORKSPACE)).toBe(true);
  });

  it('blocks a ReadWriteOncePod PVC when both the current workspace pod and an unrelated pod are present', () => {
    const pvc = buildMockPVC({
      pvcSpec: buildSpec(V1PersistentVolumeAccessMode.ReadWriteOncePod),
      pods: [
        { name: CURRENT_POD, phase: V1PodPhase.PodRunning },
        { name: 'other-pod', phase: V1PodPhase.PodRunning },
      ],
      workspaces: [buildWorkspaceInfo(CURRENT_WORKSPACE, CURRENT_POD)],
    });
    expect(isPVCMountBlocked(pvc, CURRENT_WORKSPACE)).toBe(true);
  });

  it('blocks a ReadWriteOncePod PVC with a pod when the current workspace has no pod of its own', () => {
    const pvc = buildMockPVC({
      pvcSpec: buildSpec(V1PersistentVolumeAccessMode.ReadWriteOncePod),
      pods: [{ name: CURRENT_POD, phase: V1PodPhase.PodRunning }],
      workspaces: [buildWorkspaceInfo(CURRENT_WORKSPACE)],
    });
    expect(isPVCMountBlocked(pvc, CURRENT_WORKSPACE)).toBe(true);
  });

  it('blocks a ReadWriteOncePod PVC referenced by another workspace, even with only our own pod', () => {
    const pvc = buildMockPVC({
      pvcSpec: buildSpec(V1PersistentVolumeAccessMode.ReadWriteOncePod),
      pods: [{ name: CURRENT_POD, phase: V1PodPhase.PodRunning }],
      workspaces: [
        buildWorkspaceInfo(CURRENT_WORKSPACE, CURRENT_POD),
        buildWorkspaceInfo(OTHER_WORKSPACE),
      ],
    });
    expect(isPVCMountBlocked(pvc, CURRENT_WORKSPACE)).toBe(true);
  });

  it('does not block a ReadWriteOnce PVC mounted only by a non-workspace pod', () => {
    const pvc = buildMockPVC({
      pvcSpec: buildSpec(V1PersistentVolumeAccessMode.ReadWriteOnce),
      pods: [{ name: 'some-pod', phase: V1PodPhase.PodRunning }],
      workspaces: [],
    });
    expect(isPVCMountBlocked(pvc, CURRENT_WORKSPACE)).toBe(false);
  });

  it('never blocks a ReadWriteMany PVC, no matter who mounts it', () => {
    const pvc = buildMockPVC({
      pvcSpec: buildSpec(V1PersistentVolumeAccessMode.ReadWriteMany),
      pods: [{ name: 'some-pod', phase: V1PodPhase.PodRunning }],
      workspaces: [buildWorkspaceInfo(OTHER_WORKSPACE)],
    });
    expect(isPVCMountBlocked(pvc)).toBe(false);
  });

  it('never blocks a ReadOnlyMany PVC, no matter who mounts it', () => {
    const pvc = buildMockPVC({
      pvcSpec: buildSpec(V1PersistentVolumeAccessMode.ReadOnlyMany),
      pods: [{ name: 'some-pod', phase: V1PodPhase.PodRunning }],
      workspaces: [buildWorkspaceInfo(OTHER_WORKSPACE)],
    });
    expect(isPVCMountBlocked(pvc)).toBe(false);
  });
});

describe('getBlockedMountTooltip', () => {
  it('returns null when the PVC is not blocked', () => {
    const pvc = buildMockPVC({ pods: [], workspaces: [] });
    expect(getBlockedMountTooltip(pvc)).toBeNull();
  });

  it('returns an explanatory message when blocked', () => {
    const pvc = buildMockPVC({
      pvcSpec: buildSpec(V1PersistentVolumeAccessMode.ReadWriteOnce),
      pods: [],
      workspaces: [buildWorkspaceInfo(OTHER_WORKSPACE)],
    });
    expect(getBlockedMountTooltip(pvc)).toMatch(/ReadWriteOnce/);
  });

  it('returns null when the only mount is the current workspace itself', () => {
    const pvc = buildMockPVC({
      pvcSpec: buildSpec(V1PersistentVolumeAccessMode.ReadWriteOnce),
      pods: [],
      workspaces: [buildWorkspaceInfo(CURRENT_WORKSPACE)],
    });
    expect(getBlockedMountTooltip(pvc, CURRENT_WORKSPACE)).toBeNull();
  });

  it('includes the conflicting workspace name for a blocked ReadWriteOnce PVC', () => {
    const pvc = buildMockPVC({
      pvcSpec: buildSpec(V1PersistentVolumeAccessMode.ReadWriteOnce),
      pods: [],
      workspaces: [buildWorkspaceInfo(OTHER_WORKSPACE)],
    });
    expect(getBlockedMountTooltip(pvc, CURRENT_WORKSPACE)).toBe(
      `This volume uses ReadWriteOnce access and is already mounted by workspace "${OTHER_WORKSPACE}".`,
    );
  });

  it('includes the conflicting workspace name for a ReadWriteOncePod PVC blocked by another workspace', () => {
    const pvc = buildMockPVC({
      pvcSpec: buildSpec(V1PersistentVolumeAccessMode.ReadWriteOncePod),
      pods: [{ name: CURRENT_POD, phase: V1PodPhase.PodRunning }],
      workspaces: [
        buildWorkspaceInfo(CURRENT_WORKSPACE, CURRENT_POD),
        buildWorkspaceInfo(OTHER_WORKSPACE),
      ],
    });
    expect(getBlockedMountTooltip(pvc, CURRENT_WORKSPACE)).toBe(
      `This volume uses ReadWriteOncePod access and is already mounted by workspace "${OTHER_WORKSPACE}".`,
    );
  });

  it('includes the conflicting pod name for a ReadWriteOncePod PVC blocked only by an unrelated pod', () => {
    const pvc = buildMockPVC({
      pvcSpec: buildSpec(V1PersistentVolumeAccessMode.ReadWriteOncePod),
      pods: [{ name: 'other-pod', phase: V1PodPhase.PodRunning }],
      workspaces: [],
    });
    expect(getBlockedMountTooltip(pvc, CURRENT_WORKSPACE)).toBe(
      'This volume uses ReadWriteOncePod access and is already mounted by pod "other-pod".',
    );
  });

  it('falls back to a generic message for ReadWriteOnce when the conflicting workspace has no name', () => {
    const pvc = buildMockPVC({
      pvcSpec: buildSpec(V1PersistentVolumeAccessMode.ReadWriteOnce),
      pods: [],
      workspaces: [buildWorkspaceInfo('')],
    });
    expect(getBlockedMountTooltip(pvc, CURRENT_WORKSPACE)).toBe(
      'This volume uses ReadWriteOnce access and is already mounted by another workspace.',
    );
  });

  it('falls back to a generic message for ReadWriteOncePod when neither workspace nor pod name is available', () => {
    const pvc = buildMockPVC({
      pvcSpec: buildSpec(V1PersistentVolumeAccessMode.ReadWriteOncePod),
      pods: [{ name: '', phase: V1PodPhase.PodRunning }],
      workspaces: [],
    });
    expect(getBlockedMountTooltip(pvc, CURRENT_WORKSPACE)).toBe(
      'This volume uses ReadWriteOncePod access and is already mounted by another pod or workspace.',
    );
  });
});

describe('buildPVCSelectOptions blocking behavior', () => {
  const storageClasses = [buildMockStorageClass({ name: 'standard', canUse: true })];

  it('disables (soft) a blocked PVC option with an explanatory tooltip', () => {
    const blockedPvc = buildMockPVC({
      name: 'blocked-pvc',
      pvcSpec: buildSpec(V1PersistentVolumeAccessMode.ReadWriteOnce),
      pods: [],
      workspaces: [buildWorkspaceInfo(OTHER_WORKSPACE)],
    });

    const options = buildPVCSelectOptions(
      [blockedPvc],
      storageClasses,
      undefined,
      undefined,
      CURRENT_WORKSPACE,
    );
    const option = options.find((o) => o.value === 'blocked-pvc');
    expect(option).toBeDefined();
    expect(option?.isAriaDisabled).toBe(true);
    expect(option?.tooltipProps?.content).toMatch(/ReadWriteOnce/);
  });

  it('does not disable a PVC mounted only by the current workspace', () => {
    const selfPvc = buildMockPVC({
      name: 'self-pvc',
      pvcSpec: buildSpec(V1PersistentVolumeAccessMode.ReadWriteOnce),
      pods: [],
      workspaces: [buildWorkspaceInfo(CURRENT_WORKSPACE)],
    });

    const options = buildPVCSelectOptions(
      [selfPvc],
      storageClasses,
      undefined,
      undefined,
      CURRENT_WORKSPACE,
    );
    const option = options.find((o) => o.value === 'self-pvc');
    expect(option?.isDisabled).toBeFalsy();
    expect(option?.isAriaDisabled).toBeFalsy();
  });

  it('never disables a ReadWriteMany PVC due to being mounted elsewhere', () => {
    const sharedPvc = buildMockPVC({
      name: 'shared-pvc',
      pvcSpec: buildSpec(V1PersistentVolumeAccessMode.ReadWriteMany),
      pods: [],
      workspaces: [buildWorkspaceInfo(OTHER_WORKSPACE)],
    });

    const options = buildPVCSelectOptions(
      [sharedPvc],
      storageClasses,
      undefined,
      undefined,
      CURRENT_WORKSPACE,
    );
    const option = options.find((o) => o.value === 'shared-pvc');
    expect(option?.isDisabled).toBeFalsy();
    expect(option?.isAriaDisabled).toBeFalsy();
  });

  it('preserves existing "Already mounted" exclusion behavior independent of blocking', () => {
    const excludedPvc = buildMockPVC({
      name: 'excluded-pvc',
      pvcSpec: buildSpec(V1PersistentVolumeAccessMode.ReadWriteMany),
      pods: [],
      workspaces: [],
    });

    const options = buildPVCSelectOptions(
      [excludedPvc],
      storageClasses,
      new Set(['excluded-pvc']),
      undefined,
      CURRENT_WORKSPACE,
    );
    const option = options.find((o) => o.value === 'excluded-pvc');
    expect(option?.isDisabled).toBe(true);
  });

  it('hard-disables an excluded PVC without the blocked tooltip, even if it is also blocked', () => {
    const excludedBlockedPvc = buildMockPVC({
      name: 'excluded-blocked-pvc',
      pvcSpec: buildSpec(V1PersistentVolumeAccessMode.ReadWriteOnce),
      pods: [],
      workspaces: [buildWorkspaceInfo(OTHER_WORKSPACE)],
    });

    const options = buildPVCSelectOptions(
      [excludedBlockedPvc],
      storageClasses,
      new Set(['excluded-blocked-pvc']),
      undefined,
      CURRENT_WORKSPACE,
    );
    const option = options.find((o) => o.value === 'excluded-blocked-pvc');
    expect(option?.isDisabled).toBe(true);
    expect(option?.isAriaDisabled).toBe(false);
    expect(option?.tooltipProps).toBeUndefined();
  });

  it('preserves existing canMount=false (unmountable) behavior independent of blocking', () => {
    const unmountablePvc = buildMockPVC({
      name: 'unmountable-pvc',
      canMount: false,
      pvcSpec: buildSpec(V1PersistentVolumeAccessMode.ReadWriteMany),
      pods: [],
      workspaces: [],
    });

    const options = buildPVCSelectOptions(
      [unmountablePvc],
      storageClasses,
      undefined,
      undefined,
      CURRENT_WORKSPACE,
    );
    const option = options.find((o) => o.value === 'unmountable-pvc');
    expect(option?.isDisabled).toBe(true);
  });
});
