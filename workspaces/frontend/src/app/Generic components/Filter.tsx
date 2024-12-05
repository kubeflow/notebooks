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

interface FilterProps {
  onFilter: (activeAttributeMenu: string, value: string) => void;
  columnNames: { [key: string]: string };
}

const Filter: React.FC<FilterProps> = ({ onFilter, columnNames }) => {
  const [activeFilter, setActiveFilter] = React.useState<string>(Object.values(columnNames)[0]);
  const [searchValue, setSearchValue] = React.useState('');
  const [isFilterMenuOpen, setIsFilterMenuOpen] = React.useState(false);

  const filterToggleRef = React.useRef<MenuToggleElement | null>(null);
  const filterMenuRef = React.useRef<HTMLDivElement | null>(null);
  const filterContainerRef = React.useRef<HTMLDivElement | null>(null);

  const handlefilterMenuKeys = React.useCallback(
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
    window.addEventListener('keydown', handlefilterMenuKeys);
    window.addEventListener('click', handleClickOutside);
    return () => {
      window.removeEventListener('keydown', handlefilterMenuKeys);
      window.removeEventListener('click', handleClickOutside);
    };
  }, [isFilterMenuOpen, filterMenuRef, handlefilterMenuKeys, handleClickOutside]);

  const onFilterToggleClick = (ev: React.MouseEvent) => {
    ev.stopPropagation(); // Stop handleClickOutside from handling
    setTimeout(() => {
      if (filterMenuRef.current) {
        const firstElement = filterMenuRef.current.querySelector('li > button:not(:disabled)');
        if (firstElement) {
          (firstElement as HTMLElement).focus();
        }
      }
    }, 0);
    setIsFilterMenuOpen(!isFilterMenuOpen);
  };

  const FilterMenuToggle = (
    <MenuToggle
      ref={filterToggleRef}
      onClick={onFilterToggleClick}
      isExpanded={isFilterMenuOpen}
      icon={<FilterIcon />}
    >
      {activeFilter}
    </MenuToggle>
  );

  const filterMenu = (
    <Menu
      ref={filterMenuRef}
      onSelect={(_ev, itemId) => {
        setActiveFilter(itemId);
        setIsFilterMenuOpen(!isFilterMenuOpen);
      }}
    >
      <MenuContent>
        <MenuList>
          {Object.values(columnNames).map((name: string) => (
            <MenuItem key={name} itemId={name}>
              {name}
            </MenuItem>
          ))}
        </MenuList>
      </MenuContent>
    </Menu>
  );

  const filterDropdown = (
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
  );

  const onSearchChange = (value: string) => {
    setSearchValue(value);
    onFilter(activeFilter, value);
  };

  return (
    <Toolbar
      id="attribute-search-filter-toolbar"
      clearAllFilters={() => {
        onSearchChange('');
      }}
    >
      <ToolbarContent>
        <ToolbarToggleGroup toggleIcon={<FilterIcon />} breakpoint="xl">
          <ToolbarGroup variant="filter-group">
            <ToolbarItem>{filterDropdown}</ToolbarItem>
            <ToolbarFilter
              labels={searchValue !== '' ? [searchValue] : ([] as string[])}
              deleteLabel={() => setSearchValue('')}
              deleteLabelGroup={() => setSearchValue('')}
              categoryName={activeFilter}
            >
              <SearchInput
                placeholder={`Filter by ${activeFilter}`}
                value={searchValue}
                onChange={(_event, value) => onSearchChange(value)}
                onClear={() => onSearchChange('')}
              />
            </ToolbarFilter>
          </ToolbarGroup>
        </ToolbarToggleGroup>
        <Button variant="primary" ouiaId="Primary">
          Create Workspace
        </Button>
      </ToolbarContent>
    </Toolbar>
  );
};
export default Filter;
