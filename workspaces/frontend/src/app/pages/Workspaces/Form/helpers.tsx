import React from 'react';
import { Alert, AlertVariant } from '@patternfly/react-core/dist/esm/components/Alert';
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
 * Use for attach flow where existing paths are a Set for O(1) lookup.
 */
export function getMountPathUniquenessError(
  existingMountPaths: Set<string>,
  proposedPath: string,
): string | null;

export function getMountPathUniquenessError(
  existingMountPaths: Set<string>,
  proposedPath: string,
): string | null {
  const normalized = normalizeMountPath(proposedPath);
  if (!normalized) {
    return null;
  }
  return existingMountPaths.has(normalized) ? 'Mount path is already in use' : null;
}

/**
 * Returns the first validation error for a mount path when editing one row.
 * otherMountPaths must be a pre-normalized Set of all paths *except* the row being edited,
 * allowing O(1) uniqueness lookup.
 */
export function getMountPathValidationError(
  otherMountPaths: Set<string>,
  proposedPath: string,
): string | null {
  return (
    validateMountPath(proposedPath) ?? getMountPathUniquenessError(otherMountPaths, proposedPath)
  );
}

/**
 * Returns the first validation error for a mount path in the attach flow:
 * format error from validateMountPath, or uniqueness error against existing paths.
 */
export function getMountPathValidationErrorForPaths(
  existingMountPaths: Set<string>,
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

interface DetachWarningAlertProps {
  resourceName: string;
  testId: string;
  isAttached: boolean;
}

export const DetachWarningAlert: React.FC<DetachWarningAlertProps> = ({
  resourceName,
  testId,
  isAttached,
}) => (
  <>
    Are you sure you want to detach <strong>{resourceName}</strong>?
    {!isAttached && (
      <Alert
        data-testid={testId}
        variant={AlertVariant.danger}
        isInline
        isPlain
        className="pf-v6-u-mt-sm"
        title={`Since ${resourceName} was just created and not yet mounted to a workspace, detaching it will permanently delete it from the namespace.`}
      />
    )}
  </>
);

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
                    className={!pvc.canMount || isExcluded ? 'pf-m-disabled' : undefined}
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
