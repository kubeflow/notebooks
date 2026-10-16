/**
 * Generates a short, collision-resistant resource name for test fixtures, so
 * specs don't need to coordinate on fixed literal names (which would collide
 * across parallel or retried runs).
 */
export function uniqueName(prefix: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 6);
  return `${prefix}-${timestamp}-${random}`;
}
