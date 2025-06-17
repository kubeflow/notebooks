import React, {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuList,
  MenuToggle,
  MenuToggleElement,
  Popper,
  Toolbar,
  ToolbarContent,
  ToolbarFilter,
  ToolbarGroup,
  ToolbarItem,
  ToolbarToggleGroup,
} from '@patternfly/react-core';
import { FilterIcon } from '@patternfly/react-icons';
import ThemeAwareSearchInput from '~/app/components/ThemeAwareSearchInput';

export interface FilterProps {
  id: string;
  filters: FilteredColumn[];
  setFilters: (filters: FilteredColumn[]) => void;
  columnDefinition: Record<string, string>;
  toolbarActions?: React.ReactNode;
}

export interface FilteredColumn<K extends string = string> {
  columnKey: K;
  value: string;
}

// Define the handle type that the parent will use to access the exposed function
export interface FilterRef {
  clearAll: () => void;
}

// Use forwardRef to allow parents to get a ref to this component instance
const Filter = React.forwardRef<FilterRef, FilterProps>(
  ({ id, filters, setFilters, columnDefinition, toolbarActions }, ref) => {
    const [activeFilter, setActiveFilter] = useState<FilteredColumn>({
      columnKey: filters[0]?.columnKey ?? Object.keys(columnDefinition)[0],
      value: filters[0]?.value ?? '',
    });
    const [searchValue, setSearchValue] = useState<string>(activeFilter.value || '');
    const [isFilterMenuOpen, setIsFilterMenuOpen] = useState<boolean>(false);

    const filterToggleRef = useRef<MenuToggleElement | null>(null);
    const filterMenuRef = useRef<HTMLDivElement | null>(null);
    const filterContainerRef = useRef<HTMLDivElement | null>(null);

    const activeFilterLabel = useMemo(
      () => columnDefinition[activeFilter.columnKey],
      [activeFilter.columnKey, columnDefinition],
    );

    const handleFilterMenuKeys = useCallback(
      (event: KeyboardEvent) => {
        if (!isFilterMenuOpen) {
          return;
        }
        if (
          filterMenuRef.current?.contains(event.target as Node) ||
          filterToggleRef.current?.contains(event.target as Node)
        ) {
          if (event.key === 'Escape' || event.key === 'Tab') {
            setIsFilterMenuOpen(!isFilterMenuOpen);
            filterToggleRef.current?.focus();
          }
        }
      },
      [isFilterMenuOpen, filterMenuRef, filterToggleRef],
    );

    const handleClickOutside = useCallback(
      (event: MouseEvent) => {
        if (isFilterMenuOpen && !filterMenuRef.current?.contains(event.target as Node)) {
          setIsFilterMenuOpen(false);
        }
      },
      [isFilterMenuOpen, filterMenuRef],
    );

    useEffect(() => {
      window.addEventListener('keydown', handleFilterMenuKeys);
      window.addEventListener('click', handleClickOutside);
      return () => {
        window.removeEventListener('keydown', handleFilterMenuKeys);
        window.removeEventListener('click', handleClickOutside);
      };
    }, [isFilterMenuOpen, filterMenuRef, handleFilterMenuKeys, handleClickOutside]);

    const onFilterToggleClick = useCallback(
      (ev: React.MouseEvent) => {
        ev.stopPropagation(); // Stop handleClickOutside from handling
        setTimeout(() => {
          const firstElement = filterMenuRef.current?.querySelector('li > button:not(:disabled)');
          if (firstElement) {
            (firstElement as HTMLElement).focus();
          }
        }, 0);
        setIsFilterMenuOpen(!isFilterMenuOpen);
      },
      [isFilterMenuOpen],
    );

    const updateFilters = useCallback(
      (filterObj: FilteredColumn) => {
        const index = filters.findIndex((filter) => filter.columnKey === filterObj.columnKey);
        const newFilters = [...filters];

        if (filterObj.value === '') {
          const updatedFilters = newFilters.filter(
            (filter) => filter.columnKey !== filterObj.columnKey,
          );
          setFilters(updatedFilters);
          return updatedFilters;
        }
        if (index !== -1) {
          newFilters[index] = filterObj;
          setFilters(newFilters);
          return newFilters;
        }
        newFilters.push(filterObj);
        setFilters(newFilters);
        return newFilters;
      },
      [filters, setFilters],
    );

    const onSearchChange = useCallback((value: string) => {
      setSearchValue(value);
      setActiveFilter((prevActiveFilter) => ({
        ...prevActiveFilter,
        value,
      }));
    }, []);

    useEffect(() => {
      updateFilters({ ...activeFilter, value: searchValue });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchValue]);

    const onDeleteLabelGroup = useCallback(
      (filter: FilteredColumn) => {
        setFilters([...filters.filter((f) => f.columnKey !== filter.columnKey)]);
        if (filter.columnKey === activeFilter.columnKey) {
          setSearchValue('');
          setActiveFilter((prevActiveFilter) => ({
            ...prevActiveFilter,
            value: '',
          }));
        }
      },
      [activeFilter.columnKey, filters, setFilters],
    );

    // Expose the clearAllFilters logic via the ref
    const clearAllInternal = useCallback(() => {
      setFilters([]);
      setSearchValue('');
      setActiveFilter({
        columnKey: Object.keys(columnDefinition)[0],
        value: '',
      });
      setFilters([]);
    }, [columnDefinition, setFilters]);

    useImperativeHandle(ref, () => ({
      clearAll: clearAllInternal,
    }));

    const onFilterSelect = useCallback(
      (itemId: string | number | undefined) => {
        // Use the functional update form to toggle the state
        setIsFilterMenuOpen((prevIsMenuOpen) => !prevIsMenuOpen); // Fix is here

        const selectedColumnKey = itemId ? itemId.toString() : Object.keys(columnDefinition)[0];

        // Find the existing filter value for the selected column, if any
        const existingFilter = filters.find((filter) => filter.columnKey === selectedColumnKey);
        const existingValue = existingFilter ? existingFilter.value : '';

        setSearchValue(existingValue); // Set search input to the existing filter value
        setActiveFilter({
          columnKey: selectedColumnKey,
          value: existingValue, // Set the active filter value
        });
      },
      [columnDefinition, filters],
    );

    const filterMenuToggle = useMemo(
      () => (
        <MenuToggle
          ref={filterToggleRef}
          onClick={onFilterToggleClick}
          isExpanded={isFilterMenuOpen}
          icon={<FilterIcon />}
        >
          {activeFilterLabel}
        </MenuToggle>
      ),
      [activeFilterLabel, isFilterMenuOpen, onFilterToggleClick],
    );

    const filterMenu = useMemo(
      () => (
        <Menu ref={filterMenuRef} onSelect={(_ev, itemId) => onFilterSelect(itemId)}>
          <MenuContent>
            <MenuList>
              {Object.keys(columnDefinition).map((columnKey: string) => (
                <MenuItem id={`${id}-dropdown-${columnKey}`} key={columnKey} itemId={columnKey}>
                  {columnDefinition[columnKey]}
                </MenuItem>
              ))}
            </MenuList>
          </MenuContent>
        </Menu>
      ),
      [columnDefinition, id, onFilterSelect],
    );

    const filterDropdown = useMemo(
      () => (
        <div ref={filterContainerRef}>
          <Popper
            trigger={filterMenuToggle}
            triggerRef={filterToggleRef}
            popper={filterMenu}
            popperRef={filterMenuRef}
            appendTo={filterContainerRef.current || undefined}
            isVisible={isFilterMenuOpen}
          />
        </div>
      ),
      [filterMenuToggle, filterMenu, isFilterMenuOpen],
    );

    return (
      <Toolbar
        id="attribute-search-filter-toolbar"
        clearAllFilters={clearAllInternal} // Use the internal clear function
      >
        <ToolbarContent>
          <ToolbarToggleGroup toggleIcon={<FilterIcon />} breakpoint="xl">
            <ToolbarGroup variant="filter-group">
              <ToolbarItem id={`${id}-dropdown`}>{filterDropdown}</ToolbarItem>
              <ToolbarItem>
                <ThemeAwareSearchInput
                  data-testid={`${id}-search-input`}
                  value={searchValue}
                  onChange={onSearchChange}
                  placeholder={`Filter by ${activeFilterLabel}`}
                  fieldLabel={`Find by ${activeFilterLabel}`}
                  aria-label={`Filter by ${activeFilterLabel}`}
                />
              </ToolbarItem>
              {filters.map(
                (filter) =>
                  filter.value !== '' && (
                    <ToolbarFilter
                      key={`${filter.columnKey}-filter`}
                      labels={[filter.value]}
                      deleteLabel={() => onDeleteLabelGroup(filter)}
                      deleteLabelGroup={() => onDeleteLabelGroup(filter)}
                      categoryName={columnDefinition[filter.columnKey]}
                    >
                      {undefined}
                    </ToolbarFilter>
                  ),
              )}
            </ToolbarGroup>
            {toolbarActions}
          </ToolbarToggleGroup>
        </ToolbarContent>
      </Toolbar>
    );
  },
);

Filter.displayName = 'Filter';

export default Filter;
