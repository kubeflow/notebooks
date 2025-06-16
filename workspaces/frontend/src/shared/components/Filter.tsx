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
  onFilter: (filters: FilteredColumn[]) => void;
  columnNames: { [key: string]: string };
  toolbarActions?: React.ReactNode;
}

export interface FilteredColumn {
  columnName: string;
  value: string;
}

// Define the handle type that the parent will use to access the exposed function
export interface FilterRef {
  clearAll: () => void;
}

// Use forwardRef to allow parents to get a ref to this component instance
const Filter = React.forwardRef<FilterRef, FilterProps>(
  ({ id, onFilter, columnNames, toolbarActions }, ref) => {
    Filter.displayName = 'Filter';
    const [activeFilter, setActiveFilter] = useState<FilteredColumn>({
      columnName: Object.values(columnNames)[0],
      value: '',
    });
    const [searchValue, setSearchValue] = useState<string>('');
    const [isFilterMenuOpen, setIsFilterMenuOpen] = useState<boolean>(false);
    const [filters, setFilters] = useState<FilteredColumn[]>([]);

    const filterToggleRef = useRef<MenuToggleElement | null>(null);
    const filterMenuRef = useRef<HTMLDivElement | null>(null);
    const filterContainerRef = useRef<HTMLDivElement | null>(null);

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
        setFilters((prevFilters) => {
          const index = prevFilters.findIndex(
            (filter) => filter.columnName === filterObj.columnName,
          );
          const newFilters = [...prevFilters];

          if (filterObj.value === '') {
            const updatedFilters = newFilters.filter(
              (filter) => filter.columnName !== filterObj.columnName,
            );
            onFilter(updatedFilters);
            return updatedFilters;
          }
          if (index !== -1) {
            newFilters[index] = filterObj;
            onFilter(newFilters);
            return newFilters;
          }
          newFilters.push(filterObj);
          onFilter(newFilters);
          return newFilters;
        });
      },
      [onFilter],
    );

    const onSearchChange = useCallback(
      (value: string) => {
        setSearchValue(value);
        setActiveFilter((prevActiveFilter) => {
          const newActiveFilter = { ...prevActiveFilter, value };
          updateFilters(newActiveFilter);
          return newActiveFilter;
        });
      },
      [updateFilters],
    );

    const onDeleteLabelGroup = useCallback(
      (filter: FilteredColumn) => {
        setFilters((prevFilters) => {
          const newFilters = prevFilters.filter(
            (filter1) => filter1.columnName !== filter.columnName,
          );
          onFilter(newFilters);
          return newFilters;
        });
        if (filter.columnName === activeFilter.columnName) {
          setSearchValue('');
          setActiveFilter((prevActiveFilter) => ({
            ...prevActiveFilter,
            value: '',
          }));
        }
      },
      [activeFilter.columnName, onFilter],
    );

    // Expose the clearAllFilters logic via the ref
    const clearAllInternal = useCallback(() => {
      setFilters([]);
      setSearchValue('');
      setActiveFilter({
        columnName: Object.values(columnNames)[0],
        value: '',
      });
      onFilter([]);
    }, [columnNames, onFilter]);

    useImperativeHandle(ref, () => ({
      clearAll: clearAllInternal,
    }));

    const onFilterSelect = useCallback(
      (itemId: string | number | undefined) => {
        // Use the functional update form to toggle the state
        setIsFilterMenuOpen((prevIsMenuOpen) => !prevIsMenuOpen); // Fix is here

        const selectedColumnName = itemId ? itemId.toString() : Object.values(columnNames)[0];

        // Find the existing filter value for the selected column, if any
        const existingFilter = filters.find((filter) => filter.columnName === selectedColumnName);
        const existingValue = existingFilter ? existingFilter.value : '';

        setSearchValue(existingValue); // Set search input to the existing filter value
        setActiveFilter({
          columnName: selectedColumnName,
          value: existingValue, // Set the active filter value
        });
      },
      [columnNames, filters],
    );

    const filterMenuToggle = useMemo(
      () => (
        <MenuToggle
          ref={filterToggleRef}
          onClick={onFilterToggleClick}
          isExpanded={isFilterMenuOpen}
          icon={<FilterIcon />}
        >
          {activeFilter.columnName}
        </MenuToggle>
      ),
      [activeFilter.columnName, isFilterMenuOpen, onFilterToggleClick],
    );

    const filterMenu = useMemo(
      () => (
        <Menu ref={filterMenuRef} onSelect={(_ev, itemId) => onFilterSelect(itemId)}>
          <MenuContent>
            <MenuList>
              {Object.values(columnNames).map((name: string) => (
                <MenuItem id={`${id}-dropdown-${name}`} key={name} itemId={name}>
                  {name}
                </MenuItem>
              ))}
            </MenuList>
          </MenuContent>
        </Menu>
      ),
      [columnNames, id, onFilterSelect],
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
                  placeholder={`Filter by ${activeFilter.columnName}`}
                  fieldLabel={`Find by ${activeFilter.columnName}`}
                  aria-label={`Filter by ${activeFilter.columnName}`}
                />
              </ToolbarItem>
              {filters.map(
                (filter) =>
                  filter.value !== '' && (
                    <ToolbarFilter
                      key={`${filter.columnName}-filter`}
                      labels={[filter.value]}
                      deleteLabel={() => onDeleteLabelGroup(filter)}
                      deleteLabelGroup={() => onDeleteLabelGroup(filter)}
                      categoryName={filter.columnName}
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
export default Filter;
