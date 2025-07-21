import React, { useMemo, useState } from 'react';
import { Content, Split, SplitItem } from '@patternfly/react-core';
import { WorkspaceFormPodConfigList } from '~/app/pages/Workspaces/Form/podConfig/WorkspaceFormPodConfigList';
import { FilterByLabels } from '~/app/pages/Workspaces/Form/labelFilter/FilterByLabels';
import { WorkspacePodConfigValue } from '~/shared/api/backendApiTypes';

interface WorkspaceFormPodConfigSelectionProps {
  podConfigs: WorkspacePodConfigValue[];
  selectedPodConfig: WorkspacePodConfigValue | undefined;
  onSelect: (podConfig: WorkspacePodConfigValue | undefined) => void;
}

const WorkspaceFormPodConfigSelection: React.FunctionComponent<
  WorkspaceFormPodConfigSelectionProps
> = ({ podConfigs, selectedPodConfig, onSelect }) => {
  const [selectedLabels, setSelectedLabels] = useState<Map<string, Set<string>>>(new Map());

  const podConfigFilterContent = useMemo(
    () => (
      <FilterByLabels
        labelledObjects={podConfigs.flatMap((podConfig) => podConfig.labels)}
        selectedLabels={selectedLabels}
        onSelect={setSelectedLabels}
      />
    ),
    [podConfigs, selectedLabels, setSelectedLabels],
  );

  return (
    <Content style={{ height: '100%' }}>
      <Split hasGutter>
        <SplitItem style={{ minWidth: '200px' }}>{podConfigFilterContent}</SplitItem>
        <SplitItem isFilled>
          <WorkspaceFormPodConfigList
            podConfigs={podConfigs}
            selectedLabels={selectedLabels}
            selectedPodConfig={selectedPodConfig}
            onSelect={onSelect}
          />
        </SplitItem>
      </Split>
    </Content>
  );
};

export { WorkspaceFormPodConfigSelection };
