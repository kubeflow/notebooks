import React, { useCallback, useMemo, useState } from 'react';
import { Content, Divider, Split, SplitItem } from '@patternfly/react-core';
import { WorkspaceCreationPodConfigDetails } from '~/app/pages/Workspaces/Creation/podConfig/WorkspaceCreationPodConfigDetails';
import { WorkspaceCreationPodConfigList } from '~/app/pages/Workspaces/Creation/podConfig/WorkspaceCreationPodConfigList';
import { FilterByLabels } from '~/app/pages/Workspaces/Creation/labelFilter/FilterByLabels';
import { WorkspaceCreationDrawer } from '~/app/pages/Workspaces/Creation/WorkspaceCreationDrawer';
import { WorkspacePodConfigValue } from '~/shared/api/backendApiTypes';

interface WorkspaceCreationPodConfigSelectionProps {
  podConfigs: WorkspacePodConfigValue[];
  selectedPodConfig: WorkspacePodConfigValue | undefined;
  onSelect: (podConfig: WorkspacePodConfigValue | undefined) => void;
}

const WorkspaceCreationPodConfigSelection: React.FunctionComponent<
  WorkspaceCreationPodConfigSelectionProps
> = ({ podConfigs, selectedPodConfig, onSelect }) => {
  const [selectedLabels, setSelectedLabels] = useState<Map<string, Set<string>>>(new Map());
  const [isExpanded, setIsExpanded] = useState(false);
  const drawerRef = React.useRef<HTMLSpanElement>(undefined);

  const onExpand = useCallback(() => {
    if (drawerRef.current) {
      drawerRef.current.focus();
    }
  }, []);

  const onClick = useCallback(
    (podConfig?: WorkspacePodConfigValue) => {
      setIsExpanded(true);
      onSelect(podConfig);
    },
    [onSelect],
  );

  const onCloseClick = useCallback(() => {
    setIsExpanded(false);
  }, []);

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

  const podConfigDetailsContent = useMemo(
    () => <WorkspaceCreationPodConfigDetails workspacePodConfig={selectedPodConfig} />,
    [selectedPodConfig],
  );

  return (
    <Content style={{ height: '100%' }}>
      <p>Select a pod config to use for the workspace.</p>
      <Divider />

      <WorkspaceCreationDrawer
        title="Pod config"
        info={podConfigDetailsContent}
        isExpanded={isExpanded}
        onCloseClick={onCloseClick}
        onExpand={onExpand}
      >
        <Split hasGutter>
          <SplitItem style={{ minWidth: '200px' }}>{podConfigFilterContent}</SplitItem>
          <SplitItem isFilled>
            <WorkspaceCreationPodConfigList
              podConfigs={podConfigs}
              selectedLabels={selectedLabels}
              selectedPodConfig={selectedPodConfig}
              onSelect={onClick}
            />
          </SplitItem>
        </Split>
      </WorkspaceCreationDrawer>
    </Content>
  );
};

export { WorkspaceCreationPodConfigSelection };
