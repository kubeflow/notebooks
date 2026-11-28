// Context-agnostic. Override semantics used by every model's `create()`.
// TODO: add Node unit tests (node --test) as the framework grows.

export type DeepPartial<T> = T extends (infer U)[]
  ? U[]
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T;

/**
 * How a test customizes a model's default object:
 * - an object: deep-merged into the defaults. Plain objects merge key by key;
 *   arrays and scalars **replace** the default value.
 * - a function: receives a copy of the defaults and returns the final object.
 *   Use it to remove keys, replace a nested object wholesale, or edit arrays.
 */
export type Overrides<T> = DeepPartial<T> | ((defaults: T) => T);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function deepMerge<T>(base: T, patch: unknown): T {
  if (!isPlainObject(base) || !isPlainObject(patch)) {
    return (patch === undefined ? base : patch) as T;
  }
  const result: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    result[key] = deepMerge(result[key], value);
  }
  return result as T;
}

export function applyOverrides<T>(defaults: T, overrides?: Overrides<T>): T {
  if (overrides === undefined) {
    return defaults;
  }
  if (typeof overrides === 'function') {
    return (overrides as (defaults: T) => T)(structuredClone(defaults));
  }
  return deepMerge(defaults, overrides);
}
