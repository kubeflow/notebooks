import React from 'react';
import axios from 'axios';
import { Bullseye } from '@patternfly/react-core/dist/esm/layouts/Bullseye';
import { ExclamationCircleIcon } from '@patternfly/react-icons/dist/esm/icons/exclamation-circle-icon';
import { EmptyState, EmptyStateBody } from '@patternfly/react-core/dist/esm/components/EmptyState';
import { ApiErrorEnvelope } from '~/generated/data-contracts';
import { formatValidationErrorMessages, isApiErrorEnvelope } from '~/shared/api/apiUtils';

interface LoadErrorProps {
  title: string;
  error: Error | ApiErrorEnvelope;
}

function resolveErrorMessage(error: Error | ApiErrorEnvelope): string {
  if (isApiErrorEnvelope(error)) {
    return formatValidationErrorMessages(error).join('\n');
  }
  if (axios.isAxiosError<ApiErrorEnvelope>(error)) {
    const envelope = error.response?.data;
    if (envelope && isApiErrorEnvelope(envelope)) {
      return formatValidationErrorMessages(envelope).join('\n');
    }
  }
  return error.message;
}

export const LoadError: React.FC<LoadErrorProps> = ({ title, error }) => (
  <Bullseye>
    <EmptyState titleText={title} headingLevel="h4" icon={ExclamationCircleIcon} status="danger">
      <EmptyStateBody>{resolveErrorMessage(error)}</EmptyStateBody>
    </EmptyState>
  </Bullseye>
);
