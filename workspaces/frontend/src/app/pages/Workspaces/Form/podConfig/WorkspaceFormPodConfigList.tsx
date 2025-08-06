import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  CardTitle,
  Card,
  CardHeader,
  CardBody,
} from '@patternfly/react-core/dist/esm/components/Card';
import { Gallery } from '@patternfly/react-core/dist/esm/layouts/Gallery';
import { PageSection } from '@patternfly/react-core/dist/esm/components/Page';
import { Toolbar, ToolbarContent } from '@patternfly/react-core/dist/esm/components/Toolbar';
import Filter, { FilteredColumn, FilterRef } from '~/shared/components/Filter';
import CustomEmptyState from '~/shared/components/CustomEmptyState';
import { defineDataFields, FilterableDataFieldKey } from '~/app/filterableDataHelper';
import { WorkspacekindsPodConfigValue } from '~/generated/data-contracts';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { fields, filterableLabelMap } = defineDataFields({
  name: { label: 'Name', isFilterable: true, isSortable: false },
});

type FilterableDataFieldKeys = FilterableDataFieldKey<typeof fields>;

type WorkspaceFormPodConfigListProps = {
  podConfigs: WorkspacekindsPodConfigValue[];
  selectedPodConfig: WorkspacekindsPodConfigValue | undefined;
  onSelect: (workspacePodConfig: WorkspacekindsPodConfigValue | undefined) => void;
};

export const WorkspaceFormPodConfigList: React.FunctionComponent<
  WorkspaceFormPodConfigListProps
> = ({ podConfigs, selectedPodConfig, onSelect }) => {
  const [filters, setFilters] = useState<FilteredColumn[]>([]);
  const filterRef = useRef<FilterRef>(null);

  const clearAllFilters = useCallback(() => {
    filterRef.current?.clearAll();
  }, []);

  const filteredWorkspacePodConfigs = useMemo(() => {
    if (podConfigs.length === 0) {
      return [];
    }
    return filters.reduce((result, filter) => {
      let searchValueInput: RegExp;
      try {
        searchValueInput = new RegExp(filter.value, 'i');
      } catch {
        searchValueInput = new RegExp(filter.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      }
      return result.filter((podConfig) => {
        if (filter.value === '') {
          return true;
        }
        switch (filter.columnKey as FilterableDataFieldKeys) {
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
          case 'name':
            return (
              podConfig.id.search(searchValueInput) >= 0 ||
              podConfig.displayName.search(searchValueInput) >= 0
            );
          default:
            return true;
        }
      });
    }, podConfigs);
  }, [filters, podConfigs]);

  const onChange = useCallback(
    (event: React.FormEvent<HTMLInputElement>) => {
      const newSelectedWorkspacePodConfig = filteredWorkspacePodConfigs.find(
        (podConfig) => podConfig.displayName === event.currentTarget.name,
      );
      onSelect(newSelectedWorkspacePodConfig);
    },
    [filteredWorkspacePodConfigs, onSelect],
  );

  return (
    <>
      <PageSection>
        <Toolbar id="toolbar-group-types">
          <ToolbarContent>
            <Filter
              ref={filterRef}
              id="filter-workspace-images"
              filters={filters}
              setFilters={setFilters}
              columnDefinition={filterableLabelMap}
            />
          </ToolbarContent>
        </Toolbar>
      </PageSection>
      <PageSection isFilled>
        {filteredWorkspacePodConfigs.length === 0 && (
          <CustomEmptyState onClearFilters={clearAllFilters} />
        )}
        {filteredWorkspacePodConfigs.length > 0 && (
          <Gallery hasGutter aria-label="Selectable card container">
            {filteredWorkspacePodConfigs.map((podConfig) => (
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
