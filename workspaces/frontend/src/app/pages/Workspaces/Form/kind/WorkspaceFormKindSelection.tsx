import React from 'react';
import { Content } from '@patternfly/react-core';
import { WorkspaceKind } from '~/shared/api/backendApiTypes';
import useWorkspaceKinds from '~/app/hooks/useWorkspaceKinds';
import { WorkspaceFormKindList } from '~/app/pages/Workspaces/Form/kind/WorkspaceFormKindList';

interface WorkspaceFormKindSelectionProps {
  selectedKind: WorkspaceKind | undefined;
  onSelect: (kind: WorkspaceKind | undefined) => void;
}

const WorkspaceFormKindSelection: React.FunctionComponent<WorkspaceFormKindSelectionProps> = ({
  selectedKind,
  onSelect,
}) => {
  const [workspaceKinds, loaded, error] = useWorkspaceKinds();

  if (error) {
    return <p>Error loading workspace kinds: {error.message}</p>; // TODO: UX for error state
  }

  if (!loaded) {
    return <p>Loading...</p>; // TODO: UX for loading state
  }

  return (
    <Content style={{ height: '100%' }}>
      <WorkspaceFormKindList
        allWorkspaceKinds={workspaceKinds}
        selectedKind={selectedKind}
        onSelect={onSelect}
      />
    </Content>
  );
};

export { WorkspaceFormKindSelection };
