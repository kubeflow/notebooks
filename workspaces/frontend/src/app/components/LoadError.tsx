import React from 'react';
import { Bullseye } from '@patternfly/react-core/dist/esm/layouts/Bullseye';
import { ExclamationCircleIcon } from '@patternfly/react-icons/dist/esm/icons/exclamation-circle-icon';
import { EmptyState, EmptyStateBody } from '@patternfly/react-core/dist/esm/components/EmptyState';

interface LoadErrorProps {
  title: string;
  error: Error;
}

// TODO: simple LoadError component -- we should improve this later

export const LoadError: React.FC<LoadErrorProps> = ({ title, error }) => (
  <Bullseye>
    <EmptyState titleText={title} headingLevel="h4" icon={ExclamationCircleIcon} status="danger">
      <EmptyStateBody>{error.message}</EmptyStateBody>
    </EmptyState>
  </Bullseye>
);
