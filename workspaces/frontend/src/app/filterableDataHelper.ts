export interface DataFieldDefinition {
  label: string;
  isFilterable: boolean;
}

export type FilterableDataFieldKey<T extends Record<string, DataFieldDefinition>> = {
  [K in keyof T]: T[K]['isFilterable'] extends true ? K : never;
}[keyof T];

export type DataFieldKey<T> = keyof T;

export function defineDataFields<const T extends Record<string, DataFieldDefinition>>(
  fields: T,
): {
  fields: T;
  keyArray: (keyof T)[];
  filterableKeyArray: FilterableDataFieldKey<T>[];
  filterableLabelMap: Record<FilterableDataFieldKey<T>, string>;
} {
  type Key = keyof T;

  const keyArray = Object.keys(fields) as Key[];

  const filterableKeyArray = keyArray.filter((key): key is FilterableDataFieldKey<T> => {
    const field = fields[key] as DataFieldDefinition;
    return field.isFilterable;
  });

  const filterableLabelMap = Object.fromEntries(
    filterableKeyArray.map((key) => [key, fields[key].label]),
  ) as Record<FilterableDataFieldKey<T>, string>;

  return { fields, keyArray, filterableKeyArray, filterableLabelMap };
}
