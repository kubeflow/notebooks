import React from 'react';
import {
  Button,
  EmptyState,
  EmptyStateActions,
  EmptyStateBody,
  EmptyStateFooter,
  EmptyStateVariant,
  PageSection,
} from '@patternfly/react-core';
import { PathMissingIcon } from '@patternfly/react-icons';

type Props = {
  onClose: () => void;
};

const UpdateState: React.FC<Props> = ({ onClose }) => (
  <PageSection hasBodyWrapper={false} data-testid="error-update-state">
    <EmptyState
      headingLevel="h2"
      icon={PathMissingIcon}
      titleText="An error occurred"
      variant={EmptyStateVariant.full}
    >
      <EmptyStateBody>This is likely the result of a recent update.</EmptyStateBody>
      <EmptyStateFooter>
        <EmptyStateActions>
          <Button
            variant="primary"
            onClick={() => window.location.reload()}
            data-testid="reload-button"
          >
            Reload this page
          </Button>
        </EmptyStateActions>
        <EmptyStateActions>
          <Button variant="link" onClick={onClose} data-testid="show-error-button">
            Show error
          </Button>
        </EmptyStateActions>
      </EmptyStateFooter>
    </EmptyState>
  </PageSection>
);

export default UpdateState;
