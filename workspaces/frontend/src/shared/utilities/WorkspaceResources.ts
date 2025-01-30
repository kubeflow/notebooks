export const formatRam = (valueInKb: number | undefined | null): string => {
  if (valueInKb === undefined || valueInKb === null) {
    return 'N/A';
  }
  const units = ['KB', 'MB', 'GB', 'TB'];
  let index = 0;
  let value = valueInKb;

  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }

  return `${value.toFixed(2)} ${units[index]}`;
};
