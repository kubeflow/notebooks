import React from 'react';
import { Content } from '@patternfly/react-core/dist/esm/components/Content';
import useWorkspaceKinds from '~/app/hooks/useWorkspaceKinds';
import { WorkspaceFormKindList } from '~/app/pages/Workspaces/Form/kind/WorkspaceFormKindList';
import { WorkspacekindsWorkspaceKind } from '~/generated/data-contracts';
import { LoadingSpinner } from '~/app/components/LoadingSpinner';
import { LoadError } from '~/app/components/LoadError';

interface WorkspaceFormKindSelectionProps {
  selectedKind: WorkspacekindsWorkspaceKind | undefined;
  onSelect: (kind: WorkspacekindsWorkspaceKind | undefined) => void;
}

const WorkspaceFormKindSelection: React.FunctionComponent<WorkspaceFormKindSelectionProps> = ({
  selectedKind,
  onSelect,
}) => {
  const [workspaceKinds, loaded, error] = useWorkspaceKinds();

  if (error) {
    return <LoadError error={error} />;
  }

  if (!loaded) {
    return <LoadingSpinner />;
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
