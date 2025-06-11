import React from 'react';
import { CubesIcon } from '@patternfly/react-icons';
import {
  Button,
  EmptyState,
  EmptyStateBody,
  EmptyStateFooter,
  EmptyStateVariant,
  PageSection,
} from '@patternfly/react-core';

const Debug: React.FunctionComponent = () => (
  <PageSection>
    <EmptyState
      variant={EmptyStateVariant.full}
      titleText="Debug page (for development only)"
      icon={CubesIcon}
    >
      <EmptyStateBody>
        This represents an the empty state pattern in Patternfly 6. Hopefully it&apos;s simple
        enough to use but flexible enough to meet a variety of needs.
      </EmptyStateBody>
      <EmptyStateFooter>
        <Button variant="primary">Primary Action</Button>
      </EmptyStateFooter>
    </EmptyState>
  </PageSection>
);

export { Debug };
