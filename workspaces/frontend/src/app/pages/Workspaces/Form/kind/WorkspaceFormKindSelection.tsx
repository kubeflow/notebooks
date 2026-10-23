import React from 'react';
import { Content } from '@patternfly/react-core/dist/esm/components/Content';
import { EmptyState, EmptyStateBody } from '@patternfly/react-core/dist/esm/components/EmptyState';
import { ExclamationTriangleIcon } from '@patternfly/react-icons/dist/esm/icons/exclamation-triangle-icon';
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

  if (workspaceKinds.length === 0) {
    return (
      <EmptyState
        titleText="No workspace kinds found"
        headingLevel="h4"
        icon={ExclamationTriangleIcon}
        status="warning"
      >
        <EmptyStateBody>
          No Workspace Kinds are available. Contact your administrator for assistance.
        </EmptyStateBody>
      </EmptyState>
    );
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
