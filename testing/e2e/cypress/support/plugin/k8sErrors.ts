import * as k8s from '@kubernetes/client-node';

export function isNotFoundError(err: unknown): boolean {
  return err instanceof k8s.ApiException && err.code === 404;
}

export function isConflictError(err: unknown): boolean {
  return err instanceof k8s.ApiException && err.code === 409;
}
