export const formatRam = (valueInKb: number): string => {
  const units = ['KB', 'MB', 'GB', 'TB'];
  let index = 0;
  let value = valueInKb;

  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }

  return `${value.toFixed(2)} ${units[index]}`;
};
