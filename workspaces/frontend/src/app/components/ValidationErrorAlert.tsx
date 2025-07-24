import React from 'react';
import { Alert } from '@patternfly/react-core/dist/esm/components/Alert';
import { List, ListItem } from '@patternfly/react-core/dist/esm/components/List';
import { ApiValidationError } from '~/generated/data-contracts';

interface ValidationErrorAlertProps {
  title: string;
  errors: ApiValidationError[];
}

export const ValidationErrorAlert: React.FC<ValidationErrorAlertProps> = ({ title, errors }) => {
  if (errors.length === 0) {
    return null;
  }

  return (
    <Alert variant="danger" title={title} isInline>
      <List>
        {errors.map((error, index) => (
          <ListItem key={index}>
            {error.message}: &apos;{error.field}&apos;
          </ListItem>
        ))}
      </List>
    </Alert>
  );
};
