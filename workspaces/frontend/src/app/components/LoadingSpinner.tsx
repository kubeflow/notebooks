import * as React from 'react';
import { Bullseye, Spinner } from '@patternfly/react-core';

// TODO: simple LoadingSpinner component -- we should improve this later

export const LoadingSpinner: React.FC = () => (
  <Bullseye>
    <Spinner />
  </Bullseye>
);
