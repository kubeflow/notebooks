import React, { useState, useRef, useMemo, useCallback } from 'react';
import { Content, Divider } from '@patternfly/react-core';
import { WorkspaceKind } from '~/shared/api/backendApiTypes';
import useWorkspaceKinds from '~/app/hooks/useWorkspaceKinds';
import { WorkspaceCreationKindDetails } from '~/app/pages/Workspaces/Creation/kind/WorkspaceCreationKindDetails';
import { WorkspaceCreationKindList } from '~/app/pages/Workspaces/Creation/kind/WorkspaceCreationKindList';
import { WorkspaceCreationDrawer } from '~/app/pages/Workspaces/Creation/WorkspaceCreationDrawer';

interface WorkspaceCreationKindSelectionProps {
  selectedKind: WorkspaceKind | undefined;
  onSelect: (kind: WorkspaceKind | undefined) => void;
}

const WorkspaceCreationKindSelection: React.FunctionComponent<
  WorkspaceCreationKindSelectionProps
> = ({ selectedKind, onSelect }) => {
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
    () => <WorkspaceCreationKindDetails workspaceKind={selectedKind} />,
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
      <WorkspaceCreationDrawer
        title="Workspace kind"
        info={kindDetailsContent}
        isExpanded={isExpanded}
        onCloseClick={onCloseClick}
        onExpand={onExpand}
      >
        <p>Select a workspace kind to use for the workspace.</p>
        <Divider />
        <WorkspaceCreationKindList
          allWorkspaceKinds={workspaceKinds}
          selectedKind={selectedKind}
          onSelect={onClick}
        />
      </WorkspaceCreationDrawer>
    </Content>
  );
};

export { WorkspaceCreationKindSelection };
