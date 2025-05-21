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
} from '@patternfly/react-core';
import { WorkspaceKind } from '~/shared/api/backendApiTypes';
import Filter, { FilteredColumn, FilterRef } from '~/shared/components/Filter';
import CustomEmptyState from '~/shared/components/CustomEmptyState';

type WorkspaceCreationKindListProps = {
  allWorkspaceKinds: WorkspaceKind[];
  selectedKind: WorkspaceKind | undefined;
  onSelect: (workspaceKind: WorkspaceKind | undefined) => void;
};

export const WorkspaceCreationKindList: React.FunctionComponent<WorkspaceCreationKindListProps> = ({
  allWorkspaceKinds,
  selectedKind,
  onSelect,
}) => {
  const [workspaceKinds, setWorkspaceKinds] = useState<WorkspaceKind[]>(allWorkspaceKinds);
  const filterRef = React.useRef<FilterRef>(null);

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

  const clearAllFilters = useCallback(() => {
    filterRef.current?.clearAll();
  }, []);

  const onChange = useCallback(
    (event: React.FormEvent<HTMLInputElement>) => {
      const newSelectedWorkspaceKind = workspaceKinds.find(
        (kind) => kind.name === event.currentTarget.name,
      );
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
              ref={filterRef}
              id="filter-workspace-images"
              onFilter={onFilter}
              columnNames={filterableColumns}
            />
          </ToolbarContent>
        </Toolbar>
      </PageSection>
      <PageSection isFilled>
        {workspaceKinds.length === 0 && <CustomEmptyState onClearFilters={clearAllFilters} />}
        {workspaceKinds.length > 0 && (
          <Gallery hasGutter aria-label="Selectable card container">
            {workspaceKinds.map((kind) => (
              <Card
                isCompact
                isSelectable
                key={kind.name}
                id={kind.name.replace(/ /g, '-')}
                isSelected={kind.name === selectedKind?.name}
              >
                <CardHeader
                  selectableActions={{
                    selectableActionId: `selectable-actions-item-${kind.name.replace(/ /g, '-')}`,
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
