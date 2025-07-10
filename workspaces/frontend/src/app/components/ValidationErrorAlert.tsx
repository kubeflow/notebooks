import React from 'react';
import { Alert, List, ListItem } from '@patternfly/react-core';
import { ValidationError } from '~/shared/api/backendApiTypes';
import { ErrorEnvelopeException } from '~/shared/api/apiUtils';

interface ValidationErrorAlertProps {
  title: string;
  errors: (ValidationError | ErrorEnvelopeException)[];
}

export const ValidationErrorAlert: React.FC<ValidationErrorAlertProps> = ({ title, errors }) => {
  if (errors.length === 0) {
    return null;
  }

  return (
    <Alert variant="danger" title={title} isInline>
      <List>
        {errors.map((error, index) => (
          <ListItem key={index}>{error.message}</ListItem>
        ))}
      </List>
    </Alert>
  );
};
