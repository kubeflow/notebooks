import React, { useState } from 'react';
import {
  Dropdown,
  DropdownItem,
  DropdownList,
} from '@patternfly/react-core/dist/esm/components/Dropdown';
import {
  MenuToggle,
  MenuToggleElement,
  MenuToggleAction,
} from '@patternfly/react-core/dist/esm/components/MenuToggle';
import { WorkspacesWorkspace, WorkspacesWorkspaceState } from '~/generated/data-contracts';

type WorkspaceConnectActionProps = {
  workspace: WorkspacesWorkspace;
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

  const onClickConnect = () => {
    if (workspace.services.length === 0 || !workspace.services[0].httpService) {
      return;
    }

    openEndpoint(workspace.services[0].httpService.httpPath);
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
          splitButtonItems={[
            <MenuToggleAction
              id="connect-endpoint-button"
              key="connect-endpoint-button"
              onClick={onClickConnect}
              className="connect-button-no-wrap"
            >
              Connect
            </MenuToggleAction>,
          ]}
        />
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
