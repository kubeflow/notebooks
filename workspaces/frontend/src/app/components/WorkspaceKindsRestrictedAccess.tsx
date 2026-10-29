import React from 'react';
import { PageSection } from '@patternfly/react-core/dist/esm/components/Page';
import { EmptyState, EmptyStateBody } from '@patternfly/react-core/dist/esm/components/EmptyState';
import { Bullseye } from '@patternfly/react-core/dist/esm/layouts/Bullseye';
import { LockIcon } from '@patternfly/react-icons/dist/esm/icons/lock-icon';

export const WorkspaceKindsRestrictedAccess: React.FC = () => (
  <PageSection isFilled>
    <Bullseye>
      <EmptyState
        headingLevel="h4"
        titleText="WorkspaceKind management is restricted to administrators"
        icon={LockIcon}
        status="info"
        data-testid="workspace-kinds-access-empty-state"
      >
        <EmptyStateBody>
          Please contact your admin if you need changes to workspace configurations.
        </EmptyStateBody>
      </EmptyState>
    </Bullseye>
  </PageSection>
);
