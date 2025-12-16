import React from 'react';
import { Alert } from '@patternfly/react-core/dist/esm/components/Alert';

type ErrorAlertProps = {
  title: string;
  message: string;
  testId: string;
};

export const ErrorAlert: React.FC<ErrorAlertProps> = ({ title, message, testId }) => (
  <Alert variant="danger" isInline title={title} data-testid={testId}>
    <span data-testid={`${testId}-message`}>Error: {message}</span>
  </Alert>
);
