// 420 decimal = 0644 octal (standard file permissions)
export const DEFAULT_MODE = 420;
export const DEFAULT_MODE_OCTAL = DEFAULT_MODE.toString(8);

export const isValidDefaultMode = (mode: string): boolean => {
  if (mode.length !== 3) {
    return false;
  }
  const permissions = ['0', '4', '5', '6', '7'];
  return Array.from(mode).every((char) => permissions.includes(char));
};
