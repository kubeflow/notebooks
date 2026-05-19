import React, { useRef, useMemo, useState, useImperativeHandle } from 'react';
import { Content } from '@patternfly/react-core/dist/esm/components/Content';
import { Split, SplitItem } from '@patternfly/react-core/dist/esm/layouts/Split';
import { WorkspaceFormPodConfigList } from '~/app/pages/Workspaces/Form/podConfig/WorkspaceFormPodConfigList';
import {
  ExtraFilter,
  FilterByLabels,
  FilterControlHandle,
} from '~/app/pages/Workspaces/Form/labelFilter/FilterByLabels';
import { OptionsPodConfigValue } from '~/generated/data-contracts';
import { computeDefaultFilterValues } from '~/app/pages/Workspaces/Form/utils/filterDefaults';

export type PodConfigSelectionFilterHandle = {
  adaptFiltersForPodConfig: (podConfig: OptionsPodConfigValue) => void;
};

interface WorkspaceFormPodConfigSelectionProps {
  podConfigs: OptionsPodConfigValue[];
  selectedPodConfig: OptionsPodConfigValue | undefined;
  onSelect: (podConfig: OptionsPodConfigValue | undefined) => void;
  defaultPodConfigId?: string;
  filterControlRef?: React.Ref<PodConfigSelectionFilterHandle>;
}

const WorkspaceFormPodConfigSelection: React.FunctionComponent<
  WorkspaceFormPodConfigSelectionProps
> = ({ podConfigs, selectedPodConfig, onSelect, defaultPodConfigId, filterControlRef }) => {
  const [filteredPodConfigs, setFilteredPodConfigs] = useState<OptionsPodConfigValue[]>(podConfigs);
  const internalFilterControlRef = useRef<FilterControlHandle>(null);

  const defaultFilterValues = useMemo(() => {
    const defaults = computeDefaultFilterValues(podConfigs, defaultPodConfigId);
    if (selectedPodConfig) {
      if (selectedPodConfig.hidden) {
        defaults.showHidden = true;
      }
      if (selectedPodConfig.redirect !== undefined) {
        defaults.showRedirected = true;
      }
    }
    return defaults;
  }, [podConfigs, defaultPodConfigId, selectedPodConfig]);

  const extraFilters: ExtraFilter<OptionsPodConfigValue>[] = useMemo(
    () => [
      {
        label: 'Show hidden',
        value: defaultFilterValues.showHidden,
        key: 'showHidden',
        matchesFilter: (podConfig: OptionsPodConfigValue, value: boolean) =>
          value || !podConfig.hidden,
      },
      {
        label: 'Show redirected',
        value: defaultFilterValues.showRedirected,
        key: 'showRedirected',
        matchesFilter: (podConfig: OptionsPodConfigValue, value: boolean) =>
          value || podConfig.redirect === undefined,
      },
    ],
    [defaultFilterValues],
  );

  useImperativeHandle(
    filterControlRef,
    () => ({
      adaptFiltersForPodConfig: (podConfig: OptionsPodConfigValue) => {
        internalFilterControlRef.current?.clearAllFilters();
        if (podConfig.hidden) {
          internalFilterControlRef.current?.setExtraFilter('showHidden', true);
        }
        if (podConfig.redirect !== undefined) {
          internalFilterControlRef.current?.setExtraFilter('showRedirected', true);
        }
      },
    }),
    [],
  );

  const podConfigFilterContent = useMemo(
    () => (
      <FilterByLabels
        labelledObjects={podConfigs}
        setLabelledObjects={(obj) => setFilteredPodConfigs(obj as OptionsPodConfigValue[])}
        extraFilters={extraFilters}
        filterControlRef={internalFilterControlRef}
      />
    ),
    [podConfigs, setFilteredPodConfigs, extraFilters],
  );

  return (
    <Content className="workspace-form__full-height">
      <Split hasGutter>
        <SplitItem className="workspace-form__filter-sidebar">{podConfigFilterContent}</SplitItem>
        <SplitItem isFilled>
          <WorkspaceFormPodConfigList
            filteredPodConfigs={filteredPodConfigs}
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
