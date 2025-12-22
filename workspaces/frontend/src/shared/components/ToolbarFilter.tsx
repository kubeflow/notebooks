import React, { useCallback, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import {
  Toolbar,
  ToolbarContent,
  ToolbarGroup,
  ToolbarFilter as PFToolbarFilter,
  ToolbarToggleGroup,
  ToolbarItem,
} from '@patternfly/react-core/dist/esm/components/Toolbar';
import {
  Select,
  SelectList,
  SelectOption,
} from '@patternfly/react-core/dist/esm/components/Select';
import {
  MenuToggle,
  MenuToggleElement,
} from '@patternfly/react-core/dist/esm/components/MenuToggle';
import { Badge } from '@patternfly/react-core/dist/esm/components/Badge';
import { FilterIcon } from '@patternfly/react-icons/dist/esm/icons/filter-icon';
import ThemeAwareSearchInput from '~/app/components/ThemeAwareSearchInput';

interface CommonFilterConfig {
  label: string;
  placeholder: string;
}

export interface TextFilterConfig extends CommonFilterConfig {
  type: 'text';
}

export interface SelectFilterConfig extends CommonFilterConfig {
  type: 'select';
  options: { value: string; label: string }[];
}

export interface MultiselectFilterConfig extends CommonFilterConfig {
  type: 'multiselect';
  options: { value: string; label: string }[];
}

export type FilterConfig = TextFilterConfig | SelectFilterConfig | MultiselectFilterConfig;

export type FilterType = FilterConfig['type'];

export type FilterConfigMap<K extends string> = {
  [key in K]: FilterConfig;
};

/** Filter value type - string for text/select, string[] for multiselect */
export type FilterValue = string | string[];

export type FilterState<K extends string> = Record<K, FilterValue>;

export interface ToolbarFilterProps<K extends string> {
  filterConfig: FilterConfigMap<K>;
  visibleFilterKeys: readonly K[];
  filterValues: FilterState<K>;
  onFilterChange: (key: K, value: FilterValue) => void;
  onClearAllFilters: () => void;
  toolbarActions?: React.ReactNode;
  testIdPrefix?: string;
}

export interface ToolbarFilterRef<K extends string> {
  clearAll: () => void;
  setFilter: (key: K, value: FilterValue) => void;
}

/**
 * A unified, reusable toolbar filter component supporting both text input
 * and select dropdown filters.
 *
 * @template K - Union of filter key strings
 *
 * @example
 * ```tsx
 * const filterConfig = {
 *   name: { type: 'text', label: 'Name', placeholder: 'Filter by name' },
 *   status: {
 *     type: 'select',
 *     label: 'Status',
 *     placeholder: 'Filter by status',
 *     options: [
 *       { value: 'Active', label: 'Active' },
 *       { value: 'Deprecated', label: 'Deprecated' },
 *     ],
 *   },
 * } as const;
 *
 * <ToolbarFilter
 *   id="my-filter"
 *   filterConfig={filterConfig}
 *   visibleFilterKeys={['name', 'status']}
 *   filterValues={{ name: '', status: '' }}
 *   onFilterChange={(key, value) => handleChange(key, value)}
 *   onClearAllFilters={() => handleClearAll()}
 * />
 * ```
 */
function ToolbarFilterInner<K extends string>(
  {
    filterConfig,
    visibleFilterKeys,
    filterValues,
    onFilterChange,
    onClearAllFilters,
    toolbarActions,
    testIdPrefix = 'filter',
  }: ToolbarFilterProps<K>,
  ref: React.ForwardedRef<ToolbarFilterRef<K>>,
) {
  const [activeFilterKey, setActiveFilterKey] = useState<K>(visibleFilterKeys[0]);
  const [isAttributeMenuOpen, setIsAttributeMenuOpen] = useState(false);
  const [isSelectFilterOpen, setIsSelectFilterOpen] = useState(false);
  const [isMultiselectFilterOpen, setIsMultiselectFilterOpen] = useState(false);

  const activeFilterLabel = visibleFilterKeys.length > 0 ? filterConfig[activeFilterKey].label : '';

  useImperativeHandle(ref, () => ({
    clearAll: onClearAllFilters,
    setFilter: onFilterChange,
  }));

  useEffect(() => {
    if (visibleFilterKeys.includes(activeFilterKey) || visibleFilterKeys.length === 0) {
      return;
    }
    setActiveFilterKey(visibleFilterKeys[0]);
  }, [activeFilterKey, visibleFilterKeys]);

  const onAttributeSelect = useCallback(
    (_ev: React.MouseEvent | undefined, itemId: string | number | undefined) => {
      if (itemId && visibleFilterKeys.includes(itemId as K)) {
        setActiveFilterKey(itemId as K);
      }
      setIsAttributeMenuOpen(false);
    },
    [visibleFilterKeys],
  );

  const onAttributeToggle = useCallback(() => {
    setIsAttributeMenuOpen((prev) => !prev);
  }, []);

  const attributeDropdown = useMemo(
    () => (
      <Select
        isOpen={isAttributeMenuOpen}
        selected={activeFilterKey}
        onSelect={onAttributeSelect}
        onOpenChange={(isOpen) => setIsAttributeMenuOpen(isOpen)}
        toggle={(toggleRef) => (
          <MenuToggle
            ref={toggleRef}
            onClick={onAttributeToggle}
            isExpanded={isAttributeMenuOpen}
            icon={<FilterIcon />}
            data-testid={`${testIdPrefix}-dropdown`}
          >
            {activeFilterLabel}
          </MenuToggle>
        )}
      >
        <SelectList>
          {visibleFilterKeys.map((key) => (
            <SelectOption key={key} value={key} data-testid={`${testIdPrefix}-dropdown-${key}`}>
              {filterConfig[key].label}
            </SelectOption>
          ))}
        </SelectList>
      </Select>
    ),
    [
      isAttributeMenuOpen,
      activeFilterKey,
      activeFilterLabel,
      onAttributeSelect,
      onAttributeToggle,
      visibleFilterKeys,
      filterConfig,
      testIdPrefix,
    ],
  );

  const renderTextFilter = useCallback(
    (key: K, config: TextFilterConfig) => {
      const value = filterValues[key];
      const textValue = typeof value === 'string' ? value : '';
      return (
        <ThemeAwareSearchInput
          value={textValue}
          onChange={(newValue: string) => onFilterChange(key, newValue)}
          placeholder={config.placeholder}
          fieldLabel={config.placeholder}
          aria-label={config.placeholder}
          data-testid={`${testIdPrefix}-${key}-input`}
        />
      );
    },
    [filterValues, onFilterChange, testIdPrefix],
  );

  const onSelectFilterChange = useCallback(
    (key: K) => (_ev: React.MouseEvent | undefined, value: string | number | undefined) => {
      if (value === undefined) {
        return;
      }
      onFilterChange(key, value.toString());
      setIsSelectFilterOpen(false);
    },
    [onFilterChange],
  );

  const renderSelectFilter = useCallback(
    (key: K, config: SelectFilterConfig) => {
      const value = filterValues[key];
      const selected = typeof value === 'string' ? value : '';
      const displayValue = selected
        ? (config.options.find((option) => option.value === selected)?.label ?? selected)
        : config.placeholder;

      return (
        <Select
          isOpen={isSelectFilterOpen && activeFilterKey === key}
          selected={selected}
          onSelect={onSelectFilterChange(key)}
          onOpenChange={(isOpen) => setIsSelectFilterOpen(isOpen)}
          toggle={(toggleRef) => (
            <MenuToggle
              ref={toggleRef}
              onClick={() => setIsSelectFilterOpen((prev) => !prev)}
              isExpanded={isSelectFilterOpen && activeFilterKey === key}
              style={{ width: '200px' }}
              data-testid={`${testIdPrefix}-${key}-dropdown`}
            >
              {displayValue}
            </MenuToggle>
          )}
        >
          <SelectList>
            {config.options.map((option) => (
              <SelectOption
                key={option.value}
                value={option.value}
                data-testid={`${testIdPrefix}-${key}-${option.value.toLowerCase()}`}
              >
                {option.label}
              </SelectOption>
            ))}
          </SelectList>
        </Select>
      );
    },
    [isSelectFilterOpen, activeFilterKey, filterValues, onSelectFilterChange, testIdPrefix],
  );

  const renderMultiselectFilter = useCallback(
    (key: K, config: MultiselectFilterConfig) => {
      const value = filterValues[key];
      const selectedValues: string[] = Array.isArray(value) ? value : [];

      const onToggleSelection = (selectedValue: string) => {
        const newValues = selectedValues.includes(selectedValue)
          ? selectedValues.filter((v) => v !== selectedValue)
          : [...selectedValues, selectedValue];
        onFilterChange(key, newValues);
      };

      return (
        <Select
          role="menu"
          isOpen={isMultiselectFilterOpen && activeFilterKey === key}
          selected={selectedValues}
          onSelect={(_ev, selection) => {
            if (selection !== undefined) {
              onToggleSelection(selection.toString());
            }
          }}
          onOpenChange={(isOpen) => setIsMultiselectFilterOpen(isOpen)}
          toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
            <MenuToggle
              ref={toggleRef}
              onClick={() => setIsMultiselectFilterOpen((prev) => !prev)}
              isExpanded={isMultiselectFilterOpen && activeFilterKey === key}
              style={{ width: '200px' }}
              data-testid={`${testIdPrefix}-${key}-dropdown`}
              badge={
                selectedValues.length > 0 ? (
                  <Badge isRead>{selectedValues.length}</Badge>
                ) : undefined
              }
            >
              {config.placeholder}
            </MenuToggle>
          )}
        >
          <SelectList>
            {config.options.map((option) => (
              <SelectOption
                key={option.value}
                value={option.value}
                hasCheckbox
                isSelected={selectedValues.includes(option.value)}
                data-testid={`${testIdPrefix}-${key}-${option.value.toLowerCase()}`}
              >
                {option.label}
              </SelectOption>
            ))}
          </SelectList>
        </Select>
      );
    },
    [isMultiselectFilterOpen, activeFilterKey, filterValues, onFilterChange, testIdPrefix],
  );

  const renderFilterInput = useCallback(
    (key: K) => {
      const config = filterConfig[key];
      if (config.type === 'text') {
        return renderTextFilter(key, config);
      }
      if (config.type === 'multiselect') {
        return renderMultiselectFilter(key, config);
      }
      return renderSelectFilter(key, config);
    },
    [filterConfig, renderTextFilter, renderSelectFilter, renderMultiselectFilter],
  );

  const getFilterLabels = (key: K): string[] => {
    const value = filterValues[key];
    if (Array.isArray(value)) {
      return value;
    }
    return value ? [value] : [];
  };

  const handleDeleteLabel = (key: K, labelToDelete?: string) => {
    const config = filterConfig[key];
    if (config.type === 'multiselect' && labelToDelete !== undefined) {
      const value = filterValues[key];
      const currentValues = Array.isArray(value) ? value : [];
      const newValues = currentValues.filter((v) => v !== labelToDelete);
      onFilterChange(key, newValues);
    } else {
      // For text and select filters, clear the entire value
      onFilterChange(key, config.type === 'multiselect' ? [] : '');
    }
  };

  return (
    <Toolbar
      id={`${testIdPrefix}-toolbar`}
      clearAllFilters={onClearAllFilters}
      data-testid={`${testIdPrefix}-toolbar`}
    >
      <ToolbarContent>
        <ToolbarToggleGroup toggleIcon={<FilterIcon />} breakpoint="xl">
          <ToolbarGroup variant="filter-group">
            <ToolbarItem>{attributeDropdown}</ToolbarItem>
            {visibleFilterKeys.map((key) => (
              <PFToolbarFilter
                key={key}
                labels={getFilterLabels(key)}
                deleteLabel={(_category, label) => {
                  const labelStr = typeof label === 'string' ? label : label.key;
                  handleDeleteLabel(key, labelStr);
                }}
                deleteLabelGroup={() => handleDeleteLabel(key)}
                categoryName={filterConfig[key].label}
                showToolbarItem={activeFilterKey === key}
              >
                {renderFilterInput(key)}
              </PFToolbarFilter>
            ))}
            {Object.keys(filterConfig)
              .filter((key) => {
                const value = filterValues[key as K];
                const hasValue = Array.isArray(value) ? value.length > 0 : Boolean(value);
                return !visibleFilterKeys.includes(key as K) && hasValue;
              })
              .map((key) => (
                <PFToolbarFilter
                  key={key}
                  labels={getFilterLabels(key as K)}
                  deleteLabel={(_category, label) => {
                    const labelStr = typeof label === 'string' ? label : label.key;
                    handleDeleteLabel(key as K, labelStr);
                  }}
                  deleteLabelGroup={() => handleDeleteLabel(key as K)}
                  categoryName={filterConfig[key as K].label}
                >
                  {null}
                </PFToolbarFilter>
              ))}
            {toolbarActions}
          </ToolbarGroup>
        </ToolbarToggleGroup>
      </ToolbarContent>
    </Toolbar>
  );
}

const ToolbarFilter = React.forwardRef(ToolbarFilterInner) as <K extends string>(
  props: ToolbarFilterProps<K> & { ref?: React.ForwardedRef<ToolbarFilterRef<K>> },
) => React.ReactElement;

export default ToolbarFilter;
