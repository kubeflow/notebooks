import * as React from 'react';
import { Bullseye, Spinner } from '@patternfly/react-core';
import { useNotebookAPI } from './hooks/useNotebookAPI';

interface EnsureAPIAvailabilityProps {
  children: React.ReactNode;
}

const EnsureAPIAvailability: React.FC<EnsureAPIAvailabilityProps> = ({ children }) => {
  const { apiAvailable } = useNotebookAPI();
  if (!apiAvailable) {
    return (
      <Bullseye style={{ minHeight: 150 }}>
        <Spinner />
      </Bullseye>
    );
  }

  return <>{children}</>;
};

export default EnsureAPIAvailability;
