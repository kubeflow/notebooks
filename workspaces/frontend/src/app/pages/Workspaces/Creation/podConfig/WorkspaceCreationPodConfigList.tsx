import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CardTitle,
  Gallery,
  PageSection,
  Toolbar,
  ToolbarContent,
  Card,
  CardHeader,
  CardBody,
} from '@patternfly/react-core';
import { WorkspacePodConfig } from '~/shared/types';
import Filter, { FilteredColumn, FilterRef } from '~/shared/components/Filter';
import EmptyStateWithClearFilters from 'shared/components/EmptyStateWithClearFilters';

type WorkspaceCreationPodConfigListProps = {
  podConfigs: WorkspacePodConfig[];
  selectedLabels: Map<string, Set<string>>;
  selectedPodConfig: WorkspacePodConfig | undefined;
  onSelect: (workspacePodConfig: WorkspacePodConfig | undefined) => void;
};

export const WorkspaceCreationPodConfigList: React.FunctionComponent<
  WorkspaceCreationPodConfigListProps
> = ({ podConfigs, selectedLabels, selectedPodConfig, onSelect }) => {
  const [workspacePodConfigs, setWorkspacePodConfigs] = useState<WorkspacePodConfig[]>(podConfigs);
  const [filters, setFilters] = useState<FilteredColumn[]>([]);

  const filterRef = React.useRef<FilterRef>(null);

  const filterableColumns = useMemo(
    () => ({
      name: 'Name',
    }),
    [],
  );

  const getFilteredWorkspacePodConfigsByLabels = useCallback(
    (unfilteredPodConfigs: WorkspacePodConfig[]) =>
      unfilteredPodConfigs.filter((podConfig) =>
        Object.keys(podConfig.labels).reduce((accumulator, labelKey) => {
          const labelValue = podConfig.labels[labelKey];
          if (selectedLabels.has(labelKey)) {
            const labelValues: Set<string> | undefined = selectedLabels.get(labelKey);
            return accumulator && labelValues !== undefined && labelValues.has(labelValue);
          }
          return accumulator;
        }, true),
      ),
    [selectedLabels],
  );

  const onChange = useCallback(
    (event: React.FormEvent<HTMLInputElement>) => {
      const newSelectedWorkspacePodConfig = workspacePodConfigs.find(
        (podConfig) => podConfig.displayName === event.currentTarget.name,
      );
      onSelect(newSelectedWorkspacePodConfig);
    },
    [workspacePodConfigs, onSelect],
  );

  const clearAllFilters = useCallback(() => {
    filterRef.current?.clearAll();
  }, []);

  useEffect(() => {
    // Search name with search value
    let filteredWorkspacePodConfigs = podConfigs;

    filters.forEach((filter) => {
      let searchValueInput: RegExp;
      try {
        searchValueInput = new RegExp(filter.value, 'i');
      } catch {
        searchValueInput = new RegExp(filter.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      }

      filteredWorkspacePodConfigs = filteredWorkspacePodConfigs.filter((podConfig) => {
        if (filter.value === '') {
          return true;
        }
        switch (filter.columnName) {
          case filterableColumns.name:
            return (
              podConfig.id.search(searchValueInput) >= 0 ||
              podConfig.displayName.search(searchValueInput) >= 0
            );
          default:
            return true;
        }
      });
    });

    setWorkspacePodConfigs(getFilteredWorkspacePodConfigsByLabels(filteredWorkspacePodConfigs));
  }, [
    filterableColumns,
    filters,
    podConfigs,
    selectedLabels,
    getFilteredWorkspacePodConfigsByLabels,
  ]);

  return (
    <>
      <PageSection>
        <Toolbar id="toolbar-group-types">
          <ToolbarContent>
            <Filter
              ref={filterRef}
              id="filter-workspace-images"
              onFilter={setFilters}
              columnNames={filterableColumns}
            />
          </ToolbarContent>
        </Toolbar>
      </PageSection>
      <PageSection isFilled>
        {workspacePodConfigs.length === 0 && (
          <EmptyStateWithClearFilters
            title="No results found"
            body="No results match the filter criteria. Clear all filters and try again."
            onClearFilters={clearAllFilters}
          />
        )}
        {workspacePodConfigs.length > 0 && (
          <Gallery hasGutter aria-label="Selectable card container">
            {workspacePodConfigs.map((podConfig) => (
              <Card
                isCompact
                isSelectable
                key={podConfig.id}
                id={podConfig.id.replace(/ /g, '-')}
                isSelected={podConfig.id === selectedPodConfig?.id}
              >
                <CardHeader
                  selectableActions={{
                    selectableActionId: `selectable-actions-item-${podConfig.id.replace(/ /g, '-')}`,
                    selectableActionAriaLabelledby: podConfig.displayName.replace(/ /g, '-'),
                    name: podConfig.displayName,
                    variant: 'single',
                    onChange,
                  }}
                >
                  <CardTitle>{podConfig.displayName}</CardTitle>
                  <CardBody>{podConfig.id}</CardBody>
                </CardHeader>
              </Card>
            ))}
          </Gallery>
        )}
      </PageSection>
    </>
  );
};
