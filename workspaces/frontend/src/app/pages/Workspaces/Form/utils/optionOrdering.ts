export function moveDefaultToFront<T extends { id: string }>(
  options: T[],
  defaultId?: string,
): T[] {
  if (!defaultId) {
    return options;
  }

  const defaultIndex = options.findIndex((opt) => opt.id === defaultId);
  if (defaultIndex === -1) {
    return options;
  }

  const result = [...options];
  const [defaultOption] = result.splice(defaultIndex, 1);
  return [defaultOption, ...result];
}
