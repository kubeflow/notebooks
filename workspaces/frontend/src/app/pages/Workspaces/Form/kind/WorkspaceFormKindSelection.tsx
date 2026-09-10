import React from 'react';
import { Content } from '@patternfly/react-core/dist/esm/components/Content';
import { WorkspaceFormKindList } from '~/app/pages/Workspaces/Form/kind/WorkspaceFormKindList';
import { WorkspacekindsWorkspaceKindListItem } from '~/generated/data-contracts';
import { LoadingSpinner } from '~/app/components/LoadingSpinner';
import { LoadError } from '~/app/components/LoadError';
import { WorkspaceFormMode } from '~/app/types';

interface WorkspaceFormKindSelectionProps {
  mode: WorkspaceFormMode;
  workspaceKinds: WorkspacekindsWorkspaceKindListItem[];
  workspaceKindsLoaded: boolean;
  workspaceKindsError: Error | undefined;
  selectedKind: WorkspacekindsWorkspaceKindListItem | undefined;
  onSelect: (kind: WorkspacekindsWorkspaceKindListItem | undefined) => void;
}

const WorkspaceFormKindSelection: React.FunctionComponent<WorkspaceFormKindSelectionProps> = ({
  mode,
  workspaceKinds,
  workspaceKindsLoaded,
  workspaceKindsError,
  selectedKind,
  onSelect,
}) => {
  if (workspaceKindsError) {
    return <LoadError title="Failed to load workspace kinds" error={workspaceKindsError} />;
  }

  if (!workspaceKindsLoaded) {
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
