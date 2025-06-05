import * as React from 'react';
import {
  Dropdown,
  DropdownList,
  MenuToggle,
  DropdownItem,
  Flex,
  FlexItem,
} from '@patternfly/react-core';

interface WorkspaceAggregatedDetailsActionsProps {
  onDeleteClick: React.MouseEventHandler;
}

export const WorkspaceAggregatedDetailsActions: React.FC<
  WorkspaceAggregatedDetailsActionsProps
> = ({ onDeleteClick }) => {
  const [isOpen, setOpen] = React.useState(false);

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
              ref={toggleRef}
              onClick={() => setOpen(!isOpen)}
              isExpanded={isOpen}
              aria-label="Workspace aggregated details action toggle"
              data-testid="workspace-aggregated-details-action-toggle"
            >
              Actions
            </MenuToggle>
          )}
        >
          <DropdownList>
            <DropdownItem
              id="workspace-aggregated-details-action-delete-button"
              aria-label="Delete selected workspace"
              key="delete-aggregated-workspace-button"
              onClick={onDeleteClick}
            >
              Delete selected
            </DropdownItem>
          </DropdownList>
        </Dropdown>
      </FlexItem>
    </Flex>
  );
};
