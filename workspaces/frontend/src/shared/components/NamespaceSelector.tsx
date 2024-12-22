import React, { FC, useMemo, useState, useEffect } from 'react';
import {
  Dropdown,
  DropdownItem,
  MenuToggle,
  DropdownList,
  DropdownProps,
  MenuSearch,
  MenuSearchInput,
  InputGroup,
  InputGroupItem,
  SearchInput,
  Button,
  ButtonVariant,
  Divider,
} from '@patternfly/react-core';
import { SearchIcon } from '@patternfly/react-icons/dist/esm/icons/search-icon';
import { useNamespaceContext } from '~/app/context/NamespaceContextProvider';

const NamespaceSelector: FC = () => {
  const { namespaces, selectedNamespace, setSelectedNamespace } = useNamespaceContext();
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [searchInputValue, setSearchInputValue] = useState<string>('');
  const [filteredNamespaces, setFilteredNamespaces] = useState<string[]>(namespaces);

  useEffect(() => {
    setFilteredNamespaces(namespaces);
  }, [namespaces]);

  const onToggleClick = () => {
    if (!isOpen) {
      onClearSearch();
    }
    setIsOpen(!isOpen);
  };

  const onSearchInputChange = (value: string) => {
    setSearchInputValue(value);
  };

  const onSearchButtonClick = () => {
    const filtered =
      searchInputValue === ''
        ? namespaces
        : namespaces.filter((ns) => ns.toLowerCase().includes(searchInputValue.toLowerCase()));
    setFilteredNamespaces(filtered);
  };

  const onEnterPressed = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      onSearchButtonClick();
    }
  };

  const onSelect: DropdownProps['onSelect'] = (_event, value) => {
    setSelectedNamespace(value as string);
    setIsOpen(false);
  };

  const onClearSearch = () => {
    setSearchInputValue('');
    setFilteredNamespaces(namespaces);
  };

  const dropdownItems = useMemo(
    () =>
      filteredNamespaces.map((ns) => (
        <DropdownItem
          key={ns}
          itemId={ns}
          className="namespace-list-items"
          data-testid={`dropdown-item-${ns}`}
        >
          {ns}
        </DropdownItem>
      )),
    [filteredNamespaces],
  );

  return (
    <Dropdown
      onSelect={onSelect}
      toggle={(toggleRef) => (
        <MenuToggle
          ref={toggleRef}
          onClick={onToggleClick}
          isExpanded={isOpen}
          className="namespace-select-toggle"
          data-testid="namespace-toggle"
        >
          {selectedNamespace}
        </MenuToggle>
      )}
      isOpen={isOpen}
      isScrollable
      data-testid="namespace-dropdown"
    >
      <MenuSearch>
        <MenuSearchInput>
          <InputGroup>
            <InputGroupItem isFill>
              <SearchInput
                value={searchInputValue}
                placeholder="Search Namespace"
                onChange={(_event, value) => onSearchInputChange(value)}
                onKeyDown={onEnterPressed}
                onClear={onClearSearch}
                // resetButtonLabel="Clear search"
                aria-labelledby="namespace-search-button"
              />
            </InputGroupItem>
            <InputGroupItem>
              <Button
                variant={ButtonVariant.control}
                aria-label="Search namespace"
                id="namespace-search-button"
                onClick={onSearchButtonClick}
                icon={<SearchIcon aria-hidden="true" />}
              />
            </InputGroupItem>
          </InputGroup>
        </MenuSearchInput>
      </MenuSearch>
      <Divider />
      <DropdownList>{dropdownItems}</DropdownList>
    </Dropdown>
  );
};

export default NamespaceSelector;
