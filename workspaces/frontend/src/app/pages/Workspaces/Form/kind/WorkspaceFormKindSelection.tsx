import React from 'react';
import { Content } from '@patternfly/react-core/dist/esm/components/Content';
import useWorkspaceKinds from '~/app/hooks/useWorkspaceKinds';
import { WorkspaceFormKindList } from '~/app/pages/Workspaces/Form/kind/WorkspaceFormKindList';
import { WorkspacekindsWorkspaceKind } from '~/generated/data-contracts';
import { LoadingSpinner } from '~/app/components/LoadingSpinner';
import { LoadError } from '~/app/components/LoadError';
import { WorkspaceFormMode } from '~/app/types';

interface WorkspaceFormKindSelectionProps {
  mode: WorkspaceFormMode;
  namespace?: string;
  selectedKind: WorkspacekindsWorkspaceKind | undefined;
  onSelect: (kind: WorkspacekindsWorkspaceKind | undefined) => void;
}

const WorkspaceFormKindSelection: React.FunctionComponent<WorkspaceFormKindSelectionProps> = ({
  mode,
  namespace,
  selectedKind,
  onSelect,
}) => {
  const [workspaceKinds, loaded, error] = useWorkspaceKinds(namespace);

  if (error) {
    return <LoadError title="Failed to load workspace kinds" error={error} />;
  }

  if (!loaded) {
    return <LoadingSpinner />;
  }

  return (
    <Content className="workspace-form__full-height">
      <WorkspaceFormKindList
        allWorkspaceKinds={workspaceKinds}
        selectedKind={selectedKind}
        onSelect={onSelect}
        isSelectionDisabled={mode === 'update'}
      />
    </Content>
  );
};

export { WorkspaceFormKindSelection };
