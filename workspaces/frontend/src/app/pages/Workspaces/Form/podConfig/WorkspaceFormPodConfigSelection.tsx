import React, { useEffect, useMemo, useState } from 'react';
import { Content } from '@patternfly/react-core/dist/esm/components/Content';
import { Split, SplitItem } from '@patternfly/react-core/dist/esm/layouts/Split';
import { WorkspaceFormPodConfigList } from '~/app/pages/Workspaces/Form/podConfig/WorkspaceFormPodConfigList';
import {
  ExtraFilter,
  FilterByLabels,
} from '~/app/pages/Workspaces/Form/labelFilter/FilterByLabels';
import { WorkspacekindsPodConfigValue } from '~/generated/data-contracts';
import { computeDefaultFilterValues } from '~/app/pages/Workspaces/Form/utils/filterDefaults';

interface WorkspaceFormPodConfigSelectionProps {
  podConfigs: WorkspacekindsPodConfigValue[];
  selectedPodConfig: WorkspacekindsPodConfigValue | undefined;
  onSelect: (podConfig: WorkspacekindsPodConfigValue | undefined) => void;
  defaultPodConfigId?: string;
}

const WorkspaceFormPodConfigSelection: React.FunctionComponent<
  WorkspaceFormPodConfigSelectionProps
> = ({ podConfigs, selectedPodConfig, onSelect, defaultPodConfigId }) => {
  const [filteredPodConfigs, setFilteredPodConfigs] =
    useState<WorkspacekindsPodConfigValue[]>(podConfigs);

  const defaultFilterValues = useMemo(
    () => computeDefaultFilterValues(podConfigs, defaultPodConfigId),
    [podConfigs, defaultPodConfigId],
  );

  const extraFilters: ExtraFilter<WorkspacekindsPodConfigValue>[] = useMemo(
    () => [
      {
        label: 'Show hidden',
        value: defaultFilterValues.showHidden,
        key: 'showHidden',
        matchesFilter: (podConfig: WorkspacekindsPodConfigValue, value: boolean) =>
          value || !podConfig.hidden,
      },
      {
        label: 'Show redirected',
        value: defaultFilterValues.showRedirected,
        key: 'showRedirected',
        matchesFilter: (podConfig: WorkspacekindsPodConfigValue, value: boolean) =>
          value || podConfig.redirect === undefined,
      },
    ],
    [defaultFilterValues],
  );

  useEffect(() => {
    if (!selectedPodConfig) {
      return;
    }

    const isSelectedInFilteredList = filteredPodConfigs.some(
      (podConfig) => podConfig.id === selectedPodConfig.id,
    );

    if (!isSelectedInFilteredList) {
      onSelect(undefined);
    }
  }, [filteredPodConfigs, selectedPodConfig, onSelect]);

  const podConfigFilterContent = useMemo(
    () => (
      <FilterByLabels
        labelledObjects={podConfigs}
        setLabelledObjects={(obj) => setFilteredPodConfigs(obj as WorkspacekindsPodConfigValue[])}
        extraFilters={extraFilters}
      />
    ),
    [podConfigs, setFilteredPodConfigs, extraFilters],
  );

  return (
    <Content style={{ height: '100%' }}>
      <Split hasGutter>
        <SplitItem style={{ minWidth: '200px' }}>{podConfigFilterContent}</SplitItem>
        <SplitItem isFilled>
          <WorkspaceFormPodConfigList
            podConfigs={filteredPodConfigs}
            allPodConfigs={podConfigs}
            selectedPodConfig={selectedPodConfig}
            onSelect={onSelect}
            defaultPodConfigId={defaultPodConfigId}
          />
        </SplitItem>
      </Split>
    </Content>
  );
};

export { WorkspaceFormPodConfigSelection };
