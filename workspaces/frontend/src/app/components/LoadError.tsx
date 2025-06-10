import * as React from 'react';
import { Alert, Bullseye } from '@patternfly/react-core';

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
