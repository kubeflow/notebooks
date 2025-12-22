import { renderHook, act } from '@testing-library/react';
import { useToolbarFilters, applyFilters } from '~/shared/hooks/useToolbarFilters';
import { FilterConfigMap } from '~/shared/components/ToolbarFilter';

describe('useToolbarFilters', () => {
  const textFilterConfig = {
    name: { type: 'text', label: 'Name', placeholder: 'Filter by name' },
    description: { type: 'text', label: 'Description', placeholder: 'Filter by description' },
  } as const satisfies FilterConfigMap<string>;

  const mixedFilterConfig = {
    name: { type: 'text', label: 'Name', placeholder: 'Filter by name' },
    status: {
      type: 'select',
      label: 'Status',
      placeholder: 'Filter by status',
      options: [
        { value: 'Active', label: 'Active' },
        { value: 'Inactive', label: 'Inactive' },
      ],
    },
  } as const satisfies FilterConfigMap<string>;

  const multiselectFilterConfig = {
    name: { type: 'text', label: 'Name', placeholder: 'Filter by name' },
    tags: {
      type: 'multiselect',
      label: 'Tags',
      placeholder: 'Filter by tags',
      options: [
        { value: 'frontend', label: 'Frontend' },
        { value: 'backend', label: 'Backend' },
        { value: 'database', label: 'Database' },
      ],
    },
  } as const satisfies FilterConfigMap<string>;

  describe('initialization', () => {
    it('should initialize all filter values to empty strings', () => {
      const { result } = renderHook(() => useToolbarFilters(textFilterConfig));

      expect(result.current.filterValues).toEqual({
        name: '',
        description: '',
      });
    });

    it('should initialize hasActiveFilters to false', () => {
      const { result } = renderHook(() => useToolbarFilters(textFilterConfig));

      expect(result.current.hasActiveFilters).toBe(false);
    });
  });

  describe('setFilter', () => {
    it('should update a specific filter value', () => {
      const { result } = renderHook(() => useToolbarFilters(textFilterConfig));

      act(() => {
        result.current.setFilter('name', 'test-value');
      });

      expect(result.current.filterValues.name).toBe('test-value');
      expect(result.current.filterValues.description).toBe('');
    });

    it('should update multiple filters independently', () => {
      const { result } = renderHook(() => useToolbarFilters(textFilterConfig));

      act(() => {
        result.current.setFilter('name', 'name-value');
      });

      act(() => {
        result.current.setFilter('description', 'desc-value');
      });

      expect(result.current.filterValues).toEqual({
        name: 'name-value',
        description: 'desc-value',
      });
    });

    it('should overwrite existing filter value', () => {
      const { result } = renderHook(() => useToolbarFilters(textFilterConfig));

      act(() => {
        result.current.setFilter('name', 'first-value');
      });

      act(() => {
        result.current.setFilter('name', 'second-value');
      });

      expect(result.current.filterValues.name).toBe('second-value');
    });

    it('should clear a filter by setting empty string', () => {
      const { result } = renderHook(() => useToolbarFilters(textFilterConfig));

      act(() => {
        result.current.setFilter('name', 'test-value');
      });

      act(() => {
        result.current.setFilter('name', '');
      });

      expect(result.current.filterValues.name).toBe('');
    });
  });

  describe('clearAllFilters', () => {
    it('should reset all filter values to empty strings', () => {
      const { result } = renderHook(() => useToolbarFilters(textFilterConfig));

      act(() => {
        result.current.setFilter('name', 'name-value');
        result.current.setFilter('description', 'desc-value');
      });

      act(() => {
        result.current.clearAllFilters();
      });

      expect(result.current.filterValues).toEqual({
        name: '',
        description: '',
      });
    });

    it('should set hasActiveFilters to false after clearing', () => {
      const { result } = renderHook(() => useToolbarFilters(textFilterConfig));

      act(() => {
        result.current.setFilter('name', 'test-value');
      });

      expect(result.current.hasActiveFilters).toBe(true);

      act(() => {
        result.current.clearAllFilters();
      });

      expect(result.current.hasActiveFilters).toBe(false);
    });
  });

  describe('hasActiveFilters', () => {
    it('should return true when at least one filter has a value', () => {
      const { result } = renderHook(() => useToolbarFilters(textFilterConfig));

      act(() => {
        result.current.setFilter('name', 'test');
      });

      expect(result.current.hasActiveFilters).toBe(true);
    });

    it('should return true when multiple filters have values', () => {
      const { result } = renderHook(() => useToolbarFilters(textFilterConfig));

      act(() => {
        result.current.setFilter('name', 'name-value');
        result.current.setFilter('description', 'desc-value');
      });

      expect(result.current.hasActiveFilters).toBe(true);
    });

    it('should return false when all filters are empty', () => {
      const { result } = renderHook(() => useToolbarFilters(textFilterConfig));

      expect(result.current.hasActiveFilters).toBe(false);
    });

    it('should return false after clearing a single active filter', () => {
      const { result } = renderHook(() => useToolbarFilters(textFilterConfig));

      act(() => {
        result.current.setFilter('name', 'test');
      });

      act(() => {
        result.current.setFilter('name', '');
      });

      expect(result.current.hasActiveFilters).toBe(false);
    });
  });

  describe('with mixed filter types', () => {
    it('should handle both text and select filter types', () => {
      const { result } = renderHook(() => useToolbarFilters(mixedFilterConfig));

      expect(result.current.filterValues).toEqual({
        name: '',
        status: '',
      });

      act(() => {
        result.current.setFilter('name', 'test-name');
        result.current.setFilter('status', 'Active');
      });

      expect(result.current.filterValues).toEqual({
        name: 'test-name',
        status: 'Active',
      });
    });
  });

  describe('multiselect filters', () => {
    it('should initialize multiselect filters with empty array', () => {
      const { result } = renderHook(() => useToolbarFilters(multiselectFilterConfig));

      expect(result.current.filterValues).toEqual({
        name: '',
        tags: [],
      });
    });

    it('should set multiselect filter with array values', () => {
      const { result } = renderHook(() => useToolbarFilters(multiselectFilterConfig));

      act(() => {
        result.current.setFilter('tags', ['frontend', 'backend']);
      });

      expect(result.current.filterValues.tags).toEqual(['frontend', 'backend']);
    });

    it('should detect active filters for non-empty multiselect arrays', () => {
      const { result } = renderHook(() => useToolbarFilters(multiselectFilterConfig));

      expect(result.current.hasActiveFilters).toBe(false);

      act(() => {
        result.current.setFilter('tags', ['frontend']);
      });

      expect(result.current.hasActiveFilters).toBe(true);
    });

    it('should not detect active filters for empty multiselect arrays', () => {
      const { result } = renderHook(() => useToolbarFilters(multiselectFilterConfig));

      act(() => {
        result.current.setFilter('tags', []);
      });

      expect(result.current.hasActiveFilters).toBe(false);
    });

    it('should clear multiselect filter to empty array', () => {
      const { result } = renderHook(() => useToolbarFilters(multiselectFilterConfig));

      act(() => {
        result.current.setFilter('tags', ['frontend', 'backend']);
      });

      act(() => {
        result.current.clearAllFilters();
      });

      expect(result.current.filterValues.tags).toEqual([]);
    });

    it('should handle text and multiselect filters together', () => {
      const { result } = renderHook(() => useToolbarFilters(multiselectFilterConfig));

      act(() => {
        result.current.setFilter('name', 'test');
        result.current.setFilter('tags', ['frontend']);
      });

      expect(result.current.filterValues).toEqual({
        name: 'test',
        tags: ['frontend'],
      });
      expect(result.current.hasActiveFilters).toBe(true);
    });
  });
});

