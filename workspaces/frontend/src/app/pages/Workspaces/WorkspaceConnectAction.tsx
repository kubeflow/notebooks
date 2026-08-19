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
import {
  WorkspacesWorkspaceListItem,
  WorkspacesHttpService,
  V1Beta1WorkspaceState,
} from '~/generated/data-contracts';

type WorkspaceConnectActionProps = {
  workspace: WorkspacesWorkspaceListItem;
};

export const WorkspaceConnectAction: React.FunctionComponent<WorkspaceConnectActionProps> = ({
  workspace,
}) => {
  const [open, setIsOpen] = useState(false);

  const connectableServices = workspace.services
    .map((service) => service.httpService)
    .filter((httpService): httpService is WorkspacesHttpService => !!httpService);

  const isDisabled = workspace.state !== V1Beta1WorkspaceState.WorkspaceStateRunning;

  const openEndpoint = (value: string) => {
    window.open(value, '_blank');
  };

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

  // With a single endpoint there is nothing to choose, so skip the dropdown and
  // connect directly. We still render a MenuToggle (rather than a plain Button)
  // so the control keeps the exact same size as the multi-endpoint variant; the
  // `--direct` modifier rotates its caret to point right, signalling that the
  // click connects immediately instead of opening a menu.
  if (connectableServices.length === 1) {
    return (
      <MenuToggle
        variant="secondary"
        className="kubeflow-connect-toggle--direct"
        isDisabled={isDisabled}
        onClick={() => openEndpoint(connectableServices[0].httpPath)}
        aria-label="Connect to workspace"
      >
        Connect
      </MenuToggle>
    );
  }

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
        >
          Connect
        </MenuToggle>
      )}
      ouiaId="BasicDropdown"
      shouldFocusToggleOnSelect
    >
      <DropdownList>
        {connectableServices.map((httpService) => (
          <DropdownItem
            value={httpService.httpPath}
            key={`${workspace.name}-${httpService.displayName}`}
          >
            {httpService.displayName}
          </DropdownItem>
        ))}
      </DropdownList>
    </Dropdown>
  );
};
