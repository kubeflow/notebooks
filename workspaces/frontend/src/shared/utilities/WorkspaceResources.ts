export const formatRam = (value: string | undefined | null): string => {
  if (value === undefined || value === null) {
    return 'N/A';
  }

  // Extract numeric part and unit (e.g., "128Mi" → [128, "Mi"])
  const match = value.match(/^(\d+)([KMGTP]i?)$/);
  if (!match) {
    return 'Invalid';
  }

  const size = parseInt(match[1], 10);
  const unit = match[2];

  // Convert input to KB based on unit
  const unitMultiplier: Record<string, number> = {
    Ki: 1, // Kibibyte = 1 KB
    Mi: 1024, // Mebibyte → KB
    Gi: 1024 * 1024, // Gigibyte → KB
    Ti: 1024 * 1024 * 1024, // Terabyte → KB
    Pi: 1024 * 1024 * 1024 * 1024, // Petabyte → KB (unlikely but just in case)
  };

  const valueInKB = size * (unitMultiplier[unit] || 1);
  return formatFromKB(valueInKB);
};

// Helper function to format KB into readable units
const formatFromKB = (valueInKb: number): string => {
  const units = ['KB', 'MB', 'GB', 'TB', 'PB'];
  let index = 0;

  while (valueInKb >= 1024 && index < units.length - 1) {
    // eslint-disable-next-line no-param-reassign
    valueInKb /= 1024;
    index += 1;
  }

  return `${valueInKb.toFixed(2)} ${units[index]}`;
};

export const formatCPU = (value: string): string => {
  // If value is in millicores (e.g., "100m"), convert it to vCPUs
  if (value.endsWith('m')) {
    const milliCores = parseInt(value.replace('m', ''), 10);
    return `${(milliCores / 1000).toFixed(2)} vCPU`;
  }

  // Otherwise, assume it's in full cores
  return `${value} vCPU`;
};
