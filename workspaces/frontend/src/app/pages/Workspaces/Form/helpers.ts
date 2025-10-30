export const isValidDefaultMode = (mode: string): boolean => {
  if (mode.length !== 3) {
    return false;
  }
  const permissions = ['0', '4', '5', '6', '7'];
  return Array.from(mode).every((char) => permissions.includes(char));
};
