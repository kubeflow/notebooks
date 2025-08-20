export interface DataFieldDefinition {
  label: string;
  isSortable: boolean;
  isFilterable: boolean;
  width?: number;
}

export type FilterableDataFieldKey<T extends Record<string, DataFieldDefinition>> = {
  [K in keyof T]: T[K]['isFilterable'] extends true ? K : never;
}[keyof T];

export type SortableDataFieldKey<T extends Record<string, DataFieldDefinition>> = {
  [K in keyof T]: T[K]['isSortable'] extends true ? K : never;
}[keyof T];

export type DataFieldKey<T> = keyof T;

export function defineDataFields<const T extends Record<string, DataFieldDefinition>>(
  fields: T,
): {
  fields: T;
  keyArray: (keyof T)[];
  sortableKeyArray: SortableDataFieldKey<T>[];
  filterableKeyArray: FilterableDataFieldKey<T>[];
  filterableLabelMap: Record<FilterableDataFieldKey<T>, string>;
} {
  type Key = keyof T;

  const keyArray = Object.keys(fields) as Key[];

  const sortableKeyArray = keyArray.filter(
    (key): key is SortableDataFieldKey<T> => (fields[key] as DataFieldDefinition).isSortable,
  );

  const filterableKeyArray = keyArray.filter(
    (key): key is FilterableDataFieldKey<T> => (fields[key] as DataFieldDefinition).isFilterable,
  );

  const filterableLabelMap = Object.fromEntries(
    filterableKeyArray.map((key) => [key, fields[key].label]),
  ) as Record<FilterableDataFieldKey<T>, string>;

  return { fields, keyArray, sortableKeyArray, filterableKeyArray, filterableLabelMap };
}
