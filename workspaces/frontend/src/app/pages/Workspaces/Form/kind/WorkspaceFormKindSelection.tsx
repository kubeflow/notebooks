import React, { useState, useRef, useMemo, useCallback } from 'react';
import { Content, Divider } from '@patternfly/react-core';
import { WorkspaceKind } from '~/shared/api/backendApiTypes';
import useWorkspaceKinds from '~/app/hooks/useWorkspaceKinds';
import { WorkspaceFormKindDetails } from '~/app/pages/Workspaces/Form/kind/WorkspaceFormKindDetails';
import { WorkspaceFormKindList } from '~/app/pages/Workspaces/Form/kind/WorkspaceFormKindList';
import { WorkspaceFormDrawer } from '~/app/pages/Workspaces/Form/WorkspaceFormDrawer';

interface WorkspaceFormKindSelectionProps {
  selectedKind: WorkspaceKind | undefined;
  onSelect: (kind: WorkspaceKind | undefined) => void;
}

const WorkspaceFormKindSelection: React.FunctionComponent<WorkspaceFormKindSelectionProps> = ({
  selectedKind,
  onSelect,
}) => {
  const [workspaceKinds, loaded, error] = useWorkspaceKinds();
  const [isExpanded, setIsExpanded] = useState(false);
  const drawerRef = useRef<HTMLSpanElement>(undefined);

  const onExpand = useCallback(() => {
    if (drawerRef.current) {
      drawerRef.current.focus();
    }
  }, []);

  const onClick = useCallback(
    (kind?: WorkspaceKind) => {
      setIsExpanded(true);
      onSelect(kind);
    },
    [onSelect],
  );

  const onCloseClick = useCallback(() => {
    setIsExpanded(false);
  }, []);

  const kindDetailsContent = useMemo(
    () => <WorkspaceFormKindDetails workspaceKind={selectedKind} />,
    [selectedKind],
  );

  if (error) {
    return <p>Error loading workspace kinds: {error.message}</p>; // TODO: UX for error state
  }

  if (!loaded) {
    return <p>Loading...</p>; // TODO: UX for loading state
  }

  return (
    <Content style={{ height: '100%' }}>
      <WorkspaceFormDrawer
        title="Workspace kind"
        info={kindDetailsContent}
        isExpanded={isExpanded}
        onCloseClick={onCloseClick}
        onExpand={onExpand}
      >
        <p>Select a workspace kind to use for the workspace.</p>
        <Divider />
        <WorkspaceFormKindList
          allWorkspaceKinds={workspaceKinds}
          selectedKind={selectedKind}
          onSelect={onClick}
        />
      </WorkspaceFormDrawer>
    </Content>
  );
};

export { WorkspaceFormKindSelection };
