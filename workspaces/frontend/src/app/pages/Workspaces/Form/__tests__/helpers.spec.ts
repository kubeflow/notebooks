import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  isPVCMountBlocked,
  getBlockedMountTooltip,
  getRWOInUseWarning,
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

const buildSpec = (...accessModes: V1PersistentVolumeAccessMode[]): PvcsPVCSpec => ({
  accessModes,
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

  it('does not block a ReadWriteOnce PVC already mounted by another workspace', () => {
    const pvc = buildMockPVC({
      pvcSpec: buildSpec(V1PersistentVolumeAccessMode.ReadWriteOnce),
      pods: [],
      workspaces: [buildWorkspaceInfo(OTHER_WORKSPACE)],
    });
    expect(isPVCMountBlocked(pvc)).toBe(false);
    expect(isPVCMountBlocked(pvc, CURRENT_WORKSPACE)).toBe(false);
  });

  it('does not block a ReadWriteOnce PVC mounted only by the current workspace', () => {
    const pvc = buildMockPVC({
      pvcSpec: buildSpec(V1PersistentVolumeAccessMode.ReadWriteOnce),
      pods: [],
      workspaces: [buildWorkspaceInfo(CURRENT_WORKSPACE)],
    });
    expect(isPVCMountBlocked(pvc, CURRENT_WORKSPACE)).toBe(false);
  });

  it('does not block a ReadWriteOnce PVC mounted by the current workspace AND another workspace', () => {
    const pvc = buildMockPVC({
      pvcSpec: buildSpec(V1PersistentVolumeAccessMode.ReadWriteOnce),
      pods: [],
      workspaces: [buildWorkspaceInfo(CURRENT_WORKSPACE), buildWorkspaceInfo(OTHER_WORKSPACE)],
    });
    expect(isPVCMountBlocked(pvc, CURRENT_WORKSPACE)).toBe(false);
  });

  it('blocks a ReadWriteOncePod PVC already mounted by an active pod', () => {
    const pvc = buildMockPVC({
      pvcSpec: buildSpec(V1PersistentVolumeAccessMode.ReadWriteOncePod),
      pods: [{ name: 'some-pod', phase: V1PodPhase.PodRunning }],
      workspaces: [],
    });
    expect(isPVCMountBlocked(pvc)).toBe(true);
  });

  it('does not block a ReadWriteOncePod PVC whose only pod has Succeeded', () => {
    const pvc = buildMockPVC({
      pvcSpec: buildSpec(V1PersistentVolumeAccessMode.ReadWriteOncePod),
      pods: [{ name: 'completed-pod', phase: V1PodPhase.PodSucceeded }],
      workspaces: [],
    });
    expect(isPVCMountBlocked(pvc, CURRENT_WORKSPACE)).toBe(false);
  });

  it('does not block a ReadWriteOncePod PVC whose only pod has Failed', () => {
    const pvc = buildMockPVC({
      pvcSpec: buildSpec(V1PersistentVolumeAccessMode.ReadWriteOncePod),
      pods: [{ name: 'failed-pod', phase: V1PodPhase.PodFailed }],
      workspaces: [],
    });
    expect(isPVCMountBlocked(pvc, CURRENT_WORKSPACE)).toBe(false);
  });

  it('blocks a ReadWriteOncePod PVC when both a terminal pod and an active pod are present', () => {
    const pvc = buildMockPVC({
      pvcSpec: buildSpec(V1PersistentVolumeAccessMode.ReadWriteOncePod),
      pods: [
        { name: 'done-pod', phase: V1PodPhase.PodSucceeded },
        { name: 'active-pod', phase: V1PodPhase.PodRunning },
      ],
      workspaces: [],
    });
    expect(isPVCMountBlocked(pvc, CURRENT_WORKSPACE)).toBe(true);
  });

  it('conservatively blocks a ReadWriteOncePod PVC whose pod phase is Unknown', () => {
    const pvc = buildMockPVC({
      pvcSpec: buildSpec(V1PersistentVolumeAccessMode.ReadWriteOncePod),
      pods: [{ name: 'unknown-pod', phase: V1PodPhase.PodUnknown }],
      workspaces: [],
    });
    expect(isPVCMountBlocked(pvc, CURRENT_WORKSPACE)).toBe(true);
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

  describe('mixed access modes', () => {
    it('does not block [ReadWriteOnce, ReadWriteMany] mounted by another workspace', () => {
      const pvc = buildMockPVC({
        pvcSpec: buildSpec(
          V1PersistentVolumeAccessMode.ReadWriteOnce,
          V1PersistentVolumeAccessMode.ReadWriteMany,
        ),
        pods: [],
        workspaces: [buildWorkspaceInfo(OTHER_WORKSPACE)],
      });
      expect(isPVCMountBlocked(pvc, CURRENT_WORKSPACE)).toBe(false);
      expect(getBlockedMountTooltip(pvc, CURRENT_WORKSPACE)).toBeNull();
    });

    it('does not block [ReadWriteOnce, ReadOnlyMany] mounted by another workspace', () => {
      const pvc = buildMockPVC({
        pvcSpec: buildSpec(
          V1PersistentVolumeAccessMode.ReadWriteOnce,
          V1PersistentVolumeAccessMode.ReadOnlyMany,
        ),
        pods: [],
        workspaces: [buildWorkspaceInfo(OTHER_WORKSPACE)],
      });
      expect(isPVCMountBlocked(pvc, CURRENT_WORKSPACE)).toBe(false);
      expect(getBlockedMountTooltip(pvc, CURRENT_WORKSPACE)).toBeNull();
    });

    it('does not block a plain [ReadWriteOnce] PVC mounted by another workspace', () => {
      const pvc = buildMockPVC({
        pvcSpec: buildSpec(V1PersistentVolumeAccessMode.ReadWriteOnce),
        pods: [],
        workspaces: [buildWorkspaceInfo(OTHER_WORKSPACE)],
      });
      expect(isPVCMountBlocked(pvc, CURRENT_WORKSPACE)).toBe(false);
      expect(getBlockedMountTooltip(pvc, CURRENT_WORKSPACE)).toBeNull();
    });

    it('blocks a [ReadWriteOncePod, ReadWriteOnce] PVC mounted by another workspace', () => {
      const pvc = buildMockPVC({
        pvcSpec: buildSpec(
          V1PersistentVolumeAccessMode.ReadWriteOncePod,
          V1PersistentVolumeAccessMode.ReadWriteOnce,
        ),
        pods: [],
        workspaces: [buildWorkspaceInfo(OTHER_WORKSPACE)],
      });
      expect(isPVCMountBlocked(pvc, CURRENT_WORKSPACE)).toBe(true);
    });

    it('still blocks a plain [ReadWriteOncePod] PVC mounted by another pod or workspace', () => {
      const podPvc = buildMockPVC({
        pvcSpec: buildSpec(V1PersistentVolumeAccessMode.ReadWriteOncePod),
        pods: [{ name: 'other-pod', phase: V1PodPhase.PodRunning }],
        workspaces: [],
      });
      const workspacePvc = buildMockPVC({
        pvcSpec: buildSpec(V1PersistentVolumeAccessMode.ReadWriteOncePod),
        pods: [],
        workspaces: [buildWorkspaceInfo(OTHER_WORKSPACE)],
      });
      expect(isPVCMountBlocked(podPvc, CURRENT_WORKSPACE)).toBe(true);
      expect(isPVCMountBlocked(workspacePvc, CURRENT_WORKSPACE)).toBe(true);
    });
  });
});

describe('getBlockedMountTooltip', () => {
  it('returns null when the PVC is not blocked', () => {
    const pvc = buildMockPVC({ pods: [], workspaces: [] });
    expect(getBlockedMountTooltip(pvc)).toBeNull();
  });

  it('returns an explanatory message for a blocked ReadWriteOncePod PVC', () => {
    const pvc = buildMockPVC({
      pvcSpec: buildSpec(V1PersistentVolumeAccessMode.ReadWriteOncePod),
      pods: [],
      workspaces: [buildWorkspaceInfo(OTHER_WORKSPACE)],
    });
    expect(getBlockedMountTooltip(pvc)).toMatch(/ReadWriteOncePod/);
  });

  it('returns null for an in-use ReadWriteOnce PVC (RWO is not blocked)', () => {
    const pvc = buildMockPVC({
      pvcSpec: buildSpec(V1PersistentVolumeAccessMode.ReadWriteOnce),
      pods: [],
      workspaces: [buildWorkspaceInfo(OTHER_WORKSPACE)],
    });
    expect(getBlockedMountTooltip(pvc, CURRENT_WORKSPACE)).toBeNull();
  });

  it('returns null when the only RWOP mount is the current workspace itself', () => {
    const pvc = buildMockPVC({
      pvcSpec: buildSpec(V1PersistentVolumeAccessMode.ReadWriteOncePod),
      pods: [],
      workspaces: [buildWorkspaceInfo(CURRENT_WORKSPACE)],
    });
    expect(getBlockedMountTooltip(pvc, CURRENT_WORKSPACE)).toBeNull();
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

  it('returns null for a ReadWriteOnce PVC even when the conflicting workspace has no name', () => {
    const pvc = buildMockPVC({
      pvcSpec: buildSpec(V1PersistentVolumeAccessMode.ReadWriteOnce),
      pods: [],
      workspaces: [buildWorkspaceInfo('')],
    });
    expect(getBlockedMountTooltip(pvc, CURRENT_WORKSPACE)).toBeNull();
  });

  it('ignores terminal pods and identifies the active conflicting pod in the tooltip', () => {
    const pvc = buildMockPVC({
      pvcSpec: buildSpec(V1PersistentVolumeAccessMode.ReadWriteOncePod),
      pods: [
        { name: 'done-pod', phase: V1PodPhase.PodSucceeded },
        { name: 'active-pod', phase: V1PodPhase.PodRunning },
      ],
      workspaces: [],
    });
    expect(getBlockedMountTooltip(pvc, CURRENT_WORKSPACE)).toBe(
      'This volume uses ReadWriteOncePod access and is already mounted by pod "active-pod".',
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

describe('getRWOInUseWarning', () => {
  it('returns null when the PVC has no ReadWriteOnce access mode', () => {
    const pvc = buildMockPVC({
      pvcSpec: buildSpec(V1PersistentVolumeAccessMode.ReadWriteMany),
      pods: [],
      workspaces: [buildWorkspaceInfo(OTHER_WORKSPACE)],
    });
    expect(getRWOInUseWarning(pvc, CURRENT_WORKSPACE)).toBeNull();
  });

  it('returns null when the RWO PVC is not in use by others', () => {
    const pvc = buildMockPVC({
      pvcSpec: buildSpec(V1PersistentVolumeAccessMode.ReadWriteOnce),
      pods: [],
      workspaces: [buildWorkspaceInfo(CURRENT_WORKSPACE)],
    });
    expect(getRWOInUseWarning(pvc, CURRENT_WORKSPACE)).toBeNull();
  });

  it('returns null when the RWO PVC has no mounts at all', () => {
    const pvc = buildMockPVC({
      pvcSpec: buildSpec(V1PersistentVolumeAccessMode.ReadWriteOnce),
      pods: [],
      workspaces: [],
    });
    expect(getRWOInUseWarning(pvc, CURRENT_WORKSPACE)).toBeNull();
  });

  it('returns a node-scope warning when RWO PVC is mounted by another workspace', () => {
    const pvc = buildMockPVC({
      pvcSpec: buildSpec(V1PersistentVolumeAccessMode.ReadWriteOnce),
      pods: [],
      workspaces: [buildWorkspaceInfo(OTHER_WORKSPACE)],
    });
    const warning = getRWOInUseWarning(pvc, CURRENT_WORKSPACE);
    expect(warning).not.toBeNull();
    expect(warning).toMatch(/single node/i);
  });

  it('returns a node-scope warning when RWO PVC is mounted by an unrelated pod', () => {
    const pvc = buildMockPVC({
      pvcSpec: buildSpec(V1PersistentVolumeAccessMode.ReadWriteOnce),
      pods: [{ name: 'other-pod', phase: V1PodPhase.PodRunning }],
      workspaces: [],
    });
    const warning = getRWOInUseWarning(pvc, CURRENT_WORKSPACE);
    expect(warning).not.toBeNull();
    expect(warning).toMatch(/single node/i);
  });

  it('mentions that Pods on different nodes may not mount it simultaneously', () => {
    const pvc = buildMockPVC({
      pvcSpec: buildSpec(V1PersistentVolumeAccessMode.ReadWriteOnce),
      pods: [],
      workspaces: [buildWorkspaceInfo(OTHER_WORKSPACE)],
    });
    const warning = getRWOInUseWarning(pvc, CURRENT_WORKSPACE);
    expect(warning).toMatch(/different nodes/i);
  });

  it('returns null for RWOP PVCs (only RWOP blocking applies, not the RWO warning)', () => {
    const pvc = buildMockPVC({
      pvcSpec: buildSpec(V1PersistentVolumeAccessMode.ReadWriteOncePod),
      pods: [],
      workspaces: [buildWorkspaceInfo(OTHER_WORKSPACE)],
    });
    expect(getRWOInUseWarning(pvc, CURRENT_WORKSPACE)).toBeNull();
  });

  it('returns a warning for a mixed [ReadWriteOnce, ReadWriteMany] PVC in use', () => {
    const pvc = buildMockPVC({
      pvcSpec: buildSpec(
        V1PersistentVolumeAccessMode.ReadWriteOnce,
        V1PersistentVolumeAccessMode.ReadWriteMany,
      ),
      pods: [],
      workspaces: [buildWorkspaceInfo(OTHER_WORKSPACE)],
    });
    expect(getRWOInUseWarning(pvc, CURRENT_WORKSPACE)).not.toBeNull();
  });
});

describe('buildPVCSelectOptions blocking behavior', () => {
  const storageClasses = [buildMockStorageClass({ name: 'standard', canUse: true })];

  it('disables (soft) a blocked RWOP PVC option with an explanatory tooltip', () => {
    const blockedPvc = buildMockPVC({
      name: 'blocked-pvc',
      pvcSpec: buildSpec(V1PersistentVolumeAccessMode.ReadWriteOncePod),
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
    render(React.createElement(React.Fragment, null, option?.tooltipProps?.content));
    expect(screen.getByTestId('pvc-option-tooltip-blocked-pvc')).toHaveTextContent(
      `This volume uses ReadWriteOncePod access and is already mounted by workspace "${OTHER_WORKSPACE}".`,
    );
  });

  it('does not disable an in-use ReadWriteOnce PVC option (RWO is selectable)', () => {
    const rwoPvc = buildMockPVC({
      name: 'rwo-in-use-pvc',
      pvcSpec: buildSpec(V1PersistentVolumeAccessMode.ReadWriteOnce),
      pods: [],
      workspaces: [buildWorkspaceInfo(OTHER_WORKSPACE)],
    });

    const options = buildPVCSelectOptions(
      [rwoPvc],
      storageClasses,
      undefined,
      undefined,
      CURRENT_WORKSPACE,
    );
    const option = options.find((o) => o.value === 'rwo-in-use-pvc');
    expect(option?.isDisabled).toBeFalsy();
    expect(option?.isAriaDisabled).toBeFalsy();
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

  it('does not disable or add a blocked tooltip to a mixed RWO/RWX PVC mounted elsewhere', () => {
    const mixedPvc = buildMockPVC({
      name: 'mixed-pvc',
      pvcSpec: buildSpec(
        V1PersistentVolumeAccessMode.ReadWriteOnce,
        V1PersistentVolumeAccessMode.ReadWriteMany,
      ),
      pods: [],
      workspaces: [buildWorkspaceInfo(OTHER_WORKSPACE)],
    });

    const options = buildPVCSelectOptions(
      [mixedPvc],
      storageClasses,
      undefined,
      undefined,
      CURRENT_WORKSPACE,
    );
    const option = options.find((o) => o.value === 'mixed-pvc');
    expect(option?.isDisabled).toBeFalsy();
    expect(option?.isAriaDisabled).toBeFalsy();
    expect(option?.tooltipProps).toBeUndefined();
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

  it('hard-disables an excluded PVC without the blocked tooltip, even if it is also RWOP-blocked', () => {
    const excludedBlockedPvc = buildMockPVC({
      name: 'excluded-blocked-pvc',
      pvcSpec: buildSpec(V1PersistentVolumeAccessMode.ReadWriteOncePod),
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
