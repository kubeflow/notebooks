import React from "react";
import {
  Dropdown,
  DropdownItem,
  DropdownList,
  MenuToggle,
  MenuToggleElement,
} from "@patternfly/react-core";
import { Workspace, WorkspaceState } from "~/shared/types";

type EndpointsDropdownProps = {
  workspace: Workspace;
};

export const EndpointsDropdown: React.FunctionComponent<EndpointsDropdownProps> = ({workspace}) => {
  const [isOpen, setIsOpen] = React.useState(false);

  const onToggleClick = () => {
    setIsOpen(!isOpen);
  };

  const onSelect = (
    _event: React.MouseEvent<Element, MouseEvent> | undefined,
    value: string | number | undefined) => {
    setIsOpen(false);
    if (typeof value === 'string'){
      openEndpoint(value);
    }
  };

  const openEndpoint = (port: string) => {
    window.open(`workspace/${workspace.namespace}/${workspace.name}/${port}`, '_blank'); 
  };

  return (
    <Dropdown
      isOpen={isOpen}
      onSelect={onSelect}
      onOpenChange={(isOpen: boolean) => setIsOpen(isOpen)}
      toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
        <MenuToggle
          ref={toggleRef}
          onClick={onToggleClick}
          isExpanded={isOpen}
          isFullWidth={true}
          isDisabled={workspace.status.state != WorkspaceState.Running}
        >Connect
        </MenuToggle>
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