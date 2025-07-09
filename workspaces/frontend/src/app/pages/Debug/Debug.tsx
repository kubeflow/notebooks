import React from 'react';
import { CubesIcon } from '@patternfly/react-icons/dist/esm/icons/cubes-icon';
import { Button } from '@patternfly/react-core/dist/esm/components/Button';
import {
  EmptyState,
  EmptyStateBody,
  EmptyStateVariant,
  EmptyStateFooter,
} from '@patternfly/react-core/dist/esm/components/EmptyState';
import { PageSection } from '@patternfly/react-core/dist/esm/components/Page';

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
