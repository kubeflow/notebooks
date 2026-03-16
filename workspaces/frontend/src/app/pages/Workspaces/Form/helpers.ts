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
    return duplicate ? 'Mount path is already in use by another secret' : null;
  }
  const items = existingMountPathsOrItems as T[];
  const duplicate = items.some(
    (item, i) => i !== excludeIndex && normalizeMountPath(item.mountPath) === normalized,
  );
  return duplicate ? 'Mount path is already in use by another secret' : null;
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

interface FilterableItem {
  id: string;
  hidden?: boolean;
  redirect?: unknown;
}

export const computeDefaultFilterValues = (
  items: FilterableItem[],
  defaultId?: string,
): { showHidden: boolean; showRedirected: boolean } => {
  const defaultItem = items.find((i) => i.id === defaultId);
  return {
    showHidden: !!defaultItem?.hidden,
    showRedirected: defaultItem?.redirect !== undefined,
  };
};
