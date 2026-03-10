import React, { useCallback, useMemo, useState } from 'react';
import { Gallery } from '@patternfly/react-core/dist/esm/layouts/Gallery';
import { PageSection } from '@patternfly/react-core/dist/esm/components/Page';
import ToolbarFilter, { FilterConfigMap } from '~/shared/components/ToolbarFilter';
import { useToolbarFilters, applyFilters } from '~/shared/hooks/useToolbarFilters';
import CustomEmptyState from '~/shared/components/CustomEmptyState';
import { WorkspacekindsPodConfigValue } from '~/generated/data-contracts';
import { WorkspaceFormOptionCard } from '~/app/pages/Workspaces/Form/shared/WorkspaceFormOptionCard';
import { moveDefaultToFront } from '~/app/pages/Workspaces/Form/utils/optionOrdering';

type PodConfigFilterKey = 'name';

const filterConfig = {
  name: { type: 'text', label: 'Name', placeholder: 'Filter by name' },
} as const satisfies FilterConfigMap<PodConfigFilterKey>;

const visibleFilterKeys: readonly PodConfigFilterKey[] = ['name'];

const filterableProperties: Record<
  PodConfigFilterKey,
  (item: WorkspacekindsPodConfigValue) => string
> = {
  name: (podConfig) => `${podConfig.id} ${podConfig.displayName}`,
};

type WorkspaceFormPodConfigListProps = {
  filteredPodConfigs: WorkspacekindsPodConfigValue[];
  allPodConfigs: WorkspacekindsPodConfigValue[];
  selectedPodConfig: WorkspacekindsPodConfigValue | undefined;
  onSelect: (workspacePodConfig: WorkspacekindsPodConfigValue | undefined) => void;
  defaultPodConfigId?: string;
};

export const WorkspaceFormPodConfigList: React.FunctionComponent<
  WorkspaceFormPodConfigListProps
> = ({ filteredPodConfigs, allPodConfigs, selectedPodConfig, onSelect, defaultPodConfigId }) => {
  const { filterValues, setFilter, clearAllFilters } =
    useToolbarFilters<PodConfigFilterKey>(filterConfig);
  const [activePopoverId, setActivePopoverId] = useState<string | null>(null);
  const [pinnedPopoverId, setPinnedPopoverId] = useState<string | null>(null);

  const reorderedPodConfigs = useMemo(
    () => moveDefaultToFront(filteredPodConfigs, defaultPodConfigId),
    [filteredPodConfigs, defaultPodConfigId],
  );

  const filteredWorkspacePodConfigs = useMemo(
    () => applyFilters(reorderedPodConfigs, filterValues, filterableProperties),
    [reorderedPodConfigs, filterValues],
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
            {filteredWorkspacePodConfigs.map((podConfig) => (
              <WorkspaceFormOptionCard
                key={podConfig.id}
                option={podConfig}
                allOptions={allPodConfigs}
                isSelected={podConfig.id === selectedPodConfig?.id}
                isDefault={podConfig.id === defaultPodConfigId}
                onClick={handleCardClick}
                onChange={onChange}
                activePopoverId={activePopoverId}
                pinnedPopoverId={pinnedPopoverId}
                onActivePopoverChange={setActivePopoverId}
                onPinnedPopoverChange={setPinnedPopoverId}
              />
            ))}
          </Gallery>
        )}
      </PageSection>
    </>
  );
};
