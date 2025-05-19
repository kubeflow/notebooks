import * as React from 'react';
import {
  Button,
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
import { useNavigate } from 'react-router';
import { useCallback } from 'react';
import ThemeAwareSearchInput from '~/app/components/ThemeAwareSearchInput';

export interface FilterProps {
  id: string;
  onFilter: (filters: FilteredColumn[]) => void;
  columnNames: { [key: string]: string };
}

export interface FilteredColumn {
  columnName: string;
  value: string;
}

const Filter: React.FC<FilterProps> = ({ id, onFilter, columnNames }) => {
  const [activeFilter, setActiveFilter] = React.useState<FilteredColumn>({
    columnName: Object.values(columnNames)[0],
    value: '',
  });
  const [searchValue, setSearchValue] = React.useState<string>('');
  const [isFilterMenuOpen, setIsFilterMenuOpen] = React.useState<boolean>(false);
  const [filters, setFilters] = React.useState<FilteredColumn[]>([]);

  const filterToggleRef = React.useRef<MenuToggleElement | null>(null);
  const filterMenuRef = React.useRef<HTMLDivElement | null>(null);
  const filterContainerRef = React.useRef<HTMLDivElement | null>(null);

  const navigate = useNavigate();
  const createWorkspace = useCallback(() => {
    navigate('/workspaces/create');
  }, [navigate]);

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
      if (filterMenuRef.current) {
        const firstElement = filterMenuRef.current.querySelector('li > button:not(:disabled)');
        if (firstElement) {
          (firstElement as HTMLElement).focus();
        }
      }
      setIsFilterMenuOpen(!isFilterMenuOpen);
    },
    [isFilterMenuOpen],
  );

  const addFilter = React.useCallback(
    (filterObj: FilteredColumn) => {
      const index = filters.findIndex((filter) => filter.columnName === filterObj.columnName);
      const newFilters = filters;
      if (index !== -1) {
        newFilters[index] = filterObj;
      } else {
        newFilters.push(filterObj);
      }
      setFilters(newFilters);
    },
    [filters],
  );

  const onSearchChange = React.useCallback(
    (value: string) => {
      const newFilter = { columnName: activeFilter.columnName, value };
      setSearchValue(value);
      setActiveFilter(newFilter);
      addFilter(newFilter);
      onFilter(filters);
    },
    [activeFilter.columnName, addFilter, filters, onFilter],
  );

  const onDeleteLabelGroup = React.useCallback(
    (filter: FilteredColumn) => {
      const newFilters = filters.filter((filter1) => filter1.columnName !== filter.columnName);
      setFilters(newFilters);
      if (filter.columnName === activeFilter.columnName) {
        setSearchValue('');
      }
      onFilter(newFilters);
    },
    [activeFilter.columnName, filters, onFilter],
  );

  const onFilterSelect = React.useCallback(
    (itemId: string | number | undefined) => {
      setIsFilterMenuOpen(!isFilterMenuOpen);
      const index = filters.findIndex((filter) => filter.columnName === itemId);
      setSearchValue(index === -1 ? '' : filters[index].value);
      setActiveFilter({
        columnName: itemId ? itemId.toString() : Object.values(columnNames)[0],
        value: searchValue,
      });
    },
    [columnNames, filters, isFilterMenuOpen, searchValue],
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
      clearAllFilters={() => {
        setFilters([]);
        setSearchValue('');
        onFilter([]);
      }}
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
            {filters.map((filter) => (
              <ToolbarFilter
                key={`${filter.columnName}-filter`}
                labels={filter.value !== '' ? [filter.value] : ['']}
                deleteLabel={() => onDeleteLabelGroup(filter)}
                deleteLabelGroup={() => onDeleteLabelGroup(filter)}
                categoryName={filter.columnName}
              >
                {undefined}
              </ToolbarFilter>
            ))}
          </ToolbarGroup>
          <Button variant="primary" ouiaId="Primary" onClick={createWorkspace}>
            Create Workspace
          </Button>
        </ToolbarToggleGroup>
      </ToolbarContent>
    </Toolbar>
  );
};
export default Filter;
