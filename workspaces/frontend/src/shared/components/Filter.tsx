import * as React from 'react';
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
  ({ id, filters, setFilters, columnNames, toolbarActions }, ref) => {
    const [activeFilter, setActiveFilter] = React.useState<FilteredColumn>({
      columnName: filters[0]?.columnName ?? Object.values(columnNames)[0],
      value: filters[0]?.value ?? '',
    });
    const [searchValue, setSearchValue] = React.useState<string>(activeFilter.value || '');
    const [isFilterMenuOpen, setIsFilterMenuOpen] = React.useState<boolean>(false);

    const filterToggleRef = React.useRef<MenuToggleElement | null>(null);
    const filterMenuRef = React.useRef<HTMLDivElement | null>(null);
    const filterContainerRef = React.useRef<HTMLDivElement | null>(null);

    const handleFilterMenuKeys = React.useCallback(
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

    const handleClickOutside = React.useCallback(
      (event: MouseEvent) => {
        if (isFilterMenuOpen && !filterMenuRef.current?.contains(event.target as Node)) {
          setIsFilterMenuOpen(false);
        }
      },
      [isFilterMenuOpen, filterMenuRef],
    );

    React.useEffect(() => {
      window.addEventListener('keydown', handleFilterMenuKeys);
      window.addEventListener('click', handleClickOutside);
      return () => {
        window.removeEventListener('keydown', handleFilterMenuKeys);
        window.removeEventListener('click', handleClickOutside);
      };
    }, [isFilterMenuOpen, filterMenuRef, handleFilterMenuKeys, handleClickOutside]);

    const onFilterToggleClick = React.useCallback(
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

    const updateFilters = React.useCallback(
      (filterObj: FilteredColumn) => {
        const index = filters.findIndex((filter) => filter.columnName === filterObj.columnName);
        const newFilters = [...filters];

        if (filterObj.value === '') {
          const updatedFilters = newFilters.filter(
            (filter) => filter.columnName !== filterObj.columnName,
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

    const onSearchChange = React.useCallback((value: string) => {
      setSearchValue(value);
      setActiveFilter((prevActiveFilter) => ({
        ...prevActiveFilter,
        value,
      }));
    }, []);

    React.useEffect(() => {
      updateFilters({ ...activeFilter, value: searchValue });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchValue]);

    const onDeleteLabelGroup = React.useCallback(
      (filter: FilteredColumn) => {
        setFilters([...filters.filter((f) => f.columnName !== filter.columnName)]);
        if (filter.columnName === activeFilter.columnName) {
          setSearchValue('');
          setActiveFilter((prevActiveFilter) => ({
            ...prevActiveFilter,
            value: '',
          }));
        }
      },
      [activeFilter.columnName, filters, setFilters],
    );

    // Expose the clearAllFilters logic via the ref
    const clearAllInternal = React.useCallback(() => {
      setFilters([]);
      setSearchValue('');
      setActiveFilter({
        columnName: Object.values(columnNames)[0],
        value: '',
      });
      setFilters([]);
    }, [columnNames, setFilters]);

    React.useImperativeHandle(ref, () => ({
      clearAll: clearAllInternal,
    }));

    const onFilterSelect = React.useCallback(
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

    const filterMenuToggle = React.useMemo(
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

    const filterMenu = React.useMemo(
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

    const filterDropdown = React.useMemo(
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

Filter.displayName = 'Filter';

export default Filter;
