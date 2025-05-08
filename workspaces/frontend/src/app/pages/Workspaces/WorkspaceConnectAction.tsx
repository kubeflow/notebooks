import React from 'react';
import {
  Dropdown,
  DropdownItem,
  DropdownList,
  MenuToggle,
  MenuToggleElement,
  MenuToggleAction,
} from '@patternfly/react-core';
import { Workspace, WorkspaceState } from '~/shared/types';

type WorkspaceConnectActionProps = {
  workspace: Workspace;
};

export const WorkspaceConnectAction: React.FunctionComponent<WorkspaceConnectActionProps> = ({
  workspace,
}) => {
  const [open, setIsOpen] = React.useState(false);

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
    openEndpoint(workspace.podTemplate.endpoints[0].port);
  };

  const openEndpoint = (port: string) => {
    window.open(`workspace/${workspace.namespace}/${workspace.name}/${port}`, '_blank');
  };

  return (
    <Dropdown
      isOpen={open}
      onSelect={onSelect}
      onOpenChange={(isOpen: boolean) => setIsOpen(isOpen)}
      toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
        <MenuToggle
          ref={toggleRef}
          onClick={onToggleClick}
          isExpanded={open}
          isDisabled={workspace.status.state !== WorkspaceState.Running}
          splitButtonItems={[
            <MenuToggleAction
              id="connect-endpoint-button"
              key="connect-endpoint-button"
              onClick={onClickConnect}
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
        {workspace.podTemplate.endpoints.map((endpoint) => (
          <DropdownItem value={endpoint.port} key={`${workspace.name}-${endpoint.port}`}>
            {endpoint.displayName}
          </DropdownItem>
        ))}
      </DropdownList>
    </Dropdown>
  );
};
