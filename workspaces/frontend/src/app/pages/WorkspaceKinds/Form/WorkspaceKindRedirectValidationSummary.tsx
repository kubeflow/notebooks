import React from 'react';
import { Alert } from '@patternfly/react-core/dist/esm/components/Alert';
import { Button } from '@patternfly/react-core/dist/esm/components/Button';
import { List, ListItem } from '@patternfly/react-core/dist/esm/components/List';
import { RedirectValidationError } from './redirectValidation';

interface WorkspaceKindRedirectValidationSummaryProps {
  errors: RedirectValidationError[];
  onEdit?: (error: RedirectValidationError) => void;
}

export const WorkspaceKindRedirectValidationSummary: React.FC<
  WorkspaceKindRedirectValidationSummaryProps
> = ({ errors, onEdit }) => {
  if (!errors.length) {
    return null;
  }
  return (
    <Alert
      variant="danger"
      isInline
      title="Fix invalid redirects before saving"
      data-testid="redirect-validation-summary"
    >
      <List>
        {errors.map((error) => (
          <ListItem key={`${error.optionType}-${error.index}`}>
            {error.optionType === 'imageConfig' ? 'Image' : 'Pod configuration'}: {error.message}{' '}
            {onEdit && (
              <Button
                variant="link"
                isInline
                data-testid={`edit-redirect-${error.optionType}-${error.index}`}
                onClick={() => onEdit(error)}
              >
                Edit {error.sourceId}
              </Button>
            )}
          </ListItem>
        ))}
      </List>
    </Alert>
  );
};
