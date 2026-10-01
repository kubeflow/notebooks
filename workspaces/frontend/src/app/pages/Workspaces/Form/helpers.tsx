import React from 'react';
import { generate as generateRandomWords } from 'random-words';
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

export const MAX_WORKSPACE_NAME_LENGTH = 63;
export const MAX_DISPLAY_NAME_LENGTH = 128;
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

// A single "."-separated segment of a Kubernetes DNS subdomain name: lowercase
// alphanumeric characters and "-", starting and ending with an alphanumeric character.
const DNS_LABEL_REGEX = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

export const validateName = (name: string): string | null => {
  if (!name) {
    return 'Value is required';
  }

  if (name.length > MAX_WORKSPACE_NAME_LENGTH) {
    return `Must be no more than ${MAX_WORKSPACE_NAME_LENGTH} characters`;
  }

  if (!/^[a-z0-9.-]+$/.test(name)) {
    return 'Only lowercase alphanumeric characters, "-" or "." are allowed';
  }

  if (!/^[a-z0-9]/.test(name)) {
    return 'Must start with an alphanumeric character';
  }

  if (!/[a-z0-9]$/.test(name)) {
    return 'Must end with an alphanumeric character';
  }

  // A valid overall start/end doesn't guarantee a valid DNS subdomain: each "."-separated
  // segment must independently start and end with an alphanumeric character too, which
  // also rejects empty segments from consecutive dots (e.g. "foo..bar", "foo.-bar", "foo-.bar").
  if (!name.split('.').every((label) => DNS_LABEL_REGEX.test(label))) {
    return 'Each "."-separated segment must start and end with an alphanumeric character';
  }

  return null;
};

export interface ResourceNameCriterion {
  key: string;
  label: string;
  isValid: boolean;
}

/** Same rules as validateName, decomposed into individually-checkable criteria for live UI feedback. */
export const getResourceNameCriteria = (name: string): ResourceNameCriterion[] => [
  {
    key: 'length',
    label: `Must be no more than ${MAX_WORKSPACE_NAME_LENGTH} characters`,
    isValid: name.length > 0 && name.length <= MAX_WORKSPACE_NAME_LENGTH,
  },
  {
    key: 'chars',
    label: 'Only lowercase alphanumeric characters, "-" or "." are allowed',
    isValid: name.length > 0 && /^[a-z0-9.-]+$/.test(name),
  },
  {
    key: 'start',
    label: 'Must start with an alphanumeric character',
    isValid: /^[a-z0-9]/.test(name),
  },
  {
    key: 'end',
    label: 'Must end with an alphanumeric character',
    isValid: /[a-z0-9]$/.test(name),
  },
  {
    key: 'segments',
    label: 'Each "."-separated segment must start and end with an alphanumeric character',
    isValid: name.length > 0 && name.split('.').every((label) => DNS_LABEL_REGEX.test(label)),
  },
];

// Unicode letters/marks/numbers (any language/script) plus a curated set of
// everyday punctuation.
// (< > { } ` \ | ; & $ = [ ]) — nothing needs special-casing for those since
// they simply aren't in this allowlist. Whitespace is a literal space
// (U+0020) only — not tabs, newlines, or other Unicode spaces.
const DISPLAY_NAME_ALLOWED_CHARS_REGEX = /^[\p{L}\p{M}\p{N}\-_.,'":?!@#%^*()~+/ ]*$/u;
const DISPLAY_NAME_ALLOWED_CHARS_MESSAGE =
  'Only letters (any language), numbers, spaces, and the characters - _ . , \' " : ? ! @ # % ^ * ( ) ~ + / are allowed';

export const validateDisplayName = (displayName: string): string | null => {
  if (!displayName.trim()) {
    return 'Value is required';
  }

  if (displayName.length > MAX_DISPLAY_NAME_LENGTH) {
    return `Must be no more than ${MAX_DISPLAY_NAME_LENGTH} characters`;
  }

  if (!DISPLAY_NAME_ALLOWED_CHARS_REGEX.test(displayName)) {
    return DISPLAY_NAME_ALLOWED_CHARS_MESSAGE;
  }

  return null;
};

/**
 * Converts a display name into a lowercase, hyphen-separated slug. Accented Latin
 * letters are transliterated to their plain-ASCII base letter via Unicode NFD
 * decomposition (e.g. "café" becomes "cafe", not "caf") before anything else is
 * dropped. Any remaining characters outside [0-9, a-Z, -, ., _, space] — including
 * non-Latin scripts (e.g. Chinese, Cyrillic), symbols, and emoji — are removed
 * rather than romanized; such display names fall back to the random word-pair
 * generator in generateResourceNameBase. Everything is lower-cased, spaces and
 * underscores become dashes, and leading/trailing "-" or "." are trimmed so the
 * slug is more likely to already satisfy validateName's start/end rule.
 */
export const slugifyDisplayName = (displayName: string): string =>
  displayName
    .normalize('NFD') // Decompose accented Latin letters into base letter + combining mark
    .replace(/[\u0300-\u036f]/g, '') // Strip the combining marks, leaving the plain base letter
    .replace(/[^0-9a-zA-Z\-._ ]/g, '') // Drop anything else: non-Latin scripts, symbols, emoji
    .toLowerCase()
    .replace(/[ _]/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '');

const RESOURCE_NAME_HASH_LENGTH = 4;
const RESOURCE_NAME_HASH_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';

export const generateRandomHash = (length = RESOURCE_NAME_HASH_LENGTH): string => {
  let hash = '';
  for (let i = 0; i < length; i += 1) {
    hash += RESOURCE_NAME_HASH_CHARS[Math.floor(Math.random() * RESOURCE_NAME_HASH_CHARS.length)];
  }
  return hash;
};

const RANDOM_WORD_MIN_LENGTH = 5;
const RANDOM_WORD_MAX_LENGTH = 7;

/**
 * Returns a domain-friendly base name derived from the display name when it converts into
 * a valid resource name, otherwise falls back to a random "<word>-<word>" base
 * (e.g. when the display name has no alphanumeric characters at all, like an emoji-only name).
 */
export const generateResourceNameBase = (displayName: string): string => {
  const slug = slugifyDisplayName(displayName);
  if (slug && validateName(slug) === null) {
    return slug;
  }

  const [word1, word2] = generateRandomWords({
    exactly: 2,
    minLength: RANDOM_WORD_MIN_LENGTH,
    maxLength: RANDOM_WORD_MAX_LENGTH,
  }) as string[];

  return `${word1}-${word2}`;
};

export const generateResourceName = (displayName: string): string => {
  const base = generateResourceNameBase(displayName);
  const hash = generateRandomHash();
  const maxBaseLength = MAX_WORKSPACE_NAME_LENGTH - hash.length - 1;
  const truncatedBase = base.slice(0, maxBaseLength).replace(/-+$/, '');
  return `${truncatedBase}-${hash}`;
};
