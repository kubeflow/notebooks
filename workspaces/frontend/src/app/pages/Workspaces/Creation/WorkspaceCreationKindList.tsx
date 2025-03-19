import React, { useCallback, useMemo, useState } from 'react';
import {
  CardBody,
  CardTitle,
  Gallery,
  PageSection,
  Toolbar,
  ToolbarContent,
  Card,
  CardHeader,
  EmptyState,
  EmptyStateBody,
} from '@patternfly/react-core';
import { SearchIcon } from '@patternfly/react-icons/dist/esm/icons/search-icon';
import { WorkspaceKind } from '~/shared/types';
import Filter, { FilteredColumn } from '~/shared/components/Filter';

type WorkspaceCreationKindListProps = {
  allWorkspaceKinds: WorkspaceKind[];
  onSelect: (workspaceKind: WorkspaceKind) => void;
};

export const WorkspaceCreationKindList: React.FunctionComponent<WorkspaceCreationKindListProps> = ({
  allWorkspaceKinds,
  onSelect,
}) => {
  const [workspaceKinds, setWorkspaceKinds] = useState<WorkspaceKind[]>(allWorkspaceKinds);
  const [selectedWorkspaceKind, setSelectedWorkspaceKind] = useState<WorkspaceKind>();

  const filterableColumns = useMemo(
    () => ({
      name: 'Name',
    }),
    [],
  );

  const onFilter = useCallback(
    (filters: FilteredColumn[]) => {
      // Search name with search value
      let filteredWorkspaceKinds = allWorkspaceKinds;
      filters.forEach((filter) => {
        let searchValueInput: RegExp;
        try {
          searchValueInput = new RegExp(filter.value, 'i');
        } catch {
          searchValueInput = new RegExp(filter.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        }

        filteredWorkspaceKinds = filteredWorkspaceKinds.filter((kind) => {
          if (filter.value === '') {
            return true;
          }
          switch (filter.columnName) {
            case filterableColumns.name:
              return (
                kind.name.search(searchValueInput) >= 0 ||
                kind.displayName.search(searchValueInput) >= 0
              );
            default:
              return true;
          }
        });
      });
      setWorkspaceKinds(filteredWorkspaceKinds);
    },
    [filterableColumns, allWorkspaceKinds],
  );

  const onChange = useCallback(
    (event: React.FormEvent<HTMLInputElement>) => {
      const newSelectedWorkspaceKind = workspaceKinds.find(
        (kind) => kind.name === event.currentTarget.name,
      );
      setSelectedWorkspaceKind(newSelectedWorkspaceKind);
      onSelect(newSelectedWorkspaceKind);
    },
    [workspaceKinds, onSelect],
  );

  return (
    <>
      <PageSection>
        <Toolbar id="toolbar-group-types">
          <ToolbarContent>
            <Filter
              id="filter-workspace-kinds"
              onFilter={onFilter}
              columnNames={filterableColumns}
            />
          </ToolbarContent>
        </Toolbar>
      </PageSection>
      <PageSection isFilled>
        {workspaceKinds.length === 0 && (
          <EmptyState titleText="No results found" headingLevel="h4" icon={SearchIcon}>
            <EmptyStateBody>
              No results match the filter criteria. Clear all filters and try again.
            </EmptyStateBody>
          </EmptyState>
        )}
        {workspaceKinds.length > 0 && (
          <Gallery hasGutter aria-label="Selectable card container">
            {workspaceKinds.map((kind) => (
              <Card
                isCompact
                isSelectable
                key={kind.name}
                id={kind.name.replace(/ /g, '-')}
                isSelected={kind.name === selectedWorkspaceKind?.name}
              >
                <CardHeader
                  selectableActions={{
                    selectableActionId: `selectable-actions-item-${kind.name}`,
                    selectableActionAriaLabelledby: kind.name.replace(/ /g, '-'),
                    name: kind.name,
                    variant: 'single',
                    onChange,
                  }}
                >
                  <img src={kind.icon.url} alt={`${kind.name} icon`} style={{ maxWidth: '60px' }} />
                  <CardTitle>{kind.displayName}</CardTitle>
                </CardHeader>
                <CardBody>{kind.description}</CardBody>
              </Card>
            ))}
          </Gallery>
        )}
      </PageSection>
    </>
  );
};
