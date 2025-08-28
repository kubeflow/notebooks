import React from 'react';
import { Bullseye } from '@patternfly/react-core/dist/esm/layouts/Bullseye';
import { Spinner } from '@patternfly/react-core/dist/esm/components/Spinner';

// TODO: simple LoadingSpinner component -- we should improve this later

export const LoadingSpinner: React.FC = () => (
  <Bullseye>
    <Spinner />
  </Bullseye>
);
