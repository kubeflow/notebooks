import { useCallback, useMemo, useState } from 'react';
import { FilterConfigMap, FilterState } from '~/shared/components/ToolbarFilter';

interface UseToolbarFiltersResult<K extends string> {
  filterValues: FilterState<K>;
  setFilter: (key: K, value: string) => void;
  clearAllFilters: () => void;
  hasActiveFilters: boolean;
}

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
 * } as const;
 *
 * const { filterValues, setFilter, clearAllFilters, hasActiveFilters } =
 *   useToolbarFilters<keyof typeof filterConfig>(filterConfig);
 * ```
 */
export function useToolbarFilters<K extends string>(
  filterConfig: FilterConfigMap<K>,
): UseToolbarFiltersResult<K> {
  // Initialize all filter values to empty strings
  const initialState = useMemo(
    () =>
      Object.keys(filterConfig).reduce((acc, key) => ({ ...acc, [key]: '' }), {} as FilterState<K>),
    [filterConfig],
  );

  const [filterValues, setFilterValues] = useState<FilterState<K>>(initialState);

  const setFilter = useCallback((key: K, value: string) => {
    setFilterValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  const clearAllFilters = useCallback(() => {
    setFilterValues(initialState);
  }, [initialState]);

  const hasActiveFilters = useMemo(
    () => Object.values(filterValues).some((value) => value !== ''),
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
  const activeFilters = Object.entries(filterValues).filter(([, value]) => value !== '');
  if (activeFilters.length === 0 || data.length === 0) {
    return data;
  }

  const compiledFilters = activeFilters.map(([key, searchValue]) => {
    let regex: RegExp;
    try {
      regex = new RegExp(searchValue as string, 'i');
    } catch {
      // If regex is invalid, escape special characters and try again
      regex = new RegExp((searchValue as string).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    }
    return { key: key as K, regex };
  });

  return data.filter((item) =>
    compiledFilters.every(({ key, regex }) => regex.test(propertyGetters[key](item))),
  );
}
