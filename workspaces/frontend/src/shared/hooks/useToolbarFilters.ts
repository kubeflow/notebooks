import { useCallback, useMemo, useState } from 'react';
import {
  FilterConfigMap,
  FilterState,
  FilterType,
  FilterValue,
} from '~/shared/components/ToolbarFilter';

interface UseToolbarFiltersResult<K extends string> {
  filterValues: FilterState<K>;
  setFilter: (key: K, value: FilterValue) => void;
  clearAllFilters: () => void;
  hasActiveFilters: boolean;
}

const isEmptyFilterValue = (value: FilterValue): boolean => {
  if (Array.isArray(value)) {
    return value.length === 0;
  }
  return value === '';
};

const getInitialFilterValue = (type: FilterType): FilterValue => (type === 'multiselect' ? [] : '');

/**
 * Custom hook for managing table filter state
 *
 * @template K - Union of filter key strings
 * @param filterConfig - Configuration map defining available filters
 * @returns Filter state and management functions
 *
 * @example
 * ```tsx
 * const filterConfig = {
 *   name: { type: 'text', label: 'Name', placeholder: 'Filter by name' },
 *   status: { type: 'select', label: 'Status', placeholder: 'Filter by status', options: [...] },
 *   tags: { type: 'multiselect', label: 'Tags', placeholder: 'Filter by tags', options: [...] },
 * } as const;
 *
 * const { filterValues, setFilter, clearAllFilters, hasActiveFilters } =
 *   useToolbarFilters<keyof typeof filterConfig>(filterConfig);
 * ```
 */
export function useToolbarFilters<K extends string>(
  filterConfig: FilterConfigMap<K>,
): UseToolbarFiltersResult<K> {
  // Initialize filter values based on their types
  const initialState = useMemo(
    () =>
      Object.keys(filterConfig).reduce(
        (acc, key) => ({
          ...acc,
          [key]: getInitialFilterValue(filterConfig[key as K].type),
        }),
        {} as FilterState<K>,
      ),
    [filterConfig],
  );

  const [filterValues, setFilterValues] = useState<FilterState<K>>(initialState);

  const setFilter = useCallback((key: K, value: FilterValue) => {
    setFilterValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  const clearAllFilters = useCallback(() => {
    setFilterValues(initialState);
  }, [initialState]);

  const hasActiveFilters = useMemo(
    () => Object.values(filterValues).some((value) => !isEmptyFilterValue(value as FilterValue)),
    [filterValues],
  );

  return {
    filterValues,
    setFilter,
    clearAllFilters,
    hasActiveFilters,
  };
}

/**
 * Utility function to filter data based on filter values
 *
 * @template T - Type of data items to filter
 * @template K - Union of filter key strings
 * @param data - Array of data items to filter
 * @param filterValues - Current filter values
 * @param propertyGetters - Map of functions to extract filterable properties from data items
 * @returns Filtered array of data items
 *
 * @example
 * ```tsx
 * const filteredData = applyFilters(
 *   workspace,
 *   filterValues,
 *   {
 *     name: (ws) => ws.name,
 *     kind: (ws) => ws.workspaceKind.name,
 *     state: (ws) => ws.state,
 *   },
 * );
 * ```
 */
export function applyFilters<T, K extends string>(
  data: T[],
  filterValues: FilterState<K>,
  propertyGetters: Record<K, (item: T) => string>,
): T[] {
  type ActiveStringFilter = { key: K; regex: RegExp };
  type ActiveMultiselectFilter = { key: K; selectedLower: Set<string> };

  const escapeRegExp = (input: string): string => input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const compileUserRegex = (input: string): RegExp => {
    try {
      return new RegExp(input, 'i');
    } catch {
      // If regex is invalid, treat the input as a literal string.
      return new RegExp(escapeRegExp(input), 'i');
    }
  };

  const getActiveFilters = (): {
    stringFilters: ActiveStringFilter[];
    multiselectFilters: ActiveMultiselectFilter[];
  } => {
    const stringFilters: ActiveStringFilter[] = [];
    const multiselectFilters: ActiveMultiselectFilter[] = [];

    (Object.entries(filterValues) as Array<[K, FilterValue]>).forEach(([key, value]) => {
      if (isEmptyFilterValue(value)) {
        return;
      }

      if (Array.isArray(value)) {
        multiselectFilters.push({
          key,
          selectedLower: new Set(value.map((v) => v.toLowerCase())),
        });
        return;
      }

      stringFilters.push({ key, regex: compileUserRegex(value) });
    });

    return { stringFilters, multiselectFilters };
  };

  const matchesStringFilters = (item: T, filters: ActiveStringFilter[]) =>
    filters.every(({ key, regex }) => regex.test(propertyGetters[key](item)));

  const matchesMultiselectFilters = (item: T, filters: ActiveMultiselectFilter[]) =>
    filters.every(({ key, selectedLower }) =>
      selectedLower.has(propertyGetters[key](item).toLowerCase()),
    );

  const { stringFilters, multiselectFilters } = getActiveFilters();

  if (stringFilters.length === 0 && multiselectFilters.length === 0) {
    return data;
  }

  if (data.length === 0) {
    return data;
  }

  return data.filter(
    (item) =>
      matchesStringFilters(item, stringFilters) &&
      matchesMultiselectFilters(item, multiselectFilters),
  );
}
