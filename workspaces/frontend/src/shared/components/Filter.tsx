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
  SearchInput,
  Toolbar,
  ToolbarContent,
  ToolbarFilter,
  ToolbarGroup,
  ToolbarItem,
  ToolbarToggleGroup,
} from '@patternfly/react-core';
import { FilterIcon } from '@patternfly/react-icons';
import { FilterObj, FilterProps } from '~/shared/types';

const Filter: React.FC<FilterProps> = ({ id, onFilter, columnNames }) => {
  const [activeFilter, setActiveFilter] = React.useState<FilterObj>({
    filterName: Object.values(columnNames)[0],
    value: '',
  });
  const [searchValue, setSearchValue] = React.useState<string>('');
  const [isFilterMenuOpen, setIsFilterMenuOpen] = React.useState<boolean>(false);
  const [filters, setFilters] = React.useState<FilterObj[]>([]);

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
    (filterObj: FilterObj) => {
      const index = filters.findIndex((filter) => filter.filterName === filterObj.filterName);
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
      const newFilter = { filterName: activeFilter.filterName, value };
      setSearchValue(value);
      setActiveFilter(newFilter);
      addFilter(newFilter);
      onFilter(filters);
    },
    [activeFilter.filterName, addFilter, filters, onFilter],
  );

  const onDeleteLabelGroup = React.useCallback(
    (filter: FilterObj) => {
      const newFilters = filters.filter((filter1) => filter1.filterName !== filter.filterName);
      setFilters(newFilters);
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      filter.filterName === activeFilter.filterName && setSearchValue('');
      onFilter(newFilters);
    },
    [activeFilter.filterName, filters, onFilter],
  );

  const onFilterSelect = React.useCallback(
    (itemId: string | number | undefined) => {
      setIsFilterMenuOpen(!isFilterMenuOpen);
      const index = filters.findIndex((filter) => filter.filterName === itemId);
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      index === -1 ? setSearchValue('') : setSearchValue(filters[index].value);
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      setActiveFilter({ filterName: itemId, value: searchValue });
    },
    [filters, isFilterMenuOpen, searchValue],
  );

  const FilterMenuToggle = React.useMemo(
    () => (
      <MenuToggle
        ref={filterToggleRef}
        onClick={onFilterToggleClick}
        isExpanded={isFilterMenuOpen}
        icon={<FilterIcon />}
      >
        {activeFilter.filterName}
      </MenuToggle>
    ),
    [activeFilter.filterName, isFilterMenuOpen, onFilterToggleClick],
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
          trigger={FilterMenuToggle}
          triggerRef={filterToggleRef}
          popper={filterMenu}
          popperRef={filterMenuRef}
          appendTo={filterContainerRef.current || undefined}
          isVisible={isFilterMenuOpen}
        />
      </div>
    ),
    [FilterMenuToggle, filterMenu, isFilterMenuOpen],
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
          <ToolbarItem id={`${id}-dropdown`}>{filterDropdown}</ToolbarItem>
          <ToolbarGroup variant="filter-group">
            {filters.map((filter) => (
              <ToolbarFilter
                key={`${filter.filterName}-filter`}
                labels={filter.value !== '' ? [filter.value] : ['']}
                deleteLabel={() => onDeleteLabelGroup(filter)}
                deleteLabelGroup={() => onDeleteLabelGroup(filter)}
                categoryName={filter.filterName}
              >
                {undefined}
              </ToolbarFilter>
            ))}
          </ToolbarGroup>
          <SearchInput
            id={`${id}-search-input`}
            placeholder={`Filter by ${activeFilter.filterName}`}
            value={searchValue}
            onChange={(_event, value) => onSearchChange(value)}
            onClear={() => onSearchChange('')}
          />
        </ToolbarToggleGroup>
        <Button variant="primary" ouiaId="Primary">
          Create Workspace
        </Button>
      </ToolbarContent>
    </Toolbar>
  );
};
export default Filter;
