// Node.js process only (see README "Architecture").
import * as k8s from '@kubernetes/client-node';
import type { K8sApiError } from '../shared/k8s';

export function isNotFoundError(err: unknown): boolean {
  return err instanceof k8s.ApiException && err.code === 404;
}

/** Normalizes a client error into the plain `K8sApiError` shape that can cross `cy.task`. */
export function toApiError(err: unknown): K8sApiError {
  if (err instanceof k8s.ApiException) {
    let status: { reason?: string; message?: string };
    try {
      status = typeof err.body === 'string' ? JSON.parse(err.body) : (err.body ?? {});
    } catch {
      status = { message: String(err.body) };
    }
    return { code: err.code, reason: status.reason, message: status.message ?? err.message };
  }
  throw err;
}
