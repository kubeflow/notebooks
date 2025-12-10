import React, { useState } from 'react';
import {
  Dropdown,
  DropdownItem,
  DropdownList,
} from '@patternfly/react-core/dist/esm/components/Dropdown';
import { MenuToggle } from '@patternfly/react-core/dist/esm/components/MenuToggle';
import { Flex, FlexItem } from '@patternfly/react-core/dist/esm/layouts/Flex';

interface WorkspaceDetailsActionsProps {
  onEditClick: React.MouseEventHandler;
  onDeleteClick: React.MouseEventHandler;
}

export const WorkspaceDetailsActions: React.FC<WorkspaceDetailsActionsProps> = ({
  onEditClick,
  onDeleteClick,
}) => {
  const [isOpen, setOpen] = useState(false);

  return (
    <Flex>
      <FlexItem>
        <Dropdown
          isOpen={isOpen}
          onSelect={() => setOpen(false)}
          onOpenChange={(open) => setOpen(open)}
          popperProps={{ position: 'end' }}
          toggle={(toggleRef) => (
            <MenuToggle
              variant="primary"
              className="workspace-details-action-toggle"
              ref={toggleRef}
              onClick={() => setOpen(!isOpen)}
              isExpanded={isOpen}
              aria-label="Workspace details action toggle"
              data-testid="workspace-details-action-toggle"
            >
              Actions
            </MenuToggle>
          )}
        >
          <DropdownList>
            <DropdownItem
              id="workspace-details-action-edit-button"
              data-testid="workspace-details-action-edit-button"
              aria-label="Edit workspace"
              key="edit-workspace-button"
              onClick={onEditClick}
            >
              Edit
            </DropdownItem>
            <DropdownItem
              id="workspace-details-action-delete-button"
              data-testid="workspace-details-action-delete-button"
              aria-label="Delete workspace"
              key="delete-workspace-button"
              onClick={onDeleteClick}
            >
              Delete
            </DropdownItem>
          </DropdownList>
        </Dropdown>
      </FlexItem>
    </Flex>
  );
};
