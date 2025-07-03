/**
 * Formats a camelCase string into a readable title format.
 * Handles special cases and converts camelCase to Title Case.
 *
 * @param key - The camelCase string to format
 * @returns The formatted title string
 *
 * @example
 * formatLabel('pythonVersion') // returns 'Python Version'
 * formatLabel('jupyterlabVersion') // returns 'JupyterLab Version'
 * formatLabel('cpu') // returns 'CPU'
 * formatLabel('gpu') // returns 'GPU'
 */
export const formatLabel = (key: string): string => {
  // Handle special cases
  if (key === 'jupyterlabVersion') {
    return 'JupyterLab Version';
  }

  if (key === 'cpu' || key === 'gpu') {
    return key.toUpperCase();
  }

  // Convert camelCase to Title Case
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
};
