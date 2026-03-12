import React from 'react';
import { Label, LabelGroup } from '@patternfly/react-core/dist/esm/components/Label';
import { Flex, FlexItem } from '@patternfly/react-core/dist/esm/layouts/Flex';
import { Stack, StackItem } from '@patternfly/react-core/dist/esm/layouts/Stack';
import { Tooltip } from '@patternfly/react-core/dist/esm/components/Tooltip';
import { InfoCircleIcon } from '@patternfly/react-icons/dist/esm/icons/info-circle-icon';
import { CubeIcon } from '@patternfly/react-icons/dist/esm/icons/cube-icon';
import { TypeaheadSelectOption } from '@patternfly/react-templates';
import {
  PvcsPVCListItem,
  StorageclassesStorageClassListItem,
  V1PersistentVolumeAccessMode,
} from '~/generated/data-contracts';
import { LabelGroupWithTooltip } from '~/app/components/LabelGroupWithTooltip';

// 420 decimal = 0644 octal (standard file permissions)
export const DEFAULT_MODE = 420;
export const DEFAULT_MODE_OCTAL = DEFAULT_MODE.toString(8);

const MOUNT_PATH_MIN_LENGTH = 2;
const MOUNT_PATH_MAX_LENGTH = 4096;
const MOUNT_PATH_REGEX = /^\/[^/].*$/;

/** Normalize for comparison: trim and remove trailing slashes so /foo and /foo/ match. */
export const normalizeMountPath = (path: string): string => path.trim().replace(/\/+$/, '');

export const validateMountPath = (path: string): string | null => {
  const trimmed = path.trim();
  if (!trimmed) {
    return 'Mount path is required';
  }
  if (trimmed.length < MOUNT_PATH_MIN_LENGTH) {
    return `Mount path must be at least ${MOUNT_PATH_MIN_LENGTH} characters`;
  }
  if (trimmed.length > MOUNT_PATH_MAX_LENGTH) {
    return `Mount path must be at most ${MOUNT_PATH_MAX_LENGTH} characters`;
  }
  if (!MOUNT_PATH_REGEX.test(trimmed)) {
    return 'Mount path must be an absolute path (e.g. /path/to/dir)';
  }
  return null;
};

/**
 * Returns an error if proposedPath (after normalization) is already in existingMountPaths.
 * Use for attach flow where existing paths are a string array.
 */
export function getMountPathUniquenessError(
  existingMountPaths: string[],
  proposedPath: string,
): string | null;

/**
 * Returns an error if proposedPath (after normalization) is already used by another item.
 * Use excludeIndex when editing one row so the current row's existing path is ignored.
 */
export function getMountPathUniquenessError<T extends { mountPath: string }>(
  items: T[],
  proposedPath: string,
  excludeIndex: number,
): string | null;

export function getMountPathUniquenessError<T extends { mountPath: string }>(
  existingMountPathsOrItems: string[] | T[],
  proposedPath: string,
  excludeIndex?: number,
): string | null {
  const normalized = normalizeMountPath(proposedPath);
  if (!normalized) {
    return null;
  }
  if (excludeIndex === undefined) {
    const paths = existingMountPathsOrItems as string[];
    const duplicate = paths.some((p) => normalizeMountPath(p) === normalized);
    return duplicate ? 'Mount path is already in use' : null;
  }
  const items = existingMountPathsOrItems as T[];
  const duplicate = items.some(
    (item, i) => i !== excludeIndex && normalizeMountPath(item.mountPath) === normalized,
  );
  return duplicate ? 'Mount path is already in use' : null;
}

/**
 * Returns the first validation error for a mount path when editing one row:
 * format error from validateMountPath, or uniqueness error excluding the row at excludeIndex.
 */
export function getMountPathValidationError<T extends { mountPath: string }>(
  items: T[],
  proposedPath: string,
  excludeIndex: number,
): string | null {
  return (
    validateMountPath(proposedPath) ??
    getMountPathUniquenessError(items, proposedPath, excludeIndex)
  );
}

/**
 * Returns the first validation error for a mount path in the attach flow:
 * format error from validateMountPath, or uniqueness error against existing paths.
 */
export function getMountPathValidationErrorForPaths(
  existingMountPaths: string[],
  proposedPath: string,
): string | null {
  return (
    validateMountPath(proposedPath) ?? getMountPathUniquenessError(existingMountPaths, proposedPath)
  );
}

export const isValidDefaultMode = (mode: string): boolean => {
  if (mode.length !== 3) {
    return false;
  }
  const permissions = ['0', '4', '5', '6', '7'];
  return Array.from(mode).every((char) => permissions.includes(char));
};

export const getUnmountableTooltip = (pvc: PvcsPVCListItem): string | null => {
  if (pvc.canMount) {
    return null;
  }
  const modes = pvc.pvcSpec.accessModes;
  if (modes.includes(V1PersistentVolumeAccessMode.ReadWriteOncePod) && pvc.pods.length > 0) {
    return 'This volume uses ReadWriteOncePod access and is already mounted by a pod.';
  }
  if (modes.includes(V1PersistentVolumeAccessMode.ReadWriteOnce) && pvc.workspaces.length > 0) {
    return 'This volume uses ReadWriteOnce access and is already mounted by a workspace.';
  }
  return null;
};

