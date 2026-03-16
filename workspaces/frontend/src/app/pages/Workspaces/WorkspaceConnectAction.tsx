import {
  Dropdown,
  DropdownItem,
  DropdownList,
} from '@patternfly/react-core/dist/esm/components/Dropdown';
import {
  MenuToggle,
  MenuToggleElement,
} from '@patternfly/react-core/dist/esm/components/MenuToggle';
import React, { useState } from 'react';
import { WorkspacesWorkspaceListItem, WorkspacesWorkspaceState } from '~/generated/data-contracts';

type WorkspaceConnectActionProps = {
  workspace: WorkspacesWorkspaceListItem;
};

export const WorkspaceConnectAction: React.FunctionComponent<WorkspaceConnectActionProps> = ({
  workspace,
}) => {
  const [open, setIsOpen] = useState(false);

  const onToggleClick = () => {
    setIsOpen(!open);
  };

  const onSelect = (
    _event: React.MouseEvent<Element, MouseEvent> | undefined,
    value: string | number | undefined,
  ) => {
    setIsOpen(false);
    if (typeof value === 'string') {
      openEndpoint(value);
    }
  };

  const openEndpoint = (value: string) => {
    window.open(value, '_blank');
  };

  return (
    <Dropdown
      isOpen={open}
      onSelect={onSelect}
      onOpenChange={(isOpen: boolean) => setIsOpen(isOpen)}
      toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
        <MenuToggle
          ref={toggleRef}
          variant="secondary"
          onClick={onToggleClick}
          isExpanded={open}
          isDisabled={workspace.state !== WorkspacesWorkspaceState.WorkspaceStateRunning}
          aria-label="Select connection endpoint"
        >
          Connect
        </MenuToggle>
      )}
      ouiaId="BasicDropdown"
      shouldFocusToggleOnSelect
    >
      <DropdownList>
        {workspace.services.map((service) => {
          if (!service.httpService) {
            return null;
          }
          return (
            <DropdownItem
              value={service.httpService.httpPath}
              key={`${workspace.name}-${service.httpService.displayName}`}
            >
              {service.httpService.displayName}
            </DropdownItem>
          );
        })}
      </DropdownList>
    </Dropdown>
  );
};
