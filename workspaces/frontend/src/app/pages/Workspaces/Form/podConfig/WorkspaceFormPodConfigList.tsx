import React, { useCallback, useMemo } from 'react';
import {
  CardTitle,
  Card,
  CardHeader,
  CardBody,
} from '@patternfly/react-core/dist/esm/components/Card';
import { Gallery } from '@patternfly/react-core/dist/esm/layouts/Gallery';
import { PageSection } from '@patternfly/react-core/dist/esm/components/Page';
import ToolbarFilter, { FilterConfigMap } from '~/shared/components/ToolbarFilter';
import { useToolbarFilters, applyFilters } from '~/shared/hooks/useToolbarFilters';
import CustomEmptyState from '~/shared/components/CustomEmptyState';
import { WorkspacekindsPodConfigValue } from '~/generated/data-contracts';

type PodConfigFilterKey = 'name';

const filterConfig = {
  name: { type: 'text', label: 'Name', placeholder: 'Filter by name' },
} as const satisfies FilterConfigMap<PodConfigFilterKey>;

const visibleFilterKeys: readonly PodConfigFilterKey[] = ['name'];

const filterableProperties: Record<
  PodConfigFilterKey,
  (item: WorkspacekindsPodConfigValue) => string
> = {
  // Combine id and displayName for matching (separated by space so regex can match either)
  name: (podConfig) => `${podConfig.id} ${podConfig.displayName}`,
};

type WorkspaceFormPodConfigListProps = {
  podConfigs: WorkspacekindsPodConfigValue[];
  selectedPodConfig: WorkspacekindsPodConfigValue | undefined;
  onSelect: (workspacePodConfig: WorkspacekindsPodConfigValue | undefined) => void;
};

export const WorkspaceFormPodConfigList: React.FunctionComponent<
  WorkspaceFormPodConfigListProps
> = ({ podConfigs, selectedPodConfig, onSelect }) => {
  const { filterValues, setFilter, clearAllFilters } =
    useToolbarFilters<PodConfigFilterKey>(filterConfig);

  const filteredWorkspacePodConfigs = useMemo(
    () => applyFilters(podConfigs, filterValues, filterableProperties),
    [podConfigs, filterValues],
  );

  const onChange = useCallback(
    (event: React.FormEvent<HTMLInputElement>) => {
      const newSelectedWorkspacePodConfig = filteredWorkspacePodConfigs.find(
        (podConfig) => podConfig.displayName === event.currentTarget.name,
      );
      onSelect(newSelectedWorkspacePodConfig);
    },
    [filteredWorkspacePodConfigs, onSelect],
  );

  const handleCardClick = useCallback(
    (podConfig: WorkspacekindsPodConfigValue) => {
      if (podConfig.id !== selectedPodConfig?.id) {
        return;
      }
      onSelect(podConfig);
    },
    [selectedPodConfig?.id, onSelect],
  );

  return (
    <>
      <PageSection>
        <ToolbarFilter
          filterConfig={filterConfig}
          visibleFilterKeys={visibleFilterKeys}
          filterValues={filterValues}
          onFilterChange={setFilter}
          onClearAllFilters={clearAllFilters}
          testIdPrefix="pod-config-filter"
        />
      </PageSection>
      <PageSection isFilled>
        {filteredWorkspacePodConfigs.length === 0 && (
          <CustomEmptyState onClearFilters={clearAllFilters} />
        )}
        {filteredWorkspacePodConfigs.length > 0 && (
          <Gallery hasGutter aria-label="Selectable card container">
            {filteredWorkspacePodConfigs
              .filter((podConfig) => !podConfig.hidden)
              .map((podConfig) => (
                <Card
                  isCompact
                  isSelectable
                  key={podConfig.id}
                  id={podConfig.id.replace(/ /g, '-')}
                  isSelected={podConfig.id === selectedPodConfig?.id}
                  onClick={() => handleCardClick(podConfig)}
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