export const buildPVCOptionDescription = (
  pvc: PvcsPVCListItem,
  excludedPvcNames?: Set<string>,
): React.ReactNode => {
  const isExcluded = excludedPvcNames?.has(pvc.name) ?? false;
  return (
    <Flex justifyContent={{ default: 'justifyContentSpaceBetween' }}>
      <FlexItem>
        <Stack style={{ width: '100%' }}>
          <StackItem>
            <LabelGroup numLabels={5}>
              <Label
                isCompact
                className={!pvc.canMount || isExcluded ? 'pf-m-disabled' : undefined}
              >
                {pvc.pvcSpec.requests.storage}
              </Label>
              {pvc.pvcSpec.accessModes.map((mode) => (
                <Label
                  key={mode}
                  isCompact
                  className={!pvc.canMount || isExcluded ? 'pf-m-disabled' : undefined}
                  color="blue"
                >
                  {mode}
                </Label>
              ))}
              {isExcluded && (
                <Label isCompact className="pf-m-disabled">
                  Already mounted
                </Label>
              )}
              {!pvc.canMount && (
                <Label isCompact className="pf-m-disabled">
                  Unmountable
                </Label>
              )}
            </LabelGroup>
          </StackItem>
          {pvc.workspaces.length > 0 && (
            <StackItem className="pf-v6-u-ml-sm pf-v6-u-mt-xs">
              <Flex gap={{ default: 'gapXs' }}>
                <FlexItem>Connected Workspaces:</FlexItem>
                <FlexItem>
                  <LabelGroupWithTooltip
                    labels={pvc.workspaces.map((w) => w.name)}
                    limit={5}
                    variant="outline"
                    icon={<CubeIcon color="teal" />}
                    isCompact
                    color="teal"
                    className={!pvc.canMount ? 'pf-m-disabled' : undefined}
                  />
                </FlexItem>
              </Flex>
            </StackItem>
          )}
        </Stack>
      </FlexItem>
      <FlexItem>
        <Tooltip
          aria="none"
          aria-live="polite"
          content={
            <Stack>
              <StackItem>{`Created at: ${new Date(pvc.audit.createdAt).toLocaleString()} by ${pvc.audit.createdBy}`}</StackItem>
              <StackItem>{`Updated at: ${new Date(pvc.audit.updatedAt).toLocaleString()} by ${pvc.audit.updatedBy}`}</StackItem>
            </Stack>
          }
        >
          <span style={{ cursor: 'default' }}>
            <InfoCircleIcon />
          </span>
        </Tooltip>
      </FlexItem>
    </Flex>
  );
};

export const buildPVCSelectOptions = (
  availablePVCs: PvcsPVCListItem[],
  storageClasses: StorageclassesStorageClassListItem[],
  excludedPvcNames?: Set<string>,
  selectedPvcName?: string,
): TypeaheadSelectOption[] => {
  const scMap = new Map(storageClasses.map((s) => [s.name, s]));
  const grouped = new Map<
    string,
    { displayName: string; description: string; pvcs: PvcsPVCListItem[] }
  >();

  for (const pvc of availablePVCs) {
    const sc = pvc.pvcSpec.storageClassName || 'default';
    if (!grouped.has(sc)) {
      grouped.set(sc, {
        displayName: scMap.get(sc)?.displayName ?? sc,
        description: scMap.get(sc)?.description ?? '',
        pvcs: [],
      });
    }
    grouped.get(sc)!.pvcs.push(pvc);
  }

  const options: TypeaheadSelectOption[] = [];

  for (const [sc, { displayName, description, pvcs }] of grouped) {
    const headerLabel = `${displayName || sc}${description ? ` - ${description}` : ''}`;
    options.push({
      content: headerLabel,
      value: `group-header-${sc}`,
      isDisabled: true,
      ...(options.length > 0 ? { className: 'pvc-select-group-header--with-divider' } : {}),
    });

    const sorted = [...pvcs].sort((a, b) => {
      const aDisabled = !a.canMount || (excludedPvcNames?.has(a.name) ?? false);
      const bDisabled = !b.canMount || (excludedPvcNames?.has(b.name) ?? false);
      return Number(aDisabled) - Number(bDisabled);
    });

    for (const pvc of sorted) {
      const isDisabled = !pvc.canMount || (excludedPvcNames?.has(pvc.name) ?? false);
      const tooltip = getUnmountableTooltip(pvc);
      options.push({
        content: pvc.name,
        value: pvc.name,
        isDisabled: isDisabled && !tooltip,
        isAriaDisabled: isDisabled && !!tooltip,
        selected: pvc.name === selectedPvcName,
        description: buildPVCOptionDescription(pvc, excludedPvcNames),
        ...(tooltip ? { tooltipProps: { content: tooltip } } : {}),
      });
    }
  }

  return options;
};
