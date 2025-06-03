import React, { useCallback, useMemo, useState } from 'react';
import { Content, Split, SplitItem } from '@patternfly/react-core';
import { WorkspaceFormPodConfigDetails } from '~/app/pages/Workspaces/Form/podConfig/WorkspaceFormPodConfigDetails';
import { WorkspaceFormPodConfigList } from '~/app/pages/Workspaces/Form/podConfig/WorkspaceFormPodConfigList';
import { FilterByLabels } from '~/app/pages/Workspaces/Form/labelFilter/FilterByLabels';
import { WorkspaceFormDrawer } from '~/app/pages/Workspaces/Form/WorkspaceFormDrawer';
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
    () => <WorkspaceFormPodConfigDetails workspacePodConfig={selectedPodConfig} />,
    [selectedPodConfig],
  );

  return (
    <Content style={{ height: '100%' }}>
      <WorkspaceFormDrawer
        title="Pod config"
        info={podConfigDetailsContent}
        isExpanded={isExpanded}
        onCloseClick={onCloseClick}
        onExpand={onExpand}
      >
        <Split hasGutter>
          <SplitItem style={{ minWidth: '200px' }}>{podConfigFilterContent}</SplitItem>
          <SplitItem isFilled>
            <WorkspaceFormPodConfigList
              podConfigs={podConfigs}
              selectedLabels={selectedLabels}
              selectedPodConfig={selectedPodConfig}
              onSelect={onClick}
            />
          </SplitItem>
        </Split>
      </WorkspaceFormDrawer>
    </Content>
  );
};

export { WorkspaceFormPodConfigSelection };
