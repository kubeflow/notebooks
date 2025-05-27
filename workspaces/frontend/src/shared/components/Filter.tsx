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
import { SimpleSelect } from 'mod-arch-shared';

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
      const [activeFilter, setActiveFilter] = React.useState<FilteredColumn>({
        columnName: Object.values(columnNames)[0],
        value: '',
    });
    const [searchValue, setSearchValue] = React.useState<string>('');
    const [isFilterMenuOpen, setIsFilterMenuOpen] = React.useState<boolean>(false);
    const [filters, setFilters] = React.useState<FilteredColumn[]>([]);

    const filterToggleRef = React.useRef<MenuToggleElement | null>(null);
    const filterMenuRef = React.useRef<HTMLDivElement | null>(null);

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

    const updateFilters = React.useCallback(
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

    const onSearchChange = React.useCallback(
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

    const onDeleteLabelGroup = React.useCallback(
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
    const clearAllInternal = React.useCallback(() => {
      setFilters([]);
      setSearchValue('');
      setActiveFilter({
        columnName: Object.values(columnNames)[0],
        value: '',
      });
      onFilter([]);
    }, [columnNames, onFilter]);

    React.useImperativeHandle(ref, () => ({
      clearAll: clearAllInternal,
    }));

    const onFilterSelect = React.useCallback(
      (newColumnName: string | number | undefined) => {
        const selectedKey = typeof newColumnName === 'string' ? newColumnName : Object.keys(columnNames)[0];
        if (selectedKey && columnNames[selectedKey]) {
            setActiveFilter({
                columnName: columnNames[selectedKey],
                value: '',
            });
            setSearchValue('');
        }
        setIsFilterMenuOpen(false);
      },
      [columnNames],
    );

    const filterOptions = React.useMemo(() => {
        return Object.entries(columnNames).map(([key, label]) => ({
            key: key,
            label: label
        }));
    }, [columnNames]);
    
    const currentActiveFilterKey = React.useMemo(() => {
        const entry = Object.entries(columnNames).find(([, label]) => label === activeFilter.columnName);
        return entry ? entry[0] : Object.keys(columnNames)[0];
    }, [activeFilter.columnName, columnNames]);

    const [search, setSearch] = React.useState('');
    const resetFilters = () => setSearch('');

    return (
      <Toolbar
        id="attribute-search-filter-toolbar"
        clearAllFilters={clearAllInternal}
      >
        <ToolbarContent>
          <ToolbarToggleGroup toggleIcon={<FilterIcon />} breakpoint="xl">
            <ToolbarGroup variant="filter-group">
              <ToolbarFilter
                labels={search === '' ? [] : [search]}
                deleteLabel={resetFilters}
                deleteLabelGroup={clearAllInternal}
                categoryName="Keyword"
              >
                <SimpleSelect
                  options={filterOptions}
                  value={currentActiveFilterKey || ''}
                  onChange={(newKey) => {
                    const selectedEntry = filterOptions.find(opt => opt.key === newKey);
                    if (selectedEntry) {
                      onFilterSelect(selectedEntry.key);
                    }
                  }}
                  icon={<FilterIcon />}
                />
              </ToolbarFilter>
              <ToolbarItem>
                <ThemeAwareSearchInput
                  data-testid={`${id}-search-input`}
                  value={searchValue}
                  onChange={onSearchChange}
                  placeholder={`Filter by ${activeFilter.columnName.toLowerCase()}`}
                  fieldLabel={`Find by ${activeFilter.columnName.toLowerCase()}`}
                  aria-label={`Filter by ${activeFilter.columnName.toLowerCase()}`}
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
