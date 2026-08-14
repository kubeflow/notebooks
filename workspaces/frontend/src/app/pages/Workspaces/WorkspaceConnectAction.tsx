import {
  Dropdown,
  DropdownItem,
  DropdownList,
} from '@patternfly/react-core/dist/esm/components/Dropdown';
import {
  MenuToggle,
  MenuToggleAction,
  MenuToggleElement,
} from '@patternfly/react-core/dist/esm/components/MenuToggle';
import React, { useState } from 'react';
import { WorkspacesWorkspaceListItem, V1Beta1WorkspaceState } from '~/generated/data-contracts';

type WorkspaceConnectActionProps = {
  workspace: WorkspacesWorkspaceListItem;
};

export const WorkspaceConnectAction: React.FunctionComponent<WorkspaceConnectActionProps> = ({
  workspace,
}) => {
  const [open, setIsOpen] = useState(false);

  const httpServices = workspace.services.filter((service) => service.httpService);
  const hasMultipleEndpoints = httpServices.length > 1;
  const isRunning = workspace.state === V1Beta1WorkspaceState.WorkspaceStateRunning;
  const isDisabled = !isRunning || httpServices.length === 0;

  const openEndpoint = (value: string) => {
    window.open(value, '_blank');
  };

  const onPrimaryConnect = () => {
    setIsOpen(false);
    const primary = httpServices[0]?.httpService;
    if (primary) {
      openEndpoint(primary.httpPath);
    }
  };

  const onToggleClick = () => {
    // Only open the dropdown when there is a choice to make; with a single
    // endpoint the caret behaves like the primary action and connects directly.
    if (hasMultipleEndpoints) {
      setIsOpen(!open);
    } else {
      onPrimaryConnect();
    }
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
          isDisabled={isDisabled}
          aria-label="Select connection endpoint"
          splitButtonItems={[
            <MenuToggleAction
              id={`${workspace.name}-connect`}
              key={`${workspace.name}-connect`}
              aria-label="Connect"
              isDisabled={isDisabled}
              onClick={onPrimaryConnect}
            >
              Connect
            </MenuToggleAction>,
          ]}
          ouiaId="BasicDropdown"
        />
      )}
      shouldFocusToggleOnSelect
    >
      <DropdownList>
        {httpServices.map((service) => {
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
