import React from 'react';
import { Alert } from '@patternfly/react-core/dist/esm/components/Alert';
import { Bullseye } from '@patternfly/react-core/dist/esm/layouts/Bullseye';

interface LoadErrorProps {
  error: Error;
}

// TODO: simple LoadError component -- we should improve this later

export const LoadError: React.FC<LoadErrorProps> = ({ error }) => (
  <Bullseye>
    <Alert variant="danger" title="Error loading data">
      Error details: {error.message}
    </Alert>
  </Bullseye>
);
