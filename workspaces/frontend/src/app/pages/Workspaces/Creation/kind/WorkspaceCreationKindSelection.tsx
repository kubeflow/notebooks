import * as React from 'react';
import { Content, Divider, Split, SplitItem } from '@patternfly/react-core';
import { useMemo } from 'react';
import { WorkspaceKind } from '~/shared/api/backendApiTypes';
import { WorkspaceCreationKindDetails } from '~/app/pages/Workspaces/Creation/kind/WorkspaceCreationKindDetails';
import { WorkspaceCreationKindList } from '~/app/pages/Workspaces/Creation/kind/WorkspaceCreationKindList';
import useWorkspaceKinds from '~/app/hooks/useWorkspaceKinds';

interface WorkspaceCreationKindSelectionProps {
  selectedKind: WorkspaceKind | undefined;
  onSelect: (kind: WorkspaceKind | undefined) => void;
}

const WorkspaceCreationKindSelection: React.FunctionComponent<
  WorkspaceCreationKindSelectionProps
> = ({ selectedKind, onSelect }) => {
  const [workspaceKinds, loaded, error] = useWorkspaceKinds();

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
      <p>Select a workspace kind to use for the workspace.</p>
      <Divider />
      <Split hasGutter>
        <SplitItem isFilled>
          <WorkspaceCreationKindList
            allWorkspaceKinds={workspaceKinds}
            selectedKind={selectedKind}
            onSelect={onSelect}
          />
        </SplitItem>
        <SplitItem style={{ minWidth: '200px' }}>{kindDetailsContent}</SplitItem>
      </Split>
    </Content>
  );
};

export { WorkspaceCreationKindSelection };
