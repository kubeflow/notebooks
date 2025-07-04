import React from 'react';
import { Alert, List, ListItem } from '@patternfly/react-core';
import { ValidationError } from '~/shared/api/backendApiTypes';

interface ValidationErrorAlertProps {
  title: string;
  errors: ValidationError[];
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
