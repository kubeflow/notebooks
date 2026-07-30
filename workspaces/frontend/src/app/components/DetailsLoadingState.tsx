import React from 'react';
import { Spinner } from '@patternfly/react-core/dist/esm/components/Spinner';
import { Content } from '@patternfly/react-core/dist/esm/components/Content';

interface DetailsLoadingStateProps {
  error?: Error;
  loaded: boolean;
  children: React.ReactNode;
}

export const DetailsLoadingState: React.FC<DetailsLoadingStateProps> = ({
  error,
  loaded,
  children,
}) => {
  if (error) {
    return (
      <Content component="small" data-testid="details-loading-error">
        Failed to load details
      </Content>
    );
  }
  if (loaded) {
    return <>{children}</>;
  }
  return <Spinner size="md" data-testid="details-loading-spinner" />;
};
