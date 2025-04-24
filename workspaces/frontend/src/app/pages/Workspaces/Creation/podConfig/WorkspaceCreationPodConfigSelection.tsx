import * as React from 'react';
import { Content, Divider, Split, SplitItem } from '@patternfly/react-core';
import { useMemo, useState } from 'react';
import { WorkspacePodConfig } from '~/shared/types';
import { WorkspaceCreationPodConfigDetails } from '~/app/pages/Workspaces/Creation/podConfig/WorkspaceCreationPodConfigDetails';
import { WorkspaceCreationPodConfigList } from '~/app/pages/Workspaces/Creation/podConfig/WorkspaceCreationPodConfigList';
import { FilterByLabels } from '~/app/pages/Workspaces/Creation/labelFilter/FilterByLabels';

interface WorkspaceCreationPodConfigSelectionProps {
  podConfigs: WorkspacePodConfig[];
  selectedPodConfig: WorkspacePodConfig | undefined;
  onSelect: (podConfig: WorkspacePodConfig | undefined) => void;
}

const WorkspaceCreationPodConfigSelection: React.FunctionComponent<
  WorkspaceCreationPodConfigSelectionProps
> = ({ podConfigs, selectedPodConfig, onSelect }) => {
  const [selectedLabels, setSelectedLabels] = useState<Map<string, Set<string>>>(new Map());

  const podConfigFilterContent = useMemo(
    () => (
      <FilterByLabels
        labelledObjects={podConfigs.map((podConfig) => podConfig.labels)}
        selectedLabels={selectedLabels}
        onSelect={setSelectedLabels}
      />
    ),
    [podConfigs, selectedLabels, setSelectedLabels],
  );

  const podConfigDetailsContent = useMemo(
    () => <WorkspaceCreationPodConfigDetails workspacePodConfig={selectedPodConfig} />,
    [selectedPodConfig],
  );

  return (
    <Content style={{ height: '100%' }}>
      <p>Select a pod config to use for the workspace.</p>
      <Divider />
      <Split hasGutter>
        <SplitItem style={{ minWidth: '200px' }}>{podConfigFilterContent}</SplitItem>
        <SplitItem isFilled>
          <WorkspaceCreationPodConfigList
            podConfigs={podConfigs}
            selectedLabels={selectedLabels}
            selectedPodConfig={selectedPodConfig}
            onSelect={onSelect}
          />
        </SplitItem>
        <SplitItem style={{ minWidth: '200px' }}>{podConfigDetailsContent}</SplitItem>
      </Split>
    </Content>
  );
};

export { WorkspaceCreationPodConfigSelection };