describe('applyFilters', () => {
  interface TestItem {
    id: number;
    name: string;
    status: string;
    category: string;
  }

  const testData: TestItem[] = [
    { id: 1, name: 'Alpha', status: 'Active', category: 'A' },
    { id: 2, name: 'Beta', status: 'Inactive', category: 'B' },
    { id: 3, name: 'Gamma', status: 'Active', category: 'A' },
    { id: 4, name: 'Delta', status: 'Inactive', category: 'C' },
    { id: 5, name: 'Epsilon', status: 'Active', category: 'B' },
  ];

  const propertyGetters = {
    name: (item: TestItem) => item.name,
    status: (item: TestItem) => item.status,
    category: (item: TestItem) => item.category,
  };

  describe('basic filtering', () => {
    it('should return all data when no filters are active', () => {
      const filterValues = { name: '', status: '', category: '' };
      const result = applyFilters(testData, filterValues, propertyGetters);

      expect(result).toHaveLength(5);
      expect(result).toEqual(testData);
    });

    it('should return empty array when data is empty', () => {
      const filterValues = { name: 'test', status: '', category: '' };
      const result = applyFilters([], filterValues, propertyGetters);

      expect(result).toEqual([]);
    });

    it('should filter by a single property', () => {
      const filterValues = { name: 'Alpha', status: '', category: '' };
      const result = applyFilters(testData, filterValues, propertyGetters);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Alpha');
    });

    it('should filter by multiple properties (AND logic)', () => {
      const filterValues = { name: '', status: 'Active', category: 'A' };
      const result = applyFilters(testData, filterValues, propertyGetters);

      expect(result).toHaveLength(2);
      expect(result.every((item) => item.status === 'Active' && item.category === 'A')).toBe(true);
    });
  });

  describe('case insensitive filtering', () => {
    it('should match regardless of case', () => {
      const filterValues = { name: 'alpha', status: '', category: '' };
      const result = applyFilters(testData, filterValues, propertyGetters);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Alpha');
    });

    it('should match uppercase search against lowercase data', () => {
      const filterValues = { name: 'BETA', status: '', category: '' };
      const result = applyFilters(testData, filterValues, propertyGetters);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Beta');
    });
  });

  describe('partial matching', () => {
    it('should match partial strings', () => {
      const filterValues = { name: 'lph', status: '', category: '' };
      const result = applyFilters(testData, filterValues, propertyGetters);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Alpha');
    });

    it('should match items containing the search term', () => {
      const filterValues = { name: 'a', status: '', category: '' };
      const result = applyFilters(testData, filterValues, propertyGetters);

      // Alpha, Beta, Gamma, Delta all contain 'a'
      expect(result).toHaveLength(4);
    });
  });

  describe('regex support', () => {
    it('should support regex patterns', () => {
      const filterValues = { name: '^[AB]', status: '', category: '' };
      const result = applyFilters(testData, filterValues, propertyGetters);

      expect(result).toHaveLength(2);
      expect(result.map((item) => item.name)).toEqual(['Alpha', 'Beta']);
    });

    it('should support regex with alternation', () => {
      const filterValues = { name: 'Alpha|Gamma', status: '', category: '' };
      const result = applyFilters(testData, filterValues, propertyGetters);

      expect(result).toHaveLength(2);
      expect(result.map((item) => item.name)).toEqual(['Alpha', 'Gamma']);
    });

    it('should handle invalid regex gracefully by escaping special chars', () => {
      const filterValues = { name: '[', status: '', category: '' };
      const result = applyFilters(testData, filterValues, propertyGetters);

      // Invalid regex should be escaped and treated as literal
      expect(result).toHaveLength(0);
    });

    it('should escape special regex characters for literal matching when regex is invalid', () => {
      const filterValues = { name: 'test(', status: '', category: '' };
      const result = applyFilters(testData, filterValues, propertyGetters);

      // Should not throw, just return no matches
      expect(result).toHaveLength(0);
    });
  });

  describe('edge cases', () => {
    it('should handle whitespace-only filter values as active', () => {
      const filterValues = { name: ' ', status: '', category: '' };
      const result = applyFilters(testData, filterValues, propertyGetters);

      // Whitespace is still a value, so filter is active
      // None of our test items have spaces in names
      expect(result).toHaveLength(0);
    });

    it('should return no results when filter matches nothing', () => {
      const filterValues = { name: 'NonExistent', status: '', category: '' };
      const result = applyFilters(testData, filterValues, propertyGetters);

      expect(result).toHaveLength(0);
    });

    it('should handle all filters being active', () => {
      const filterValues = { name: 'Alpha', status: 'Active', category: 'A' };
      const result = applyFilters(testData, filterValues, propertyGetters);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(testData[0]);
    });
  });

  describe('multiselect filtering', () => {
    it('should match items when multiselect has single value (OR within filter)', () => {
      const filterValues = { name: '', status: ['Active'], category: '' };
      const result = applyFilters(testData, filterValues, propertyGetters);

      expect(result).toHaveLength(3);
      expect(result.every((item) => item.status === 'Active')).toBe(true);
    });

    it('should match items when multiselect has multiple values (OR within filter)', () => {
      const filterValues = { name: '', status: ['Active', 'Inactive'], category: '' };
      const result = applyFilters(testData, filterValues, propertyGetters);

      // Should match all items since all have either Active or Inactive status
      expect(result).toHaveLength(5);
    });

    it('should apply AND logic between different multiselect filters', () => {
      const filterValues = { name: '', status: ['Active'], category: ['A'] };
      const result = applyFilters(testData, filterValues, propertyGetters);

      // Only items with Active status AND category A
      expect(result).toHaveLength(2);
      expect(result.every((item) => item.status === 'Active' && item.category === 'A')).toBe(true);
    });

    it('should return all data when multiselect array is empty', () => {
      const filterValues = { name: '', status: [], category: '' };
      const result = applyFilters(testData, filterValues, propertyGetters);

      expect(result).toHaveLength(5);
    });

    it('should combine text and multiselect filters with AND logic', () => {
      const filterValues = { name: 'a', status: ['Active'], category: '' };
      const result = applyFilters(testData, filterValues, propertyGetters);

      // Items with 'a' in name AND Active status: Alpha, Gamma, Delta has 'a' but is Inactive
      expect(result).toHaveLength(2);
      expect(result.map((item) => item.name).sort()).toEqual(['Alpha', 'Gamma']);
    });

    it('should be case insensitive for multiselect matching', () => {
      const filterValues = { name: '', status: ['active'], category: '' };
      const result = applyFilters(testData, filterValues, propertyGetters);

      expect(result).toHaveLength(3);
      expect(result.every((item) => item.status === 'Active')).toBe(true);
    });

    it('should return no results when multiselect value matches nothing', () => {
      const filterValues = { name: '', status: ['NonExistent'], category: '' };
      const result = applyFilters(testData, filterValues, propertyGetters);

      expect(result).toHaveLength(0);
    });
  });
});
