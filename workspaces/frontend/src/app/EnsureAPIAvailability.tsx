import React from 'react';
import { Bullseye } from '@patternfly/react-core/dist/esm/layouts/Bullseye';
import { Spinner } from '@patternfly/react-core/dist/esm/components/Spinner';
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
