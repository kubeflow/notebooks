import React, { useMemo, useState } from 'react';
import { Content } from '@patternfly/react-core/dist/esm/components/Content';
import { Split, SplitItem } from '@patternfly/react-core/dist/esm/layouts/Split';
import { WorkspaceFormPodConfigList } from '~/app/pages/Workspaces/Form/podConfig/WorkspaceFormPodConfigList';
import { FilterByLabels } from '~/app/pages/Workspaces/Form/labelFilter/FilterByLabels';
import { WorkspacekindsPodConfigValue } from '~/generated/data-contracts';

interface WorkspaceFormPodConfigSelectionProps {
  podConfigs: WorkspacekindsPodConfigValue[];
  selectedPodConfig: WorkspacekindsPodConfigValue | undefined;
  onSelect: (podConfig: WorkspacekindsPodConfigValue | undefined) => void;
}

const WorkspaceFormPodConfigSelection: React.FunctionComponent<
  WorkspaceFormPodConfigSelectionProps
> = ({ podConfigs, selectedPodConfig, onSelect }) => {
  const [filteredPodConfigs, setFilteredPodConfigs] =
    useState<WorkspacekindsPodConfigValue[]>(podConfigs);

  const podConfigFilterContent = useMemo(
    () => (
      <FilterByLabels
        labelledObjects={podConfigs}
        setLabelledObjects={(obj) => setFilteredPodConfigs(obj as WorkspacekindsPodConfigValue[])}
      />
    ),
    [podConfigs, setFilteredPodConfigs],
  );

  return (
    <Content style={{ height: '100%' }}>
      <Split hasGutter>
        <SplitItem style={{ minWidth: '200px' }}>{podConfigFilterContent}</SplitItem>
        <SplitItem isFilled>
          <WorkspaceFormPodConfigList
            podConfigs={filteredPodConfigs}
            selectedPodConfig={selectedPodConfig}
            onSelect={onSelect}
          />
        </SplitItem>
      </Split>
    </Content>
  );
};

export { WorkspaceFormPodConfigSelection };
