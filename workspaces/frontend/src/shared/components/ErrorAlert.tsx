import React from 'react';
import { Alert } from '@patternfly/react-core/dist/esm/components/Alert';
import { List, ListItem } from '@patternfly/react-core/dist/esm/components/List';
import { ApiErrorEnvelope } from '~/generated/data-contracts';
import { formatConflictErrorMessages, formatValidationErrorMessages } from '~/shared/api/apiUtils';

type ErrorAlertProps = {
  title: string;
  content: string | ApiErrorEnvelope;
  testId: string;
};

export const ErrorAlert: React.FC<ErrorAlertProps> = ({ title, content, testId }) => {
  const validationItems = typeof content !== 'string' ? formatValidationErrorMessages(content) : [];
  const conflictItems = typeof content !== 'string' ? formatConflictErrorMessages(content) : [];
  const showFallbackMessage = validationItems.length === 0 && conflictItems.length === 0;

  return (
    <Alert variant="danger" isInline title={title} data-testid={testId}>
      <div data-testid={`${testId}-message`}>
        {typeof content === 'string' ? (
          <>Error: {content}</>
        ) : (
          <>
            <ErrorList items={validationItems} keyPrefix="validation" />
            <ErrorList items={conflictItems} keyPrefix="conflict" />
            {showFallbackMessage && <>Error: {content.error.message}</>}
          </>
        )}
      </div>
    </Alert>
  );
};

type ErrorListProps = {
  items: string[];
  keyPrefix: string;
};

const ErrorList: React.FC<ErrorListProps> = ({ items, keyPrefix }) => {
  if (items.length === 0) {
    return null;
  }

  return (
    <List>
      {items.map((item, index) => (
        <ListItem key={`${keyPrefix}-${index}`}>{item}</ListItem>
      ))}
    </List>
  );
};
