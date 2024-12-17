import React, { FC, useMemo, useState } from 'react';
import {
  Dropdown,
  DropdownItem,
  MenuToggle,
  DropdownList,
  DropdownProps,
} from '@patternfly/react-core';
import { useNamespaceContext } from '../../app/context/NamespaceContextProvider';

const NamespaceSelector: FC = () => {
  const { namespaces, selectedNamespace, setSelectedNamespace } = useNamespaceContext();
  const [isOpen, setIsOpen] = useState<boolean>(false);

  const onSelect: DropdownProps['onSelect'] = (_event, value) => {
    setSelectedNamespace(value as string);
    setIsOpen(false);
  };

  const dropdownItems = useMemo(
    () =>
      namespaces.map((ns) => (
        <DropdownItem
          key={ns}
          itemId={ns}
          className="namespace-list-items"
          data-testid={`dropdown-item-${ns}`}
        >
          {ns}
        </DropdownItem>
      )),
    [namespaces],
  );

  return (
    <Dropdown
      onSelect={onSelect}
      toggle={(toggleRef) => (
        <MenuToggle
          ref={toggleRef}
          onClick={() => setIsOpen(!isOpen)}
          isExpanded={isOpen}
          className="namespace-select-toggle"
          data-testid="namespace-toggle"
        >
          {selectedNamespace}
        </MenuToggle>
      )}
      isOpen={isOpen}
      data-testid="namespace-dropdown"
    >
      <DropdownList>{dropdownItems}</DropdownList>
    </Dropdown>
  );
};

export default NamespaceSelector;
